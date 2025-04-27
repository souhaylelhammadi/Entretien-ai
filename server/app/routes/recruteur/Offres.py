from flask import Blueprint, jsonify, request, current_app, send_file
from bson import ObjectId
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
from typing import List, Optional
import logging
from flask_cors import cross_origin
import jwt
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

Offres_recruteur_bp = Blueprint("Offres_recruteur", __name__, url_prefix="/api/offres-emploi")

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
            
        # Si le token est une liste ou un dict, on le convertit en string
        if not isinstance(token, str):
            logger.warning(f"Token is not a string but {type(token)}")
            if isinstance(token, (list, tuple)) and len(token) > 0:
                token = str(token[0])
            elif isinstance(token, dict) and len(token) > 0:
                token = str(list(token.values())[0])
            else:
                token = str(token)
                
        # Enlever le préfixe Bearer si présent
        if token.startswith('Bearer '):
            token = token[7:]
            
        # Essayer directement au cas où c'est un jeton JWT complet
        if not token or len(token.split('.')) != 3:
            logger.warning(f"Token semble invalide (format JWT incorrect): {token[:10]}...")
            return None
            
        # Get the JWT secret from app config
        secret_key = current_app.config.get('JWT_SECRET', 'your-jwt-secret')
        
        # First attempt: Try standard JWT decode with signature verification
        try:
            decoded = jwt.decode(token, secret_key, algorithms=['HS256'])
            logger.info("JWT successfully decoded with signature verification")
        except Exception as e:
            logger.error(f"Erreur de décodage JWT: {str(e)}")
            
            # Second attempt: Try without signature verification as fallback
            try:
                decoded = jwt.decode(token, options={"verify_signature": False})
                logger.warning("Token décodé sans vérification de signature")
            except Exception as e2:
                logger.error(f"Échec du décodage sans signature: {str(e2)}")
                return None
        
        # Extract user ID from token
        user_id = decoded.get('id')
        if not user_id:
            logger.warning("Token doesn't contain user ID")
            return None
            
        # Look up user in database
        try:
            user = current_app.mongo.db.users.find_one({"_id": ObjectId(user_id)})
            
            # If user not found in 'users' collection, try 'utilisateurs' collection
            if not user:
                logger.info(f"User not found in 'users' collection, trying 'utilisateurs'")
                user = current_app.mongo.db.utilisateurs.find_one({"_id": ObjectId(user_id)})
                
            if not user:
                logger.warning(f"User ID {user_id} from token not found in database")
                return None
                
            # Add string ID for easier access
            user['id'] = str(user['_id'])
            return user
            
        except Exception as db_error:
            logger.error(f"Database error: {str(db_error)}")
            return None
            
    except jwt.ExpiredSignatureError:
        logger.warning("Token has expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Error decoding token: {str(e)}")
        return None

@Offres_recruteur_bp.route("", methods=["GET"])
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
        
        # Récupérer l'ID du recruteur
        recruteur_id = user['id']
        logger.info(f"Fetching jobs specifically for recruiter ID: {recruteur_id}")
        
        # Créer le filtre de recherche
        filter_query = {"recruteur_id": recruteur_id}
        
        # Vérifier s'il y a des paramètres de pagination
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        skip = (page - 1) * limit
        
        # Filtre par période si demandé
        period = request.args.get('period')
        if period:
            now = datetime.utcnow()
            if period == 'week':
                start_date = now - timedelta(days=7)
            elif period == 'month':
                start_date = now - timedelta(days=30)
            elif period == 'year':
                start_date = now - timedelta(days=365)
            else:  # 'all' ou autre
                start_date = None
                
            if start_date:
                filter_query["created_at"] = {"$gte": start_date.isoformat()}
                
        # Obtenir le nombre total
        total_count = current_app.mongo.db.offres.count_documents(filter_query)
        
        # Obtenir les offres d'emploi avec pagination
        jobs = current_app.mongo.db.offres.find(filter_query).skip(skip).limit(limit)
        
        job_list = []
        for job in jobs:
            job['_id'] = str(job['_id'])
            job['entreprise_id'] = str(job['entreprise_id'])
            job_list.append(job)
            
        logger.info(f"Fetched {len(job_list)} job offers for recruiter {recruteur_id} (total: {total_count})")
        
        # Retourner les données avec pagination
        response_data = {
            "_id": job['_id'],

            "recruteur_id": recruteur_id,
            "offres": job_list,
            "total": total_count,
            "page": page,
            "limit": limit
        }
        
        if period:
            # Ajout des données statistiques pour les graphiques
            # Ces données seront également filtrées par recruteur
            status_distribution = {}
            for job in job_list:
                status = job.get("status", "unknown")
                status_distribution[status] = status_distribution.get(status, 0) + 1
                
            # Ajouter les statistiques à la réponse
            response_data.update({
                "offers": len(job_list),
                "status_distribution": status_distribution,
                # Les autres données statistiques restent les mêmes
            })
        
        return jsonify(response_data), 200
    except Exception as e:
        logger.error(f"Error fetching job offers: {str(e)}", exc_info=True)
        return jsonify({"error": "Server error while fetching job offers"}), 500

