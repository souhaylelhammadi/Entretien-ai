from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from datetime import datetime
from pydantic import BaseModel, Field
from typing import List, Optional
import logging
from flask_cors import cross_origin
import jwt

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

jobs_bp = Blueprint("jobs", __name__, url_prefix="/api/offres-emploi")

class JobOffer(BaseModel):
    title: str
    department: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    requirements: List[str] = Field(default_factory=list)
    status: str = "open"
    recruteur_id: str
    entreprise_id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

def get_user_from_token(token):
    """Extract user information from JWT token."""
    try:
        if not token:
            logger.warning("No token provided")
            return None
            
        if token.startswith('Bearer '):
            token = token[7:]
            
        secret_key = current_app.config.get('SECRET_KEY', 'default-secret-key')
        decoded = jwt.decode(token, secret_key, algorithms=['HS256'])
        
        user_id = decoded.get('id')
        if not user_id:
            logger.warning("Token doesn't contain user ID")
            return None
            
        user = current_app.mongo.db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            logger.warning(f"User ID {user_id} from token not found in database")
            return None
            
        user['id'] = str(user['_id'])
        return user
    except jwt.ExpiredSignatureError:
        logger.warning("Token has expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Error decoding token: {str(e)}")
        return None

@jobs_bp.route("", methods=["GET"])
@cross_origin()
def get_offres_emploi():
    """Retrieve all job offers for the authenticated recruiter."""
    try:
        token = request.headers.get('Authorization')
        user = get_user_from_token(token)
        
        if not user:
            logger.warning("Unauthorized job fetch attempt - invalid or missing token")
            return jsonify({"error": "Unauthorized", "message": "Please log in to perform this action"}), 401
            
        if user.get('role') != 'recruteur':
            logger.warning(f"Job fetch attempted by non-recruiter user {user['id']}")
            return jsonify({"error": "Unauthorized", "message": "Only recruiters can view job offers"}), 403
            
        jobs = current_app.mongo.db.offres.find({"recruteur_id": user['id']})
        job_list = []
        for job in jobs:
            job['_id'] = str(job['_id'])
            job['entreprise_id'] = str(job['entreprise_id'])
            job_list.append(job)
            
        logger.info(f"Fetched {len(job_list)} job offers for user {user['id']}")
        return jsonify(job_list), 200
    except Exception as e:
        logger.error(f"Error fetching job offers: {str(e)}", exc_info=True)
        return jsonify({"error": "Server error while fetching job offers"}), 500

@jobs_bp.route("", methods=["POST"])
@cross_origin()
def create_offre_emploi():
    """Create a new job offer."""
    try:
        token = request.headers.get('Authorization')
        user = get_user_from_token(token)
        
        if not user:
            logger.warning("Unauthorized job creation attempt - invalid or missing token")
            return jsonify({"error": "Unauthorized", "message": "Please log in to perform this action"}), 401
            
        if user.get('role') != 'recruteur':
            logger.warning(f"Job creation attempted by non-recruiter user {user['id']}")
            return jsonify({"error": "Unauthorized", "message": "Only recruiters can create job offers"}), 403
            
        data = request.get_json()
        if not data:
            logger.warning(f"No data provided via {request.method} {request.path}")
            return jsonify({"error": "No data provided"}), 400

        data['recruteur_id'] = user['id']
        if not data.get('entreprise_id'):
            data['entreprise_id'] = user.get('entreprise_id', '')
                
        try:
            entreprise_id = ObjectId(data["entreprise_id"])
            if not current_app.mongo.db.entreprises.find_one({"_id": entreprise_id}):
                logger.warning(f"Entreprise ID {data['entreprise_id']} not found")
                return jsonify({"error": "Entreprise not found"}), 404
        except ValueError:
            logger.warning(f"Invalid entreprise_id format: {data.get('entreprise_id')}")
            return jsonify({"error": "Invalid entreprise ID format"}), 400

        job_data = JobOffer(
            title=data["title"].strip(),
            department=data.get("department", "").strip(),
            location=data.get("location", "").strip(),
            description=data.get("description", "").strip(),
            requirements=[
                skill.strip() for skill in data.get("requirements", [])
                if isinstance(skill, str) and skill.strip()
            ],
            status=data.get("status", "open").lower(),
            recruteur_id=data["recruteur_id"],
            entreprise_id=str(entreprise_id),
            created_at=datetime.utcnow().isoformat(),
        ).dict(exclude_none=True)

        if job_data["status"] not in ["open", "closed"]:
            logger.warning(f"Invalid status: {job_data['status']}")
            return jsonify({"error": "Invalid status. Must be 'open' or 'closed'"}), 400

        result = current_app.mongo.db.offres.insert_one(job_data)
        job_data["_id"] = str(result.inserted_id)
        logger.info(f"Created job offer with ID {job_data['_id']} by user {user['id']}")
        return jsonify({"message": "Job created successfully", "offre": job_data}), 201
    except ValueError as e:
        logger.error(f"Invalid data format: {str(e)}")
        return jsonify({"error": "Invalid data", "details": str(e)}), 400
    except Exception as e:
        logger.error(f"Error creating job offer: {str(e)}", exc_info=True)
        return jsonify({"error": "Server error while creating job offer"}), 500

