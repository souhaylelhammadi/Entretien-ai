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
        doc["entreprise"] = {
            "id": str(doc["entreprise"]["_id"]),
            "nom": doc["entreprise"].get("nom", "N/A"),
            "secteur": doc["entreprise"].get("secteur", "N/A")
        }
    if "recruteur" in doc and isinstance(doc["recruteur"], dict) and "_id" in doc["recruteur"]:
        doc["recruteur"]["_id"] = str(doc["recruteur"]["_id"])
    if "candidature_ids" in doc and isinstance(doc["candidature_ids"], list):
        doc["candidature_ids"] = [str(cid) for cid in doc["candidature_ids"] if ObjectId.is_valid(str(cid))]
    if "created_at" in doc and isinstance(doc["created_at"], datetime):
        doc["created_at"] = doc["created_at"].isoformat() + "Z"
    if "updated_at" in doc and isinstance(doc["updated_at"], datetime):
        doc["updated_at"] = doc["updated_at"].isoformat() + "Z"
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
    return jsonify({"error": f"Échec de {operation} l'offre d'emploi.", "details": str(e)}), 500

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
@offres_emploi_bp.route('/offres-emploi', methods=['GET'])
def get_offres_emploi():
    """Retrieve job offers with pagination - all offers for candidates, only recruiter's offers for recruiters"""
    try:
        db = current_app.mongo.db
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        
        # Check if there's an authenticated recruiter
        token = request.headers.get("Authorization")
        is_recruiter = False
        recruiter_id = None
        
        if token:
            try:
                decoded_payload = verify_token(token)
                if decoded_payload and decoded_payload.get("role") == "recruteur":
                    is_recruiter = True
                    recruiter_id = decoded_payload.get("id")
                    logger.info(f"Authenticated recruiter {recruiter_id} viewing job offers")
            except Exception as e:
                logger.warning(f"Error verifying token: {str(e)}")
        
        # If it's a recruiter, filter offers to show only their own
        query = {}
        if is_recruiter and recruiter_id:
            # Pour les recruteurs, filtrer pour n'afficher que leurs propres offres
            # La structure dans le document d'offre est "recruteur._id" pour stocker l'ID du recruteur
            # ou parfois "recruteur_id" directement dans le document
            query = {"$or": [
                {"recruteur._id": ObjectId(recruiter_id)},
                {"recruteur_id": recruiter_id}
            ]}
            logger.info(f"Filtering offers for recruiter: {recruiter_id}")
        
        offres = list(db.offres.find(query).skip((page - 1) * per_page).limit(per_page))
        total = db.offres.count_documents(query)
        
        offres_serialized = []
        for offre in offres:
            serialized = {
                'id': str(offre['_id']),
                'titre': offre.get('titre', 'Titre non spécifié'),
                'description': offre.get('description', 'Description non disponible'),
                'localisation': offre.get('localisation', 'Localisation non spécifiée'),
                'departement': offre.get('departement', 'Département non spécifié'),
                'createdAt': offre.get('created_at', datetime.now(timezone.utc)).isoformat() + "Z",
                'entreprise': offre.get('entreprise', {}).get('nom', 'Entreprise non spécifiée'),
                'recruteur': {
                    'nom': offre.get('recruteur', {}).get('nom', 'Recruteur non spécifié')
                },
                'valide': offre.get('status', 'open') == 'open'
            }
            offres_serialized.append(serialized)
        
        logger.info(f"Récupéré {len(offres_serialized)} offres, page {page}")
        return jsonify({
            'offres': offres_serialized,
            'total': total,
            'page': page,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des offres: {str(e)}")
        return jsonify({'error': 'Erreur serveur lors de la récupération des offres', 'details': str(e)}), 500

@offres_emploi_bp.route("/offres-emploi/<string:offre_id>", methods=["GET"])
def get_offre_by_id(offre_id):
    """Retrieve a single job offer by ID"""
    try:
        db = current_app.mongo.db
        if not ObjectId.is_valid(offre_id):
            return jsonify({"error": "Format d'ID d'offre invalide."}), 400
        offre = db.offres.find_one({"_id": ObjectId(offre_id)})
        if not offre:
            return jsonify({"error": "Offre non trouvée."}), 404
        
        serialized = {
            'id': str(offre['_id']),
            'titre': offre.get('titre', 'Titre non spécifié'),
            'description': offre.get('description', 'Description non disponible'),
            'localisation': offre.get('localisation', 'Localisation non spécifiée'),
            'departement': offre.get('departement', 'Département non spécifié'),
            'createdAt': offre.get('created_at', datetime.now(timezone.utc)).isoformat() + "Z",
            'entreprise': offre.get('entreprise', {}).get('nom', 'Entreprise non spécifiée'),
            'recruteur': {
                'nom': offre.get('recruteur', {}).get('nom', 'Recruteur non spécifié')
            },
            'valide': offre.get('status', 'open') == 'open',
            'salaire_min': offre.get('salaire_min', 0.0)
        }
        
        logger.info(f"Offre ID {offre_id} récupérée")
        return jsonify(serialized), 200
    except Exception as e:
        return handle_mongo_error(e, "récupérer l'offre")


@offres_emploi_bp.route("/candidatures", methods=["POST"])
@require_auth(role="candidat")
def create_candidature(auth_payload):
    """Create a new job application"""
    cv_path = None
    candidate_id = None
    candidature_id = None
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

        allowed_extensions = {'.pdf', '.doc', '.docx'}
        file_ext = os.path.splitext(cv_file.filename)[1].lower()
        if file_ext not in allowed_extensions:
            return jsonify({"error": "Type de fichier non autorisé (PDF, DOC, DOCX uniquement)."}), 400
        max_size = 5 * 1024 * 1024

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        secure_name = secure_filename(f"{timestamp}_{auth_user_id}_{cv_file.filename}")
        upload_folder = get_upload_folder()
        cv_path = os.path.join(upload_folder, secure_name)

        try:
            cv_file.save(cv_path)
            if os.path.getsize(cv_path) > max_size or os.path.getsize(cv_path) == 0:
                os.remove(cv_path)
                return jsonify({"error": "Le fichier CV est invalide ou dépasse la taille maximale de 5 Mo."}), 400
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

        # Check for duplicate candidature
        existing_candidature = db.candidatures.find_one({
            "offre_id": ObjectId(offre_id),
            "user_id": ObjectId(auth_user_id)
        })
        if existing_candidature:
            os.remove(cv_path)
            return jsonify({"error": "Vous avez déjà postulé à cette offre."}), 400

        # Ensure candidature_ids exists
        if "candidature_ids" not in offre:
            db.offres.update_one(
                {"_id": ObjectId(offre_id)},
                {"$set": {"candidature_ids": []}}
            )
            logger.info(f"Initialized candidature_ids for Offre ID: {offre_id}")

        nom = f"{user_db_data.get('firstName', '')} {user_db_data.get('lastName', '')}".strip() or "Candidat Inconnu"

        # Insert candidate
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
        logger.info(f"Candidat ID: {candidate_id} créé pour User ID: {auth_user_id}")

        # Insert candidature
        candidature_data = {
            "candidate_id": candidate_id,
            "offre_id": ObjectId(offre_id),
            "user_id": ObjectId(auth_user_id),
            "statut": "en_attente",
            "date_postulation": datetime.now(timezone.utc),
            "lettre_motivation": form_data["lettre_motivation"].strip(),
            "cv_path": cv_path,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        candidature_result = db.candidatures.insert_one(candidature_data)
        candidature_id = candidature_result.inserted_id
        logger.info(f"Candidature ID: {candidature_id} créée pour Offre ID: {offre_id}")

        # Update offres.candidature_ids
        update_result = db.offres.update_one(
            {"_id": ObjectId(offre_id)},
            {"$push": {"candidature_ids": candidature_id}}
        )
        if update_result.matched_count == 0:
            # Rollback: delete candidature and candidate
            db.candidatures.delete_one({"_id": candidature_id})
            db.candidates.delete_one({"_id": candidate_id})
            os.remove(cv_path)
            logger.error(f"Offre ID {offre_id} non trouvée lors de la mise à jour des candidature_ids")
            return jsonify({"error": "Offre non trouvée lors de la mise à jour."}), 404
        if update_result.modified_count == 0:
            logger.warning(f"No changes made to candidature_ids for Offre ID: {offre_id}")

        updated_offre = db.offres.find_one({"_id": ObjectId(offre_id)})
        logger.info(f"Candidature ID: {candidature_id} créée par User ID: {auth_user_id} pour Offre ID: {offre_id}")
        return jsonify({
            "message": "Candidature envoyée avec succès.",
            "candidature_id": str(candidature_id),
            "candidate_id": str(candidate_id),
            "offre": serialize_doc(updated_offre)
        }), 201

    except PyMongoError as e:
        # Rollback: delete any inserted documents
        if candidate_id:
            db.candidates.delete_one({"_id": candidate_id})
        if candidature_id:
            db.candidatures.delete_one({"_id": candidature_id})
        if cv_path and os.path.exists(cv_path):
            try:
                os.remove(cv_path)
                logger.info(f"Nettoyage: Fichier CV supprimé {cv_path}")
            except OSError as remove_err:
                logger.error(f"Erreur lors du nettoyage du fichier CV {cv_path}: {remove_err}")
        logger.error(f"Erreur MongoDB lors de la création de la candidature: {e}", exc_info=True)
        return jsonify({"error": "Échec de la création de la candidature.", "details": str(e)}), 500
    except Exception as e:
        # Rollback: delete any inserted documents
        if candidate_id:
            db.candidates.delete_one({"_id": candidate_id})
        if candidature_id:
            db.candidatures.delete_one({"_id": candidature_id})
        if cv_path and os.path.exists(cv_path):
            try:
                os.remove(cv_path)
                logger.info(f"Nettoyage: Fichier CV supprimé {cv_path}")
            except OSError as remove_err:
                logger.error(f"Erreur lors du nettoyage du fichier CV {cv_path}: {remove_err}")
        logger.error(f"Erreur inattendue lors de la création de la candidature: {e}", exc_info=True)
        return jsonify({"error": "Échec de la création de la candidature en raison d'une erreur interne.", "details": str(e)}), 500