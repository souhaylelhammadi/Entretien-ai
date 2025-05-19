from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from datetime import datetime, timezone
import logging
from flask_cors import CORS
from pymongo.errors import PyMongoError
from .entretiens_questions import generate_interview_questions, get_stored_questions
import json
import tempfile
import whisper
from moviepy import VideoFileClip
import shutil
from jwt_manager import jwt_manager
import os
import base64
import gridfs
from werkzeug.utils import secure_filename

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Blueprint avec préfixe
interviews_bp = Blueprint('interviews', __name__, url_prefix='/api/candidates/entretiens')

# Noms des collections
OFFRES_COLLECTION = 'offres'
CANDIDATURES_COLLECTION = 'candidatures'
CANDIDATS_COLLECTION = 'candidats'
UTILISATEURS_COLLECTION = 'utilisateurs'
RECRUTEURS_COLLECTION = 'recruteurs'
ENTRETIENS_COLLECTION = 'entretiens'
RECORDINGS_COLLECTION = 'recordings'
VIDEOS_COLLECTION = 'videos'

# Configure CORS
CORS(interviews_bp, 
     resources={r"/*": {
         "origins": ["http://localhost:3000"],
         "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         "allow_headers": ["Content-Type", "Authorization"],
         "supports_credentials": True,
         "max_age": 3600
     }},
     supports_credentials=True)

# Dossier pour stocker les vidéos
UPLOAD_FOLDER = "uploads/videos"
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@interviews_bp.route("/<string:candidate_id>", methods=["GET"])
def get_accepted_interviews(candidate_id):
    """Récupérer les entretiens acceptés pour un candidat."""
    try:
        db = current_app.mongo
        
        # Vérifier que le candidat existe
        candidat = db[CANDIDATS_COLLECTION].find_one({"_id": ObjectId(candidate_id)})
        if not candidat:
            return jsonify({"error": "Candidat non trouvé", "code": "CANDIDATE_NOT_FOUND"}), 404

        # Récupérer les entretiens acceptés
        entretiens = db[ENTRETIENS_COLLECTION].find({
            "candidat_id": ObjectId(candidate_id),
            "statut": "planifie"
        })

        result = []
        for entretien in entretiens:
            # Récupérer les détails de l'offre
            offre = db[OFFRES_COLLECTION].find_one({"_id": entretien["offre_id"]})
            if not offre:
                continue

            # Récupérer les détails du recruteur
            recruteur = db[RECRUTEURS_COLLECTION].find_one({"_id": entretien["recruteur_id"]})
            if not recruteur:
                continue

            # Récupérer les questions
            questions = db["questions"].find_one({"_id": entretien["questions_id"]})
            
            result.append({
                "id": str(entretien["_id"]),
                "offre": {
                    "id": str(offre["_id"]),
                    "titre": offre.get("titre", ""),
                    "entreprise": offre.get("entreprise", ""),
                    "localisation": offre.get("localisation", "")
                },
                "recruteur": {
                    "id": str(recruteur["_id"]),
                    "nom": recruteur.get("nom", ""),
                    "prenom": recruteur.get("prenom", "")
                },
                "questions": questions.get("questions", []) if questions else [],
                "date_creation": entretien.get("date_creation", datetime.now(timezone.utc)).isoformat(),
                "statut": entretien.get("statut", "planifie")
            })

        return jsonify({
            "success": True,
            "entretiens": result
        }), 200

    except Exception as e:
        logger.error(f"Erreur lors de la récupération des entretiens: {str(e)}")
        return jsonify({"error": str(e), "code": "SERVER_ERROR"}), 500

