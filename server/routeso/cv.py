# routes/offres_emploi.py
from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from datetime import datetime, timezone
import os
from werkzeug.utils import secure_filename

offres_emploi_bp = Blueprint('offres_emploi', __name__)

UPLOAD_FOLDER = 'Uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def serialize_doc(doc):
    if not doc:
        return None
    doc = dict(doc)
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    if "entreprise" in doc and "_id" in doc["entreprise"]:
        doc["entreprise"]["_id"] = str(doc["entreprise"]["_id"])
    if "recruteur" in doc and "_id" in doc["recruteur"]:
        doc["recruteur"]["_id"] = str(doc["recruteur"]["_id"])
    if "candidature_ids" in doc:
        doc["candidature_ids"] = [str(cid) for cid in doc["candidature_ids"]]
    return doc

def validate_required_fields(data, required_fields):
    if not data:
        return False, "Aucune donnée fournie"
    missing_fields = [field for field in required_fields if field not in data or not data[field]]
    if missing_fields:
        return False, f"Champs requis manquants : {', '.join(missing_fields)}"
    return True, None

def handle_mongo_error(e, operation):
    print(f"Erreur lors de {operation} : {e}")
    return jsonify({"error": f"Échec de {operation} l'offre d'emploi"}), 500

# Reusing verify_token from auth.py (assuming it's available)
def verify_token(token):
    """Verify JWT token"""
    from jwt import decode, ExpiredSignatureError, InvalidTokenError
    if not token or not token.startswith("Bearer "):
        return None
    token = token.split(" ")[1]
    secret = current_app.config["JWT_SECRET"]
    if current_app.mongo.db.blacklist.find_one({"token": token}):
        return None
    try:
        return decode(token, secret, algorithms=["HS256"])
    except (ExpiredSignatureError, InvalidTokenError):
        return None

@offres_emploi_bp.route("/offres-emploi", methods=["GET"])
def get_offres_emploi():
    try:
        db = current_app.mongo.db
        offres = db.offres.find()
        serialized_offres = [serialize_doc(offre) for offre in offres]
        print(f"Offres récupérées : {len(serialized_offres)}")
        return jsonify(serialized_offres), 200
    except Exception as e:
        return handle_mongo_error(e, "récupérer les offres")

@offres_emploi_bp.route("/offres-emploi/<string:offre_id>", methods=["GET"])
def get_offre_by_id(offre_id):
    try:
        db = current_app.mongo.db
        if not ObjectId.is_valid(offre_id):
            print(f"ID d'offre invalide : {offre_id}")
            return jsonify({"error": "Format d'ID d'offre invalide"}), 400
        offre = db.offres.find_one({"_id": ObjectId(offre_id)})
        if not offre:
            print(f"Offre non trouvée pour ID : {offre_id}")
            return jsonify({"error": "Offre non trouvée"}), 404
        return jsonify(serialize_doc(offre)), 200
    except Exception as e:
        return handle_mongo_error(e, "récupérer l'offre")

