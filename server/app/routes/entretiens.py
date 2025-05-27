from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from datetime import datetime, timezone
from jwt_manager import jwt_manager
import logging
from flask_cors import cross_origin
from pymongo.errors import PyMongoError
import json
import os
import whisper
import requests
import httpx

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Créer le blueprint
entretiens_bp = Blueprint('entretiens', __name__, url_prefix='/api/candidates/entretiens')

# Noms des collections
ENTRETIENS_COLLECTION = 'entretiens'
QUESTIONS_COLLECTION = 'questions'
RAPPORTS_COLLECTION = 'rapports'

# Configuration Groq
GROQ_API_KEY = "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"
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

logger.info("Configuration Groq initialisée")

def serialize_doc(doc):
    """Serialize MongoDB document to JSON-compatible format."""
    if not doc:
        return None
    doc = doc.copy()
    
    # Convertir tous les ObjectId en string
    for key in list(doc.keys()):
        if isinstance(doc[key], ObjectId):
            doc[key] = str(doc[key])
        elif isinstance(doc[key], dict):
            doc[key] = serialize_doc(doc[key])
        elif isinstance(doc[key], list):
            doc[key] = [serialize_doc(item) if isinstance(item, dict) else item for item in doc[key]]
    
    # Convertir les dates en format ISO
    for date_field, new_field in [
        ('date_prevue', 'datePrevue'),
        ('date_creation', 'dateCreation'),
        ('date_maj', 'dateMaj'),
        ('completed_at', 'completedAt'),
        ('created_at', 'createdAt')
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

def validate_interview_access(db, entretien_id, user_id):
    """Validate interview access and return interview data if valid."""
    try:
        entretien_obj_id = ObjectId(entretien_id)
    except Exception as e:
        logger.error(f"ID d'entretien invalide: {entretien_id}. Erreur: {str(e)}")
        return None, "ID d'entretien invalide", 400

    entretien = db[ENTRETIENS_COLLECTION].find_one({
        "_id": entretien_obj_id,
        "candidat_id": ObjectId(user_id)
    })
    
    if not entretien:
        return None, "Entretien non trouvé ou non autorisé", 404
        
    return entretien, None, None

def process_transcriptions(transcriptions, questions_list):
    """Process and validate transcriptions."""
    if not transcriptions or not isinstance(transcriptions, list):
        return []
        
    processed = []
    for trans in transcriptions:
        if not isinstance(trans, dict):
            continue
            
        question_index = trans.get('questionIndex')
        if question_index is None or not isinstance(question_index, int):
            continue
            
        question = questions_list[question_index] if 0 <= question_index < len(questions_list) else f"Question {question_index + 1}"
        
        processed.append({
            "questionIndex": question_index,
            "question": question,
            "transcript": trans.get('answer', ''),
            "timestamp": datetime.now(timezone.utc)
        })
    
    return processed

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

        db = current_app.mongo
        if db is None:
            return jsonify({"error": "Base de données non initialisée", "code": "DB_NOT_INITIALIZED"}), 500

        entretien, error_msg, error_code = validate_interview_access(db, entretien_id, user.get('id'))
        if error_msg:
            return jsonify({"error": error_msg, "code": error_code}), error_code
        
        questions_id = entretien.get('questions_id')
        if not questions_id:
            return jsonify({"error": "Entretien sans questions", "code": "NO_QUESTIONS"}), 400

        questions_doc = db[QUESTIONS_COLLECTION].find_one({"_id": ObjectId(questions_id)})
        if not questions_doc:
            return jsonify({"error": "Questions non trouvées", "code": "QUESTIONS_NOT_FOUND"}), 404

        questions_list = questions_doc.get('questions', [])
        if not questions_list:
            return jsonify({"error": "Liste de questions vide", "code": "EMPTY_QUESTIONS"}), 400

        # Organiser les questions et réponses
        qa_pairs = []
        recordings = entretien.get('recordings', [])
        
        for i, question in enumerate(questions_list):
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

@entretiens_bp.route("/<entretien_id>/save", methods=["POST"])
@cross_origin(origins="http://localhost:3000")
def save_entretien(entretien_id):
    """Save interview with video and metadata."""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({"error": "Authentification requise", "code": "NO_TOKEN"}), 401
            
        user = get_user_from_token(auth_header)
        if not user:
            return jsonify({"error": "Token invalide ou expiré", "code": "INVALID_TOKEN"}), 401
            
        if 'candidat' not in user.get('roles', []):
            return jsonify({"error": "Accès réservé aux candidats", "code": "UNAUTHORIZED_ROLE"}), 403

        db = current_app.mongo
        if db is None:
            return jsonify({"error": "Base de données non initialisée", "code": "DB_NOT_INITIALIZED"}), 500

        entretien, error_msg, error_code = validate_interview_access(db, entretien_id, user.get('id'))
        if error_msg:
            return jsonify({"error": error_msg, "code": error_code}), error_code

        # Vérifier si la vidéo est présente
        video_file = request.files.get('video')
        if not video_file:
            logger.error("Aucun fichier vidéo n'a été reçu")
            return jsonify({
                "success": False,
                "error": "Vidéo manquante",
                "code": "MISSING_VIDEO"
            }), 400

        # Vérifier le type de fichier
        if not video_file.filename.endswith('.webm'):
            logger.error(f"Type de fichier invalide: {video_file.filename}")
            return jsonify({
                "success": False,
                "error": "Format de vidéo invalide. Seul le format WebM est accepté.",
                "code": "INVALID_VIDEO_FORMAT"
            }), 400

        # Récupérer et valider les métadonnées
        try:
            metadata = json.loads(request.form.get('metadata', '{}'))
            transcriptions = metadata.get('transcriptions', [])
            logger.info(f"Transcriptions reçues: {len(transcriptions)}")
        except json.JSONDecodeError:
            logger.error("Métadonnées invalides")
            return jsonify({
                "success": False,
                "error": "Métadonnées invalides",
                "code": "INVALID_METADATA"
            }), 400

        # Créer les dossiers nécessaires pour la vidéo
        try:
            # Vérifier si UPLOAD_FOLDER est configuré
            if not current_app.config.get('UPLOAD_FOLDER'):
                logger.error("UPLOAD_FOLDER non configuré dans l'application")
                return jsonify({
                    "success": False,
                    "error": "Configuration manquante pour le stockage des vidéos",
                    "code": "MISSING_CONFIG"
                }), 500

            # Créer le dossier upload s'il n'existe pas
            upload_dir = os.path.join(current_app.root_path, 'Uploads')
            if not os.path.exists(upload_dir):
                os.makedirs(upload_dir)
                logger.info(f"Dossier upload créé: {upload_dir}")

            # Créer le dossier videos s'il n'existe pas
            video_dir = os.path.join(upload_dir, 'videos')
            if not os.path.exists(video_dir):
                os.makedirs(video_dir)
                logger.info(f"Dossier videos créé: {video_dir}")

            # Vérifier les permissions d'écriture
            if not os.access(video_dir, os.W_OK):
                logger.error(f"Pas de permission d'écriture sur le dossier: {video_dir}")
                return jsonify({
                    "success": False,
                    "error": "Erreur de permission pour le stockage des vidéos",
                    "code": "PERMISSION_ERROR"
                }), 500

        except Exception as e:
            logger.error(f"Erreur lors de la création des dossiers: {str(e)}")
            return jsonify({
                "success": False,
                "error": "Erreur lors de la création des dossiers de stockage",
                "code": "DIRECTORY_CREATION_ERROR"
            }), 500

        # Générer un nom de fichier unique
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        video_filename = f"interview_{entretien_id}_{timestamp}.webm"
        video_path = os.path.join(video_dir, video_filename)

        # Sauvegarder la vidéo
        try:
            logger.info(f"Tentative de sauvegarde de la vidéo: {video_path}")
            video_file.save(video_path)
            logger.info(f"Vidéo sauvegardée avec succès: {video_path}")
            
            # Vérifier que le fichier a bien été créé
            if not os.path.exists(video_path):
                logger.error(f"Le fichier vidéo n'a pas été créé: {video_path}")
                return jsonify({
                    "success": False,
                    "error": "Erreur lors de la sauvegarde de la vidéo",
                    "code": "VIDEO_SAVE_ERROR"
                }), 500
                
            # Vérifier la taille du fichier
            file_size = os.path.getsize(video_path)
            if file_size == 0:
                logger.error(f"Le fichier vidéo est vide: {video_path}")
                os.remove(video_path)  # Supprimer le fichier vide
                return jsonify({
                    "success": False,
                    "error": "Le fichier vidéo est vide",
                    "code": "EMPTY_VIDEO"
                }), 400
                
            logger.info(f"Taille du fichier vidéo: {file_size} bytes")
            
        except Exception as e:
            logger.error(f"Erreur lors de la sauvegarde de la vidéo: {str(e)}")
            return jsonify({
                "success": False,
                "error": "Erreur lors de la sauvegarde de la vidéo",
                "code": "VIDEO_SAVE_ERROR"
            }), 500

        # Générer l'URL de la vidéo
        video_url = f"/api/candidates/entretiens/videos/{entretien_id}"

        # Sauvegarder le chemin relatif de la vidéo avec des forward slashes
        relative_video_path = os.path.relpath(video_path, current_app.root_path).replace('\\', '/')
        logger.info(f"Chemin relatif de la vidéo: {relative_video_path}")

        # Générer la transcription avec Whisper
        transcription = None
        try:
            model = whisper.load_model("base")
            result = model.transcribe(video_path)
            transcription = result["text"]
            logger.info(f"Transcription générée avec succès pour l'entretien {entretien_id}")
        except Exception as e:
            logger.error(f"Erreur lors de la transcription: {str(e)}")
            transcription = None

        # Récupérer les questions de l'entretien
        questions_id = entretien.get('questions_id')
        questions_doc = db[QUESTIONS_COLLECTION].find_one({"_id": ObjectId(questions_id)})
        questions_list = questions_doc.get('questions', []) if questions_doc else []

        # Traiter les transcriptions
        processed_recordings = process_transcriptions(transcriptions, questions_list)
        logger.info(f"Transcriptions traitées: {len(processed_recordings)}")

        # Mettre à jour l'entretien avec les enregistrements traités
        try:
            db[ENTRETIENS_COLLECTION].update_one(
                {"_id": ObjectId(entretien_id)},
                {"$set": {"recordings": processed_recordings}}
            )
            logger.info(f"Enregistrements mis à jour pour l'entretien {entretien_id}")
        except Exception as e:
            logger.error(f"Erreur lors de la mise à jour des enregistrements: {str(e)}")
            return jsonify({
                "success": False,
                "error": "Erreur lors de la mise à jour des enregistrements",
                "code": "RECORDINGS_UPDATE_ERROR"
            }), 500

        # Récupérer l'entretien mis à jour avec les enregistrements
        updated_entretien = db[ENTRETIENS_COLLECTION].find_one({"_id": ObjectId(entretien_id)})
        if not updated_entretien:
            logger.error("Impossible de récupérer l'entretien mis à jour")
            return jsonify({
                "success": False,
                "error": "Erreur lors de la récupération de l'entretien",
                "code": "FETCH_UPDATE_FAILED"
            }), 500

        # Générer le rapport avec l'entretien mis à jour
        rapport = None
        rapport_id = None
        try:
            rapport = generate_rapport(updated_entretien, transcription, questions_list)
            if rapport:
                rapport_id = rapport.get('_id')
                logger.info(f"Rapport généré avec l'ID: {rapport_id}")
            else:
                logger.error("Échec de la génération du rapport")
                return jsonify({
                    "success": False,
                    "error": "Échec de la génération du rapport",
                    "code": "REPORT_GENERATION_FAILED"
                }), 500
        except Exception as e:
            logger.error(f"Erreur lors de la génération du rapport: {str(e)}")
            return jsonify({
                "success": False,
                "error": "Erreur lors de la génération du rapport",
                "code": "REPORT_GENERATION_ERROR"
            }), 500

        # Mettre à jour l'entretien avec le rapport
        try:
            update_data = {
                "video_url": video_url,
                "video_path": relative_video_path,
                "transcription": transcription,
                "transcription_completed": bool(transcription),
                "rapport_id": rapport_id,
                "statut": "termine" if rapport_id else "en_cours",
                "completed_at": datetime.now(timezone.utc) if rapport_id else None,
                "date_maj": datetime.now(timezone.utc),
                "last_updated_by": user.get('id')
            }

            update_result = db[ENTRETIENS_COLLECTION].update_one(
                {"_id": ObjectId(entretien_id)},
                {"$set": update_data}
            )

            if update_result.modified_count == 0:
                logger.error("Échec de la mise à jour de l'entretien")
                return jsonify({
                    "success": False,
                    "error": "Échec de la mise à jour de l'entretien",
                    "code": "UPDATE_FAILED"
                }), 500

            logger.info(f"Entretien mis à jour avec succès: {entretien_id}")

        except Exception as e:
            logger.error(f"Erreur lors de la mise à jour de l'entretien: {str(e)}")
            return jsonify({
                "success": False,
                "error": "Erreur lors de la mise à jour de l'entretien",
                "code": "INTERVIEW_UPDATE_ERROR"
            }), 500

        # Retourner les données mises à jour
        final_entretien = db[ENTRETIENS_COLLECTION].find_one({"_id": ObjectId(entretien_id)})
        if not final_entretien:
            return jsonify({
                "success": False,
                "error": "Erreur lors de la récupération de l'entretien final",
                "code": "FETCH_FINAL_FAILED"
            }), 500

        # Sérialiser les données pour la réponse
        serialized_entretien = serialize_doc(final_entretien)
        serialized_rapport = serialize_doc(rapport) if rapport else None

        return jsonify({
            "success": True,
            "message": "Entretien sauvegardé avec succès",
            "data": {
                "videoUrl": video_url,
                "videoPath": relative_video_path,
                "transcription": transcription,
                "entretien": serialized_entretien,
                "rapport": serialized_rapport,
                "recordings": processed_recordings
            }
        }), 200

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB: {str(e)}")
        return jsonify({"error": "Erreur de base de données", "code": "DB_ERROR"}), 500
    except Exception as e:
        logger.error(f"Erreur serveur: {str(e)}")
        return jsonify({"error": "Erreur serveur", "code": "SERVER_ERROR"}), 500

def generate_rapport(entretien, transcription, questions_list):
    """Génère un rapport d'entretien basé sur les réponses du candidat et les questions."""
    try:
        # Récupérer les enregistrements des réponses
        recordings = entretien.get('recordings', [])
        if not recordings:
            logger.error("Aucun enregistrement trouvé pour l'entretien")
            return None

        # Organiser les questions et réponses
        qa_pairs = []
        for recording in recordings:
            question_index = recording.get('questionIndex')
            if question_index is not None and 0 <= question_index < len(questions_list):
                # Convertir le timestamp en string ISO si présent
                timestamp = recording.get('timestamp')
                if isinstance(timestamp, datetime):
                    timestamp = timestamp.isoformat()
                
                qa_pairs.append({
                    "question": questions_list[question_index],
                    "answer": recording.get('transcript', ''),
                    "timestamp": timestamp
                })

        # Préparation du prompt pour Groq
        prompt = f"""En tant qu'expert en recrutement, évaluez cet entretien d'embauche.

Questions et réponses du candidat :
{json.dumps(qa_pairs, indent=2, ensure_ascii=False)}

Veuillez fournir une évaluation détaillée au format JSON suivant :
{{
    "questions_analysees": [
        {{
            "question": "Question posée",
            "reponse": "Réponse du candidat",
            "analyse": "Analyse détaillée de la réponse",
            "score": 8
        }}
    ],
    "score_global": 7,
    "points_forts": ["Point fort 1", "Point fort 2"],
    "points_a_ameliorer": ["Point à améliorer 1", "Point à améliorer 2"],
    "recommandations": ["Recommandation 1", "Recommandation 2"],
    "conclusion": "Conclusion sur l'adéquation du candidat"
}}"""

        # Appel à l'API Groq
        try:
            headers = {
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            }
            
            data = {
                "model": "llama3-8b-8192",
                "messages": [
                    {"role": "system", "content": "Tu es un expert en recrutement qui évalue les entretiens d'embauche."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7,
                "max_tokens": 1500
            }

            logger.info("Envoi de la requête à l'API Groq...")
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    GROQ_API_URL,
                    json=data,
                    headers=headers
                )
                
                if response.status_code == 401:
                    logger.error("Erreur d'authentification avec l'API Groq")
                    return None
                elif response.status_code != 200:
                    logger.error(f"Erreur API Groq (status {response.status_code}): {response.text}")
                    return None
                    
                response.raise_for_status()
                evaluation_data = response.json()
                
                # Extraire et parser la réponse
                evaluation_text = evaluation_data['choices'][0]['message']['content'].strip()
                
                # Trouver le début et la fin de la structure JSON
                start_index = evaluation_text.find('{')
                end_index = evaluation_text.rfind('}') + 1

                if start_index == -1 or end_index == 0:
                    logger.error("Format de réponse invalide - aucun JSON trouvé")
                    return None

                # Extraire la chaîne JSON
                evaluation_json = evaluation_text[start_index:end_index]
                evaluation = json.loads(evaluation_json)
                
                # Créer le rapport final
                rapport = {
                    "entretien_id": ObjectId(entretien["_id"]),
                    "candidat_id": ObjectId(entretien["candidat_id"]),
                    "recruteur_id": ObjectId(entretien["recruteur_id"]),
                    "date_creation": datetime.now(timezone.utc),
                    "statut": "termine",
                    "questions_analysees": evaluation.get("questions_analysees", []),
                    "score_global": evaluation.get("score_global", 0),
                    "points_forts": evaluation.get("points_forts", []),
                    "points_a_ameliorer": evaluation.get("points_a_ameliorer", []),
                    "recommandations": evaluation.get("recommandations", []),
                    "conclusion": evaluation.get("conclusion", ""),
                    "evaluation_complete": True,
                    "qa_pairs": qa_pairs,
                    "questions": questions_list
                }
                
                # Insérer le rapport dans la base de données
                db = current_app.mongo
                rapport_id = db[RAPPORTS_COLLECTION].insert_one(rapport).inserted_id
                logger.info(f"Rapport généré et sauvegardé avec l'ID: {rapport_id}")
                
                # Mettre à jour l'entretien avec l'ID du rapport
                db[ENTRETIENS_COLLECTION].update_one(
                    {"_id": ObjectId(entretien["_id"])},
                    {"$set": {"rapport_id": rapport_id}}
                )
                logger.info(f"Entretien mis à jour avec l'ID du rapport: {rapport_id}")
                
                return rapport

        except httpx.HTTPError as e:
            logger.error(f"Erreur HTTP lors de la requête à l'API Groq: {str(e)}")
            return None
        except json.JSONDecodeError as e:
            logger.error(f"Erreur lors du parsing JSON: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Erreur lors de l'appel à l'API Groq: {str(e)}")
            return None

    except Exception as e:
        logger.error(f"Erreur lors de la génération du rapport: {str(e)}")
        return None