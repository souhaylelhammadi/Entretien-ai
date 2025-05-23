from flask import Blueprint, jsonify, request, current_app, send_from_directory
from bson import ObjectId
from datetime import datetime, timezone
from jwt_manager import jwt_manager
import logging
from flask_cors import cross_origin
from pymongo.errors import PyMongoError
from gridfs import GridFS
import json
import os

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Créer le blueprint
entretiens_bp = Blueprint('entretiens', __name__, url_prefix='/api/candidates/entretiens')

# Noms des collections
ENTRETIENS_COLLECTION = 'entretiens'
UTILISATEURS_COLLECTION = 'utilisateur'
RECRUTEURS_COLLECTION = 'recruteurs'
QUESTIONS_COLLECTION = 'questions'

# Dossier pour stocker les vidéos localement
UPLOAD_FOLDER = 'Uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def serialize_doc(doc):
    """Serialize MongoDB document to JSON-compatible format."""
    if not doc:
        return None
    doc = doc.copy()
    for key in list(doc.keys()):
        if key.endswith('_id') and isinstance(doc[key], ObjectId):
            new_key = key.replace('_id', 'Id')
            doc[new_key] = str(doc[key])
            del doc[key]
        elif isinstance(doc[key], ObjectId):
            doc[key] = str(doc[key])
    for date_field, new_field in [
        ('date_prevue', 'datePrevue'),
        ('date_creation', 'dateCreation'),
        ('date_maj', 'dateMaj'),
        ('completed_at', 'completedAt'),
    ]:
        if date_field in doc:
            doc[new_field] = doc[date_field].isoformat() if doc[date_field] else None
            del doc[date_field]
    return doc

def get_user_from_token(token):
    """Extract user information from token."""
    if not token:
        logger.error("Aucun token fourni")
        return None
    if isinstance(token, str) and token.startswith("Bearer "):
        token = token.split(" ")[1]
    try:
        data = jwt_manager.verify_token(token)
        if not data:
            logger.error("Token invalide: données vides")
            return None
        user_id = None
        roles = []
        if isinstance(data, dict):
            user_id = data.get("sub")
            if "roles" in data and isinstance(data["roles"], list):
                roles = data["roles"]
            elif "role" in data:
                roles = [data["role"]]
        elif isinstance(data, str):
            user_id = data
            roles = ["candidat"]  # Correction : rôle par défaut pour les candidats
        if not user_id:
            logger.error("Token invalide: ID utilisateur manquant")
            return None
        logger.info(f"Token verified: user_id={user_id}, roles={roles}, email={data.get('email', '') if isinstance(data, dict) else ''}")
        return {
            "id": str(user_id),
            "roles": roles,
            "email": data.get("email", "") if isinstance(data, dict) else ""
        }
    except Exception as e:
        logger.error(f"Erreur lors de la vérification du token: {str(e)}")
        return None

def validate_interview_data(interview):
    """Validate interview data structure."""
    required_fields = ['_id', 'candidat_id', 'statut']  # Changement de recruteur_id à candidat_id
    missing_fields = [field for field in required_fields if field not in interview or not interview[field]]
    if missing_fields:
        logger.warning(f"Entretien {interview.get('_id')} invalide: champs manquants: {', '.join(missing_fields)}")
        return False
    for field in ['candidat_id']:
        try:
            ObjectId(interview[field])
        except:
            logger.warning(f"ID invalide pour {field}: {interview[field]}")
            return False
    return True