@offres_emploi_bp.route("/offres-emploi", methods=["POST"])
def create_offre_emploi():
    try:
        db = current_app.mongo.db
        data = request.get_json()
        required_fields = ["titre", "description", "localisation", "competences_requises", "entreprise_id", "recruteur_id"]
        is_valid, error_message = validate_required_fields(data, required_fields)
        if not is_valid:
            print(f"Erreur de validation : {error_message}")
            return jsonify({"error": error_message}), 400

        if not isinstance(data.get("competences_requises"), list):
            return jsonify({"error": "Les compétences requises doivent être une liste"}), 400

        entreprise = db.entreprises.find_one({"_id": ObjectId(data["entreprise_id"])})
        if not entreprise:
            return jsonify({"error": "Entreprise non trouvée"}), 404

        recruteur = db.recruteurs.find_one({"_id": ObjectId(data["recruteur_id"])})
        if not recruteur:
            return jsonify({"error": "Recruteur non trouvé"}), 404

        offre_data = {
            "titre": data["titre"],
            "description": data["description"],
            "localisation": data["localisation"],
            "salaire_min": data.get("salaire_min", 0.0),
            "competences_requises": data["competences_requises"],
            "entreprise": {
                "_id": ObjectId(data["entreprise_id"]),
                "nom": entreprise["nom"],
                "secteur": entreprise["secteur"]
            },
            "recruteur": {
                "_id": ObjectId(data["recruteur_id"]),
                "nom": recruteur["nom"]
            },
            "candidature_ids": [],  # Initialize empty array
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }

        result = db.offres.insert_one(offre_data)
        print(f"Offre créée avec ID : {str(result.inserted_id)}")
        return jsonify({"message": "Offre créée avec succès", "id": str(result.inserted_id)}), 201
    except Exception as e:
        return handle_mongo_error(e, "créer l'offre")

@offres_emploi_bp.route("/offres-emploi/<string:offre_id>", methods=["PUT"])
def update_offre_emploi(offre_id):
    try:
        db = current_app.mongo.db
        if not ObjectId.is_valid(offre_id):
            return jsonify({"error": "Format d'ID d'offre invalide"}), 400
        data = request.get_json()
        required_fields = ["titre", "description", "localisation", "competences_requises"]
        is_valid, error_message = validate_required_fields(data, required_fields)
        if not is_valid:
            return jsonify({"error": error_message}), 400

        if not isinstance(data.get("competences_requises"), list):
            return jsonify({"error": "Les compétences requises doivent être une liste"}), 400

        offre_data = {
            "titre": data["titre"],
            "description": data["description"],
            "localisation": data["localisation"],
            "salaire_min": data.get("salaire_min", 0.0),
            "competences_requises": data["competences_requises"],
            "updated_at": datetime.now(timezone.utc),
        }

        if "entreprise_id" in data:
            entreprise = db.entreprises.find_one({"_id": ObjectId(data["entreprise_id"])})
            if not entreprise:
                return jsonify({"error": "Entreprise non trouvée"}), 404
            offre_data["entreprise"] = {
                "_id": ObjectId(data["entreprise_id"]),
                "nom": entreprise["nom"],
                "secteur": entreprise["secteur"]
            }

        if "recruteur_id" in data:
            recruteur = db.recruteurs.find_one({"_id": ObjectId(data["recruteur_id"])})
            if not recruteur:
                return jsonify({"error": "Recruteur non trouvé"}), 404
            offre_data["recruteur"] = {
                "_id": ObjectId(data["recruteur_id"]),
                "nom": recruteur["nom"]
            }

        result = db.offres.update_one(
            {"_id": ObjectId(offre_id)},
            {"$set": offre_data}
        )
        if result.matched_count == 0:
            return jsonify({"error": "Offre non trouvée"}), 404
        return jsonify({"message": "Offre mise à jour avec succès"}), 200
    except Exception as e:
        return handle_mongo_error(e, "mettre à jour l'offre")

@offres_emploi_bp.route("/offres-emploi/<string:offre_id>", methods=["DELETE"])
def delete_offre_emploi(offre_id):
    try:
        db = current_app.mongo.db
        if not ObjectId.is_valid(offre_id):
            return jsonify({"error": "Format d'ID d'offre invalide"}), 400
        result = db.offres.delete_one({"_id": ObjectId(offre_id)})
        if result.deleted_count == 0:
            return jsonify({"error": "Offre non trouvée"}), 404
        return jsonify({"message": "Offre supprimée avec succès"}), 200
    except Exception as e:
        return handle_mongo_error(e, "supprimer l'offre")

