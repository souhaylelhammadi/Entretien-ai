from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from auth_middleware import require_auth
from pydantic import BaseModel, validator, Field
from typing import List, Optional, Dict
import logging
from flask_cors import cross_origin
from datetime import datetime
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

profile_bp = Blueprint("profile", __name__, url_prefix="/api/recruiter/profile")

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

@profile_bp.route("", methods=["GET"])
@require_auth
@cross_origin()
def get_profile():
    """Get the authenticated recruiter's profile"""
    try:
        recruiter_id = request.user["id"]
        logger.info(f"Fetching profile for recruiter {recruiter_id}")
        
        # Get the basic user info from users collection
        user = current_app.mongo.db.users.find_one({"_id": ObjectId(recruiter_id), "role": "recruteur"})
        if not user:
            logger.warning(f"Recruiter not found: {recruiter_id}")
            return jsonify({"error": "Recruteur non trouvé"}), 404

        # Get additional profile data from recruiter_profiles collection if it exists
        profile_data = current_app.mongo.db.recruiter_profiles.find_one({"user_id": ObjectId(recruiter_id)})
        
        # Combine user data with profile data
        profile = {
            "id": str(user["_id"]),
            "firstName": user.get("firstName", ""),
            "lastName": user.get("lastName", ""),
            "email": user.get("email", ""),
            "role": "recruteur",
            "entreprise_id": str(user.get("entreprise_id", "")) if user.get("entreprise_id") else None,
            "createdAt": user.get("createdAt").isoformat() if user.get("createdAt") else None,
        }
        
        # Add profile data if available
        if profile_data:
            for key, value in profile_data.items():
                if key not in ["_id", "user_id"]:
                    profile[key] = value
        
        # Get company name
        if profile.get("entreprise_id"):
            entreprise = current_app.mongo.db.entreprises.find_one({"_id": ObjectId(profile["entreprise_id"])})
            if entreprise:
                profile["entreprise_name"] = entreprise.get("nom", "")
            
        # Get statistics
        active_jobs = current_app.mongo.db.offres.count_documents({
            "recruteur_id": recruiter_id,
            "status": "open"
        })
        total_jobs = current_app.mongo.db.offres.count_documents({"recruteur_id": recruiter_id})
        total_candidates = current_app.mongo.db.candidates.count_documents({"recruteur_id": recruiter_id})
        scheduled_interviews = current_app.mongo.db.interviews.count_documents({
            "recruteur_id": recruiter_id,
            "status": "Planifié"
        })
        
        # Add statistics to profile
        profile["stats"] = {
            "active_jobs": active_jobs,
            "total_jobs": total_jobs,
            "total_candidates": total_candidates,
            "scheduled_interviews": scheduled_interviews
        }
        
        logger.info(f"Successfully fetched profile for recruiter {recruiter_id}")
        return jsonify({"profile": profile}), 200
        
    except Exception as e:
        logger.error(f"Error fetching recruiter profile: {str(e)}")
        return jsonify({"error": "Erreur serveur lors de la récupération du profil"}), 500

@profile_bp.route("", methods=["PUT"])
@require_auth
@cross_origin()
def update_profile():
    """Update the authenticated recruiter's profile"""
    try:
        recruiter_id = request.user["id"]
        logger.info(f"Updating profile for recruiter {recruiter_id}")
        
        # Validate request data
        data = request.get_json()
        if not data:
            logger.warning(f"No data provided for profile update by recruiter {recruiter_id}")
            return jsonify({"error": "Aucune donnée fournie"}), 400
            
        # Validate with Pydantic model
        try:
            validated_data = ProfileUpdateRequest(**data).dict(exclude_none=True, exclude_unset=True)
        except Exception as e:
            logger.warning(f"Invalid profile data: {str(e)}")
            return jsonify({"error": "Données de profil invalides", "details": str(e)}), 400
            
        # Get the user from the database to verify it exists
        user = current_app.mongo.db.users.find_one({"_id": ObjectId(recruiter_id), "role": "recruteur"})
        if not user:
            logger.warning(f"Recruiter not found: {recruiter_id}")
            return jsonify({"error": "Recruteur non trouvé"}), 404
            
        # Update basic user info in users collection
        user_update_data = {}
        if "firstName" in validated_data:
            user_update_data["firstName"] = validated_data.pop("firstName")
        if "lastName" in validated_data:
            user_update_data["lastName"] = validated_data.pop("lastName")
            
        if user_update_data:
            current_app.mongo.db.users.update_one(
                {"_id": ObjectId(recruiter_id)},
                {"$set": user_update_data}
            )
            
        # Update or create profile data in recruiter_profiles collection
        if validated_data:
            validated_data["updated_at"] = datetime.utcnow()
            
            current_app.mongo.db.recruiter_profiles.update_one(
                {"user_id": ObjectId(recruiter_id)},
                {"$set": validated_data},
                upsert=True
            )
            
        logger.info(f"Successfully updated profile for recruiter {recruiter_id}")
        return jsonify({"message": "Profil mis à jour avec succès"}), 200
        
    except Exception as e:
        logger.error(f"Error updating recruiter profile: {str(e)}")
        return jsonify({"error": "Erreur serveur lors de la mise à jour du profil"}), 500
        
