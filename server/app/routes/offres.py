from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from datetime import datetime, timezone
import os
from werkzeug.utils import secure_filename
from functools import wraps
from auth.jwt_manager import jwt_manager
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
            payload = jwt_manager.verify_token(token)
            if not payload:
                return jsonify({"error": "Authentification requise."}), 401
            if role and payload.get("role") != role:
                return jsonify({"error": f"Accès non autorisé. Rôle '{role}' requis."}), 403
            kwargs["auth_payload"] = payload
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# --- Routes ---
@offres_emploi_bp.route('/offres-emploi', methods=['GET', 'POST'])
def handle_offres_emploi():
    if request.method == 'GET':
        try:
            db = current_app.mongo.db

            token = request.headers.get("Authorization")
            is_recruiter = False
            recruiter_id = None
            if token:
                payload = jwt_manager.verify_token(token)
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
                        "statut": 1,
                        "questions": 1
                    }
                }
            ]

            offres = db.offres.aggregate(pipeline)
            offres_list = []
            for offre in offres:
                # Gérer la date de création
                date_creation = offre.get("date_creation")
                if isinstance(date_creation, datetime):
                    date_creation_str = date_creation.isoformat() + "Z"
                elif isinstance(date_creation, str):
                    date_creation_str = date_creation
                else:
                    date_creation_str = datetime.now(timezone.utc).isoformat() + "Z"

                offres_list.append({
                    "id": str(offre["_id"]),
                    "titre": offre.get("titre", "Titre non spécifié"),
                    "description": offre.get("description", "Description non disponible"),
                    "localisation": offre.get("localisation", "Localisation non spécifiée"),
                    "departement": offre.get("departement", "Département non spécifié"),
                    "entreprise": offre.get("entreprise_nom"),
                    "date_creation": date_creation_str,
                    "valide": offre.get("statut", "ouverte") == "ouverte",
                    "questions": offre.get("questions", [])
                })

            return jsonify({"offres": offres_list}), 200

        except Exception as e:
            return handle_mongo_error(e, "récupération des offres")
    
    elif request.method == 'POST':
        try:
            db = current_app.mongo.db
            data = request.get_json()

            # Vérification du token et du rôle
            token = request.headers.get("Authorization")
            if not token:
                return jsonify({"error": "Token d'authentification manquant"}), 401

            payload = jwt_manager.verify_token(token)
            if not payload or payload.get("role") != "recruteur":
                return jsonify({"error": "Accès non autorisé"}), 403

            # Validation des champs requis
            required_fields = ["titre", "description", "localisation", "departement", "entreprise_id", "questions"]
            for field in required_fields:
                if field not in data or not data[field]:
                    return jsonify({"error": f"Le champ {field} est requis"}), 400

            # Validation des questions
            if not isinstance(data["questions"], list):
                return jsonify({"error": "Le champ questions doit être un tableau"}), 400

            for question in data["questions"]:
                if not isinstance(question, str) or not question.strip():
                    return jsonify({"error": "Chaque question doit être une chaîne de caractères non vide"}), 400

            # Vérification de l'existence de l'entreprise
            if not ObjectId.is_valid(data["entreprise_id"]):
                return jsonify({"error": "ID d'entreprise invalide"}), 400

            entreprise = db.entreprises.find_one({"_id": ObjectId(data["entreprise_id"])})
            if not entreprise:
                return jsonify({"error": "Entreprise non trouvée"}), 404

            # Création de l'offre
            offre_data = {
                "titre": data["titre"],
                "description": data["description"],
                "localisation": data["localisation"],
                "departement": data["departement"],
                "entreprise_id": ObjectId(data["entreprise_id"]),
                "recruteur_id": ObjectId(payload["id"]),
                "date_creation": datetime.now(timezone.utc),
                "date_maj": datetime.now(timezone.utc),
                "statut": "ouverte",
                "questions": data["questions"],
                "candidature_ids": []
            }

            result = db.offres.insert_one(offre_data)
            offre_data["_id"] = result.inserted_id

            # Conversion des ObjectId en strings pour la réponse
            offre_data["_id"] = str(offre_data["_id"])
            offre_data["entreprise_id"] = str(offre_data["entreprise_id"])
            offre_data["recruteur_id"] = str(offre_data["recruteur_id"])
            offre_data["date_creation"] = offre_data["date_creation"].isoformat() + "Z"
            offre_data["date_maj"] = offre_data["date_maj"].isoformat() + "Z"

            return jsonify(offre_data), 201

        except Exception as e:
            return handle_mongo_error(e, "création d'une offre")

