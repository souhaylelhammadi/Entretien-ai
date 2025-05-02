from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from datetime import datetime, timezone
import os
from werkzeug.utils import secure_filename
from functools import wraps
from jwt_manager import jwt_manager
import logging
from pymongo.errors import PyMongoError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

Offres_recruteur_bp = Blueprint('Offres_recruteur_bp', __name__, url_prefix="/api")

# Helper Functions
def get_upload_folder():
    upload_folder = current_app.config.get("UPLOAD_FOLDER", os.path.join(os.getcwd(), "Uploads"))
    if not os.path.exists(upload_folder):
        os.makedirs(upload_folder, exist_ok=True)
    return upload_folder

def validate_required_fields(data, required_fields):
    if not data:
        return False, "No data provided"
    missing = [f for f in required_fields if f not in data or not str(data[f]).strip()]
    if missing:
        return False, f"Missing required fields: {', '.join(missing)}"
    return True, None

def handle_mongo_error(e, operation):
    logger.error(f"MongoDB error during {operation}: {e}", exc_info=True)
    return jsonify({"error": f"Error during {operation}.", "details": str(e)}), 500

def require_auth(role=None):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            token = request.headers.get("Authorization")
            payload = jwt_manager.verify_token(token)
            if not payload:
                return jsonify({"error": "Authentication required."}), 401
            if role and payload.get("role") != role:
                return jsonify({"error": f"Unauthorized access. Role '{role}' required."}), 403
            kwargs["auth_payload"] = payload
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Routes
@Offres_recruteur_bp.route('/offres-emploi', methods=['GET', 'POST'])
@require_auth(role="recruteur")
def handle_offres_emploi(auth_payload):
    if request.method == 'GET':
        try:
            db = current_app.mongo.db
            recruiter_id = auth_payload.get("id")
            logger.info(f"Recruiter ID from token: {recruiter_id}")
            logger.info(f"Recruiter ID type: {type(recruiter_id)}")

            if not recruiter_id:
                logger.error("No recruiter ID found in token")
                return jsonify({"error": "No recruiter ID found in token"}), 401

            try:
                recruiter_object_id = ObjectId(recruiter_id)
                logger.info(f"Converted recruiter ID to ObjectId: {recruiter_object_id}")
            except Exception as e:
                logger.error(f"Error converting recruiter ID to ObjectId: {str(e)}")
                return jsonify({"error": "Invalid recruiter ID format"}), 400

            query = {"recruteur_id": recruiter_object_id}
            logger.info(f"Query for finding offers: {query}")

            pipeline = [
                {"$match": query},
                {
                    "$lookup": {
                        "from": "entreprises",
                        "localField": "entreprise_id",
                        "foreignField": "_id",
                        "as": "entreprise"
                    }
                },
                {"$unwind": {"path": "$entreprise", "preserveNullAndEmptyArrays": True}},
                {
                    "$project": {
                        "_id": 1,
                        "titre": 1,
                        "description": 1,
                        "localisation": 1,
                        "departement": 1,
                        "entreprise_nom": {"$ifNull": ["$entreprise.nom", "Unspecified Enterprise"]},
                        "date_creation": {"$ifNull": ["$date_creation", datetime.now(timezone.utc)]},
                        "status": 1,
                        "competences_requises": 1
                    }
                }
            ]

            offres = db.offres.aggregate(pipeline)
            offres_list = []
            for offre in offres:
                date_creation = offre.get("date_creation")
                if isinstance(date_creation, datetime):
                    date_creation_str = date_creation.isoformat() + "Z"
                elif isinstance(date_creation, str):
                    date_creation_str = date_creation
                else:
                    date_creation_str = datetime.now(timezone.utc).isoformat() + "Z"

                offres_list.append({
                    "id": str(offre["_id"]),
                    "titre": offre.get("titre", "Unspecified Title"),
                    "description": offre.get("description", "No description available"),
                    "localisation": offre.get("localisation", "Unspecified Location"),
                    "departement": offre.get("departement", "Unspecified Department"),
                    "entreprise": offre.get("entreprise_nom"),
                    "date_creation": date_creation_str,
                    "status": offre.get("status", "open"),
                    "competences_requises": offre.get("competences_requises", [])
                })

            logger.info(f"Found {len(offres_list)} offers for recruiter {recruiter_id}")
            return jsonify({"offres": offres_list}), 200

        except Exception as e:
            return handle_mongo_error(e, "fetching job offers")

    elif request.method == 'POST':
        try:
            db = current_app.mongo.db
            data = request.get_json()
            recruiter_id = auth_payload.get("id")

            required_fields = ["titre", "description", "localisation", "departement", "entreprise_id"]
            is_valid, error = validate_required_fields(data, required_fields)
            if not is_valid:
                return jsonify({"error": error}), 400

            if not ObjectId.is_valid(data["entreprise_id"]):
                return jsonify({"error": "Invalid entreprise ID"}), 400

            entreprise = db.entreprises.find_one({"_id": ObjectId(data["entreprise_id"])})
            if not entreprise:
                return jsonify({"error": "Entreprise not found"}), 404

            competences_requises = data.get("competences_requises", [])
            if not isinstance(competences_requises, list):
                return jsonify({"error": "competences_requises must be a list"}), 400

            offre_data = {
                "titre": data["titre"],
                "description": data["description"],
                "localisation": data["localisation"],
                "departement": data["departement"],
                "entreprise_id": ObjectId(data["entreprise_id"]),
                "recruteur_id": ObjectId(recruiter_id),
                "date_creation": datetime.now(timezone.utc),
                "date_maj": datetime.now(timezone.utc),
                "status": data.get("status", "open"),
                "competences_requises": competences_requises,
                "candidature_ids": []
            }

            result = db.offres.insert_one(offre_data)
            offre_data["_id"] = str(result.inserted_id)
            offre_data["entreprise_id"] = str(offre_data["entreprise_id"])
            offre_data["recruteur_id"] = str(offre_data["recruteur_id"])
            offre_data["date_creation"] = offre_data["date_creation"].isoformat() + "Z"
            offre_data["date_maj"] = offre_data["date_maj"].isoformat() + "Z"

            return jsonify(offre_data), 201

        except Exception as e:
            return handle_mongo_error(e, "creating a job offer")