@profile_bp.route("/change-password", methods=["POST"])
@require_auth
@cross_origin()
def change_password():
    """Change the authenticated recruiter's password"""
    try:
        from bcrypt import hashpw, checkpw, gensalt
        
        recruiter_id = request.user["id"]
        logger.info(f"Changing password for recruiter {recruiter_id}")
        
        data = request.get_json()
        if not data or "currentPassword" not in data or "newPassword" not in data:
            logger.warning(f"Missing password data for recruiter {recruiter_id}")
            return jsonify({"error": "Mot de passe actuel et nouveau mot de passe requis"}), 400
            
        # Get user with password
        user = current_app.mongo.db.users.find_one({"_id": ObjectId(recruiter_id)})
        if not user:
            logger.warning(f"Recruiter not found: {recruiter_id}")
            return jsonify({"error": "Utilisateur non trouvé"}), 404
            
        # Verify current password
        if not checkpw(data["currentPassword"].encode("utf-8"), user["password"]):
            logger.warning(f"Current password verification failed for recruiter {recruiter_id}")
            return jsonify({"error": "Mot de passe actuel incorrect"}), 401
            
        # Validate new password
        new_password = data["newPassword"]
        if len(new_password) < 8 or not any(c.isupper() for c in new_password) or not any(c.isdigit() for c in new_password):
            logger.warning(f"New password does not meet requirements for recruiter {recruiter_id}")
            return jsonify({"error": "Le nouveau mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre"}), 400
            
        # Hash new password
        hashed_password = hashpw(new_password.encode("utf-8"), gensalt())
        
        # Update password
        current_app.mongo.db.users.update_one(
            {"_id": ObjectId(recruiter_id)},
            {"$set": {"password": hashed_password}}
        )
        
        logger.info(f"Successfully changed password for recruiter {recruiter_id}")
        return jsonify({"message": "Mot de passe mis à jour avec succès"}), 200
        
    except Exception as e:
        logger.error(f"Error changing password: {str(e)}")
        return jsonify({"error": "Erreur serveur lors du changement de mot de passe"}), 500

@profile_bp.route("/entreprise", methods=["GET"])
@require_auth
@cross_origin()
def get_entreprise():
    """Get the recruiter's company details"""
    try:
        recruiter_id = request.user["id"]
        logger.info(f"Fetching company details for recruiter {recruiter_id}")
        
        # Get user with entreprise_id
        user = current_app.mongo.db.users.find_one({"_id": ObjectId(recruiter_id), "role": "recruteur"})
        if not user or not user.get("entreprise_id"):
            logger.warning(f"Recruiter or entreprise ID not found: {recruiter_id}")
            return jsonify({"error": "Recruteur ou entreprise non trouvé"}), 404
            
        # Get entreprise details
        entreprise_id = user["entreprise_id"]
        entreprise = current_app.mongo.db.entreprises.find_one({"_id": entreprise_id})
        if not entreprise:
            logger.warning(f"Entreprise not found: {entreprise_id}")
            return jsonify({"error": "Entreprise non trouvée"}), 404
            
        # Format entreprise data
        entreprise_data = {
            "id": str(entreprise["_id"]),
            "nom": entreprise.get("nom", ""),
            "description": entreprise.get("description", ""),
            "secteur": entreprise.get("secteur", ""),
            "taille": entreprise.get("taille", ""),
            "site_web": entreprise.get("site_web", ""),
            "logo": entreprise.get("logo", ""),
            "adresse": entreprise.get("adresse", "")
        }
        
        logger.info(f"Successfully fetched company details for recruiter {recruiter_id}")
        return jsonify({"entreprise": entreprise_data}), 200
        
    except Exception as e:
        logger.error(f"Error fetching company details: {str(e)}")
        return jsonify({"error": "Erreur serveur lors de la récupération des détails de l'entreprise"}), 500 