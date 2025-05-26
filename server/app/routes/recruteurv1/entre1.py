from flask import Blueprint, jsonify, request, current_app, send_file
from bson import ObjectId
from datetime import datetime, timezone
import logging
from flask_cors import CORS
from pymongo.errors import PyMongoError
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import json
import os
import base64
import tempfile
import shutil
import whisper
from moviepy import VideoFileClip
import io
import gridfs

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Blueprint avec préfixe
entretiensection_bp = Blueprint('entretienssection', __name__, url_prefix='/api/recruteur/entretiens')

# Noms des collections
OFFRES_COLLECTION = 'offres'
CANDIDATURES_COLLECTION = 'candidatures'
CANDIDATS_COLLECTION = 'candidats'
UTILISATEURS_COLLECTION = 'utilisateurs'
RECRUTEURS_COLLECTION = 'recruteurs'
ENTRETIENS_COLLECTION = 'entretiens'

# Configure CORS
CORS(entretiensection_bp, 
     resources={r"/*": {"origins": "http://localhost:3000"}},
     supports_credentials=True,
     max_age=3600)

# Configure rate limiting
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# Helper function to get the JWT manager
def get_jwt_manager():
    """Helper function to get the JWT manager instance"""
    try:
        if hasattr(current_app, 'extensions') and 'jwt_manager' in current_app.extensions:
            return current_app.extensions['jwt_manager']
        
        import sys, os
        current_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        if current_dir not in sys.path:
            sys.path.insert(0, current_dir)
        from jwt_manager import jwt_manager
        
        if not jwt_manager._initialized:
            jwt_manager._initialize()
            
        return jwt_manager
        
    except Exception as e:
        logger.error(f"Error getting JWT manager: {str(e)}")
        class EmptyJWTManager:
            def verify_token(self, token):
                logger.error("Using empty JWT manager - token verification failed")
                return None
        return EmptyJWTManager()

# Authentication middleware
def require_auth(role):
    def decorator(f):
        def wrapped_function(*args, **kwargs):
            token = request.headers.get("Authorization")
            if not token:
                logger.error("Aucun token d'authentification fourni")
                return jsonify({"error": "Authentification requise", "code": "NO_TOKEN"}), 401

            try:
                if token.startswith("Bearer "):
                    token = token[7:]
                    logger.info("Préfixe 'Bearer ' retiré")
                else:
                    logger.warning("Token ne commence pas par 'Bearer '")
                    return jsonify({"error": "Format de token invalide", "code": "INVALID_TOKEN_FORMAT"}), 401

                jwt_manager = get_jwt_manager()
                if not jwt_manager:
                    logger.error("JWT manager non disponible")
                    return jsonify({"error": "Erreur de configuration", "code": "JWT_ERROR"}), 500

                user_id = jwt_manager.verify_token(token)
                if not user_id:
                    logger.error("Token invalide ou expiré")
                    return jsonify({"error": "Token invalide ou expiré", "code": "INVALID_TOKEN"}), 401

                logger.info(f"ID utilisateur extrait du token: {user_id}")
                
                db = current_app.mongo
                try:
                    user = db[UTILISATEURS_COLLECTION].find_one({"_id": ObjectId(str(user_id))})
                    if not user:
                        logger.warning(f"Utilisateur non trouvé pour l'ID: {user_id}")
                        return jsonify({"error": "Utilisateur non trouvé", "code": "USER_NOT_FOUND"}), 404
                except Exception as e:
                    logger.error(f"Erreur lors de la recherche de l'utilisateur: {str(e)}")
                    return jsonify({"error": "Format d'ID utilisateur invalide", "code": "INVALID_USER_ID"}), 400
                
                if user.get("role") != role:
                    logger.warning(f"Rôle non autorisé: {user.get('role')}")
                    return jsonify({"error": f"Accès non autorisé. Rôle {role} requis."}), 403
                
                recruteur = None
                if role == "recruteur":
                    try:
                        recruteur = db[RECRUTEURS_COLLECTION].find_one({"utilisateur_id": ObjectId(str(user_id))})
                        if not recruteur:
                            logger.warning(f"Recruteur non trouvé pour l'utilisateur: {user_id}")
                            return jsonify({"error": "Recruteur non trouvé", "code": "RECRUITER_NOT_FOUND"}), 404
                    except Exception as e:
                        logger.error(f"Erreur lors de la recherche du recruteur: {str(e)}")
                        return jsonify({"error": "Format d'ID recruteur invalide", "code": "INVALID_RECRUITER_ID"}), 400
                
                auth_payload = {
                    "sub": str(user_id),
                    "role": user.get("role"),
                    "email": user.get("email"),
                    "recruteur_id": str(recruteur.get("_id")) if recruteur else None
                }
                logger.info(f"Payload d'authentification créé: {auth_payload}")
                
                return f(auth_payload=auth_payload, *args, **kwargs)
            except Exception as e:
                logger.error(f"Erreur de vérification du token: {str(e)}")
                return jsonify({"error": str(e)}), 401

        wrapped_function.__name__ = f.__name__
        return wrapped_function
    return decorator