@offres_emploi_bp.route("/candidatures", methods=["POST"])
def create_candidature():
    try:
        db = current_app.mongo.db

        # Verify authentication
        token = request.headers.get("Authorization")
        decoded = verify_token(token)
        if not decoded:
            return jsonify({"error": "Authentification requise"}), 401

        # Fetch user details
        user = db.users.find_one({"_id": ObjectId(decoded["id"])})
        if not user:
            return jsonify({"error": "Utilisateur non trouvé"}), 404

        # Check if CV file is provided
        if 'cv' not in request.files:
            return jsonify({"error": "Aucun fichier CV fourni"}), 400
        cv_file = request.files['cv']
        if cv_file.filename == '':
            return jsonify({"error": "Aucun fichier CV sélectionné"}), 400

        # Validate file extension
        allowed_extensions = {'.pdf', '.doc', '.docx'}
        file_ext = os.path.splitext(cv_file.filename)[1].lower()
        if file_ext not in allowed_extensions:
            return jsonify({"error": "Type de fichier non autorisé. Utilisez PDF, DOC ou DOCX."}), 400

        # Validate file size
        cv_file.seek(0, os.SEEK_END)
        file_size = cv_file.tell()
        cv_file.seek(0)
        if file_size > 5 * 1024 * 1024:
            return jsonify({"error": "Le fichier CV ne doit pas dépasser 5 Mo."}), 400

        # Save CV file
        filename = secure_filename(f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{cv_file.filename}")
        cv_path = os.path.join(UPLOAD_FOLDER, filename)
        cv_file.save(cv_path)
        print(f"CV enregistré à : {cv_path}")

        # Get form data
        form_data = request.form
        required_fields = ["offre_id", "lettre_motivation"]
        is_valid, error_message = validate_required_fields(form_data, required_fields)
        if not is_valid:
            os.remove(cv_path)  # Clean up uploaded file
            return jsonify({"error": error_message}), 400

        # Validate offre_id
        offre_id = form_data["offre_id"]
        if not ObjectId.is_valid(offre_id):
            os.remove(cv_path)
            return jsonify({"error": "Format d'ID d'offre invalide"}), 400
        offre = db.offres.find_one({"_id": ObjectId(offre_id)})
        if not offre:
            os.remove(cv_path)
            return jsonify({"error": "Offre non trouvée"}), 404

        # Construct nom from firstName and lastName
        nom = f"{user['firstName']} {user['lastName']}"

        # Save candidate details
        candidate_data = {
            "nom": nom,
            "email": user["email"],
            "cv": cv_path,
            "lettre_motivation": form_data["lettre_motivation"],
            "created_at": datetime.now(timezone.utc),
            "user_id": ObjectId(decoded["id"])  # Link to user account
        }
        candidate_result = db.candidates.insert_one(candidate_data)
        candidate_id = candidate_result.inserted_id

        # Save candidature
        candidature_data = {
            "candidate_id": candidate_id,
            "offre_id": ObjectId(offre_id),
            "statut": "en_attente",
            "date_postulation": datetime.now(timezone.utc),
            "cv_path": cv_path,
            "lettre_motivation": form_data["lettre_motivation"],
            "user_id": ObjectId(decoded["id"])  # Link to user account
        }
        candidature_result = db.candidatures.insert_one(candidature_data)
        candidature_id = candidature_result.inserted_id

        # Update offre with candidature ID
        db.offres.update_one(
            {"_id": ObjectId(offre_id)},
            {"$push": {"candidature_ids": candidature_id}}
        )

        print(f"Candidature créée avec ID : {str(candidature_id)}, Candidate ID : {str(candidate_id)}")
        return jsonify({
            "message": "Candidature envoyée avec succès",
            "candidature_id": str(candidature_id),
            "candidate_id": str(candidate_id)
        }), 201
    except Exception as e:
        print(f"Erreur lors de la création de la candidature : {e}")
        if 'cv_path' in locals() and os.path.exists(cv_path):
            os.remove(cv_path)
        return jsonify({"error": "Échec de la création de la candidature"}), 500