@entretiens_bp.route("/<entretien_id>", methods=["GET"])
@cross_origin(origins="http://localhost:3000")
def get_entretien(entretien_id):
    """Retrieve a specific interview by ID."""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({"error": "Authentification requise", "code": "NO_TOKEN"}), 401
        user = get_user_from_token(auth_header)
        if not user:
            return jsonify({"error": "Token invalide ou expiré", "code": "INVALID_TOKEN"}), 401
        if 'candidat' not in user.get('roles', []):
            return jsonify({"error": "Accès réservé aux candidats", "code": "UNAUTHORIZED_ROLE"}), 403
        
        try:
            entretien_obj_id = ObjectId(entretien_id)
        except:
            return jsonify({"error": "ID d'entretien invalide", "code": "INVALID_ID"}), 400

        db = current_app.mongo
        if db is None:
            return jsonify({"error": "Base de données non initialisée", "code": "DB_NOT_INITIALIZED"}), 500

        # Log the search parameters
        logger.info(f"Recherche de l'entretien {entretien_id} pour candidat {user.get('id')}")
        
        # First check if the interview exists at all
        entretien = db[ENTRETIENS_COLLECTION].find_one({"_id": entretien_obj_id})
        if not entretien:
            logger.error(f"Entretien {entretien_id} non trouvé dans la base de données")
            return jsonify({"error": "Entretien non trouvé", "code": "INTERVIEW_NOT_FOUND"}), 404
            
        # Then check if it belongs to the candidate
        if str(entretien.get('candidat_id')) != user.get('id'):
            logger.error(f"Entretien {entretien_id} appartient à {entretien.get('candidat_id')} mais le candidat est {user.get('id')}")
            return jsonify({"error": "Accès non autorisé à cet entretien", "code": "UNAUTHORIZED_ACCESS"}), 403

        # Add questions
        questions = db[QUESTIONS_COLLECTION].find_one({"_id": ObjectId(entretien.get('questions_id'))})
        entretien_data = serialize_doc(entretien)
        entretien_data['questions'] = questions.get('questions', [
            {"text": "Expliquez le concept de polymorphisme en programmation orientée objet."},
            {"text": "Comment optimiseriez-vous une requête SQL pour une table avec des millions de lignes ?"},
            {"text": "Décrivez les différences entre REST et GraphQL."},
            {"text": "Comment géreriez-vous une panne critique d'un serveur en production ?"}
        ]) if questions else [
            {"text": "Expliquez le concept de polymorphisme en programmation orientée objet."},
            {"text": "Comment optimiseriez-vous une requête SQL pour une table avec des millions de lignes ?"},
            {"text": "Décrivez les différences entre REST et GraphQL."},
            {"text": "Comment géreriez-vous une panne critique d'un serveur en production ?"}
        ]
        
        logger.info(f"Entretien {entretien_id} trouvé et autorisé pour le candidat {user.get('id')}")
        return jsonify({"success": True, "interview": entretien_data}), 200
    except PyMongoError as e:
        logger.error(f"Erreur MongoDB: {str(e)}")
        return jsonify({"error": "Erreur de base de données", "code": "DB_ERROR"}), 500
    except Exception as e:
        logger.error(f"Erreur serveur: {str(e)}")
        return jsonify({"error": "Erreur serveur", "code": "SERVER_ERROR"}), 500

@entretiens_bp.route("/<entretien_id>/recordings", methods=["POST"])
@cross_origin(origins="http://localhost:3000")
def save_recording(entretien_id):
    """Save recordings and videos for an interview."""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({"error": "Authentification requise", "code": "NO_TOKEN"}), 401
        user = get_user_from_token(auth_header)
        if not user:
            return jsonify({"error": "Token invalide ou expiré", "code": "INVALID_TOKEN"}), 401
        if 'candidat' not in user.get('roles', []):  # Correction : vérification du rôle candidat
            return jsonify({"error": "Accès réservé aux candidats", "code": "UNAUTHORIZED_ROLE"}), 403

        try:
            entretien_obj_id = ObjectId(entretien_id)
        except:
            return jsonify({"error": "ID d'entretien invalide", "code": "INVALID_ID"}), 400

        db = current_app.mongo
        if db is None:
            return jsonify({"error": "Base de données non initialisée", "code": "DB_NOT_INITIALIZED"}), 500

        entretien = db[ENTRETIENS_COLLECTION].find_one({"_id": entretien_obj_id})
        if not entretien:
            return jsonify({"error": "Entretien non trouvé", "code": "INTERVIEW_NOT_FOUND"}), 404

        # Handle form-data with video files
        if request.content_type.startswith('multipart/form-data'):
            metadata = json.loads(request.form.get('metadata', '{}'))
            recordings = metadata.get('recordings', [])
            interview_dir = os.path.join(UPLOAD_FOLDER, str(entretien_id))
            os.makedirs(interview_dir, exist_ok=True)

            video_paths = []
            for i, recording in enumerate(recordings):
                video_file = request.files.get(f'video_{i}')
                if video_file:
                    filename = f'question_{i}.webm'
                    filepath = os.path.join(interview_dir, filename)
                    video_file.save(filepath)
                    recording['video_path'] = filepath
                    video_paths.append(filepath)

            update_result = db[ENTRETIENS_COLLECTION].update_one(
                {"_id": entretien_obj_id},
                {
                    "$set": {
                        "recordings": recordings,
                        "statut": "terminé",
                        "completed_at": datetime.now(timezone.utc),
                        "date_maj": datetime.now(timezone.utc),
                        "video_paths": video_paths
                    }
                }
            )

            if update_result.modified_count == 0:
                return jsonify({"error": "Échec de la mise à jour", "code": "UPDATE_FAILED"}), 500

            return jsonify({"success": True, "message": "Enregistrements sauvegardés", "video_paths": video_paths}), 200

        else:
            return jsonify({"error": "Content-Type non supporté", "code": "UNSUPPORTED_CONTENT_TYPE"}), 400

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB: {str(e)}")
        return jsonify({"error": "Erreur de base de données", "code": "DB_ERROR"}), 500
    except Exception as e:
        logger.error(f"Erreur serveur: {str(e)}")
        return jsonify({"error": "Erreur serveur", "code": "SERVER_ERROR"}), 500

