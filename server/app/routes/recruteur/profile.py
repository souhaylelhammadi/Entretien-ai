from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
import logging
from middleware import require_auth

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

profile_bp = Blueprint("profile", __name__)

@profile_bp.route("/profile", methods=["GET"])
@require_auth(role="recruteur")
def get_profile(auth_payload):
    """Retrieve the recruiter profile"""
    try:
        user_id = auth_payload.get('sub')
        if not user_id:
            logger.warning("No user_id found in auth_payload")
            return jsonify({"message": "Utilisateur non authentifié"}), 401

        logger.info(f"Retrieving profile for user: {user_id}")

        # Retrieve user from database
        user = current_app.mongo.db.utilisateurs.find_one({"_id": ObjectId(user_id)})
        if not user:
            logger.warning(f"User not found: {user_id}")
            return jsonify({"message": "Utilisateur non trouvé"}), 404

        # Retrieve recruiter profile
        recruteur = current_app.mongo.db.recruteurs.find_one({"utilisateur_id": ObjectId(user_id)})
        if not recruteur:
            logger.warning(f"Recruiter profile not found for user: {user_id}")
            return jsonify({"message": "Profil recruteur non trouvé"}), 404

        # Build response
        profile_data = {
            "id": str(user.get("_id", "")),
            "nom": user.get("nom", ""),
            "email": user.get("email", ""),
            "telephone": user.get("telephone", ""),
            "entreprise_id": str(recruteur.get("entreprise_id", "")),
            "created_at": user.get("created_at", "").isoformat() if user.get("created_at") else "",
            "status": recruteur.get("status", "active")
        }

        logger.info(f"Profile retrieved successfully for user: {user_id}")
        return jsonify(profile_data), 200

    except ValueError as e:
        logger.error(f"Invalid ObjectId: {str(e)}")
        return jsonify({"message": "ID utilisateur invalide"}), 400
    except Exception as e:
        logger.error(f"Error retrieving profile: {str(e)}")
        return jsonify({"message": "Erreur serveur"}), 500

@profile_bp.route("/profile", methods=["PUT"])
@require_auth(role="recruteur")
def update_profile(auth_payload):
    """Update the recruiter profile"""
    try:
        user_id = auth_payload.get('sub')
        if not user_id:
            logger.warning("No user_id found in auth_payload")
            return jsonify({"message": "Utilisateur non authentifié"}), 401

        data = request.get_json()
        logger.info(f"Updating profile for user: {user_id}")

        if not data:
            logger.warning("No data provided for profile update")
            return jsonify({"message": "Données manquantes"}), 400

        # Validate and prepare user updates
        update_data = {}
        if "nom" in data and isinstance(data["nom"], str):
            update_data["nom"] = data["nom"]
        if "telephone" in data and isinstance(data["telephone"], str):
            update_data["telephone"] = data["telephone"]

        # Update user if there are changes
        if update_data:
            result = current_app.mongo.db.utilisateurs.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": update_data}
            )
            if result.matched_count == 0:
                logger.warning(f"User not found for update: {user_id}")
                return jsonify({"message": "Utilisateur non trouvé"}), 404

        # Validate and prepare recruiter updates
        recruteur_update = {}
        if "entreprise_id" in data and isinstance(data["entreprise_id"], str):
            try:
                recruteur_update["entreprise_id"] = ObjectId(data["entreprise_id"])
            except ValueError:
                logger.warning(f"Invalid entreprise_id: {data['entreprise_id']}")
                return jsonify({"message": "ID entreprise invalide"}), 400

        # Update recruiter if there are changes
        if recruteur_update:
            result = current_app.mongo.db.recruteurs.update_one(
                {"utilisateur_id": ObjectId(user_id)},
                {"$set": recruteur_update}
            )
            if result.matched_count == 0:
                logger.warning(f"Recruiter profile not found for update: {user_id}")
                return jsonify({"message": "Profil recruteur non trouvé"}), 404

        logger.info(f"Profile updated successfully for user: {user_id}")
        return jsonify({"message": "Profil mis à jour avec succès"}), 200

    except ValueError as e:
        logger.error(f"Invalid ObjectId: {str(e)}")
        return jsonify({"message": "ID utilisateur ou entreprise invalide"}), 400
    except Exception as e:
        logger.error(f"Error updating profile: {str(e)}")
        return jsonify({"message": "Erreur serveur"}), 500