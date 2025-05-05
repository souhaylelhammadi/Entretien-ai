from flask import request, jsonify, current_app
from functools import wraps
from jwt_manager import jwt_manager
import logging
from bson import ObjectId

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def require_auth(role=None):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                # Vérifier la présence du token
                auth_header = request.headers.get('Authorization')
                if not auth_header:
                    logger.warning("Token d'authentification manquant")
                    return jsonify({"message": "Token d'authentification manquant"}), 401

                # Vérifier le jeton avec jwt_manager
                try:
                    user_id = jwt_manager.verify_token(auth_header)
                except Exception as e:
                    logger.warning(f"Erreur de vérification du jeton: {str(e)}")
                    return jsonify({"message": str(e)}), 401

                # Rechercher l'utilisateur dans la base de données
                user = current_app.mongo.db.utilisateurs.find_one({"_id": ObjectId(user_id)})
                if not user:
                    logger.warning(f"Utilisateur non trouvé pour l'ID: {user_id}")
                    return jsonify({"message": "Utilisateur non trouvé, veuillez vous reconnecter"}), 401

                # Vérifier le rôle si spécifié
                if role and user.get('role') != role:
                    logger.warning(f"Rôle invalide: {user.get('role')} au lieu de {role}")
                    return jsonify({"message": "Accès non autorisé"}), 403

                # Ajouter les informations d'authentification aux arguments
                auth_payload = {
                    'sub': user_id,
                    'email': user['email'],
                    'role': user['role'],
                    'entreprise': user['entreprise']
                }
                

                kwargs['auth_payload'] = auth_payload
                return f(*args, **kwargs)

            except Exception as e:
                logger.error(f"Erreur d'authentification: {str(e)}")
                return jsonify({"message": "Erreur d'authentification"}), 500

        return decorated_function
    return decorator