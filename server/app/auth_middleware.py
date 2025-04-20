from flask import request, jsonify
from functools import wraps
from auth import verify_token
import logging

logger = logging.getLogger(__name__)

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if "Authorization" in request.headers:
            try:
                token = request.headers["Authorization"].split(" ")[1]
            except IndexError:
                logger.warning(f"Format d'en-tête Authorization invalide: {request.headers.get('Authorization')}")
                return jsonify({"error": "Format de jeton invalide"}), 401

        if not token:
            logger.warning("Aucun jeton fourni")
            return jsonify({"error": "Jeton requis"}), 401

        try:
            data = verify_token(token)
            request.user = {"id": data["id"], "role": data["role"]}
            logger.info(f"Utilisateur authentifié: {request.user['id']}")
        except ValueError as e:
            logger.warning(f"Échec de l'authentification: {str(e)}")
            return jsonify({"error": str(e)}), 401
        except Exception as e:
            logger.error(f"Erreur lors de la vérification du jeton: {str(e)}")
            return jsonify({"error": "Erreur serveur lors de l'authentification", "details": str(e)}), 500

        return f(*args, **kwargs)
    return decorated