def store_video_and_transcribe(video_base64, entretien_id):
    """Stocke la vidéo et génère une transcription."""
    try:
        temp_dir = tempfile.mkdtemp()
        video_path = os.path.join(temp_dir, f"{entretien_id}.mp4")
        
        video_data = base64.b64decode(video_base64)
        with open(video_path, "wb") as f:
            f.write(video_data)
            
        video_url = f"/api/recruteur/entretiens/videos/{entretien_id}"
        
        model = whisper.load_model("base")
        result = model.transcribe(video_path)
        transcription = result["text"]
        
        video_doc = {
            "entretien_id": ObjectId(entretien_id),
            "video_data": video_base64,
            "video_url": video_url,
            "transcription": transcription,
            "created_at": datetime.now(timezone.utc)
        }
        video_id = current_app.mongo.db.videos.insert_one(video_doc).inserted_id
        
        current_app.mongo.db.entretiens.update_one(
            {"_id": ObjectId(entretien_id)},
            {
                "$set": {
                    "video_id": video_id,
                    "video_url": video_url,
                    "transcription": transcription,
                    "statut": "termine",
                    "completed_at": datetime.now(timezone.utc),
                    "date_maj": datetime.now(timezone.utc)
                }
            }
        )
        
        return video_id, transcription, video_url
        
    finally:
        try:
            shutil.rmtree(temp_dir)
        except Exception as e:
            logger.error(f"Erreur lors du nettoyage des fichiers temporaires: {str(e)}")

@entretiensection_bp.route("", methods=["GET"])
@require_auth("recruteur")
def get_recruiter_interviews(auth_payload):
    """Récupérer les entretiens d'un recruteur."""
    try:
        db = current_app.mongo
        recruteur_id = auth_payload.get('recruteur_id')
        
        logger.info(f'Recruteur ID: {recruteur_id}')
        
        # Récupérer tous les entretiens du recruteur sans pagination
        entretiens = list(db[ENTRETIENS_COLLECTION].find(
            {"recruteur_id": ObjectId(recruteur_id)}
        ).sort("date_creation", -1))
        
        if not recruteur_id:
            return jsonify({"error": "ID recruteur non trouvé", "code": "MISSING_RECRUITER_ID"}), 400

        result = []
        for entretien in entretiens:
            try:
                logger.info(f'Traitement de l\'entretien: {entretien.get("_id")}')
                offre = db[OFFRES_COLLECTION].find_one({"_id": entretien.get("offre_id")})
                if not offre:
                    logger.warning(f"Offre non trouvée pour l'entretien {entretien['_id']}")
                    continue

                candidat = db[UTILISATEURS_COLLECTION].find_one({"_id": entretien.get("candidat_id")})
                video = db["videos"].find_one({"entretien_id": entretien["_id"]})
                
                result.append({
                    "id": str(entretien["_id"]),
                    "offre": {
                        "titre": offre.get("titre", "Non défini"),
                        "entreprise": offre.get("entreprise", "Non définie")
                    },
                    "candidat": {
                        "nom": candidat.get("nom", "Candidat supprimé") if candidat else "Candidat supprimé",
                        "email": candidat.get("email", "Non disponible") if candidat else "Non disponible"
                    },
                    "datePrevue": entretien.get("date_prevue"),
                    "dateCreation": entretien.get("date_creation"),
                    "statut": entretien.get("statut", "planifie"),
                    "video": {
                        "url": video.get("video_url") if video else None
                    } if video else None
                })
                logger.info(f'Entretien ajouté au résultat: {entretien["_id"]}')
            except Exception as e:
                logger.error(f"Erreur lors du traitement de l'entretien {entretien.get('_id')}: {str(e)}")
                continue

        logger.info(f'Nombre d\'entretiens dans le résultat final: {len(result)}')
        return jsonify({
            "interviews": result
        }), 200

    except Exception as e:
        logger.error(f"Erreur lors de la récupération des entretiens: {str(e)}")
        return jsonify({"error": str(e), "code": "SERVER_ERROR"}), 500

