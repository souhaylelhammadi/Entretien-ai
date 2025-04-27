from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from auth_middleware import require_auth
from pydantic import BaseModel, validator, Field
from typing import List, Optional, Dict
import logging
from flask_cors import cross_origin
from datetime import datetime
import re
from app.auth_middleware import recruiter_only

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

profile_bp = Blueprint("profile", __name__, url_prefix="/api/recruteur")

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
    from app.routes.recruteur.Offres import get_user_from_token as get_user
    return get_user(token)
    
@profile_bp.route("/profile", methods=["GET"])
@cross_origin()
@recruiter_only
def get_profile():
    """
    Route pour récupérer le profil du recruteur authentifié
    """
    try:
        # L'utilisateur est déjà authentifié via le décorateur recruiter_only
        user_id = request.user['id']
        
        # Récupérer les données de l'utilisateur
        user = current_app.mongo.db.utilisateurs.find_one({"_id": ObjectId(user_id)})
        
        if not user:
            logger.warning(f"Utilisateur non trouvé avec ID: {user_id}")
            return jsonify({"error": "Utilisateur non trouvé"}), 404
            
        # Formater la réponse
        profile_data = {
            "id": str(user["_id"]),
            "nom": user.get("nom", ""),
            "prenom": user.get("prenom", ""),
            "email": user.get("email", ""),
            "telephone": user.get("telephone", ""),
            "entreprise": user.get("entreprise", ""),
            "poste": user.get("poste", ""),
            "photo": user.get("photo", ""),
            "date_inscription": user.get("date_inscription", datetime.utcnow()).isoformat()
        }
        
        # Ajouter des champs supplémentaires si présents
        if "adresse" in user:
            profile_data["adresse"] = user["adresse"]
            
        if "preferences" in user:
            profile_data["preferences"] = user["preferences"]
            
        logger.info(f"Profil récupéré avec succès pour l'utilisateur: {user_id}")
        return jsonify({"success": True, "profile": profile_data}), 200
        
    except Exception as e:
        logger.error(f"Erreur lors de la récupération du profil: {str(e)}", exc_info=True)
        return jsonify({"error": "Erreur serveur", "details": str(e)}), 500

@profile_bp.route("/profile", methods=["PUT"])
@cross_origin()
@recruiter_only
def update_profile():
    """
    Route pour mettre à jour le profil du recruteur authentifié
    """
    try:
        # L'utilisateur est déjà authentifié via le décorateur recruiter_only
        user_id = request.user['id']
        
        # Récupérer les données du corps de la requête
        data = request.get_json()
        
        if not data:
            logger.warning(f"Données manquantes pour la mise à jour du profil: {user_id}")
            return jsonify({"error": "Données manquantes"}), 400
            
        # Préparer les données à mettre à jour
        update_data = {}
        
        # Champs autorisés à être mis à jour
        allowed_fields = [
            "nom", "prenom", "telephone", "entreprise", "poste", 
            "photo", "adresse", "preferences"
        ]
        
        for field in allowed_fields:
            if field in data:
                update_data[field] = data[field]
                
        # Ajouter la date de mise à jour
        update_data["date_maj"] = datetime.utcnow()
        
        # Effectuer la mise à jour
        result = current_app.mongo.db.utilisateurs.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            logger.warning(f"Aucune modification apportée au profil: {user_id}")
            return jsonify({"warning": "Aucune modification apportée"}), 200
            
        logger.info(f"Profil mis à jour avec succès pour l'utilisateur: {user_id}")
        return jsonify({
            "success": True, 
            "message": "Profil mis à jour avec succès",
            "updated_fields": list(update_data.keys())
        }), 200
        
    except Exception as e:
        logger.error(f"Erreur lors de la mise à jour du profil: {str(e)}", exc_info=True)
        return jsonify({"error": "Erreur serveur", "details": str(e)}), 500

@profile_bp.route("/change-password", methods=["POST"])
@cross_origin()
@recruiter_only
def change_password():
    """
    Route pour modifier le mot de passe du recruteur authentifié
    """
    try:
        # L'utilisateur est déjà authentifié via le décorateur recruiter_only
        user_id = request.user['id']
        
        # Récupérer les données du corps de la requête
        data = request.get_json()
        
        if not data:
            logger.warning(f"Données manquantes pour le changement de mot de passe: {user_id}")
            return jsonify({"error": "Données manquantes"}), 400
            
        # Vérifier que tous les champs requis sont présents
        required_fields = ["current_password", "new_password"]
        for field in required_fields:
            if field not in data:
                logger.warning(f"Champ manquant pour le changement de mot de passe: {field}")
                return jsonify({"error": f"Le champ '{field}' est requis"}), 400
                
        current_password = data["current_password"]
        new_password = data["new_password"]
        
        # Vérifier que le nouveau mot de passe est suffisamment fort
        if len(new_password) < 8:
            logger.warning("Mot de passe trop court")
            return jsonify({"error": "Le nouveau mot de passe doit contenir au moins 8 caractères"}), 400
            
        # Récupérer l'utilisateur depuis la base de données
        user = current_app.mongo.db.utilisateurs.find_one({"_id": ObjectId(user_id)})
        
        if not user:
            logger.warning(f"Utilisateur non trouvé pour le changement de mot de passe: {user_id}")
            return jsonify({"error": "Utilisateur non trouvé"}), 404
            
        # Vérifier que le mot de passe actuel est correct
        from werkzeug.security import check_password_hash, generate_password_hash
        
        if not check_password_hash(user.get("password", ""), current_password):
            logger.warning(f"Mot de passe actuel incorrect pour l'utilisateur: {user_id}")
            return jsonify({"error": "Mot de passe actuel incorrect"}), 401
            
        # Hasher le nouveau mot de passe
        hashed_password = generate_password_hash(new_password)
        
        # Mettre à jour le mot de passe dans la base de données
        result = current_app.mongo.db.utilisateurs.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {
                "password": hashed_password,
                "date_maj": datetime.utcnow()
            }}
        )
        
        if result.modified_count == 0:
            logger.warning(f"Échec de la mise à jour du mot de passe pour l'utilisateur: {user_id}")
            return jsonify({"error": "Échec de la mise à jour du mot de passe"}), 500
            
        logger.info(f"Mot de passe mis à jour avec succès pour l'utilisateur: {user_id}")
        return jsonify({
            "success": True,
            "message": "Mot de passe mis à jour avec succès"
        }), 200
        
    except Exception as e:
        logger.error(f"Erreur lors du changement de mot de passe: {str(e)}", exc_info=True)
        return jsonify({"error": "Erreur serveur", "details": str(e)}), 500

@profile_bp.route("/entreprise", methods=["GET"])
@cross_origin()
@recruiter_only
def get_entreprise():
    """
    Route pour récupérer les informations de l'entreprise du recruteur authentifié
    """
    try:
        # L'utilisateur est déjà authentifié via le décorateur recruiter_only
        user_id = request.user['id']
        
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
@recruiter_only
def update_entreprise():
    """
    Route pour mettre à jour les informations de l'entreprise du recruteur authentifié
    """
    try:
        # L'utilisateur est déjà authentifié via le décorateur recruiter_only
        user_id = request.user['id']
        
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