from datetime import datetime, timedelta
import jwt
from flask import current_app, request, jsonify
from functools import wraps
import logging
from bson import ObjectId

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class JWTManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(JWTManager, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if not self._initialized:
            self._initialized = True
            self.blacklist = set()

    def _get_config(self):
        """Get configuration from current_app when needed."""
        return {
            "secret_key": current_app.config["JWT_SECRET_KEY"],
            "algorithm": "HS256",
            "token_expiration": timedelta(hours=int(current_app.config["JWT_EXPIRES_IN_HOURS"]))
        }

    def create_token(self, user_id, role):
        """Create a new JWT token."""
        try:
            config = self._get_config()
            payload = {
                "sub": str(user_id),
                "role": role,
                "iat": datetime.utcnow(),
                "exp": datetime.utcnow() + config["token_expiration"]
            }
            token = jwt.encode(payload, config["secret_key"], algorithm=config["algorithm"])
            return token
        except Exception as e:
            logger.error(f"Erreur lors de la création du token: {str(e)}")
            raise

    def verify_token(self, token):
        """Verify a JWT token and return the payload if valid."""
        try:
            if not token:
                logger.warning("Token manquant")
                return None

            if token.startswith("Bearer "):
                token = token.split(" ")[1]

            config = self._get_config()
            payload = jwt.decode(token, config["secret_key"], algorithms=[config["algorithm"]])
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("Token expiré")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"Token invalide: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Erreur lors de la vérification du token: {str(e)}")
            return None

    def blacklist_token(self, token):
        """Add a token to the blacklist."""
        try:
            if token.startswith("Bearer "):
                token = token.split(" ")[1]
            payload = self.verify_token(token)
            if not payload:
                logger.warning("Token invalide pour mise en liste noire")
                return False
            current_app.mongo.db.blacklisted_tokens.insert_one({
                'token': token,
                'user_id': payload['sub'],
                'exp': payload['exp'],
                'blacklisted_at': datetime.utcnow()
            })
            logger.info(f"Token blacklisté pour l'utilisateur ID {payload['sub']}")
            return True
        except Exception as e:
            logger.error(f"Erreur lors de la mise en liste noire du token: {str(e)}")
            return False

    def get_user_from_token(self, token):
        """Get user data from a token."""
        payload = self.verify_token(token)
        if not payload:
            return None
        try:
            user = current_app.mongo.db.utilisateurs.find_one({"_id": ObjectId(payload['sub'])})
            if user:
                user['_id'] = str(user['_id'])
            return user
        except Exception as e:
            logger.error(f"Erreur lors de la récupération de l'utilisateur depuis le token: {str(e)}")
            return None

    def require_auth(self, role=None):
        """Decorator to require authentication."""
        def decorator(f):
            @wraps(f)
            def decorated(*args, **kwargs):
                try:
                    token = request.headers.get("Authorization")
                    if not token:
                        logger.warning("Token manquant dans les headers")
                        return jsonify({"message": "Token manquant"}), 401

                    payload = self.verify_token(token)
                    if not payload:
                        logger.warning("Token invalide ou expiré")
                        return jsonify({"message": "Token invalide ou expiré"}), 401

                    if role and payload.get("role") != role:
                        logger.warning(f"Rôle invalide: {payload.get('role')}")
                        return jsonify({"message": "Accès non autorisé"}), 403

                    request.user = payload
                    return f(payload, *args, **kwargs)
                except Exception as e:
                    logger.error(f"Erreur d'authentification: {str(e)}")
                    return jsonify({"message": "Erreur d'authentification"}), 401
            return decorated
        return decorator

    def log_auth_event(self, user_id, event_type, success=True, **kwargs):
        """Log an authentication-related event."""
        try:
            current_app.mongo.db.auth_logs.insert_one({
                'user_id': user_id,
                'event_type': event_type,
                'success': success,
                'timestamp': datetime.utcnow(),
                'ip_address': request.remote_addr,
                'user_agent': request.headers.get('User-Agent'),
                **kwargs
            })
        except Exception as e:
            logger.error(f"Erreur lors de l'enregistrement de l'événement d'authentification: {str(e)}")

# Create a single instance of JWTManager
jwt_manager = JWTManager()