@Offres_recruteur_bp.route("", methods=["POST"])
@cross_origin()
def create_offre_emploi():
    """Create a new job offer."""
    try:
        # Get and validate authentication
        token = request.headers.get('Authorization')
        logger.info(f"Attempting job creation with token: {token[:10]}..." if token else "No token")
        
        user = get_user_from_token(token)
        
        if not user:
            logger.warning("Unauthorized job creation attempt - invalid or missing token")
            return jsonify({"error": "Unauthorized", "message": "Please log in to perform this action"}), 401
            
        if user.get('role') != 'recruteur':
            logger.warning(f"Job creation attempted by non-recruiter user {user['id']}")
            return jsonify({"error": "Unauthorized", "message": "Only recruiters can create job offers"}), 403
        
        # Validate input data
        data = request.get_json()
        if not data:
            logger.warning("No JSON data provided for job creation")
            return jsonify({"error": "No data provided"}), 400
            
        # Check required fields
        required_fields = ["title"]
        missing_fields = [field for field in required_fields if field not in data or not str(data[field]).strip()]
        if missing_fields:
            logger.warning(f"Missing required fields: {', '.join(missing_fields)}")
            return jsonify({"error": f"Missing required fields: {', '.join(missing_fields)}"}), 400

        # Set recruiter ID from authenticated user
        data['recruteur_id'] = user['id']
        
        # Handle entreprise_id - use from data if provided, otherwise from user profile
        if not data.get('entreprise_id'):
            if user.get('entreprise_id'):
                data['entreprise_id'] = user.get('entreprise_id')
                logger.info(f"Using entreprise_id from user profile: {data['entreprise_id']}")
            else:
                logger.warning("No entreprise_id provided and none found in user profile")
                return jsonify({"error": "Enterprise ID is required"}), 400
        
        # Validate entreprise_id format and existence
        try:
            entreprise_id = ObjectId(data["entreprise_id"])
            entreprise = current_app.mongo.db.entreprises.find_one({"_id": entreprise_id})
            if not entreprise:
                logger.warning(f"Entreprise ID {data['entreprise_id']} not found in database")
                return jsonify({"error": "Entreprise not found"}), 404
            logger.info(f"Validated entreprise: {entreprise.get('nom', 'Unknown')}")
        except ValueError:
            logger.warning(f"Invalid entreprise_id format: {data.get('entreprise_id')}")
            return jsonify({"error": "Invalid entreprise ID format"}), 400
            
        # Process requirements field
        requirements = []
        if data.get("requirements"):
            if isinstance(data["requirements"], list):
                requirements = [
                    skill.strip() for skill in data["requirements"]
                    if isinstance(skill, str) and skill.strip()
                ]
            elif isinstance(data["requirements"], str):
                # Handle comma-separated string of requirements
                requirements = [skill.strip() for skill in data["requirements"].split(',') if skill.strip()]
        
        # Create job data object
        job_data = JobOffer(
            title=data["title"].strip(),
            department=data.get("department", "").strip(),
            location=data.get("location", "").strip(),
            description=data.get("description", "").strip(),
            requirements=requirements,
            status=data.get("status", "open").lower(),
            recruteur_id=data["recruteur_id"],
            entreprise_id=str(entreprise_id),
            created_at=datetime.utcnow().isoformat(),
        ).dict(exclude_none=True)

        # Validate status field
        if job_data["status"] not in ["open", "closed"]:
            logger.warning(f"Invalid status: {job_data['status']}. Defaulting to 'open'")
            job_data["status"] = "open"

        # Save to database
        try:
            result = current_app.mongo.db.offres.insert_one(job_data)
            job_data["_id"] = str(result.inserted_id)
            logger.info(f"Successfully created job offer with ID {job_data['_id']} by user {user['id']}")
            
            # Add entreprise name for response
            if entreprise:
                job_data["entreprise_nom"] = entreprise.get("nom", "Unknown Enterprise")
                
            return jsonify({
                "message": "Job created successfully", 
                "offre": job_data
            }), 201
        except Exception as db_error:
            logger.error(f"Database error while creating job: {str(db_error)}", exc_info=True)
            return jsonify({"error": "Database error while creating job offer"}), 500
            
    except ValueError as e:
        logger.error(f"Invalid data format: {str(e)}")
        return jsonify({"error": "Invalid data", "details": str(e)}), 400
    except Exception as e:
        logger.error(f"Error creating job offer: {str(e)}", exc_info=True)
        return jsonify({"error": "Server error while creating job offer"}), 500

