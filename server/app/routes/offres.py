from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from datetime import datetime, timezone
import os
from werkzeug.utils import secure_filename
from functools import wraps
from auth import verify_token
import logging
from pymongo.errors import PyMongoError

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

offres_emploi_bp = Blueprint('offres_emploi', __name__, url_prefix="/api")

# --- Helper Functions ---
def get_upload_folder():
    upload_folder = current_app.config.get("UPLOAD_FOLDER", os.path.join(os.getcwd(), "Uploads"))
    if not os.path.exists(upload_folder):
        os.makedirs(upload_folder, exist_ok=True)
    return upload_folder

def validate_required_fields(data, required_fields):
    if not data:
        return False, "Aucune donnée fournie"
    missing = [f for f in required_fields if f not in data or not str(data[f]).strip()]
    if missing:
        return False, f"Champs requis manquants : {', '.join(missing)}"
    return True, None

def handle_mongo_error(e, operation):
    logger.error(f"Erreur MongoDB pendant {operation}: {e}", exc_info=True)
    return jsonify({"error": f"Erreur pendant {operation}.", "details": str(e)}), 500

def require_auth(role=None):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            token = request.headers.get("Authorization")
            payload = verify_token(token)
            if not payload:
                return jsonify({"error": "Authentification requise."}), 401
            if role and payload.get("role") != role:
                return jsonify({"error": f"Accès non autorisé. Rôle '{role}' requis."}), 403
            kwargs["auth_payload"] = payload
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# --- Routes ---
@offres_emploi_bp.route('/offres-emploi', methods=['GET'])
def get_offres_emploi():
    try:
        db = current_app.mongo.db

        token = request.headers.get("Authorization")
        is_recruiter = False
        recruiter_id = None
        if token:
            payload = verify_token(token)
            if payload and payload.get("role") == "recruteur":
                is_recruiter = True
                recruiter_id = payload.get("id")

        query = {}

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
                    "entreprise_nom": {"$ifNull": ["$entreprise.nom", "Entreprise non spécifiée"]},
                    "date_creation": {"$ifNull": ["$date_creation", datetime.now(timezone.utc)]},
                    "statut": 1
                }
            }
        ]

        offres = db.offres.aggregate(pipeline)
        offres_list = []
        for offre in offres:
            offres_list.append({
                "id": str(offre["_id"]),
                "titre": offre.get("titre", "Titre non spécifié"),
                "description": offre.get("description", "Description non disponible"),
                "localisation": offre.get("localisation", "Localisation non spécifiée"),
                "departement": offre.get("departement", "Département non spécifié"),
                "entreprise": offre.get("entreprise_nom"),
                "date_creation": (offre.get("date_creation") or datetime.now(timezone.utc)).isoformat() + "Z",
                "valide": offre.get("statut", "ouverte") == "ouverte"
            })

        return jsonify({"offres": offres_list}), 200

    except Exception as e:
        return handle_mongo_error(e, "récupération des offres")

@offres_emploi_bp.route("/offres-emploi/<string:offre_id>", methods=["GET"])
def get_offre_by_id(offre_id):
    try:
        db = current_app.mongo.db
        if not ObjectId.is_valid(offre_id):
            return jsonify({"error": "ID d'offre invalide."}), 400

        pipeline = [
            {"$match": {"_id": ObjectId(offre_id)}},
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
                    "entreprise_nom": {"$ifNull": ["$entreprise.nom", "Entreprise non spécifiée"]},
                    "date_creation": {"$ifNull": ["$date_creation", datetime.now(timezone.utc)]},
                    "statut": 1
                }
            }
        ]

        offres = list(db.offres.aggregate(pipeline))
        if not offres:
            return jsonify({"error": "Offre non trouvée."}), 404

        offre = offres[0]
        data = {
            "id": str(offre["_id"]),
            "titre": offre.get("titre", "Titre non spécifié"),
            "description": offre.get("description", "Description non disponible"),
            "localisation": offre.get("localisation", "Localisation non spécifiée"),
            "departement": offre.get("departement", "Département non spécifié"),
            "entreprise": offre.get("entreprise_nom"),
            "date_creation": (offre.get("date_creation") or datetime.now(timezone.utc)).isoformat() + "Z",
            "valide": offre.get("statut", "ouverte") == "ouverte"
        }

        return jsonify(data), 200

    except Exception as e:
        return handle_mongo_error(e, "récupération d'une offre")

@offres_emploi_bp.route("/candidatures", methods=["POST"])
@require_auth(role="candidat")
def create_candidature(auth_payload):
    try:
        db = current_app.mongo.db
        auth_user_id = auth_payload.get("id ocasião")
        user_db_data = auth_payload.get("user_db_data")

        if not user_db_data:
            return jsonify({"error": "Données utilisateur non trouvées."}), 404

        if "cv" not in request.files:
            return jsonify({"error": "Aucun fichier CV fourni."}), 400
        cv_file = request.files["cv"]
        if cv_file.filename == "":
            return jsonify({"error": "Aucun fichier CV sélectionné."}), 400

        ext = os.path.splitext(cv_file.filename)[1].lower()
        if ext not in {'.pdf', '.doc', '.docx'}:
            return jsonify({"error": "Type de fichier non autorisé."}), 400

        form_data = request.form
        required_fields = ["offre_id", "lettre_motivation"]
        is_valid, error = validate_required_fields(form_data, required_fields)
        if not is_valid:
            return jsonify({"error": error}), 400

        offre_id = form_data["offre_id"]
        if not ObjectId.is_valid(offre_id):
            return jsonify({"error": "ID offre invalide."}), 400

        offre = db.offres.find_one({"_id": ObjectId(offre_id)})
        if not offre:
            return jsonify({"error": "Offre introuvable."}), 404

        existing = db.candidatures.find_one({"offre_id": ObjectId(offre_id), "user_id": ObjectId(auth_user_id)})
        if existing:
            return jsonify({"error": "Déjà candidaté à cette offre."}), 400

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
            "message": "Candidature envoyée avec succès.",
            "candidature_id": str(candidature_id)
        }), 201

    except Exception as e:
        return handle_mongo_error(e, "création de la candidature")