@interviews_bp.route("/<string:interview_id>/start", methods=["POST"])
def start_interview(interview_id):
    """Démarrer un entretien."""
    try:
        db = current_app.mongo
        
        # Vérifier que l'entretien existe
        entretien = db[ENTRETIENS_COLLECTION].find_one({"_id": ObjectId(interview_id)})
        if not entretien:
            return jsonify({"error": "Entretien non trouvé", "code": "INTERVIEW_NOT_FOUND"}), 404

        # Vérifier que l'entretien est planifié
        if entretien["statut"] != "planifie":
            return jsonify({"error": "L'entretien n'est pas planifié", "code": "INTERVIEW_NOT_PLANNED"}), 400

        # Récupérer les questions
        questions = db["questions"].find_one({"_id": entretien["questions_id"]})
        if not questions:
            return jsonify({"error": "Questions non trouvées", "code": "QUESTIONS_NOT_FOUND"}), 404

        # Mettre à jour le statut de l'entretien
        db[ENTRETIENS_COLLECTION].update_one(
            {"_id": ObjectId(interview_id)},
            {
                "$set": {
                    "statut": "en_cours",
                    "date_debut": datetime.now(timezone.utc),
                    "date_maj": datetime.now(timezone.utc)
                }
            }
        )

        return jsonify({
            "success": True,
            "interview": {
                "id": str(entretien["_id"]),
                "questions": questions.get("questions", []),
                "statut": "en_cours",
                "date_debut": datetime.now(timezone.utc).isoformat()
            }
        }), 200

    except Exception as e:
        logger.error(f"Erreur lors du démarrage de l'entretien: {str(e)}")
        return jsonify({"error": str(e), "code": "SERVER_ERROR"}), 500

@interviews_bp.route('/<interview_id>/recordings', methods=['POST', 'OPTIONS'])
@jwt_manager.require_auth
def save_interview_recordings(interview_id):
    if request.method == 'OPTIONS':
        return '', 204

    try:
        logger.info(f"Requête reçue pour sauvegarder les enregistrements de l'entretien {interview_id}")

        # Vérification des données requises
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Données manquantes"}), 400

        # Vérification de l'existence de l'entretien
        entretien = current_app.mongo[ENTRETIENS_COLLECTION].find_one({"_id": ObjectId(interview_id)})
        if not entretien:
            return jsonify({"success": False, "error": "Entretien non trouvé"}), 404

        # Récupération de l'ID de la candidature associée
        candidature_id = entretien.get("candidature_id")
        if not candidature_id:
            return jsonify({"success": False, "error": "Candidature non trouvée"}), 404

        # Initialiser GridFS pour le stockage des vidéos
        fs = gridfs.GridFS(current_app.mongo.db)

        # Sauvegarde de la vidéo
        video_data = data.get("video")
        video_file_id = None
        if video_data:
            try:
                # Décoder la vidéo base64
                video_bytes = base64.b64decode(video_data.split(',')[1])
                
                # Générer un nom de fichier sécurisé
                video_filename = f"{interview_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.webm"
                
                # Sauvegarder la vidéo dans GridFS
                video_file_id = fs.put(
                    video_bytes,
                    filename=video_filename,
                    content_type='video/webm',
                    metadata={
                        "entretien_id": str(interview_id),
                        "candidature_id": str(candidature_id),
                        "created_at": datetime.utcnow()
                    }
                )

                # Enregistrer les métadonnées de la vidéo dans MongoDB
                video_doc = {
                    "entretien_id": ObjectId(interview_id),
                    "candidature_id": ObjectId(candidature_id),
                    "file_id": video_file_id,
                    "filename": video_filename,
                    "created_at": datetime.utcnow()
                }
                current_app.mongo[VIDEOS_COLLECTION].insert_one(video_doc)
            except Exception as e:
                logger.error(f"Erreur lors de la sauvegarde de la vidéo: {str(e)}")
                return jsonify({"success": False, "error": "Erreur lors de la sauvegarde de la vidéo"}), 500

        # Sauvegarde des enregistrements
        saved_recordings = []
        for recording in data.get("recordings", []):
            if "questionIndex" not in recording:
                logger.warning(f"Enregistrement sans index de question: {recording}")
                continue

            try:
                recording_data = {
                    "entretien_id": ObjectId(interview_id),
                    "candidature_id": ObjectId(candidature_id),
                    "question_index": recording["questionIndex"],
                    "question": recording["question"],
                    "transcript": recording.get("transcript", ""),
                    "timestamp": recording.get("timestamp", datetime.utcnow().isoformat()),
                    "created_at": datetime.utcnow()
                }

                result = current_app.mongo[RECORDINGS_COLLECTION].insert_one(recording_data)
                saved_recordings.append({
                    "id": str(result.inserted_id),
                    "question_index": recording["questionIndex"],
                    "question": recording["question"],
                    "transcript": recording.get("transcript", "")
                })
            except Exception as e:
                logger.error(f"Erreur lors de la sauvegarde de l'enregistrement: {str(e)}")
                continue

        # Mise à jour du statut de l'entretien
        current_app.mongo[ENTRETIENS_COLLECTION].update_one(
            {"_id": ObjectId(interview_id)},
            {
                "$set": {
                    "statut": "completed",
                    "completed_at": datetime.utcnow(),
                    "recordings": saved_recordings,
                    "video_file_id": video_file_id
                }
            }
        )

        # Mise à jour du statut de la candidature
        current_app.mongo[CANDIDATURES_COLLECTION].update_one(
            {"_id": ObjectId(candidature_id)},
            {
                "$set": {
                    "statut": "entretien_completed",
                    "updated_at": datetime.utcnow()
                }
            }
        )

        return jsonify({
            "success": True,
            "message": "Enregistrements sauvegardés avec succès",
            "data": {
                "recordings": saved_recordings,
                "video_file_id": str(video_file_id) if video_file_id else None,
                "statut": "completed"
            }
        }), 200

    except Exception as e:
        logger.error(f"Erreur lors de la sauvegarde des enregistrements: {str(e)}")
        return jsonify({
            "success": False,
            "error": f"Erreur lors de la sauvegarde des enregistrements: {str(e)}"
        }), 500

