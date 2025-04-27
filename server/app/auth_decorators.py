from flask import request, jsonify, current_app
from functools import wraps
from .auth import verify_token
import logging
from bson import ObjectId

logger = logging.getLogger(__name__)

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization")
        if not token:
            logger.warning("Jeton manquant")
            return jsonify({"error": "Jeton requis"}), 401

        try:
            if token.startswith("Bearer "):
                token = token.split(" ")[1]

            data = verify_token(token)
            if not data:
                logger.warning("Jeton invalide ou expiré")
                return jsonify({"error": "Jeton invalide ou expiré"}), 401

            request.user = {"id": data["id"], "role": data["role"]}

            if data["role"] == "recruteur":
                user = current_app.mongo.db.utilisateurs.find_one({"_id": ObjectId(data["id"])})
                if not user:
                    logger.warning(f"Utilisateur introuvable: {data['id']}")
                    return jsonify({"error": "Compte utilisateur non trouvé"}), 401

                recruteur = current_app.mongo.db.recruteurs.find_one({"utilisateur_id": ObjectId(data["id"])})
                if not recruteur:
                    logger.warning(f"Profil recruteur introuvable: {data['id']}")
                    return jsonify({"error": "Profil recruteur non trouvé"}), 403

                request.user["data"] = user

            logger.info(f"Utilisateur authentifié: {request.user['id']} avec rôle {request.user['role']}")
        except Exception as e:
            logger.error(f"Erreur de vérification du jeton: {str(e)}")
            return jsonify({"error": "Erreur serveur lors de l'authentification", "details": str(e)}), 500

        return f(*args, **kwargs)
    return decorated

def require_role(role):
    def decorator(f):
        @wraps(f)
        @require_auth
        def decorated_function(*args, **kwargs):
            if request.user["role"] != role:
                logger.warning(f"Accès refusé: {request.user['id']} avec rôle {request.user['role']} pour rôle {role}")
                return jsonify({"error": f"Accès réservé aux {role}s"}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def recruiter_only(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if request.method == "OPTIONS":
            return f(*args, **kwargs)

        token = request.headers.get("Authorization")
        if not token:
            logger.warning("Jeton manquant")
            return jsonify({"error": "Jeton requis"}), 401

        try:
            if token.startswith("Bearer "):
                token = token.split(" ")[1]

            data = verify_token(token)
            if not data:
                logger.warning("Jeton invalide ou expiré")
                return jsonify({"error": "Jeton invalide ou expiré"}), 401

            request.user = {"id": data["id"], "role": data["role"]}
            if request.user["role"] != "recruteur":
                logger.warning(f"Accès refusé: {request.user['id']} avec rôle {request.user['role']}")
                return jsonify({"error": "Accès réservé aux recruteurs"}), 403

            user = current_app.mongo.db.utilisateurs.find_one({"_id": ObjectId(data["id"])})
            if not user:
                logger.warning(f"Utilisateur introuvable: {data['id']}")
                return jsonify({"error": "Compte utilisateur non trouvé"}), 401

            request.user["data"] = user

            logger.info(f"Utilisateur authentifié: {request.user['id']} avec rôle {request.user['role']}")
        except Exception as e:
            logger.error(f"Erreur de vérification du jeton: {str(e)}")
            return jsonify({"error": "Erreur serveur lors de l'authentification", "details": str(e)}), 500

        return f(*args, **kwargs)
    return decorated_function