@entretiensection_bp.route("/<string:interview_id>", methods=["GET"])
@require_auth("recruteur")
def get_interview_details(interview_id, auth_payload):
    """Récupérer les détails d'un entretien."""
    try:
        db = current_app.mongo
        recruteur_id = auth_payload.get('recruteur_id')
        
        if not recruteur_id:
            return jsonify({"error": "ID recruteur non trouvé", "code": "MISSING_RECRUITER_ID"}), 400

        entretien = db[ENTRETIENS_COLLECTION].find_one({
            "_id": ObjectId(interview_id),
            "recruteur_id": ObjectId(recruteur_id)
        })
        
        if not entretien:
            return jsonify({"error": "Entretien non trouvé", "code": "INTERVIEW_NOT_FOUND"}), 404

        offre = db[OFFRES_COLLECTION].find_one({"_id": entretien["offre_id"]})
        if not offre:
            return jsonify({"error": "Offre non trouvée", "code": "OFFER_NOT_FOUND"}), 404

        candidat = db[UTILISATEURS_COLLECTION].find_one({"_id": entretien["candidat_id"]})
        if not candidat:
            return jsonify({"error": "Candidat non trouvé", "code": "CANDIDATE_NOT_FOUND"}), 404

        # Récupérer les questions
        questions_doc = db["questions"].find_one({"_id": entretien.get("questions_id")})
        logger.info(f"Questions document trouvé: {questions_doc}")
        
        # Récupérer les questions directement depuis l'entretien
        questions_list = entretien.get("questions", [])
        if not questions_list and questions_doc:
            questions_list = questions_doc.get("questions", [])
        
        logger.info(f"Liste des questions: {questions_list}")
        
        # Créer un dictionnaire des questions indexées
        questions_dict = {}
        for i, q in enumerate(questions_list):
            # Gérer différents formats possibles de questions
            if isinstance(q, str):
                questions_dict[i] = q
            elif isinstance(q, dict):
                question_index = q.get("index", i)
                question_text = q.get("text", q.get("question", "Question non trouvée"))
                questions_dict[question_index] = question_text
            else:
                questions_dict[i] = str(q)
            
            logger.info(f"Question {i}: {questions_dict.get(i)}")

        # Récupérer les enregistrements
        recordings = entretien.get("recordings", [])
        logger.info(f"Enregistrements trouvés: {recordings}")
        
        # Organiser les questions et réponses
        qa_pairs = []
        for i, recording in enumerate(recordings):
            question_index = recording.get("questionIndex", i)
            question = questions_dict.get(question_index, f"Question {i + 1}")
            answer = recording.get("transcript", "Pas de transcription disponible")
            timestamp = recording.get("timestamp")
            
            logger.info(f"Traitement de l'enregistrement {i} - Index: {question_index}, Question: {question}")
            
            qa_pairs.append({
                "question": question,
                "answer": answer,
                "timestamp": timestamp,
                "questionIndex": question_index
            })

        video = db["videos"].find_one({"entretien_id": entretien["_id"]})
        
        # Construire l'URL complète de la vidéo
        video_url = None
        if video:
            video_url = f"/api/recruteur/entretiens/videos/{str(entretien['_id'])}"

        response_data = {
            "interview": {
                "id": str(entretien["_id"]),
                "candidatId": str(entretien["candidat_id"]),
                "offreId": str(entretien["offre_id"]),
                "recruteurId": str(entretien["recruteur_id"]),
                "statut": entretien.get("statut"),
                "date_prevue": entretien.get("date_prevue"),
                "date_creation": entretien.get("date_creation"),
                "date_maj": entretien.get("date_maj"),
                "completed_at": entretien.get("completed_at"),
                "last_updated_by": entretien.get("last_updated_by"),
                "qa_pairs": qa_pairs,
                "transcription_completed": entretien.get("transcription_completed", False),
            },
            "offre": {
                "titre": offre.get("titre"),
                "description": offre.get("description"),
                "entreprise": offre.get("entreprise"),
                "localisation": offre.get("localisation"),
            },
            "candidat": {
                "nom": candidat.get("nom"),
                "prenom": candidat.get("prenom"),
                "email": candidat.get("email"),
                "telephone": candidat.get("telephone"),
            },
            "video": {
                "url": video_url,
                "transcription": video.get("transcription") if video else None
            } if video else None
        }

        return jsonify({
            "success": True,
            "interview": response_data["interview"],
            "offre": response_data["offre"],
            "candidat": response_data["candidat"],
            "video": response_data["video"]
        }), 200

    except Exception as e:
        logger.error(f"Erreur lors de la récupération des détails de l'entretien: {str(e)}")
        return jsonify({
            "error": "Erreur lors de la récupération des détails de l'entretien",
            "code": "INTERVIEW_DETAILS_ERROR"
        }), 500