@Offres_recruteur_bp.route("/offres-emploi/<string:offre_id>", methods=["GET", "PUT", "DELETE"])
@require_auth(role="recruteur")
def handle_offre_by_id(offre_id, auth_payload):
    if request.method == 'GET':
        try:
            db = current_app.mongo.db
            recruiter_id = auth_payload.get("id")
            logger.info(f"Attempting to fetch offer with ID: {offre_id}")

            if not ObjectId.is_valid(offre_id):
                logger.error(f"Invalid ID received: {offre_id}")
                return jsonify({"error": "Invalid offer ID."}), 400

            pipeline = [
                {"$match": {"_id": ObjectId(offre_id), "recruteur_id": ObjectId(recruiter_id)}},
                {
                    "$lookup": {
                        "from": "entreprises",
                        "localField": "entreprise_id",
                        "foreignField": "_id",
                        "as": "entreprise"
                    }
                },
                {"$unwind": {"path": "$entreprise", "preserveNullAndEmptyArrays": True}},
                {
                    "$project": {
                        "_id": 1,
                        "titre": 1,
                        "description": 1,
                        "localisation": 1,
                        "departement": 1,
                        "entreprise_nom": {"$ifNull": ["$entreprise.nom", "Unspecified Enterprise"]},
                        "date_creation": {"$ifNull": ["$date_creation", datetime.now(timezone.utc)]},
                        "status": 1,
                        "competences_requises": 1
                    }
                }
            ]

            offres = list(db.offres.aggregate(pipeline))
            if not offres:
                logger.error(f"No offer found with ID: {offre_id}")
                return jsonify({"error": "Offer not found."}), 404

            offre = offres[0]
            data = {
                "_id": str(offre["_id"]),
                "titre": offre.get("titre", "Unspecified Title"),
                "description": offre.get("description", "No description available"),
                "localisation": offre.get("localisation", "Unspecified Location"),
                "departement": offre.get("departement", "Unspecified Department"),
                "entreprise": offre.get("entreprise_nom"),
                "date_creation": (offre.get("date_creation") or datetime.now(timezone.utc)).isoformat() + "Z",
                "status": offre.get("status", "open"),
                "competences_requises": offre.get("competences_requises", [])
            }

            return jsonify(data), 200

        except Exception as e:
            logger.error(f"Error fetching offer: {str(e)}")
            return handle_mongo_error(e, "fetching an offer")

    elif request.method == 'PUT':
        try:
            db = current_app.mongo.db
            recruiter_id = auth_payload.get("id")
            logger.info(f"Attempting to update offer with ID: {offre_id}")

            if not ObjectId.is_valid(offre_id):
                logger.error(f"Invalid ID received: {offre_id}")
                return jsonify({"error": "Invalid offer ID."}), 400

            offre = db.offres.find_one({"_id": ObjectId(offre_id), "recruteur_id": ObjectId(recruiter_id)})
            if not offre:
                logger.error(f"No offer found with ID: {offre_id} for recruiter: {recruiter_id}")
                return jsonify({"error": "Offer not found or unauthorized"}), 404

            data = request.get_json()
            if not data:
                logger.error("No data provided for update")
                return jsonify({"error": "No data provided"}), 400

            required_fields = ["titre", "description", "localisation", "departement"]
            is_valid, error = validate_required_fields(data, required_fields)
            if not is_valid:
                return jsonify({"error": error}), 400

            competences_requises = data.get("competences_requises", [])
            if not isinstance(competences_requises, list):
                return jsonify({"error": "competences_requises must be a list"}), 400

            update_data = {
                "titre": data.get("titre", offre["titre"]),
                "description": data.get("description", offre["description"]),
                "localisation": data.get("localisation", offre["localisation"]),
                "departement": data.get("departement", offre["departement"]),
                "competences_requises": competences_requises,
                "status": data.get("status", offre["status"]),
                "date_maj": datetime.now(timezone.utc)
            }

            result = db.offres.update_one(
                {"_id": ObjectId(offre_id)},
                {"$set": update_data}
            )

            if result.modified_count == 0:
                logger.warning(f"No changes made to offer: {offre_id}")
                return jsonify({"error": "No changes made"}), 400

            updated_offre = db.offres.find_one({"_id": ObjectId(offre_id)})
            updated_offre["_id"] = str(updated_offre["_id"])
            updated_offre["entreprise_id"] = str(updated_offre["entreprise_id"])
            updated_offre["recruteur_id"] = str(updated_offre["recruteur_id"])
            updated_offre["date_creation"] = updated_offre["date_creation"].isoformat() + "Z"
            updated_offre["date_maj"] = updated_offre["date_maj"].isoformat() + "Z"

            logger.info(f"Offer updated successfully: {updated_offre['_id']}")
            return jsonify(updated_offre), 200

        except Exception as e:
            logger.error(f"Error updating offer: {str(e)}")
            return handle_mongo_error(e, "updating an offer")

    elif request.method == 'DELETE':
        try:
            db = current_app.mongo.db
            recruiter_id = auth_payload.get("id")
            logger.info(f"Attempting to delete offer with ID: {offre_id}")
            logger.info(f"Recruiter ID: {recruiter_id}")
            logger.info(f"Raw offer ID type: {type(offre_id)}")
            logger.info(f"Raw offer ID value: {offre_id}")

            # Vérifier si l'ID est valide
            if not offre_id:
                logger.error("No offer ID provided")
                return jsonify({"error": "No offer ID provided"}), 400

            if not ObjectId.is_valid(offre_id):
                logger.error(f"Invalid ObjectId format: {offre_id}")
                return jsonify({"error": "Invalid offer ID format"}), 400

            # Convertir l'ID en ObjectId
            object_id = ObjectId(offre_id)
            logger.info(f"Converted ObjectId: {object_id}")

            # Vérifier si l'offre existe et appartient au recruteur
            offre = db.offres.find_one({"_id": object_id})
            if not offre:
                logger.error(f"No offer found with ID: {offre_id}")
                return jsonify({"error": "Offer not found"}), 404

            if str(offre.get("recruteur_id")) != recruiter_id:
                logger.error(f"Unauthorized deletion attempt. Recruiter ID: {recruiter_id}, Offer Recruiter ID: {offre.get('recruteur_id')}")
                return jsonify({"error": "Unauthorized to delete this offer"}), 403

            # Supprimer l'offre
            result = db.offres.delete_one({"_id": object_id})
            if result.deleted_count == 0:
                logger.warning(f"No offer deleted with ID: {offre_id}")
                return jsonify({"error": "No offer deleted"}), 400

            logger.info(f"Offer deleted successfully: {offre_id}")
            return jsonify({"message": "Offer deleted successfully"}), 200

        except Exception as e:
            logger.error(f"Error deleting offer: {str(e)}", exc_info=True)
            return handle_mongo_error(e, "deleting an offer")

