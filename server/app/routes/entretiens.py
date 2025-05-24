from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from datetime import datetime, timezone
from jwt_manager import jwt_manager
import logging
from flask_cors import cross_origin
from pymongo.errors import PyMongoError
import json

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Créer le blueprint
entretiens_bp = Blueprint('entretiens', __name__, url_prefix='/api/candidates/entretiens')

# Noms des collections
ENTRETIENS_COLLECTION = 'entretiens'
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
            roles = ["candidat"]
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

@entretiens_bp.route("/<entretien_id>", methods=["GET"])
@cross_origin(origins="http://localhost:3000")
def get_entretien(entretien_id):
    """Retrieve a specific interview by ID."""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            logger.error("Aucun token d'authentification fourni")
            return jsonify({"error": "Authentification requise", "code": "NO_TOKEN"}), 401
            
        user = get_user_from_token(auth_header)
        if not user:
            logger.error("Token invalide ou expiré")
            return jsonify({"error": "Token invalide ou expiré", "code": "INVALID_TOKEN"}), 401
            
        if 'candidat' not in user.get('roles', []):
            logger.error(f"Utilisateur {user.get('id')} n'a pas le rôle candidat")
            return jsonify({"error": "Accès réservé aux candidats", "code": "UNAUTHORIZED_ROLE"}), 403
        
        try:
            entretien_obj_id = ObjectId(entretien_id)
        except Exception as e:
            logger.error(f"ID d'entretien invalide: {entretien_id}. Erreur: {str(e)}")
            return jsonify({"error": "ID d'entretien invalide", "code": "INVALID_ID"}), 400

        db = current_app.mongo
        if db is None:
            logger.error("Base de données non initialisée")
            return jsonify({"error": "Base de données non initialisée", "code": "DB_NOT_INITIALIZED"}), 500

        logger.info(f"Recherche de l'entretien {entretien_id} pour candidat {user.get('id')}")
        entretien = db[ENTRETIENS_COLLECTION].find_one({"_id": entretien_obj_id})
        
        if not entretien:
            logger.error(f"Entretien {entretien_id} non trouvé dans la base de données")
            return jsonify({"error": "Entretien non trouvé", "code": "INTERVIEW_NOT_FOUND"}), 404

        if str(entretien.get('candidat_id')) != user.get('id'):
            logger.error(f"Entretien {entretien_id} appartient à {entretien.get('candidat_id')} mais le candidat est {user.get('id')}")
            return jsonify({"error": "Accès non autorisé à cet entretien", "code": "UNAUTHORIZED_ACCESS"}), 403
        
        questions_id = entretien.get('questions_id')
        if not questions_id:
            logger.error(f"Entretien {entretien_id} n'a pas de questions_id")
            return jsonify({"error": "Entretien sans questions", "code": "NO_QUESTIONS"}), 400

        try:
            questions_obj_id = ObjectId(questions_id)
        except Exception as e:
            logger.error(f"questions_id invalide pour l'entretien {entretien_id}: {questions_id}. Erreur: {str(e)}")
            return jsonify({"error": "ID de questions invalide", "code": "INVALID_QUESTIONS_ID"}), 400

        questions_doc = db[QUESTIONS_COLLECTION].find_one({"_id": questions_obj_id})
        if not questions_doc:
            logger.error(f"Aucune question trouvée pour l'entretien {entretien_id} avec questions_id {questions_id}")
            return jsonify({"error": "Questions non trouvées", "code": "QUESTIONS_NOT_FOUND"}), 404

        questions_list = questions_doc.get('questions', [])
        if not isinstance(questions_list, list) or not questions_list:
            logger.error(f"Format de questions invalide ou liste vide pour l'entretien {entretien_id}")
            return jsonify({"error": "Format de questions invalide ou liste vide", "code": "INVALID_QUESTIONS_FORMAT"}), 400

        # Organiser les questions et réponses
        qa_pairs = []
        recordings = entretien.get('recordings', [])
        
        # Créer un dictionnaire des questions
        questions_dict = {}
        for i, q in enumerate(questions_list):
            if isinstance(q, str):
                questions_dict[i] = q
            elif isinstance(q, dict):
                question_index = q.get("index", i)
                question_text = q.get("text", q.get("question", "Question non trouvée"))
                questions_dict[question_index] = question_text
            else:
                questions_dict[i] = str(q)

        # Associer chaque question avec sa réponse
        for i in range(len(questions_list)):
            question = questions_dict.get(i, f"Question {i + 1}")
            # Chercher la réponse correspondante dans les enregistrements
            answer = next((r.get('transcript', '') for r in recordings if r.get('questionIndex') == i), '')
            
            qa_pairs.append({
                "questionIndex": i,
                "question": question,
                "answer": answer,
                "timestamp": next((r.get('timestamp') for r in recordings if r.get('questionIndex') == i), None)
            })

        entretien_data = serialize_doc(entretien)
        entretien_data['qa_pairs'] = qa_pairs
        
        return jsonify({
            "success": True,
            "data": {
                "entretien": entretien_data,
                "questions": questions_list,
                "qa_pairs": qa_pairs
            }
        }), 200
        
    except PyMongoError as e:
        logger.error(f"Erreur MongoDB: {str(e)}")
        return jsonify({"error": "Erreur de base de données", "code": "DB_ERROR"}), 500
    except Exception as e:
        logger.error(f"Erreur serveur: {str(e)}")
        return jsonify({"error": "Erreur serveur", "code": "SERVER_ERROR"}), 500

@entretiens_bp.route("/<entretien_id>/update", methods=["POST"])
@cross_origin(origins="http://localhost:3000")
def update_entretien(entretien_id):
    """Update interview with transcriptions and additional metadata."""
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

        # Vérifier que l'entretien existe et appartient au candidat
        entretien = db[ENTRETIENS_COLLECTION].find_one({
            "_id": entretien_obj_id,
            "candidat_id": ObjectId(user.get('id'))
        })
        if not entretien:
            return jsonify({"error": "Entretien non trouvé ou non autorisé", "code": "INTERVIEW_NOT_FOUND"}), 404

        # Récupérer les données de la requête
        data = request.get_json()
        if not data or 'recordings' not in data:
            return jsonify({"error": "Données invalides", "code": "INVALID_DATA"}), 400

        recordings = data.get('recordings', [])
        if not isinstance(recordings, list):
            return jsonify({"error": "Format de transcriptions invalide", "code": "INVALID_FORMAT"}), 400

        # Mettre à jour l'entretien avec les nouveaux champs
        update_result = db[ENTRETIENS_COLLECTION].update_one(
            {"_id": entretien_obj_id},
            {
                "$set": {
                    "recordings": recordings,
                    "statut": "terminé",
                    "completed_at": datetime.now(timezone.utc),
                    "date_maj": datetime.now(timezone.utc),
                    "transcription_completed": True,  # New field
                    "last_updated_by": user.get('id')  # New field to track who updated
                }
            }
        )

        if update_result.modified_count == 0:
            return jsonify({"error": "Échec de la mise à jour", "code": "UPDATE_FAILED"}), 500

        return jsonify({
            "success": True,
            "message": "Entretien mis à jour avec succès",
            "data": {
                "recordings": recordings,
                "transcription_completed": True,
                "last_updated_by": user.get('id')
            }
        }), 200

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB: {str(e)}")
        return jsonify({"error": "Erreur de base de données", "code": "DB_ERROR"}), 500
    except Exception as e:
        logger.error(f"Erreur serveur: {str(e)}")
        return jsonify({"error": "Erreur serveur", "code": "SERVER_ERROR"}), 500