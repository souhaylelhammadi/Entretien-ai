
from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from datetime import datetime, timezone
from jwt_manager import jwt_manager
import logging
from flask_cors import cross_origin
from pymongo.errors import PyMongoError
from gridfs import GridFS
import io
import json

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Créer le blueprint
entretiens_bp = Blueprint('entretiens', __name__)

# Noms des collections
ENTRETIENS_COLLECTION = 'entretiens'
UTILISATEURS_COLLECTION = 'utilisateur'
RECRUTEURS_COLLECTION = 'recruteurs'
QUESTIONS_COLLECTION = 'questions'

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
            roles = ["recruteur"]
        if not user_id:
            logger.error("Token invalide: ID utilisateur manquant")
            return None
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
    required_fields = ['_id', 'recruteur_id', 'statut']
    missing_fields = [field for field in required_fields if field not in interview or not interview[field]]
    if missing_fields:
        logger.warning(f"Entretien {interview.get('_id')} invalide: champs manquants: {', '.join(missing_fields)}")
        return False
    for field in ['recruteur_id']:
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

        entretien = db[ENTRETIENS_COLLECTION].find_one({"_id": entretien_obj_id})
        if not entretien:
            return jsonify({"error": "Entretien non trouvé", "code": "INTERVIEW_NOT_FOUND"}), 404

        try:
            utilisateur_id = ObjectId(user.get('id'))
        except:
            return jsonify({"error": "ID utilisateur invalide", "code": "INVALID_USER_ID"}), 400

        questions = db[QUESTIONS_COLLECTION].find_one({"_id": ObjectId(entretien.get('questions_id'))})
        entretien_data = serialize_doc(entretien)
        entretien_data['questions'] = questions.get('questions', []) if questions else []
        
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
    """Save video and recordings for an interview."""
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

        entretien = db[ENTRETIENS_COLLECTION].find_one({"_id": entretien_obj_id})
        if not entretien:
            return jsonify({"error": "Entretien non trouvé", "code": "INTERVIEW_NOT_FOUND"}), 404

        fs = GridFS(db)
        video_file = request.files.get('video')
        recordings = request.form.get('recordings')
        completed_at = request.form.get('completedAt')

        if not video_file or not recordings:
            return jsonify({"error": "Vidéo ou enregistrements manquants", "code": "MISSING_DATA"}), 400

        try:
            recordings = json.loads(recordings)
        except:
            return jsonify({"error": "Format d'enregistrements invalide", "code": "INVALID_RECORDINGS"}), 400

        video_id = fs.put(video_file.stream, filename=f"interview_{entretien_id}.webm", content_type="video/webm")
        video_url = f"{current_app.config['BASE_URL']}/api/videos/{video_id}"

        db[ENTRETIENS_COLLECTION].update_one(
            {"_id": entretien_obj_id},
            {
                "$set": {
                    "video_id": video_id,
                    "video_url": video_url,
                    "recordings": recordings,
                    "statut": "completed",
                    "completed_at": datetime.fromisoformat(completed_at.replace('Z', '+00:00')),
                    "date_maj": datetime.now(timezone.utc),
                }
            }
        )

        return jsonify({
            "success": True,
            "data": {
                "video_url": video_url,
                "recordings": recordings
            }
        }), 200
    except PyMongoError as e:
        logger.error(f"Erreur MongoDB: {str(e)}")
        return jsonify({"error": "Erreur de base de données", "code": "DB_ERROR"}), 500
    except Exception as e:
        logger.error(f"Erreur serveur: {str(e)}")
        return jsonify({"error": "Erreur serveur", "code": "SERVER_ERROR"}), 500

@entretiens_bp.route("/<entretien_id>/recordings", methods=["GET"])
@cross_origin(origins="http://localhost:3000")
def get_recordings(entretien_id):
    """Retrieve recordings for an interview."""
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

        entretien = db[ENTRETIENS_COLLECTION].find_one({"_id": entretien_obj_id})
        if not entretien:
            return jsonify({"error": "Entretien non trouvé", "code": "INTERVIEW_NOT_FOUND"}), 404

        return jsonify({
            "success": True,
            "recordings": entretien.get('recordings', []),
            "video_url": entretien.get('video_url', '')
        }), 200
    except PyMongoError as e:
        logger.error(f"Erreur MongoDB: {str(e)}")
        return jsonify({"error": "Erreur de base de données", "code": "DB_ERROR"}), 500
    except Exception as e:
        logger.error(f"Erreur serveur: {str(e)}")
        return jsonify({"error": "Erreur serveur", "code": "SERVER_ERROR"}), 500