@Offres_recruteur_bp.route("/form", methods=["POST"])
@cross_origin()
def create_offre_emploi_form():
    """Create a new job offer using form data."""
    try:
        # Get and validate authentication
        token = request.headers.get('Authorization')
        logger.info(f"Attempting form-based job creation with token: {token[:10]}..." if token else "No token")
        
        user = get_user_from_token(token)
        
        if not user:
            logger.warning("Unauthorized job creation attempt - invalid or missing token")
            return jsonify({"error": "Unauthorized", "message": "Please log in to perform this action"}), 401
            
        if user.get('role') != 'recruteur':
            logger.warning(f"Job creation attempted by non-recruiter user {user['id']}")
            return jsonify({"error": "Unauthorized", "message": "Only recruiters can create job offers"}), 403
        
        # Get form data
        form_data = request.form
        logger.info(f"Received form data with {len(form_data)} fields")
        
        if not form_data:
            logger.warning("No form data provided")
            return jsonify({"error": "No form data provided"}), 400
            
        # Check required fields
        required_fields = ["title"]
        missing_fields = [field for field in required_fields if not form_data.get(field)]
        if missing_fields:
            logger.warning(f"Missing required fields: {', '.join(missing_fields)}")
            return jsonify({"error": f"Missing required fields: {', '.join(missing_fields)}"}), 400
        
        # Handle file attachments
        attachments = {}
        uploaded_files = []
        
        # Process job description file if provided
        if 'job_description_file' in request.files:
            job_desc_file = request.files['job_description_file']
            if job_desc_file and job_desc_file.filename:
                try:
                    # Save file to disk
                    uploads_dir = current_app.config.get(
                        'UPLOAD_FOLDER',
                        os.path.join(os.getcwd(), "uploads", "job_descriptions")
                    )
                    
                    # Ensure directory exists
                    if not os.path.exists(uploads_dir):
                        os.makedirs(uploads_dir, exist_ok=True)
                        logger.info(f"Created uploads directory: {uploads_dir}")
                    
                    # Create unique filename
                    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
                    filename = f"{timestamp}_{user['id']}_{job_desc_file.filename}"
                    file_path = os.path.join(uploads_dir, filename)
                    
                    # Save the file
                    job_desc_file.save(file_path)
                    logger.info(f"Saved job description file to: {file_path}")
                    
                    # Add to attachments
                    attachments['job_description_path'] = file_path
                    uploaded_files.append(file_path)
                except Exception as file_error:
                    logger.error(f"Error saving job description file: {str(file_error)}", exc_info=True)
                    return jsonify({"error": "Failed to upload file"}), 500
        
        # Handle additional files if needed
        # (Similar pattern could be used for other file types)
                
        # Process requirements as a comma-separated string
        requirements = []
        if form_data.get('requirements'):
            requirements = [req.strip() for req in form_data.get('requirements').split(',') if req.strip()]
            logger.info(f"Processed {len(requirements)} requirements from form data")
            
        # Get entreprise_id from form or user profile
        entreprise_id = form_data.get('entreprise_id', user.get('entreprise_id', ''))
        
        # Validate entreprise_id format and existence
        try:
            if not entreprise_id:
                logger.warning("No entreprise_id provided in form or user profile")
                return jsonify({"error": "Enterprise ID is required"}), 400
                
            entreprise_id_obj = ObjectId(entreprise_id)
            entreprise = current_app.mongo.db.entreprises.find_one({"_id": entreprise_id_obj})
            
            if not entreprise:
                logger.warning(f"Entreprise ID {entreprise_id} not found in database")
                return jsonify({"error": "Entreprise not found"}), 404
                
            logger.info(f"Validated entreprise: {entreprise.get('nom', 'Unknown')}")
            
        except (ValueError, TypeError) as e:
            logger.warning(f"Invalid entreprise_id format: {entreprise_id}. Error: {str(e)}")
            return jsonify({"error": "Invalid entreprise ID format"}), 400
            
        # Create job data
        job_data = JobOffer(
            title=form_data.get("title", "").strip(),
            department=form_data.get("department", "").strip(),
            location=form_data.get("location", "").strip(),
            description=form_data.get("description", "").strip(),
            requirements=requirements,
            status=form_data.get("status", "open").lower(),
            recruteur_id=user['id'],
            entreprise_id=str(entreprise_id_obj),
            created_at=datetime.utcnow().isoformat(),
        ).dict(exclude_none=True)
        
        # Add file paths to job data
        job_data.update(attachments)
        
        # Validate status field
        if job_data["status"] not in ["open", "closed"]:
            logger.warning(f"Invalid status: {job_data['status']}. Defaulting to 'open'")
            job_data["status"] = "open"
        
        # Save to database
        try:
            result = current_app.mongo.db.offres.insert_one(job_data)
            job_data["_id"] = str(result.inserted_id)
            logger.info(f"Successfully created job offer with ID {job_data['_id']} by user {user['id']} via form")
            
            # Add entreprise name for response
            if entreprise:
                job_data["entreprise_nom"] = entreprise.get("nom", "Unknown Enterprise")
                
            return jsonify({
                "message": "Job created successfully", 
                "offre": job_data,
                "files": uploaded_files
            }), 201
            
        except Exception as db_error:
            logger.error(f"Database error while creating job: {str(db_error)}", exc_info=True)
            
            # Clean up any uploaded files if database insertion fails
            for file_path in uploaded_files:
                try:
                    if os.path.exists(file_path):
                        os.remove(file_path)
                        logger.info(f"Cleaned up file after database error: {file_path}")
                except Exception as cleanup_error:
                    logger.warning(f"Failed to clean up file {file_path}: {str(cleanup_error)}")
                    
            return jsonify({"error": "Database error while creating job offer"}), 500
        
    except Exception as e:
        logger.error(f"Error creating job offer via form: {str(e)}", exc_info=True)
        return jsonify({"error": "Server error while creating job offer"}), 500