@jobs_bp.route("/<job_id>", methods=["PUT"])
@cross_origin()
def update_offre_emploi(job_id):
    """Update an existing job offer."""
    try:
        token = request.headers.get('Authorization')
        user = get_user_from_token(token)
        
        if not user:
            logger.warning("Unauthorized job update attempt - invalid or missing token")
            return jsonify({"error": "Unauthorized", "message": "Please log in to perform this action"}), 401
            
        if user.get('role') != 'recruteur':
            logger.warning(f"Job update attempted by non-recruiter user {user['id']}")
            return jsonify({"error": "Unauthorized", "message": "Only recruiters can update job offers"}), 403
            
        try:
            job_id_obj = ObjectId(job_id)
        except ValueError:
            logger.warning(f"Invalid job_id format: {job_id}")
            return jsonify({"error": "Invalid job ID format"}), 400

        data = request.get_json()
        if not data:
            logger.warning(f"No data provided for job update")
            return jsonify({"error": "No data provided"}), 400

        job = current_app.mongo.db.offres.find_one({"_id": job_id_obj})
        if not job:
            logger.warning(f"Job not found: {job_id}")
            return jsonify({"error": "Job not found"}), 404

        if job.get("recruteur_id") != user["id"]:
            logger.warning(f"Unauthorized job update attempt by user {user['id']} on job {job_id}")
            return jsonify({"error": "Unauthorized", "message": "You can only update your own jobs"}), 403

        data["recruteur_id"] = user["id"]

        update_data = JobOffer(
            title=data.get("title", job["title"]).strip(),
            department=data.get("department", job.get("department", "")).strip(),
            location=data.get("location", job.get("location", "")).strip(),
            description=data.get("description", job.get("description", "")).strip(),
            requirements=[
                skill.strip() for skill in data.get("requirements", job.get("requirements", []))
                if isinstance(skill, str) and skill.strip()
            ],
            status=data.get("status", job.get("status", "open")).lower(),
            recruteur_id=user["id"],
            entreprise_id=job["entreprise_id"],
            updated_at=datetime.utcnow().isoformat(),
        ).dict(exclude_none=True)

        if update_data["status"] not in ["open", "closed"]:
            logger.warning(f"Invalid status: {update_data['status']}")
            return jsonify({"error": "Invalid status. Must be 'open' or 'closed'"}), 400

        current_app.mongo.db.offres.update_one(
            {"_id": job_id_obj},
            {"$set": update_data}
        )
        update_data["_id"] = job_id
        update_data["created_at"] = job.get("created_at", datetime.utcnow().isoformat())
        logger.info(f"Updated job offer with ID {job_id} by user {user['id']}")
        return jsonify({"message": "Job updated successfully", "offre": update_data}), 200
    except ValueError as e:
        logger.error(f"Invalid data format: {str(e)}")
        return jsonify({"error": "Invalid data", "details": str(e)}), 400
    except Exception as e:
        logger.error(f"Error updating job offer {job_id}: {str(e)}", exc_info=True)
        return jsonify({"error": "Server error while updating job offer"}), 500

@jobs_bp.route("/<job_id>", methods=["DELETE"])
@cross_origin()
def delete_offre_emploi(job_id):
    """Delete a job offer."""
    try:
        token = request.headers.get('Authorization')
        user = get_user_from_token(token)
        
        if not user:
            logger.warning("Unauthorized job deletion attempt - invalid or missing token")
            return jsonify({"error": "Unauthorized", "message": "Please log in to perform this action"}), 401
            
        if user.get('role') != 'recruteur':
            logger.warning(f"Job deletion attempted by non-recruiter user {user['id']}")
            return jsonify({"error": "Unauthorized", "message": "Only recruiters can delete job offers"}), 403
            
        try:
            job_id_obj = ObjectId(job_id)
        except ValueError:
            logger.warning(f"Invalid job_id format: {job_id}")
            return jsonify({"error": "Invalid job ID format"}), 400

        job = current_app.mongo.db.offres.find_one({"_id": job_id_obj})
        if not job:
            logger.warning(f"Job not found: {job_id}")
            return jsonify({"error": "Job not found"}), 404

        if job.get("recruteur_id") != user["id"]:
            logger.warning(f"Unauthorized job deletion attempt by user {user['id']} on job {job_id}")
            return jsonify({"error": "Unauthorized", "message": "You can only delete your own jobs"}), 403

        current_app.mongo.db.offres.delete_one({"_id": job_id_obj})
        logger.info(f"Deleted job offer with ID {job_id} by user {user['id']}")
        return jsonify({"message": "Job deleted successfully"}), 200
    except ValueError as e:
        logger.error(f"Invalid data format: {str(e)}")
        return jsonify({"error": "Invalid data", "details": str(e)}), 400
    except Exception as e:
        logger.error(f"Error deleting job offer {job_id}: {str(e)}", exc_info=True)
        return jsonify({"error": "Server error while deleting job offer"}), 500