@offres_emploi_bp.route("/offres-emploi/<string:offre_id>", methods=["GET", "PUT", "DELETE"])
def handle_offre_by_id(offre_id):
    if request.method == 'GET':
        try:
            db = current_app.mongo.db
            logger.info(f"Tentative de récupération de l'offre avec l'ID: {offre_id}")
            if not ObjectId.is_valid(offre_id):
                logger.error(f"ID invalide reçu: {offre_id}")
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
                        "statut": 1,
                        "questions": 1
                    }
                }
            ]

            offres = list(db.offres.aggregate(pipeline))
            if not offres:
                logger.error(f"Aucune offre trouvée avec l'ID: {offre_id}")
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
                "valide": offre.get("statut", "ouverte") == "ouverte",
                "questions": offre.get("questions", [])
            }

            return jsonify(data), 200

        except Exception as e:
            logger.error(f"Erreur lors de la récupération de l'offre: {str(e)}")
            return handle_mongo_error(e, "récupération d'une offre")
    
    elif request.method == 'PUT':
        try:
            db = current_app.mongo.db
            logger.info(f"Tentative de modification de l'offre avec l'ID: {offre_id}")
            
            # Vérification du token et du rôle
            token = request.headers.get("Authorization")
            if not token:
                logger.error("Token d'authentification manquant")
                return jsonify({"error": "Token d'authentification manquant"}), 401

            payload = jwt_manager.verify_token(token)
            if not payload or payload.get("role") != "recruteur":
                logger.error(f"Accès non autorisé pour le token: {token[:10]}...")
                return jsonify({"error": "Accès non autorisé"}), 403

            data = request.get_json()
            if not data:
                logger.error("Aucune donnée fournie pour la modification")
                return jsonify({"error": "Aucune donnée fournie"}), 400

            # Vérification de la validité de l'ID
            if not ObjectId.is_valid(offre_id):
                logger.error(f"ID invalide reçu: {offre_id}")
                return jsonify({"error": "ID d'offre invalide."}), 400

            # Vérification de l'existence de l'offre
            offre = db.offres.find_one({"_id": ObjectId(offre_id)})
            if not offre:
                logger.error(f"Aucune offre trouvée avec l'ID: {offre_id}")
                return jsonify({"error": "Offre non trouvée"}), 404

            # Vérification que le recruteur est bien le propriétaire de l'offre
            if str(offre.get("recruteur_id")) != payload.get("id"):
                logger.error(f"Tentative de modification par un recruteur non autorisé. ID recruteur: {payload.get('id')}, ID propriétaire: {offre.get('recruteur_id')}")
                return jsonify({"error": "Vous n'êtes pas autorisé à modifier cette offre"}), 403

            # Préparation des données à mettre à jour
            update_data = {
                "date_maj": datetime.now(timezone.utc)
            }

            # Mise à jour des champs fournis
            if "titre" in data:
                update_data["titre"] = data["titre"]
            if "description" in data:
                update_data["description"] = data["description"]
            if "localisation" in data:
                update_data["localisation"] = data["localisation"]
            if "departement" in data:
                update_data["departement"] = data["departement"]
            if "statut" in data:
                update_data["statut"] = data["statut"]
            if "questions" in data:
                # Validation des questions
                if not isinstance(data["questions"], list):
                    return jsonify({"error": "Le champ questions doit être un tableau"}), 400

                for question in data["questions"]:
                    if not isinstance(question, str) or not question.strip():
                        return jsonify({"error": "Chaque question doit être une chaîne de caractères non vide"}), 400

                update_data["questions"] = data["questions"]

            logger.info(f"Données à mettre à jour: {update_data}")

            # Mise à jour dans la base de données
            result = db.offres.update_one(
                {"_id": ObjectId(offre_id)},
                {"$set": update_data}
            )

            if result.modified_count == 0:
                logger.warning(f"Aucune modification effectuée pour l'offre: {offre_id}")
                return jsonify({"error": "Aucune modification effectuée"}), 400

            # Récupération de l'offre mise à jour
            updated_offre = db.offres.find_one({"_id": ObjectId(offre_id)})
            
            # Conversion des ObjectId en strings pour la réponse
            updated_offre["_id"] = str(updated_offre["_id"])
            updated_offre["entreprise_id"] = str(updated_offre["entreprise_id"])
            updated_offre["recruteur_id"] = str(updated_offre["recruteur_id"])
            updated_offre["date_creation"] = updated_offre["date_creation"].isoformat() + "Z"
            updated_offre["date_maj"] = updated_offre["date_maj"].isoformat() + "Z"

            logger.info(f"Offre mise à jour avec succès: {updated_offre['_id']}")
            return jsonify(updated_offre), 200

        except Exception as e:
            logger.error(f"Erreur lors de la modification de l'offre: {str(e)}")
            return handle_mongo_error(e, "modification d'une offre")
    
    elif request.method == 'DELETE':
        try:
            db = current_app.mongo.db
            logger.info(f"Tentative de suppression de l'offre avec l'ID: {offre_id}")
            
            # Vérification du token et du rôle
            token = request.headers.get("Authorization")
            if not token:
                logger.error("Token d'authentification manquant")
                return jsonify({"error": "Token d'authentification manquant"}), 401

            payload = jwt_manager.verify_token(token)
            if not payload or payload.get("role") != "recruteur":
                logger.error(f"Accès non autorisé pour le token: {token[:10]}...")
                return jsonify({"error": "Accès non autorisé"}), 403

            # Vérification de la validité de l'ID
            try:
                object_id = ObjectId(offre_id)
                logger.info(f"ID converti en ObjectId: {object_id}")
            except Exception as e:
                logger.error(f"Erreur de conversion de l'ID en ObjectId: {str(e)}")
                return jsonify({"error": "ID d'offre invalide."}), 400

            # Vérification de l'existence de l'offre
            offre = db.offres.find_one({"_id": object_id})
            if not offre:
                logger.error(f"Aucune offre trouvée avec l'ID: {offre_id}")
                return jsonify({"error": "Offre non trouvée"}), 404

            # Vérification que le recruteur est bien le propriétaire de l'offre
            if str(offre.get("recruteur_id")) != payload.get("id"):
                logger.error(f"Tentative de suppression par un recruteur non autorisé. ID recruteur: {payload.get('id')}, ID propriétaire: {offre.get('recruteur_id')}")
                return jsonify({"error": "Vous n'êtes pas autorisé à supprimer cette offre"}), 403

            # Suppression de l'offre
            result = db.offres.delete_one({"_id": object_id})

            if result.deleted_count == 0:
                logger.warning(f"Aucune offre supprimée avec l'ID: {offre_id}")
                return jsonify({"error": "Aucune offre supprimée"}), 400

            logger.info(f"Offre supprimée avec succès: {offre_id}")
            return jsonify({"message": "Offre supprimée avec succès"}), 200

        except Exception as e:
            logger.error(f"Erreur lors de la suppression de l'offre: {str(e)}")
            return handle_mongo_error(e, "suppression d'une offre")

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