@Offres_recruteur_bp.route("/<job_id>", methods=["PUT"])
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

@Offres_recruteur_bp.route("/<job_id>/form", methods=["PUT", "POST"])
@cross_origin()
def update_offre_emploi_form(job_id):
    """Update an existing job offer using form data."""
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

        # Get form data
        form_data = request.form
        
        if not form_data:
            logger.warning(f"No form data provided for job update")
            return jsonify({"error": "No form data provided"}), 400

        # Get existing job
        job = current_app.mongo.db.offres.find_one({"_id": job_id_obj})
        if not job:
            logger.warning(f"Job not found: {job_id}")
            return jsonify({"error": "Job not found"}), 404

        if job.get("recruteur_id") != user["id"]:
            logger.warning(f"Unauthorized job update attempt by user {user['id']} on job {job_id}")
            return jsonify({"error": "Unauthorized", "message": "You can only update your own jobs"}), 403
            
        # Handle file uploads
        files = {}
        if 'job_description_file' in request.files:
            job_desc_file = request.files['job_description_file']
            if job_desc_file.filename:
                # Save file to disk
                uploads_dir = current_app.config.get('UPLOAD_FOLDER', os.path.join(os.getcwd(), "uploads", "job_descriptions"))
                if not os.path.exists(uploads_dir):
                    os.makedirs(uploads_dir, exist_ok=True)
                
                filename = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{user['id']}_{job_desc_file.filename}"
                file_path = os.path.join(uploads_dir, filename)
                job_desc_file.save(file_path)
                files['job_description_path'] = file_path
                
        # Process requirements as a comma-separated string
        requirements = []
        if form_data.get('requirements'):
            requirements = [req.strip() for req in form_data.get('requirements').split(',') if req.strip()]
        else:
            requirements = job.get("requirements", [])

        # Create update data
        update_data = JobOffer(
            title=form_data.get("title", job["title"]).strip(),
            department=form_data.get("department", job.get("department", "")).strip(),
            location=form_data.get("location", job.get("location", "")).strip(),
            description=form_data.get("description", job.get("description", "")).strip(),
            requirements=requirements,
            status=form_data.get("status", job.get("status", "open")).lower(),
            recruteur_id=user["id"],
            entreprise_id=job["entreprise_id"],
            updated_at=datetime.utcnow().isoformat(),
        ).dict(exclude_none=True)
        
        # Add file paths if any
        update_data.update(files)

        if update_data["status"] not in ["open", "closed"]:
            logger.warning(f"Invalid status: {update_data['status']}")
            return jsonify({"error": "Invalid status. Must be 'open' or 'closed'"}), 400

        current_app.mongo.db.offres.update_one(
            {"_id": job_id_obj},
            {"$set": update_data}
        )
        update_data["_id"] = job_id
        update_data["created_at"] = job.get("created_at", datetime.utcnow().isoformat())
        logger.info(f"Updated job offer with ID {job_id} by user {user['id']} via form")
        return jsonify({"message": "Job updated successfully", "offre": update_data}), 200
    except ValueError as e:
        logger.error(f"Invalid data format: {str(e)}")
        return jsonify({"error": "Invalid data", "details": str(e)}), 400
    except Exception as e:
        logger.error(f"Error updating job offer {job_id} via form: {str(e)}", exc_info=True)
        return jsonify({"error": "Server error while updating job offer"}), 500

