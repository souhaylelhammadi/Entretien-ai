from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from pydantic import BaseModel, validator, Field
from typing import List, Optional, Dict
import logging
from flask_cors import cross_origin
from datetime import datetime
import re
from app.auth.jwt_manager import jwt_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

profile_bp = Blueprint("profile", __name__, url_prefix="/api/profile")

# Pydantic models for data validation
class RecruiterProfile(BaseModel):
    """Model for recruiter profile data"""
    firstName: str
    lastName: str
    email: str
    phone: Optional[str] = None
    position: Optional[str] = None
    department: Optional[str] = None
    entreprise_id: str
    bio: Optional[str] = None
    linkedin: Optional[str] = None
    availability: Optional[Dict[str, List[str]]] = None
    notification_preferences: Optional[Dict[str, bool]] = None
    profile_picture: Optional[str] = None
    
    @validator('email')
    def email_must_be_valid(cls, v):
        if not re.match(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", v):
            raise ValueError('Invalid email format')
        return v
    
    @validator('phone')
    def phone_must_be_valid(cls, v):
        if v and not re.match(r"^\+?[0-9\s\-\(\)]+$", v):
            raise ValueError('Invalid phone number format')
        return v
    
    @validator('linkedin')
    def linkedin_must_be_valid(cls, v):
        if v and not v.startswith(('https://www.linkedin.com/', 'https://linkedin.com/')):
            raise ValueError('LinkedIn URL must start with https://www.linkedin.com/ or https://linkedin.com/')
        return v

class ProfileUpdateRequest(BaseModel):
    """Model for profile update requests"""
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    department: Optional[str] = None
    bio: Optional[str] = None
    linkedin: Optional[str] = None
    availability: Optional[Dict[str, List[str]]] = None
    notification_preferences: Optional[Dict[str, bool]] = None
    profile_picture: Optional[str] = None

def get_user_from_token(token):
    """Extract user information from JWT token."""
    # Import the function from Offres.py to avoid code duplication
    from server.app.routes.recruteur.Offres_recruteur import get_user_from_token as get_user
    return get_user(token)
    
@profile_bp.route("/", methods=["GET"])
@jwt_manager.require_auth(role="recruteur")
def get_profile(payload):
    """Get recruiter profile information."""
    try:
        user_id = payload["sub"]
        user = current_app.mongo.db.utilisateurs.find_one({"_id": ObjectId(user_id)})
        
        if not user:
            logger.warning(f"Utilisateur introuvable: {user_id}")
            return jsonify({"message": "Utilisateur non trouvé"}), 404

        profile_data = {
            "id": str(user["_id"]),
            "nom": user["nom"],
            "email": user["email"],
            "telephone": user["telephone"],
            "role": user["role"]
        }

        if user["role"] == "recruteur":
            recruteur = current_app.mongo.db.recruteurs.find_one({"utilisateur_id": ObjectId(user_id)})
            if recruteur:
                profile_data["poste"] = recruteur.get("poste", "")
                profile_data["entreprise_id"] = str(recruteur.get("entreprise_id", ""))
                
                entreprise = current_app.mongo.db.entreprises.find_one({"_id": recruteur.get("entreprise_id")})
                if entreprise:
                    profile_data["entreprise"] = {
                        "id": str(entreprise["_id"]),
                        "nom": entreprise["nom"],
                        "secteur": entreprise.get("secteur", ""),
                        "taille": entreprise.get("taille", "")
                    }

        return jsonify(profile_data), 200

    except Exception as e:
        logger.error(f"Erreur lors de la récupération du profil: {str(e)}")
        return jsonify({"message": "Erreur serveur"}), 500

@profile_bp.route("/", methods=["PUT"])
@jwt_manager.require_auth(role="recruteur")
def update_profile(auth_payload):
    """Update recruiter profile information."""
    try:
        data = request.get_json()
        db = current_app.mongo.db
        recruiter_id = auth_payload['sub']

        # Validate allowed fields
        allowed_fields = ['firstName', 'lastName', 'telephone', 'entreprise']
        update_data = {k: v for k, v in data.items() if k in allowed_fields and v}

        if not update_data:
            return jsonify({"error": "Aucune donnée à mettre à jour"}), 400

        result = db.utilisateurs.update_one(
            {"_id": ObjectId(recruiter_id)},
            {"$set": update_data}
        )

        if result.modified_count == 0:
            return jsonify({"error": "Aucune modification effectuée"}), 400

        return jsonify({"message": "Profil mis à jour avec succès"}), 200

    except Exception as e:
        logger.error(f"Error updating recruiter profile: {str(e)}")
        return jsonify({"error": "Erreur serveur lors de la mise à jour du profil"}), 500

@profile_bp.route("/password", methods=["PUT"])
@jwt_manager.require_auth(role="recruteur")
def update_password(auth_payload):
    """Update recruiter password."""
    try:
        data = request.get_json()
        if not data or 'currentPassword' not in data or 'newPassword' not in data:
            return jsonify({"error": "Mot de passe actuel et nouveau mot de passe requis"}), 400

        db = current_app.mongo.db
        recruiter_id = auth_payload['sub']

        recruiter = db.utilisateurs.find_one({"_id": ObjectId(recruiter_id)})
        if not recruiter:
            return jsonify({"error": "Recruteur non trouvé"}), 404

        if recruiter['password'] != data['currentPassword']:
            return jsonify({"error": "Mot de passe actuel incorrect"}), 401

        result = db.utilisateurs.update_one(
            {"_id": ObjectId(recruiter_id)},
            {"$set": {"password": data['newPassword']}}
        )

        if result.modified_count == 0:
            return jsonify({"error": "Aucune modification effectuée"}), 400

        return jsonify({"message": "Mot de passe mis à jour avec succès"}), 200

    except Exception as e:
        logger.error(f"Error updating password: {str(e)}")
        return jsonify({"error": "Erreur serveur lors de la mise à jour du mot de passe"}), 500

@profile_bp.route("/entreprise", methods=["GET"])
@cross_origin()
@jwt_manager.require_auth(role="recruteur")
def get_entreprise(auth_payload):
    """
    Route pour récupérer les informations de l'entreprise du recruteur authentifié
    """
    try:
        # L'utilisateur est déjà authentifié via le décorateur recruiter_only
        user_id = auth_payload['sub']
        
        # Récupérer l'utilisateur depuis la base de données
        user = current_app.mongo.db.utilisateurs.find_one({"_id": ObjectId(user_id)})
        
        if not user:
            logger.warning(f"Utilisateur non trouvé pour la récupération d'entreprise: {user_id}")
            return jsonify({"error": "Utilisateur non trouvé"}), 404
            
        # Vérifier si l'entreprise existe déjà
        entreprise_id = user.get("entreprise_id")
        if not entreprise_id:
            logger.warning(f"Entreprise non associée à l'utilisateur: {user_id}")
            return jsonify({"error": "Aucune entreprise associée à ce compte"}), 404
            
        # Récupérer les détails de l'entreprise
        entreprise = current_app.mongo.db.entreprises.find_one({"_id": ObjectId(entreprise_id)})
        
        if not entreprise:
            logger.warning(f"Entreprise non trouvée pour l'ID: {entreprise_id}")
            return jsonify({"error": "Entreprise non trouvée"}), 404
            
        # Convertir l'ObjectId en chaîne pour la sérialisation JSON
        entreprise["_id"] = str(entreprise["_id"])
        
        logger.info(f"Récupération des informations d'entreprise réussie pour l'utilisateur: {user_id}")
        return jsonify({
            "success": True,
            "entreprise": entreprise
        }), 200
        
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des informations d'entreprise: {str(e)}", exc_info=True)
        return jsonify({"error": "Erreur serveur", "details": str(e)}), 500

@profile_bp.route("/entreprise", methods=["PUT"])
@cross_origin()
@jwt_manager.require_auth(role="recruteur")
def update_entreprise(auth_payload):
    """
    Route pour mettre à jour les informations de l'entreprise du recruteur authentifié
    """
    try:
        # L'utilisateur est déjà authentifié via le décorateur recruiter_only
        user_id = auth_payload['sub']
        
        # Récupérer les données du corps de la requête
        data = request.get_json()
        
        if not data:
            logger.warning(f"Données manquantes pour la mise à jour de l'entreprise: {user_id}")
            return jsonify({"error": "Données manquantes"}), 400
            
        # Récupérer l'utilisateur depuis la base de données
        user = current_app.mongo.db.utilisateurs.find_one({"_id": ObjectId(user_id)})
        
        if not user:
            logger.warning(f"Utilisateur non trouvé pour la mise à jour d'entreprise: {user_id}")
            return jsonify({"error": "Utilisateur non trouvé"}), 404
            
        # Vérifier si l'entreprise existe
        entreprise_id = user.get("entreprise_id")
        if not entreprise_id:
            # Créer une nouvelle entreprise
            new_entreprise = {
                "nom": data.get("nom", ""),
                "description": data.get("description", ""),
                "site_web": data.get("site_web", ""),
                "industrie": data.get("industrie", ""),
                "taille": data.get("taille", ""),
                "adresse": data.get("adresse", ""),
                "ville": data.get("ville", ""),
                "pays": data.get("pays", ""),
                "logo_url": data.get("logo_url", ""),
                "date_creation": datetime.utcnow(),
                "date_maj": datetime.utcnow()
            }
            
            # Insérer la nouvelle entreprise dans la base de données
            result = current_app.mongo.db.entreprises.insert_one(new_entreprise)
            new_entreprise_id = result.inserted_id
            
            # Associer l'entreprise à l'utilisateur
            current_app.mongo.db.utilisateurs.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"entreprise_id": new_entreprise_id}}
            )
            
            logger.info(f"Nouvelle entreprise créée pour l'utilisateur: {user_id}")
            return jsonify({
                "success": True,
                "message": "Entreprise créée avec succès",
                "entreprise_id": str(new_entreprise_id)
            }), 201
            
        else:
            # Mettre à jour l'entreprise existante
            update_data = {}
            
            # Vérifier et ajouter chaque champ s'il est présent
            fields = ["nom", "description", "site_web", "industrie", "taille", 
                     "adresse", "ville", "pays", "logo_url"]
                     
            for field in fields:
                if field in data:
                    update_data[field] = data[field]
                    
            # Ajouter la date de mise à jour
            update_data["date_maj"] = datetime.utcnow()
            
            # Mettre à jour l'entreprise dans la base de données
            result = current_app.mongo.db.entreprises.update_one(
                {"_id": ObjectId(entreprise_id)},
                {"$set": update_data}
            )
            
            if result.modified_count == 0 and len(update_data) > 1:  # > 1 car on a au moins date_maj
                logger.warning(f"Aucune modification apportée à l'entreprise: {entreprise_id}")
                return jsonify({
                    "success": True,
                    "message": "Aucune modification apportée à l'entreprise"
                }), 200
                
            logger.info(f"Entreprise mise à jour avec succès pour l'utilisateur: {user_id}")
            return jsonify({
                "success": True,
                "message": "Entreprise mise à jour avec succès",
                "updated_fields": list(update_data.keys())
            }), 200
            
    except Exception as e:
        logger.error(f"Erreur lors de la mise à jour de l'entreprise: {str(e)}", exc_info=True)
        return jsonify({"error": "Erreur serveur", "details": str(e)}), 500

