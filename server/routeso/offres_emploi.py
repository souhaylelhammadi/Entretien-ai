from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from datetime import datetime, timezone
import os
from werkzeug.utils import secure_filename
from jwt import decode, ExpiredSignatureError, InvalidTokenError
from functools import wraps
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

offres_emploi_bp = Blueprint('offres_emploi', __name__)

# --- Helper Functions ---
def get_upload_folder():
    """Get UPLOAD_FOLDER from app config, ensuring the folder exists."""
    upload_folder = current_app.config.get("UPLOAD_FOLDER", os.path.join(os.getcwd(), "Uploads"))
    if not os.path.exists(upload_folder):
        try:
            os.makedirs(upload_folder, exist_ok=True)
            logger.info(f"Created upload folder: {upload_folder}")
        except OSError as e:
            logger.error(f"Error creating upload folder {upload_folder}: {e}")
    return upload_folder

def serialize_doc(doc):
    """Serialize MongoDB doc, converting ObjectIds."""
    if not doc:
        return None
    doc = dict(doc)
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    if "entreprise" in doc and isinstance(doc["entreprise"], dict) and "_id" in doc["entreprise"]:
        doc["entreprise"]["_id"] = str(doc["entreprise"]["_id"])
    if "recruteur" in doc and isinstance(doc["recruteur"], dict) and "_id" in doc["recruteur"]:
        doc["recruteur"]["_id"] = str(doc["recruteur"]["_id"])
    if "candidature_ids" in doc and isinstance(doc["candidature_ids"], list):
        doc["candidature_ids"] = [str(cid) for cid in doc["candidature_ids"] if ObjectId.is_valid(str(cid))]
    if "created_at" in doc and isinstance(doc["created_at"], datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    if "updated_at" in doc and isinstance(doc["updated_at"], datetime):
        doc["updated_at"] = doc["updated_at"].isoformat()
    return doc

def validate_required_fields(data, required_fields):
    """Validate required fields are present and non-empty."""
    if not data:
        return False, "Aucune donnée fournie"
    missing = [f for f in required_fields if f not in data or (isinstance(data[f], str) and not data[f].strip())]
    if missing:
        return False, f"Champs requis manquants ou vides : {', '.join(missing)}"
    return True, None

def handle_mongo_error(e, operation):
    """Handle MongoDB errors."""
    error_message = f"Erreur base de données lors de {operation} l'offre"
    logger.error(f"{error_message}: {e}", exc_info=True)
    return jsonify({"error": f"Échec de {operation} l'offre d'emploi."}), 500

def verify_token(token_header):
    """Verify JWT token from Authorization header."""
    if not token_header or not token_header.startswith("Bearer "):
        logger.warning("Token missing or invalid format")
        return None
    token = token_header.split(" ")[1]
    try:
        secret = current_app.config["JWT_SECRET"]
        payload = decode(token, secret, algorithms=["HS256"])
        if "id" not in payload or "role" not in payload:
            logger.warning("Token payload missing required fields (id, role)")
            return None
        user = current_app.mongo.db.users.find_one({"_id": ObjectId(payload["id"])})
        if not user:
            logger.warning(f"User ID {payload['id']} from token not found in DB")
            return None
        payload["user_db_data"] = serialize_doc(user)
        return payload
    except ExpiredSignatureError:
        logger.warning("Token has expired")
        return None
    except InvalidTokenError as e:
        logger.warning(f"Invalid token: {e}")
        return None
    except Exception as e:
        logger.error(f"Token verification error: {e}", exc_info=True)
        return None

def require_auth(role="recruteur"):
    """Decorator to require authentication and specific role."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            token = request.headers.get("Authorization")
            decoded_payload = verify_token(token)
            if not decoded_payload:
                return jsonify({"error": "Authentification requise ou invalide."}), 401
            if role and decoded_payload.get("role") != role:
                return jsonify({"error": f"Accès non autorisé. Rôle '{role}' requis."}), 403
            kwargs['auth_payload'] = decoded_payload
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# --- Routes ---
@offres_emploi_bp.route("/offres-emploi", methods=["GET"])
def get_offres_emploi():
    try:
        db = current_app.mongo.db
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 10))
        offres = list(db.offres.find().sort("created_at", -1).skip((page - 1) * per_page).limit(per_page))
        total = db.offres.count_documents({})
        serialized_offres = [serialize_doc(offre) for offre in offres]
        return jsonify({
            "offres": serialized_offres,
            "total": total,
            "page": page,
            "per_page": per_page
        }), 200
    except Exception as e:
        return handle_mongo_error(e, "récupérer les offres")

@offres_emploi_bp.route("/offres-emploi/<string:offre_id>", methods=["GET"])
def get_offre_by_id(offre_id):
    try:
        db = current_app.mongo.db
        if not ObjectId.is_valid(offre_id):
            return jsonify({"error": "Format d'ID d'offre invalide."}), 400
        offre = db.offres.find_one({"_id": ObjectId(offre_id)})
        if not offre:
            return jsonify({"error": "Offre non trouvée."}), 404
        return jsonify(serialize_doc(offre)), 200
    except Exception as e:
        return handle_mongo_error(e, "récupérer l'offre")

@offres_emploi_bp.route("/offres-emploi", methods=["POST"])
@require_auth(role="recruteur")
def create_offre_emploi(auth_payload):
    try:
        db = current_app.mongo.db
        data = request.get_json()
        required_fields = ["titre", "description", "localisation", "departement", "competences_requises", "entreprise_id", "recruteur_id"]
        is_valid, error_message = validate_required_fields(data, required_fields)
        if not is_valid:
            return jsonify({"error": error_message}), 400

        auth_user_id = auth_payload.get("id")
        auth_entreprise_id = auth_payload.get("user_db_data", {}).get("entreprise_id")
        if data["recruteur_id"] != auth_user_id:
            return jsonify({"error": "Non autorisé à créer une offre pour un autre recruteur."}), 403
        if data["entreprise_id"] != str(auth_entreprise_id):
            return jsonify({"error": "Non autorisé à créer une offre pour cette entreprise."}), 403

        if not isinstance(data.get("competences_requises"), list):
            return jsonify({"error": "Les compétences requises doivent être une liste."}), 400
        if not ObjectId.is_valid(data["entreprise_id"]) or not ObjectId.is_valid(data["recruteur_id"]):
            return jsonify({"error": "Format d'ID d'entreprise ou de recruteur invalide."}), 400

        entreprise = db.entreprises.find_one({"_id": ObjectId(data["entreprise_id"])})
        recruteur = db.users.find_one({"_id": ObjectId(data["recruteur_id"]), "role": "recruteur"})
        if not entreprise:
            return jsonify({"error": "Entreprise non trouvée."}), 404
        if not recruteur:
            return jsonify({"error": "Recruteur non trouvé ou rôle invalide."}), 404

        offre_data = {
            "titre": data["titre"].strip(),
            "description": data["description"].strip(),
            "localisation": data["localisation"].strip(),
            "departement": data["departement"].strip(),
            "salaire_min": float(data.get("salaire_min", 0.0)),
            "competences_requises": [skill.strip() for skill in data["competences_requises"] if isinstance(skill, str) and skill.strip()],
            "entreprise": {
                "_id": entreprise["_id"],
                "nom": entreprise.get("nom", "N/A"),
                "secteur": entreprise.get("secteur", "N/A")
            },
            "recruteur": {
                "_id": recruteur["_id"],
                "nom": f"{recruteur.get('firstName', '')} {recruteur.get('lastName', '')}".strip() or recruteur.get("email")
            },
            "candidature_ids": [],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "status": data.get("status", "open")
        }

        result = db.offres.insert_one(offre_data)
        logger.info(f"Offre créée ID : {result.inserted_id} par Recruteur ID: {auth_user_id}")
        created_offre = db.offres.find_one({"_id": result.inserted_id})
        return jsonify(serialize_doc(created_offre)), 201

    except Exception as e:
        return handle_mongo_error(e, "créer l'offre")

@offres_emploi_bp.route("/offres-emploi/<string:offre_id>", methods=["PUT"])
@require_auth(role="recruteur")
def update_offre_emploi(offre_id, auth_payload):
    try:
        db = current_app.mongo.db
        if not ObjectId.is_valid(offre_id):
            return jsonify({"error": "Format d'ID d'offre invalide."}), 400

        data = request.get_json()
        updatable_fields = ["titre", "description", "localisation", "departement", "competences_requises", "salaire_min", "status"]
        required_fields_for_update = ["titre", "description", "localisation", "departement", "competences_requises"]
        is_valid, error_message = validate_required_fields(data, required_fields_for_update)
        if not is_valid:
            return jsonify({"error": error_message}), 400

        if "competences_requises" in data and not isinstance(data["competences_requises"], list):
            return jsonify({"error": "Les compétences requises doivent être une liste."}), 400

        offre = db.offres.find_one({"_id": ObjectId(offre_id)})
        if not offre:
            return jsonify({"error": "Offre non trouvée."}), 404

        auth_user_id = auth_payload.get("id")
        if str(offre.get("recruteur", {}).get("_id")) != auth_user_id:
            return jsonify({"error": "Non autorisé à modifier cette offre d'emploi."}), 403
        if str(offre.get("entreprise", {}).get("_id")) != auth_payload.get("user_db_data", {}).get("entreprise_id"):
            return jsonify({"error": "Non autorisé à modifier cette offre d'emploi."}), 403

        update_data = {}
        for field in updatable_fields:
            if field in data:
                if isinstance(data[field], str):
                    update_data[field] = data[field].strip()
                elif field == "competences_requises":
                    update_data[field] = [skill.strip() for skill in data[field] if isinstance(skill, str) and skill.strip()]
                elif field == "salaire_min":
                    update_data[field] = float(data.get("salaire_min", 0.0))
                else:
                    update_data[field] = data[field]

        if not update_data:
            return jsonify({"error": "Aucune donnée à mettre à jour fournie."}), 400

        update_data["updated_at"] = datetime.now(timezone.utc)

        result = db.offres.update_one(
            {"_id": ObjectId(offre_id)},
            {"$set": update_data}
        )

        logger.info(f"Offre ID {offre_id} mise à jour par Recruteur ID: {auth_user_id}")
        updated_offre = db.offres.find_one({"_id": ObjectId(offre_id)})
        return jsonify(serialize_doc(updated_offre)), 200

    except Exception as e:
        return handle_mongo_error(e, "mettre à jour l'offre")

@offres_emploi_bp.route("/offres-emploi/<string:offre_id>", methods=["DELETE"])
@require_auth(role="recruteur")
def delete_offre_emploi(offre_id, auth_payload):
    try:
        db = current_app.mongo.db
        if not ObjectId.is_valid(offre_id):
            return jsonify({"error": "Format d'ID d'offre invalide."}), 400

        offre = db.offres.find_one({"_id": ObjectId(offre_id)})
        if not offre:
            return jsonify({"error": "Offre non trouvée."}), 404

        auth_user_id = auth_payload.get("id")
        if str(offre.get("recruteur", {}).get("_id")) != auth_user_id:
            return jsonify({"error": "Non autorisé à supprimer cette offre d'emploi."}), 403
        if str(offre.get("entreprise", {}).get("_id")) != auth_payload.get("user_db_data", {}).get("entreprise_id"):
            return jsonify({"error": "Non autorisé à supprimer cette offre d'emploi."}), 403

        result = db.offres.delete_one({"_id": ObjectId(offre_id)})
        logger.info(f"Offre ID {offre_id} supprimée par Recruteur ID: {auth_user_id}")
        return jsonify({"message": "Offre supprimée avec succès."}), 200

    except Exception as e:
        return handle_mongo_error(e, "supprimer l'offre")

@offres_emploi_bp.route("/candidatures", methods=["POST"])
@require_auth(role="candidat")
def create_candidature(auth_payload):
    try:
        db = current_app.mongo.db
        auth_user_id = auth_payload.get("id")
        user_db_data = auth_payload.get("user_db_data")
        if not user_db_data:
            return jsonify({"error": "Détails utilisateur non trouvés."}), 404

        if 'cv' not in request.files:
            return jsonify({"error": "Aucun fichier CV fourni."}), 400
        cv_file = request.files['cv']
        if cv_file.filename == '':
            return jsonify({"error": "Aucun fichier CV sélectionné."}), 400

        allowed_extensions = {'.pdf'}
        file_ext = os.path.splitext(cv_file.filename)[1].lower()
        if file_ext not in allowed_extensions:
            return jsonify({"error": "Type de fichier non autorisé (PDF uniquement)."}), 400
        max_size = 5 * 1024 * 1024

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        secure_name = secure_filename(f"{timestamp}_{auth_user_id}_{cv_file.filename}")
        upload_folder = get_upload_folder()
        cv_path = os.path.join(upload_folder, secure_name)

        try:
            cv_file.save(cv_path)
            if os.path.getsize(cv_path) > max_size:
                os.remove(cv_path)
                return jsonify({"error": "Le fichier CV dépasse la taille maximale de 5 Mo."}), 400
            logger.info(f"CV enregistré: {cv_path}")
        except Exception as e:
            logger.error(f"Erreur lors de l'enregistrement du fichier CV: {e}")
            return jsonify({"error": "Impossible d'enregistrer le fichier CV."}), 500

        form_data = request.form
        required_fields = ["offre_id", "lettre_motivation"]
        is_valid, error_message = validate_required_fields(form_data, required_fields)
        if not is_valid:
            os.remove(cv_path)
            return jsonify({"error": error_message}), 400

        offre_id = form_data["offre_id"]
        if not ObjectId.is_valid(offre_id):
            os.remove(cv_path)
            return jsonify({"error": "Format d'ID d'offre invalide."}), 400
        offre = db.offres.find_one({"_id": ObjectId(offre_id)})
        if not offre:
            os.remove(cv_path)
            return jsonify({"error": "Offre d'emploi non trouvée."}), 404

        nom = f"{user_db_data.get('firstName', '')} {user_db_data.get('lastName', '')}".strip() or "Candidat Inconnu"

        candidate_data = {
            "user_id": ObjectId(auth_user_id),
            "nom": nom,
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
            "statut": "en_attente",
            "date_postulation": datetime.now(timezone.utc),
            "lettre_motivation": form_data["lettre_motivation"].strip(),
            "cv_path": cv_path,
        }
        candidature_result = db.candidatures.insert_one(candidature_data)
        candidature_id = candidature_result.inserted_id

        db.offres.update_one(
            {"_id": ObjectId(offre_id)},
            {"$push": {"candidature_ids": candidature_id}}
        )

        logger.info(f"Candidature ID: {candidature_id} créée par User ID: {auth_user_id} pour Offre ID: {offre_id}")
        return jsonify({
            "message": "Candidature envoyée avec succès.",
            "candidature_id": str(candidature_id),
            "candidate_id": str(candidate_id)
        }), 201

    except Exception as e:
        if 'cv_path' in locals() and os.path.exists(cv_path):
            try:
                os.remove(cv_path)
                logger.info(f"Nettoyage: Fichier CV supprimé {cv_path}")
            except OSError as remove_err:
                logger.error(f"Erreur lors du nettoyage du fichier CV {cv_path}: {remove_err}")
        logger.error(f"Erreur inattendue lors de la création de la candidature: {e}", exc_info=True)
        return jsonify({"error": "Échec de la création de la candidature en raison d'une erreur interne."}), 500