@entretiensection_bp.route("/<string:interview_id>/recordings", methods=["GET"])
@require_auth("recruteur")
def get_interview_recordings(interview_id, auth_payload):
    """Récupérer les enregistrements d'un entretien."""
    try:
        db = current_app.mongo
        recruteur_id = auth_payload.get('recruteur_id')
        
        if not recruteur_id:
            return jsonify({"error": "ID recruteur non trouvé", "code": "MISSING_RECRUITER_ID"}), 400

        entretien = db[ENTRETIENS_COLLECTION].find_one({
            "_id": ObjectId(interview_id),
            "recruteur_id": ObjectId(recruteur_id)
        })
        
        if not entretien:
            return jsonify({"error": "Entretien non trouvé", "code": "INTERVIEW_NOT_FOUND"}), 404

        recordings = entretien.get("recordings", [])

        return jsonify({
            "success": True,
            "recordings": [{
                "questionIndex": recording.get("questionIndex"),
                "question": recording.get("question"),
                "transcript": recording.get("transcript"),
                "timestamp": recording.get("timestamp")
            } for recording in recordings]
        }), 200

    except Exception as e:
        logger.error(f"Erreur lors de la récupération des enregistrements: {str(e)}")
        return jsonify({
            "error": "Erreur lors de la récupération des enregistrements",
            "code": "RECORDINGS_ERROR"
        }), 500