@profile_bp.route("/profile", methods=["GET"])
def get_recruiter_profile(payload):
    """Get recruiter profile with detailed information."""
    try:
        if payload["role"] != "recruteur":
            logger.warning(f"Accès non autorisé: {payload['role']}")
            return jsonify({"message": "Accès non autorisé"}), 403

        user_id = payload["sub"]
        user = current_app.mongo.db.utilisateurs.find_one({"_id": ObjectId(user_id)})
        
        if not user:
            logger.warning(f"Utilisateur introuvable: {user_id}")
            return jsonify({"message": "Utilisateur non trouvé"}), 404

        recruteur = current_app.mongo.db.recruteurs.find_one({"utilisateur_id": ObjectId(user_id)})
        if not recruteur:
            logger.warning(f"Profil recruteur introuvable pour l'utilisateur: {user_id}")
            return jsonify({"message": "Profil recruteur non trouvé"}), 404

        entreprise = current_app.mongo.db.entreprises.find_one({"_id": recruteur.get("entreprise_id")})
        if not entreprise:
            logger.warning(f"Entreprise introuvable pour le recruteur: {user_id}")
            return jsonify({"message": "Entreprise non trouvée"}), 404

        # Get recruiter's job offers
        offres = list(current_app.mongo.db.offres.find(
            {"_id": {"$in": recruteur.get("offres_ids", [])}},
            {"_id": 1, "titre": 1, "description": 1, "date_creation": 1, "status": 1}
        ))

        profile_data = {
            "id": str(user["_id"]),
            "nom": user["nom"],
            "email": user["email"],
            "telephone": user["telephone"],
            "poste": recruteur.get("poste", "Recruteur"),
            "entreprise": {
                "id": str(entreprise["_id"]),
                "nom": entreprise["nom"],
                "secteur": entreprise.get("secteur", ""),
                "taille": entreprise.get("taille", ""),
                "description": entreprise.get("description", ""),
                "adresse": entreprise.get("adresse", ""),
                "site_web": entreprise.get("site_web", "")
            },
            "offres": [{
                "id": str(offre["_id"]),
                "titre": offre["titre"],
                "description": offre["description"],
                "date_creation": offre["date_creation"],
                "status": offre["status"]
            } for offre in offres],
            "statistiques": {
                "total_offres": len(offres),
                "offres_actives": len([o for o in offres if o["status"] == "active"]),
                "offres_cloturees": len([o for o in offres if o["status"] == "closed"])
            }
        }

        return jsonify(profile_data), 200

    except Exception as e:
        logger.error(f"Erreur lors de la récupération du profil recruteur: {str(e)}")
        return jsonify({"message": "Erreur serveur"}), 500 