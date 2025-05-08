from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from datetime import datetime, timezone
from jwt_manager import jwt_manager
import logging
from flask_cors import cross_origin
from pymongo.errors import PyMongoError

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

entretiens_bp = Blueprint('entretiens', __name__, url_prefix="/api/recruteur/entretiens")

# Noms des collections
OFFRES_COLLECTION = 'offres_emploi'
CANDIDATURES_COLLECTION = 'candidatures'
CANDIDATS_COLLECTION = 'candidats'
ENTRETIENS_COLLECTION = 'entretiens'

def serialize_doc(doc):
    """Serialize MongoDB document to JSON-compatible format."""
    if not doc:
        return None
    doc = doc.copy()
    if "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    if "candidateId" in doc:
        doc["candidateId"] = str(doc["candidateId"])
    if "jobId" in doc:
        doc["jobId"] = str(doc["jobId"])
    if "interviewDate" in doc:
        doc["date"] = doc["interviewDate"].isoformat()
        del doc["interviewDate"]
    return doc

def get_user_from_token(token):
    """Extract user information from token."""
    if not token:
        return None
    if isinstance(token, str) and token.startswith("Bearer "):
        token = token.split(" ")[1]
    try:
        data = jwt_manager.verify_token(token)
        if not data:
            return None
        return {"id": data["sub"], "role": data["role"]}
    except Exception as e:
        logger.error(f"Erreur lors de la vérification du token: {str(e)}")
        return None

@entretiens_bp.route("/entretiens", methods=["GET"])
@cross_origin(origins="http://localhost:3000")
def get_entretiens():
    """Retrieve interviews for the authenticated recruiter with pagination."""
    try:
        # Obtenir le token d'authentification
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            logger.error("Aucun token d'authentification fourni")
            return jsonify({"error": "Authentification requise", "code": "NO_TOKEN"}), 401

        # Extraire et valider l'utilisateur
        user = get_user_from_token(auth_header)
        if not user:
            logger.error("Token invalide ou expiré")
            return jsonify({"error": "Token invalide ou expiré", "code": "INVALID_TOKEN"}), 401

        if user.get('role') != 'recruteur':
            logger.error(f"Accès non autorisé pour le rôle: {user.get('role')}")
            return jsonify({"error": "Accès réservé aux recruteurs", "code": "UNAUTHORIZED_ROLE"}), 403

        # Obtenir l'ID du recruteur
        recruteur_id = user.get('id')
        if not recruteur_id:
            logger.error("ID recruteur non trouvé dans les données utilisateur")
            return jsonify({"error": "Impossible d'identifier le recruteur", "code": "MISSING_RECRUITER_ID"}), 400

        # Récupérer les paramètres de pagination
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        skip = (page - 1) * per_page

        logger.info(f"Récupération des entretiens pour le recruteur: {recruteur_id}, page: {page}, per_page: {per_page}")

        db = current_app.mongo
        if db is None:
            logger.error("Base de données non initialisée")
            return jsonify({"error": "Base de données non initialisée", "code": "DB_NOT_INITIALIZED"}), 500

        # Récupérer les offres du recruteur
        offres = list(db[OFFRES_COLLECTION].find({"recruteur_id": recruteur_id}))
        offre_ids = [offre['_id'] for offre in offres]

        if not offre_ids:
            logger.info(f"Aucune offre trouvée pour le recruteur {recruteur_id}")
            return jsonify({
                "interviews": [],
                "pagination": {"page": page, "per_page": per_page, "total": 0, "pages": 0}
            }), 200

        # Vérifier si la collection entretiens existe
        if ENTRETIENS_COLLECTION not in db.list_collection_names():
            logger.info("Collection 'entretiens' non trouvée")
            return jsonify({
                "interviews": [],
                "pagination": {"page": page, "per_page": per_page, "total": 0, "pages": 0}
            }), 200

        # Compter le nombre total d'entretiens
        total_interviews = db[ENTRETIENS_COLLECTION].count_documents({
            "jobId": {"$in": offre_ids}
        })

        # Récupérer les entretiens avec pagination
        interviews = list(db[ENTRETIENS_COLLECTION].find({
            "jobId": {"$in": offre_ids}
        }).skip(skip).limit(per_page))

        # Enrichir les données des entretiens
        enriched_interviews = []
        for interview in interviews:
            try:
                interview_data = serialize_doc(interview)
                if not interview_data:
                    continue

                # Récupérer les informations de l'offre
                offre = next((o for o in offres if o['_id'] == interview.get('jobId')), None)
                interview_data['position'] = offre.get('titre', 'Offre inconnue') if offre else 'Offre inconnue'

                # Récupérer les informations du candidat via candidature
                candidature = db[CANDIDATURES_COLLECTION].find_one({
                    "_id": interview.get('candidatureId'),
                    "offre_id": interview.get('jobId')
                })
                if candidature and 'candidat_id' in candidature:
                    candidat = db[CANDIDATS_COLLECTION].find_one({"_id": candidature['candidat_id']})
                    if candidat:
                        interview_data['candidateName'] = f"{candidat.get('nom', '')} {candidat.get('prenom', '')}".strip()
                        interview_data['candidateEmail'] = candidat.get('email', '')
                    else:
                        interview_data['candidateName'] = 'Candidat inconnu'
                        interview_data['candidateEmail'] = ''
                else:
                    interview_data['candidateName'] = 'Candidat inconnu'
                    interview_data['candidateEmail'] = ''

                # Ajouter des champs par défaut si manquants
                interview_data['status'] = interview_data.get('status', 'En attente')
                interview_data['feedback'] = interview_data.get('feedback', '')
                interview_data['rating'] = interview_data.get('rating', 0)
                interview_data['recording_url'] = interview_data.get('recording_url', '')

                enriched_interviews.append(interview_data)
            except Exception as e:
                logger.error(f"Erreur lors du traitement de l'entretien {interview.get('_id')}: {str(e)}")
                continue

        # Calculer les informations de pagination
        pagination_info = {
            "page": page,
            "per_page": per_page,
            "total": total_interviews,
            "pages": (total_interviews + per_page - 1) // per_page
        }

        logger.info(f"Retour de {len(enriched_interviews)} entretiens pour le recruteur {recruteur_id}")
        return jsonify({
            "interviews": enriched_interviews,
            "pagination": pagination_info
        }), 200

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans /entretiens: {str(e)}")
        return jsonify({"error": "Erreur de base de données", "code": "DB_ERROR"}), 500
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des entretiens: {str(e)}")
        return jsonify({"error": f"Erreur serveur: {str(e)}", "code": "SERVER_ERROR"}), 500