@entretiensection_bp.route("/<string:interview_id>/recordings", methods=["POST"])
@require_auth("recruteur")
def save_interview_recordings(interview_id, auth_payload):
    """Sauvegarder les enregistrements d'un entretien."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Données manquantes"}), 400

        entretien = current_app.mongo.db.entretiens.find_one({
            "_id": ObjectId(interview_id),
            "recruteur_id": ObjectId(auth_payload["recruteur_id"])
        })
        
        if not entretien:
            return jsonify({"success": False, "error": "Entretien non trouvé"}), 404

        recordings = data.get('recordings', [])
        for recording in recordings:
            recording_doc = {
                "entretien_id": ObjectId(interview_id),
                "questionIndex": recording.get('questionIndex'),
                "question": recording.get('question'),
                "transcript": recording.get('transcript'),
                "timestamp": recording.get('timestamp'),
                "created_at": datetime.now(timezone.utc)
            }
            current_app.mongo.db.recordings.insert_one(recording_doc)

        current_app.mongo.db.entretiens.update_one(
            {"_id": ObjectId(interview_id)},
            {
                "$set": {
                    "recordings": recordings,
                    "transcription_completed": True,
                    "last_updated_by": auth_payload["sub"],
                    "date_maj": datetime.now(timezone.utc)
                }
            }
        )

        return jsonify({
            "success": True,
            "message": "Enregistrements sauvegardés avec succès"
        })

    except Exception as e:
        logger.error(f"Erreur lors de la sauvegarde des enregistrements: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Erreur lors de la sauvegarde des enregistrements"
        }), 500

@entretiensection_bp.route("/videos/<string:interview_id>", methods=["GET"])
def get_interview_video(interview_id):
    """Récupérer la vidéo d'un entretien."""
    try:
        # Récupérer le token depuis l'URL
        token = request.args.get('token')
        if not token:
            logger.error("Aucun token d'authentification fourni")
            return jsonify({"error": "Authentification requise"}), 401

        # Nettoyer le token
        if token.startswith("Bearer "):
            token = token[7:]
            logger.info("Préfixe 'Bearer ' retiré")

        # Vérifier le token
        jwt_manager = get_jwt_manager()
        user_id = jwt_manager.verify_token(token)
        if not user_id:
            logger.error("Token invalide ou expiré")
            return jsonify({"error": "Token invalide ou expiré"}), 401

        logger.info(f"ID utilisateur extrait du token: {user_id}")

        # Vérifier si l'ID de l'entretien est valide
        try:
            interview_object_id = ObjectId(interview_id)
            logger.info(f"ID de l'entretien converti en ObjectId: {interview_object_id}")
        except Exception as e:
            logger.error(f"ID d'entretien invalide: {interview_id}")
            return jsonify({"error": "ID d'entretien invalide"}), 400

        # Récupérer l'entretien
        entretien = current_app.mongo.db.entretiens.find_one({
            "_id": interview_object_id
        })
        
        if not entretien:
            logger.error(f"Entretien non trouvé pour l'ID: {interview_id}")
            return jsonify({"error": "Entretien non trouvé"}), 404

        logger.info(f"Entretien trouvé: {entretien}")

        # Récupérer la vidéo
        video = current_app.mongo.db.videos.find_one({
            "entretien_id": interview_object_id
        })
        
        if not video:
            logger.error(f"Vidéo non trouvée pour l'entretien: {interview_id}")
            return jsonify({"error": "Vidéo non trouvée"}), 404

        logger.info(f"Vidéo trouvée: {video}")

        # Chemin exact du dossier des vidéos
        VIDEOS_DIR = r"C:\Users\souhayl\OneDrive\Bureau\interview-ai\server\app\Uploads\videos"
        
        # 1. Essayer de trouver la vidéo dans le dossier Uploads/videos
        try:
            # Chercher tous les fichiers correspondant au pattern
            video_files = [f for f in os.listdir(VIDEOS_DIR) if f.startswith(f"interview_{interview_id}")]
            if video_files:
                latest_video = max(video_files, key=lambda x: os.path.getctime(os.path.join(VIDEOS_DIR, x)))
                video_path = os.path.join(VIDEOS_DIR, latest_video)
                logger.info(f"Fichier vidéo trouvé dans Uploads/videos: {video_path}")
                response = send_file(
                    video_path,
                    mimetype='video/webm',
                    as_attachment=False,
                    download_name=f"interview_{interview_id}.webm"
                )
                response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'
                response.headers['Access-Control-Allow-Credentials'] = 'true'
                response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
                response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
                return response
            else:
                logger.error(f"Aucun fichier vidéo trouvé dans {VIDEOS_DIR} pour l'ID {interview_id}")
        except Exception as e:
            logger.error(f"Erreur lors de la recherche dans Uploads/videos: {str(e)}")

        # 2. Vérifier si la vidéo est stockée dans GridFS
        if video.get("file_id"):
            try:
                fs = gridfs.GridFS(current_app.mongo.db)
                video_file = fs.get(video["file_id"])
                response = send_file(
                    io.BytesIO(video_file.read()),
                    mimetype='video/webm',
                    as_attachment=False,''
                    download_name=f"interview_{interview_id}.webm"
                )
                response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'
                response.headers['Access-Control-Allow-Credentials'] = 'true'
                response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
                response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
                return response
            except Exception as e:
                logger.error(f"Erreur lors de la récupération de la vidéo depuis GridFS: {str(e)}")

        # 3. Si la vidéo est stockée en base64
        if video.get("video_data"):
            try:
                video_data = base64.b64decode(video["video_data"])
                response = send_file(
                    io.BytesIO(video_data),
                    mimetype='video/webm',
                    as_attachment=False,
                    download_name=f"interview_{interview_id}.webm"
                )
                response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'
                response.headers['Access-Control-Allow-Credentials'] = 'true'
                response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
                response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
                return response
            except Exception as e:
                logger.error(f"Erreur lors du décodage de la vidéo: {str(e)}")

        return jsonify({"error": "Format de vidéo non supporté"}), 400

    except Exception as e:
        logger.error(f"Erreur lors de la récupération de la vidéo: {str(e)}")
        return jsonify({"error": "Erreur lors de la récupération de la vidéo"}), 500