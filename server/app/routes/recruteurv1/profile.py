from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
import logging
from jwt_manager import jwt_manager
from pymongo.errors import PyMongoError
import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

profile_bp = Blueprint("profile", __name__)

# Collections
USERS_COLLECTION = 'utilisateurs'
RECRUTEURS_COLLECTION = 'recruteurs'

# Middleware to require authentication
def require_auth(role):
    def decorator(f):
        def wrapped_function(*args, **kwargs):
            token = request.headers.get("Authorization")
            if not token:
                logger.warning("Jeton manquant")
                return jsonify({"error": "Jeton manquant"}), 401

            try:
                # Vérifier le token et obtenir l'ID de l'utilisateur (sub)
                user_id = jwt_manager.verify_token(token)
                logger.info(f"ID utilisateur extrait du token: {user_id}")
                
                # Récupérer l'utilisateur depuis la base de données par ID
                db = current_app.mongo
                user = db[USERS_COLLECTION].find_one({"_id": ObjectId(user_id)})
                if not user:
                    logger.warning(f"Utilisateur non trouvé pour l'ID: {user_id}")
                    return jsonify({"error": "Utilisateur non trouvé"}), 401
                
                # Vérifier le rôle
                if user.get("role") != role:
                    logger.warning(f"Rôle non autorisé: {user.get('role')}")
                    return jsonify({"error": f"Accès non autorisé. Rôle {role} requis."}), 403
                
                # Si c'est un recruteur, récupérer son profil recruteur
                recruteur = None
                if role == "recruteur":
                    recruteur = db[RECRUTEURS_COLLECTION].find_one({"utilisateur_id": ObjectId(user_id)})
                    if not recruteur:
                        logger.warning(f"Profil recruteur non trouvé pour l'utilisateur: {user_id}")
                        return jsonify({"error": "Profil recruteur non trouvé"}), 404
                
                # Créer le payload à passer à la fonction
                auth_payload = {
                    "sub": user_id,
                    "role": user.get("role"),
                    "email": user.get("email"),
                    "recruteur_id": str(recruteur.get("_id")) if recruteur else None
                }
                logger.info(f"Payload d'authentification créé: {auth_payload}")
                
                return f(auth_payload=auth_payload, *args, **kwargs)
            except Exception as e:
                logger.warning(f"Erreur de vérification du token: {str(e)}")
                return jsonify({"error": str(e)}), 401

        wrapped_function.__name__ = f.__name__
        return wrapped_function
    return decorator

@profile_bp.route("/profile", methods=["GET"])
@require_auth("recruteur")
def get_profile(auth_payload):
    try:
        user_id = auth_payload["sub"]
        recruteur_id = auth_payload["recruteur_id"]
        logger.info(f"Récupération du profil pour l'utilisateur: {user_id} avec ID recruteur: {recruteur_id}")

        db = current_app.mongo
        user = db[USERS_COLLECTION].find_one({"_id": ObjectId(user_id)})
        if not user:
            logger.warning(f"Utilisateur non trouvé: {user_id}")
            return jsonify({"error": "Utilisateur non trouvé"}), 404

        recruteur = db[RECRUTEURS_COLLECTION].find_one({"_id": ObjectId(recruteur_id)})
        if not recruteur:
            logger.warning(f"Profil recruteur non trouvé pour l'ID: {recruteur_id}")
            return jsonify({"error": "Profil recruteur non trouvé"}), 404

        profile_data = {
            "id": str(user.get("_id", "")),
            "recruteur_id": recruteur_id,
            "nom": user.get("nom", ""),
            "email": user.get("email", ""),
            "telephone": user.get("telephone", ""),
            "entreprise_id": str(recruteur.get("entreprise_id", "")),
            "created_at": user.get("created_at", datetime.datetime.utcnow()).isoformat() + "Z",
            "status": recruteur.get("status", "active"),
            "entreprise": user.get("entreprise", {})
        }

        logger.info(f"Profil récupéré avec succès pour l'utilisateur: {user_id}")
        return jsonify(profile_data), 200

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans /profile: {str(e)}")
        return jsonify({"error": "Erreur de base de données"}), 500
    except Exception as e:
        logger.error(f"Erreur dans /profile: {str(e)}")
        return jsonify({"error": f"Erreur serveur: {str(e)}"}), 500

@profile_bp.route("/profile", methods=["PUT"])
@require_auth("recruteur")
def update_profile(auth_payload):
    try:
        user_id = auth_payload["sub"]
        recruteur_id = auth_payload["recruteur_id"]
        data = request.get_json()
        logger.info(f"Mise à jour du profil pour l'utilisateur: {user_id} avec ID recruteur: {recruteur_id}")

        if not data:
            logger.warning("Données manquantes pour la mise à jour du profil")
            return jsonify({"error": "Données manquantes"}), 400

        db = current_app.mongo
        
        # Champs autorisés à mettre à jour pour l'utilisateur
        user_update_data = {}
        if "nom" in data:
            user_update_data["nom"] = str(data["nom"])
        if "telephone" in data:
            user_update_data["telephone"] = str(data["telephone"])
        if "entreprise" in data and isinstance(data["entreprise"], dict):
            user_update_data["entreprise"] = data["entreprise"]

        if user_update_data:
            result = db[USERS_COLLECTION].update_one(
                {"_id": ObjectId(user_id)},
                {"$set": user_update_data}
            )
            logger.info(f"Utilisateur mis à jour: {result.modified_count} documents modifiés")

        # Champs autorisés à mettre à jour pour le recruteur
        recruteur_update = {}
        if "entreprise_id" in data and ObjectId.is_valid(data["entreprise_id"]):
            recruteur_update["entreprise_id"] = ObjectId(data["entreprise_id"])
        if "status" in data:
            recruteur_update["status"] = str(data["status"])

        if recruteur_update:
            result = db[RECRUTEURS_COLLECTION].update_one(
                {"_id": ObjectId(recruteur_id)},
                {"$set": recruteur_update}
            )
            logger.info(f"Recruteur mis à jour: {result.modified_count} documents modifiés")

        # Récupérer les données mises à jour
        user = db[USERS_COLLECTION].find_one({"_id": ObjectId(user_id)})
        recruteur = db[RECRUTEURS_COLLECTION].find_one({"_id": ObjectId(recruteur_id)})
        
        profile_data = {
            "id": str(user.get("_id", "")),
            "recruteur_id": recruteur_id,
            "nom": user.get("nom", ""),
            "email": user.get("email", ""),
            "telephone": user.get("telephone", ""),
            "entreprise_id": str(recruteur.get("entreprise_id", "")),
            "created_at": user.get("created_at", datetime.datetime.utcnow()).isoformat() + "Z",
            "status": recruteur.get("status", "active"),
            "entreprise": user.get("entreprise", {})
        }

        logger.info(f"Profil mis à jour avec succès pour l'utilisateur: {user_id}")
        return jsonify({
            "message": "Profil mis à jour avec succès",
            "profile": profile_data
        }), 200

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans PUT /profile: {str(e)}")
        return jsonify({"error": "Erreur de base de données"}), 500
    except Exception as e:
        logger.error(f"Erreur dans PUT /profile: {str(e)}")
        return jsonify({"error": f"Erreur serveur: {str(e)}"}), 500