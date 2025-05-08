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
    def __init__(self):
        self._initialized = False
        self.blacklist = set()
        self.secret_key = None
        self.algorithm = "HS256"

    def _initialize(self):
        if not self._initialized:
            try:
                self.secret_key = current_app.config.get('JWT_SECRET_KEY', 'default_secret_key_for_development')
                if not self.secret_key:
                    logger.error("JWT_SECRET_KEY not found in Flask app configuration")
                    raise ValueError("JWT_SECRET_KEY not configured")
                self._initialized = True
                logger.info("JWT Manager initialized successfully")
            except Exception as e:
                logger.error(f"Error initializing JWT Manager: {str(e)}")
                raise

    def _get_secret_key(self):
        if not self._initialized:
            self._initialize()
        return self.secret_key

    def create_token(self, payload):
        try:
            if not self._initialized:
                self._initialize()
            # Ensure payload includes expiration and issued-at
            payload = {
                **payload,
                'exp': payload.get('exp', (datetime.utcnow() + timedelta(hours=24)).timestamp()),
                'iat': payload.get('iat', datetime.utcnow().timestamp())
            }
            token = jwt.encode(payload, self._get_secret_key(), algorithm='HS256')
            logger.info("Token created successfully")
            return token
        except Exception as e:
            logger.error(f"Error creating token: {str(e)}")
            raise

    def verify_token(self, token):
        """Vérifie un token JWT et retourne l'ID utilisateur."""
        try:
            if not self._initialized:
                self._initialize()

            logger.info(f"Vérification token (type: {type(token)}): {token[:20]}...")
            
            # Nettoyer le token si nécessaire
            if isinstance(token, str):
                if token.startswith("Bearer "):
                    token = token[7:]
                    logger.info("Préfixe 'Bearer ' retiré")
                elif not token.strip():
                    logger.error("Token vide")
                    return None
            else:
                logger.error(f"Type de token invalide: {type(token)}")
                return None
            
            logger.info(f"Token nettoyé final: {token[:20]}...")
            
            try:
                # Décoder le token
                payload = jwt.decode(
                    token,
                    self._get_secret_key(),
                    algorithms=[self.algorithm],
                    options={"verify_exp": True}
                )
                logger.info("Décodage JWT réussi")
                
                # S'assurer que le payload est un dictionnaire
                if not isinstance(payload, dict):
                    logger.error(f"Payload non-dictionnaire reçu: {type(payload)}")
                    return None

                # Vérifier que le payload contient les champs requis
                if "sub" not in payload:
                    logger.error("Payload ne contient pas de 'sub' (ID utilisateur)")
                    return None

                # Retourner directement l'ID utilisateur
                user_id = payload.get("sub")
                logger.info(f"ID utilisateur extrait du token: {user_id}")
                return user_id
                
            except jwt.ExpiredSignatureError:
                logger.error("Token expiré")
                return None
            except jwt.InvalidTokenError as e:
                logger.error(f"Token invalide: {str(e)}")
                return None
            except Exception as e:
                logger.error(f"Erreur lors du décodage du token: {str(e)}")
                return None
            
        except Exception as e:
            logger.error(f"Erreur lors de la vérification du token: {str(e)}")
            return None

    def blacklist_token(self, token):
        try:
            if token.startswith("Bearer "):
                token = token[7:]
            self.blacklist.add(token)
            logger.info(f"Token blacklisted: {token[:10]}...")
            return True
        except Exception as e:
            logger.error(f"Error blacklisting token: {str(e)}")
            return False

    def get_user_from_token(self, token):
        try:
            user_id = self.verify_token(token)
            user = current_app.mongo.utilisateurs.find_one({"_id": ObjectId(user_id)})
            if user:
                user['_id'] = str(user['_id'])
            return user
        except Exception as e:
            logger.error(f"Erreur lors de la récupération de l'utilisateur depuis le token: {str(e)}")
            return None

    def require_auth(self, roles=None):
        def decorator(f):
            @wraps(f)
            def decorated_function(*args, **kwargs):
                auth_header = request.headers.get("Authorization")
                if not auth_header:
                    return jsonify({"message": "Token d'authentification manquant"}), 401

                try:
                    # Obtenir l'ID de l'utilisateur
                    user_id = self.verify_token(auth_header)
                    
                    # Récupérer l'utilisateur depuis la base de données
                    user = current_app.mongo.utilisateurs.find_one({"_id": ObjectId(user_id)})
                    
                    if not user:
                        return jsonify({"message": "Utilisateur non trouvé"}), 401
                    
                    # Vérifier le rôle si nécessaire
                    if roles and user.get("role") not in roles:
                        return jsonify({"message": "Accès non autorisé"}), 403
                    
                    # Créer le payload à passer à la fonction
                    auth_payload = {
                        "user_id": user_id,
                            
                        "role": user.get("role"),
                        "email": user.get("email")
                    }
                    print(auth_payload)
                    
                    kwargs['auth_payload'] = auth_payload
                    return f(*args, **kwargs)
                except Exception as e:
                    return jsonify({"message": str(e)}), 401
                    
            return decorated_function
        return decorator

# Create a single instance of JWTManager
jwt_manager = JWTManager()