@interviews_bp.route('/<interview_id>/save', methods=['POST'])
@jwt_manager.require_auth
def save_interview(interview_id):
    """Sauvegarder les enregistrements d'un entretien."""
    try:
        logger.info(f"Requête reçue pour sauvegarder l'entretien {interview_id}")

        # Vérification des données requises
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Données manquantes"}), 400

        # Vérification de l'existence de l'entretien
        entretien = current_app.mongo[ENTRETIENS_COLLECTION].find_one({"_id": ObjectId(interview_id)})
        if not entretien:
            return jsonify({"success": False, "error": "Entretien non trouvé"}), 404

        # Récupération de l'ID de la candidature associée
        candidature_id = entretien.get("candidature_id")
        if not candidature_id:
            return jsonify({"success": False, "error": "Candidature non trouvée"}), 404

        # Initialiser GridFS pour le stockage des vidéos
        fs = gridfs.GridFS(current_app.mongo.db)

        # Sauvegarde de la vidéo
        video_data = data.get("video")
        video_file_id = None
        if video_data:
            try:
                # Décoder la vidéo base64
                video_bytes = base64.b64decode(video_data.split(',')[1])
                
                # Générer un nom de fichier sécurisé
                video_filename = f"{interview_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.webm"
                
                # Sauvegarder la vidéo dans GridFS
                video_file_id = fs.put(
                    video_bytes,
                    filename=video_filename,
                    content_type='video/webm',
                    metadata={
                        "entretien_id": str(interview_id),
                        "candidature_id": str(candidature_id),
                        "created_at": datetime.utcnow()
                    }
                )

                # Enregistrer les métadonnées de la vidéo dans MongoDB
                video_doc = {
                    "entretien_id": ObjectId(interview_id),
                    "candidature_id": ObjectId(candidature_id),
                    "file_id": video_file_id,
                    "filename": video_filename,
                    "created_at": datetime.utcnow()
                }
                current_app.mongo[VIDEOS_COLLECTION].insert_one(video_doc)
            except Exception as e:
                logger.error(f"Erreur lors de la sauvegarde de la vidéo: {str(e)}")
                return jsonify({"success": False, "error": "Erreur lors de la sauvegarde de la vidéo"}), 500

        # Sauvegarde des enregistrements
        saved_recordings = []
        for recording in data.get("recordings", []):
            if "questionIndex" not in recording:
                logger.warning(f"Enregistrement sans index de question: {recording}")
                continue

            try:
                recording_data = {
                    "entretien_id": ObjectId(interview_id),
                    "candidature_id": ObjectId(candidature_id),
                    "question_index": recording["questionIndex"],
                    "question": recording["question"],
                    "transcript": recording.get("transcript", ""),
                    "timestamp": recording.get("timestamp", datetime.utcnow().isoformat()),
                    "created_at": datetime.utcnow()
                }

                result = current_app.mongo[RECORDINGS_COLLECTION].insert_one(recording_data)
                saved_recordings.append({
                    "id": str(result.inserted_id),
                    "question_index": recording["questionIndex"],
                    "question": recording["question"],
                    "transcript": recording.get("transcript", "")
                })
            except Exception as e:
                logger.error(f"Erreur lors de la sauvegarde de l'enregistrement: {str(e)}")
                continue

        # Mise à jour du statut de l'entretien
        current_app.mongo[ENTRETIENS_COLLECTION].update_one(
            {"_id": ObjectId(interview_id)},
            {
                "$set": {
                    "statut": "completed",
                    "completed_at": datetime.utcnow(),
                    "recordings": saved_recordings,
                    "video_file_id": video_file_id
                }
            }
        )

        # Mise à jour du statut de la candidature
        current_app.mongo[CANDIDATURES_COLLECTION].update_one(
            {"_id": ObjectId(candidature_id)},
            {
                "$set": {
                    "statut": "entretien_completed",
                    "updated_at": datetime.utcnow()
                }
            }
        )

        return jsonify({
            "success": True,
            "message": "Enregistrements sauvegardés avec succès",
            "data": {
                "recordings": saved_recordings,
                "video_file_id": str(video_file_id) if video_file_id else None,
                "statut": "completed"
            }
        }), 200

    except Exception as e:
        logger.error(f"Erreur lors de la sauvegarde des enregistrements: {str(e)}")
        return jsonify({
            "success": False,
            "error": f"Erreur lors de la sauvegarde des enregistrements: {str(e)}"
        }), 500

