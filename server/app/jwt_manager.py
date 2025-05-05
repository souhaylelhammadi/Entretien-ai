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
        """Vérifie un token JWT et retourne l'ID de l'utilisateur ou None en cas d'erreur"""
        try:
            if not self._initialized:
                self._initialize()
             
            # Log le token pour le debug
            logger.info(f"Vérification token (type: {type(token)}): {token[:20]}..." if isinstance(token, str) else f"Vérification token binaire")
                
            # Gestion des tokens bytes ou avec caractères spéciaux
            if isinstance(token, bytes):
                try:
                    token = token.decode('utf-8')
                    logger.info(f"Token décodé de bytes à str: {token[:20]}...")
                except UnicodeDecodeError as e:
                    logger.warning(f"Décodage UTF-8 échoué: {e}")
                    # Essayer avec latin-1 qui peut décoder n'importe quel octet
                    try:
                        token = token.decode('latin-1')
                        logger.info(f"Token décodé avec latin-1: {token[:20]}...")
                    except Exception as e2:
                        logger.error(f"Échec du décodage latin-1: {e2}")
                        return None
            
            # Vérifier le type du token
            if not isinstance(token, str):
                logger.error(f"Type de token invalide: {type(token)}")
                return None
            
            # Nettoyer le token des caractères qui pourraient être problématiques
            token = token.strip()
            
            # Supprimer les préfixes Bearer en boucle jusqu'à ce qu'il n'y en ait plus
            while token.startswith("Bearer "):
                token = token[7:]
                logger.info("Préfixe 'Bearer ' retiré")
                token = token.strip()
            
            # Cas où Bearer est présent sans espace
            if token.startswith("Bearer") and len(token) > 6:
                token = token[6:]
                logger.info("Préfixe 'Bearer' (sans espace) retiré")
                token = token.strip()
            
            logger.info(f"Token nettoyé final: {token[:20]}...")
            
            # Vérifier si le token est dans la blacklist
            if token in self.blacklist:
                logger.error("Token blacklisté")
                return None
            
            # Vérifier le token
            try:
                payload = jwt.decode(token, self._get_secret_key(), algorithms=["HS256"])
                logger.info("Décodage JWT réussi")
            except jwt.exceptions.DecodeError as e:
                logger.error(f"Erreur de décodage JWT: {e}")
                # Vérifier si le token ressemble à un JWT valide (3 parties séparées par des points)
                if token.count('.') != 2:
                    logger.error(f"Format JWT invalide (doit contenir 3 parties): {token[:10]}...")
                return None
            
            # Vérifier l'expiration
            exp = payload.get("exp")
            if exp and datetime.fromtimestamp(exp) < datetime.utcnow():
                logger.error("Token expiré")
                return None
            
            # Vérifier que le payload contient l'ID utilisateur
            if "sub" not in payload:
                logger.error("Token ne contient pas d'ID utilisateur (sub)")
                return None
                
            return payload.get("sub")  # Retourne l'ID de l'utilisateur
            
        except jwt.ExpiredSignatureError:
            logger.error("Token expiré")
            return None
        except jwt.InvalidTokenError as e:
            logger.error(f"Token invalide: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Erreur de vérification du token: {str(e)}")
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
                    
                    kwargs['auth_payload'] = auth_payload
                    return f(*args, **kwargs)
                except Exception as e:
                    return jsonify({"message": str(e)}), 401
                    
            return decorated_function
        return decorator

# Create a single instance of JWTManager
jwt_manager = JWTManager()