@entretiens_bp.route("/<entretien_id>/recordings", methods=["GET"])
@cross_origin(origins="http://localhost:3000")
def get_recordings(entretien_id):
    """Retrieve recordings and video URLs for an interview."""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({"error": "Authentification requise", "code": "NO_TOKEN"}), 401
        user = get_user_from_token(auth_header)
        if not user:
            return jsonify({"error": "Token invalide ou expiré", "code": "INVALID_TOKEN"}), 401
        if 'candidat' not in user.get('roles', []):
            return jsonify({"error": "Accès réservé aux candidats", "code": "UNAUTHORIZED_ROLE"}), 403

        try:
            entretien_obj_id = ObjectId(entretien_id)
        except:
            return jsonify({"error": "ID d'entretien invalide", "code": "INVALID_ID"}), 400

        db = current_app.mongo
        if db is None:
            return jsonify({"error": "Base de données non initialisée", "code": "DB_NOT_INITIALIZED"}), 500

        # Log the search parameters
        logger.info(f"Recherche des enregistrements pour l'entretien {entretien_id} et candidat {user.get('id')}")
        
        # First check if the interview exists and belongs to the candidate
        entretien = db[ENTRETIENS_COLLECTION].find_one({
            "_id": entretien_obj_id,
            "candidat_id": ObjectId(user.get('id'))
        })
        
        if not entretien:
            logger.error(f"Entretien {entretien_id} non trouvé ou non autorisé pour candidat {user.get('id')}")
            return jsonify({"error": "Entretien non trouvé ou non autorisé", "code": "INTERVIEW_NOT_FOUND"}), 404

        # Get recordings and video URLs
        recordings = entretien.get('recordings', [])
        video_paths = entretien.get('video_paths', [])
        video_urls = [
            f"/api/candidates/entretiens/uploads/{os.path.basename(path)}" 
            for path in video_paths
        ]

        logger.info(f"Enregistrements trouvés pour l'entretien {entretien_id}: {len(recordings)} enregistrements")
        return jsonify({
            "success": True,
            "recordings": recordings,
            "video_urls": video_urls
        }), 200
    except PyMongoError as e:
        logger.error(f"Erreur MongoDB: {str(e)}")
        return jsonify({"error": "Erreur de base de données", "code": "DB_ERROR"}), 500
    except Exception as e:
        logger.error(f"Erreur serveur: {str(e)}")
        return jsonify({"error": "Erreur serveur", "code": "SERVER_ERROR"}), 500

@entretiens_bp.route("/uploads/<filename>", methods=["GET"])
@cross_origin(origins="http://localhost:3000")
def serve_video(filename):
    """Serve video files from the uploads folder."""
    try:
        return send_from_directory(UPLOAD_FOLDER, filename)
    except Exception as e:
        logger.error(f"Erreur lors de la récupération du fichier vidéo: {str(e)}")
        return jsonify({"error": "Fichier non trouvé", "code": "FILE_NOT_FOUND"}), 404

# Helper function to check if interview exists
def interview_exists(db, entretien_id):
    try:
        entretien_obj_id = ObjectId(entretien_id)
    except:
        return False
    entretien = db[ENTRETIENS_COLLECTION].find_one({"_id": entretien_obj_id})
    return entretien is not None

@entretiens_bp.route("/debug/<entretien_id>", methods=["GET"])
@cross_origin(origins="http://localhost:3000")
def debug_entretien(entretien_id):
    """Debug endpoint to verify token roles and interview existence."""
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({"error": "Authentification requise", "code": "NO_TOKEN"}), 401
    user = get_user_from_token(auth_header)
    if not user:
        return jsonify({"error": "Token invalide ou expiré", "code": "INVALID_TOKEN"}), 401

    db = current_app.mongo
    if db is None:
        return jsonify({"error": "Base de données non initialisée", "code": "DB_NOT_INITIALIZED"}), 500

    exists = interview_exists(db, entretien_id)

    return jsonify({
        "success": True,
        "user": user,
        "interview_exists": exists
    }), 200