@Offres_recruteur_bp.route("/<job_id>", methods=["DELETE"])
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

@Offres_recruteur_bp.route("/cv/<string:candidate_id>", methods=["GET"])
@cross_origin()
def download_cv(candidate_id):
    """Download CV for a candidate."""
    try:
        token = request.headers.get('Authorization')
        user = get_user_from_token(token)
        
        if not user:
            logger.warning("Unauthorized CV download attempt - invalid or missing token")
            return jsonify({"error": "Unauthorized", "message": "Please log in to perform this action"}), 401
            
        if user.get('role') != 'recruteur':
            logger.warning(f"CV download attempted by non-recruiter user {user['id']}")
            return jsonify({"error": "Unauthorized", "message": "Only recruiters can download CVs"}), 403
            
        try:
            candidate_id_obj = ObjectId(candidate_id)
        except ValueError:
            logger.warning(f"Invalid candidate_id format: {candidate_id}")
            return jsonify({"error": "Invalid candidate ID format"}), 400

        # Find the candidate
        candidate = current_app.mongo.db.candidates.find_one({"_id": candidate_id_obj})
        
        # If not found in candidates, check if this is a candidature ID
        if not candidate:
            logger.info(f"Candidate not found directly, checking candidatures for ID: {candidate_id}")
            candidature = current_app.mongo.db.candidatures.find_one({"_id": candidate_id_obj})
            if candidature and "candidate_id" in candidature and ObjectId.is_valid(candidature["candidate_id"]):
                candidate = current_app.mongo.db.candidates.find_one({"_id": candidature["candidate_id"]})
        
        # If still not found, check if there's a candidature with this candidate_id
        if not candidate:
            logger.info(f"Checking candidatures with candidate_id: {candidate_id}")
            candidature = current_app.mongo.db.candidatures.find_one({"candidate_id": candidate_id_obj})
            if candidature and "candidate_id" in candidature:
                candidate = current_app.mongo.db.candidates.find_one({"_id": candidature["candidate_id"]})
                
        # If no candidate is found, return an error
        if not candidate:
            logger.warning(f"Candidate not found for ID: {candidate_id}")
            return jsonify({"error": "Candidate not found"}), 404
            
        # Check for CV path in different possible fields
        cv_path = None
        
        # Check in 'cv' field
        if candidate.get("cv"):
            cv_path = candidate.get("cv")
            
        # Check in 'cv_path' field if exists
        if not cv_path and candidate.get("cv_path"):
            cv_path = candidate.get("cv_path")
            
        # If no CV path found
        if not cv_path:
            logger.warning(f"No CV found for candidate: {candidate_id}")
            return jsonify({"error": "CV not available for this candidate"}), 404

        # If path doesn't point to an existing file
        if not os.path.exists(cv_path):
            # Check if path is relative to some base directory
            uploads_dir = current_app.config.get('UPLOAD_FOLDER', os.path.join(os.getcwd(), "uploads"))
            alternative_path = os.path.join(uploads_dir, os.path.basename(cv_path))
            
            if os.path.exists(alternative_path):
                cv_path = alternative_path
                logger.info(f"Found CV at alternative path: {cv_path}")
            else:
                logger.warning(f"CV file not found on server: {cv_path}")
                return jsonify({"error": "CV file not found"}), 404
            
        # Attempt to send the file
        try:
            return send_file(
                cv_path,
                mimetype="application/pdf",
                as_attachment=True,
                download_name=f"cv_{candidate.get('nom', 'candidat')}.pdf"
            )
        except Exception as e:
            logger.error(f"Error sending CV file: {str(e)}", exc_info=True)
            return jsonify({"error": "Error sending CV file"}), 500
            
    except Exception as e:
        logger.error(f"Error downloading CV: {str(e)}", exc_info=True)
        return jsonify({"error": "Server error while downloading CV"}), 500