@Offres_recruteur_bp.route("/candidatures", methods=["POST"])
@require_auth(role="candidat")
def create_candidature(auth_payload):
    try:
        db = current_app.mongo.db
        auth_user_id = auth_payload.get("id")
        user_db_data = auth_payload.get("user_db_data")

        if not user_db_data:
            return jsonify({"error": "User data not found."}), 404

        if "cv" not in request.files:
            return jsonify({"error": "No CV file provided."}), 400

        cv_file = request.files["cv"]
        if cv_file.filename == "":
            return jsonify({"error": "No CV file selected."}), 400

        ext = os.path.splitext(cv_file.filename)[1].lower()
        if ext not in {'.pdf', '.doc', '.docx'}:
            return jsonify({"error": "File type not allowed."}), 400

        form_data = request.form
        required_fields = ["offre_id", "lettre_motivation"]
        is_valid, error = validate_required_fields(form_data, required_fields)
        if not is_valid:
            return jsonify({"error": error}), 400

        offre_id = form_data["offre_id"]
        if not ObjectId.is_valid(offre_id):
            return jsonify({"error": "Invalid offer ID."}), 400

        offre = db.offres.find_one({"_id": ObjectId(offre_id)})
        if not offre:
            return jsonify({"error": "Offer not found."}), 404

        existing = db.candidatures.find_one({"offre_id": ObjectId(offre_id), "user_id": ObjectId(auth_user_id)})
        if existing:
            return jsonify({"error": "Already applied to this offer."}), 400

        upload_folder = get_upload_folder()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = secure_filename(f"{timestamp}_{auth_user_id}_{cv_file.filename}")
        cv_path = os.path.join(upload_folder, filename)
        cv_file.save(cv_path)

        candidate_data = {
            "user_id": ObjectId(auth_user_id),
            "nom": f"{user_db_data.get('firstName', '')} {user_db_data.get('lastName', '')}".strip(),
            "email": user_db_data.get("email", ""),
            "telephone": user_db_data.get("telephone", ""),
            "cv_path": cv_path,
            "created_at": datetime.now(timezone.utc),
        }
        candidate_result = db.candidates.insert_one(candidate_data)
        candidate_id = candidate_result.inserted_id

        candidature_data = {
            "candidate_id": candidate_id,
            "offre_id": ObjectId(offre_id),
            "user_id": ObjectId(auth_user_id),
            "lettre_motivation": form_data["lettre_motivation"].strip(),
            "cv_path": cv_path,
            "statut": "en_attente",
            "date_postulation": datetime.now(timezone.utc),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        candidature_result = db.candidatures.insert_one(candidature_data)
        candidature_id = candidature_result.inserted_id

        db.offres.update_one(
            {"_id": ObjectId(offre_id)},
            {"$push": {"candidature_ids": candidature_id}}
        )

        return jsonify({
            "message": "Application submitted successfully.",
            "candidature_id": str(candidature_id)
        }), 201

    except Exception as e:
        return handle_mongo_error(e, "creating an application")