@interviews_bp.route("/<string:interview_id>", methods=["GET"])
def get_interview_details(interview_id):
    """Récupérer les détails d'un entretien."""
    try:
        db = current_app.mongo
        
        # Récupérer l'entretien
        entretien = db[ENTRETIENS_COLLECTION].find_one({"_id": ObjectId(interview_id)})
        if not entretien:
            return jsonify({"error": "Entretien non trouvé", "code": "INTERVIEW_NOT_FOUND"}), 404

        # Récupérer les questions associées
        questions = db["questions"].find_one({"_id": ObjectId(entretien.get("questions_id"))})
        if not questions:
            return jsonify({"error": "Questions non trouvées", "code": "QUESTIONS_NOT_FOUND"}), 404

        # Récupérer les détails de l'offre
        offre = db[OFFRES_COLLECTION].find_one({"_id": ObjectId(entretien.get("offre_id"))})
        if not offre:
            return jsonify({"error": "Offre non trouvée", "code": "OFFER_NOT_FOUND"}), 404

        # Récupérer les détails du recruteur
        recruteur = db[RECRUTEURS_COLLECTION].find_one({"_id": ObjectId(entretien.get("recruteur_id"))})
        if not recruteur:
            return jsonify({"error": "Recruteur non trouvé", "code": "RECRUITER_NOT_FOUND"}), 404

        # Formater la réponse
        response_data = {
            "entretien": {
                "_id": str(entretien["_id"]),
                "statut": entretien.get("statut"),
                "date_prevue": entretien.get("date_prevue"),
                "date_creation": entretien.get("date_creation"),
                "date_maj": entretien.get("date_maj"),
            },
            "questions": questions.get("questions", []),
            "offre": {
                "titre": offre.get("titre"),
                "description": offre.get("description"),
                "entreprise": offre.get("entreprise"),
                "localisation": offre.get("localisation"),
            },
            "recruteur": {
                "nom": recruteur.get("nom"),
                "prenom": recruteur.get("prenom"),
                "email": recruteur.get("email"),
            }
        }

        return jsonify({
            "success": True,
            "data": response_data
        }), 200

    except Exception as e:
        logger.error(f"Erreur lors de la récupération des détails de l'entretien: {str(e)}")
        return jsonify({
            "error": "Erreur lors de la récupération des détails de l'entretien",
            "code": "INTERVIEW_DETAILS_ERROR"
        }), 500 