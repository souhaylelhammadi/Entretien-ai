from flask import Blueprint, jsonify, request, current_app, send_file, Response, make_response
import os
import base64
from bson import ObjectId
from datetime import datetime, timezone
import logging
from flask_cors import CORS
from pymongo.errors import PyMongoError
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import PyPDF2
import io
from .entretiens_questions import generate_interview_questions, get_stored_questions
import json
import tempfile
import whisper
from moviepy import VideoFileClip
import shutil

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Blueprint avec préfixe
candidates_bp = Blueprint('candidates', __name__, url_prefix='/api/candidates')

# Noms des collections
OFFRES_COLLECTION = 'offres'
CANDIDATURES_COLLECTION = 'candidatures'
CANDIDATS_COLLECTION = 'candidats'
UTILISATEURS_COLLECTION = 'utilisateurs'
RECRUTEURS_COLLECTION = 'recruteurs'
ENTRETIENS_COLLECTION = 'entretiens'

# Configure CORS
CORS(candidates_bp, 
     resources={r"/*": {"origins": "http://localhost:3000"}},
     supports_credentials=True,
     max_age=3600)

# Configure rate limiting
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# Helper function to generate a fallback PDF
def generate_not_available_pdf(message="CV non disponible"):
    """Génère un PDF simple contenant le texte spécifié."""
    pdf_base64 = (
        "JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9GaWx0ZXIvRmxhdGVEZWNvZGUvTGVuZ3RoIDE2MT4+c3RyZWFtCnicXY/BCsMgEETvfsUes4cYk7SWCKG0hZz6A401oIuxSA/9+3pJoAXZw+zAG2ZZzt4xDZAd0RsMMUFwdGLqJkbvkRTcK9MsaxfD3CmxKlDPO0LO0eO5VLDBVYE3jF1iVBc39/WpNmh7SvRGDlKB65vT/ysLlW2aZp8XGNpiXoL7Bx1MGmJBrLXNWseaAuLdj94Kzu4LRXQoQwplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwvRmlsdGVyL0ZsYXRlRGVjb2RlL0xlbmd0aCAyNj4+c3RyZWFtCnicK+QyCuQyNFQozs9JVTDk5XKuBQBCagTJCmVuZHN0cmVhbQplbmRvYmoKNiAwIG9iago8PC9GaWx0ZXIvRmxhdGVEZWNvZGUvTGVuZ3RoIDE2NT4+c3RyZWFtCnicXU8xDsMgDNz5BR/gh4RQakAioXZoJvqAhJAislKUDPn9GJKqlfzw3dnni27MffSEsJF8dMgFiWH1mG1iC4KgjEXKiGIuswYaHpH69YMEj/J+nDpTGo3SuNFwEafY8NQMpiBGpQpRlm17PZ+uzcF9UdFLdCgV6L+r/xMzpnYcx/dxREkL5SbXH/T4aJEKZW5kc3RyZW0KZW5kb2JqCjEgMCBvYmoKPDwvVGFicy9TL0dyb3VwPDwvUy9UcmFuc3BhcmVuY3kvVHlwZS9Hcm91cC9DUy9EZXZpY2VSR0I+Pi9Db250ZW50cyA2IDAgUi9UeXBlL1BhZ2UvUmVzb3VyY2VzPDwvQ29sb3JTcGFjZTw8L0NTL0RldmljZVJHQj4+L1Byb2NTZXQgWy9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUldL0ZvbnQ8PC9GMSAyIDAgUj4+Pj4vUGFyZW50IDQgMCBSL01lZGlhQm94WzAgMCA1OTUgODQyXT4+CmVuZG9iago yIDAgb2JqCjw8L1N1YnR5cGUvVHlwZTEvVHlwZS9Gb250L0Jhc2VGb250L0hlbHZldGljYS9FbmNvZGluZy9XaW5BbnNpRW5jb2Rpbmc+PgplbmRvYmoKNCAwIG9iago8PC9LaWRzWzEgMCBSXS9UeXBlL1BhZ2VzL0NvdW50IDEvSVRYVCgyLjEuNyk+PgplbmRvYmoKNyAwIG9iago8PC9OYW1lc1soSlJfUEFHRV9BTkNIT1JfMF8xKSAzIDAgUl0+PgplbmRvYmoKOCAwIG9iago8PC9EZXN0cyA3IDAgUj4+CmVuZG9iago5IDAgb2JqCjw8L05hbWVzIDggMCBSL1R5cGUvQ2F0YWxvZy9QYWdlcyA0IDAgUi9WaWV3ZXJQcmVmZXJlbmNlczw8L1ByaW50U2NhbGluZy9BcHBEZWZhdWx0Pj4+PgplbmRvYmoKMTAgMCBvYmoKPDwvTW9kRGF0ZShEOjIwMjQwNTAxMTcwMTIwKzAwJzAwJykvQ3JlYXRvcihKYXNwZXJSZXBvcnRzIExpYnJhcnkgdmVyc2lvbiAgUkVWRFNFKSAvQ3JlYXRpb25EYXRlKEQ6MjAyNDA1MDExNzAxMjArMDAnMDAnKS9Qcm9kdWNlcihpVGV4dCAyLjEuNyBieSAxVDNYVCk+PgplbmRvYmoKeHJlZgowIDExCjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDQyMCAwMDAwMCBuIAowMDAwMDAwNjQyIDAwMDAwIG4gCjAwMDAwMDAwMTUgMDAwMCBuIAowMDAwMDAwNzMwIDAwMDAwIG4gCjAwMDAwMDAyNDMgMDAwMCBuIAowMDAwMDAwMzM5IDAwMDAwIG4gCjAwMDAwMDA3OTMgMDAwMCBuIAowMDAwMDAwODQ3IDAwMDAwIG4gCjAwMDAwMDA4NzkgMDAwMCBuIAowMDAwMDAwOTg0IDAwMDAwIG4gCnRyYWlsZXIKPDwvSW5mbyAxMCAwIFIvSUQgWzxkYmQ0MDg5ZGVmYTE0YTNjMzliZWEwYmZmMWJkYjc5ZT48ZWRlZmRlZTAwZTk1MjY2ZTY4YTI5ZGNmZjUyZGQyZGM+XScvUm9vdCA5IDAgUi9TaXplIDExPj4Kc3RhcnR4cmVmCjExNTgKJSVFT0YK"
    )
    return base64.b64decode(pdf_base64)

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
                # Nettoyer le token
                if token.startswith("Bearer "):
                    token = token[7:]
                    logger.info("Préfixe 'Bearer ' retiré")
                else:
                    logger.warning("Token ne commence pas par 'Bearer '")
                    return jsonify({"error": "Format de token invalide", "code": "INVALID_TOKEN_FORMAT"}), 401

                # Vérifier le token
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

# Helper function to format job offer response
def format_offre(offre):
    return {
        "id": str(offre["_id"]),
        "titre": str(offre.get("titre", "Titre non spécifié")),
        "description": str(offre.get("description", "Description non disponible")),
        "localisation": str(offre.get("localisation", "Localisation non spécifiée")),
        "departement": str(offre.get("departement", "Département non spécifié")),
        "entreprise": str(offre.get("entreprise", "")),
        "recruteur_id": str(offre.get("recruteur_id", "")),
        "date_creation": offre.get("date_creation", datetime.utcnow()).isoformat() + "Z",
        "date_maj": offre.get("date_maj", datetime.utcnow()).isoformat() + "Z",
        "statut": str(offre.get("statut", "ouverte")),
        "competences_requises": offre.get("competences_requises", []),
        "questions_ids": [str(qid) for qid in offre.get("questions_ids", [])],
        "candidature_ids": [str(cid) for cid in offre.get("candidature_ids", [])],
        "valide": offre.get("statut", "ouverte") == "ouverte",
    }

@candidates_bp.route("/offres-with-candidates", methods=["GET"])
@require_auth("recruteur")
def get_offres_with_candidates(auth_payload):
    """Retrieve all job offers for the authenticated recruiter with their associated candidatures."""
    try:
        user_id = auth_payload.get('sub')
        logger.info(f"User ID: {user_id}")
        
        db = current_app.mongo
        # D'abord, récupérer l'utilisateur
        user = db[UTILISATEURS_COLLECTION].find_one({"_id": ObjectId(str(user_id))})
        if not user:
            logger.error(f"Utilisateur non trouvé pour l'ID: {user_id}")
            return jsonify({"error": "Utilisateur non trouvé", "code": "USER_NOT_FOUND"}), 404

        # Ensuite, chercher le recruteur correspondant
        recruteur = db[RECRUTEURS_COLLECTION].find_one({"utilisateur_id": ObjectId(str(user_id))})
        if not recruteur:
            logger.error(f"Recruteur non trouvé pour l'utilisateur: {user_id}")
            return jsonify({"error": "Recruteur non trouvé", "code": "RECRUITER_NOT_FOUND"}), 404
            
        recruteur_id = recruteur["_id"]
        logger.info(f"Recruteur ID: {recruteur_id}")

        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        skip = (page - 1) * per_page

        offres_query = {"recruteur_id": ObjectId(recruteur_id)}
        total_offres = db[OFFRES_COLLECTION].count_documents(offres_query)
        offres = db[OFFRES_COLLECTION].find(offres_query).skip(skip).limit(per_page)

        result = []
        for offre in offres:
            try:
                offre_id = str(offre['_id'])
                formatted_offre = format_offre(offre)
                candidatures = db[CANDIDATURES_COLLECTION].find({"offre_id": ObjectId(offre_id)})
                candidatures_list = []

                for candidature in candidatures:
                    try:
                        user_email = candidature.get("user_email")
                        if not user_email:
                            logger.warning(f"user_email manquant dans la candidature: {str(candidature['_id'])}")
                            continue

                        utilisateur = db[UTILISATEURS_COLLECTION].find_one({"email": user_email})
                        if not utilisateur:
                            logger.warning(f"Utilisateur non trouvé pour l'email: {user_email}")
                            continue

                        candidat = db[CANDIDATS_COLLECTION].find_one({"utilisateur_id": utilisateur["_id"]})
                        if not candidat:
                            logger.warning(f"Candidat non trouvé pour l'utilisateur: {user_email}")
                            continue

                        cv_url = f"/api/candidates/cv/{str(candidature['_id'])}"
                        candidature_data = {
                            "id": str(candidature["_id"]),
                            "nom": candidat.get("nom", "Inconnu"),
                            "prenom": candidat.get("prenom", ""),
                            "email": user_email,
                            "status": candidature.get("statut", "En attente"),
                            "date_candidature": candidature.get("created_at", datetime.now(timezone.utc)).isoformat(),
                            "cv_url": cv_url,
                            "lettre_motivation": candidature.get("lettre_motivation", "")
                        }
                        candidatures_list.append(candidature_data)
                        logger.debug(f"Candidature traitée avec succès: {candidature_data['id']}")

                    except Exception as e:
                        logger.error(f"Erreur lors du traitement de la candidature {str(candidature.get('_id'))}: {str(e)}")
                        continue

                result.append({
                    **formatted_offre,
                    "candidats": candidatures_list
                })

            except Exception as e:
                logger.error(f"Erreur lors du traitement de l'offre {str(offre.get('_id'))}: {str(e)}")
                continue

        pagination = {
            "page": page,
            "per_page": per_page,
            "total": total_offres,
            "pages": (total_offres + per_page - 1) // per_page
        }

        logger.info(f"Retour de {len(result)} offres avec candidatures pour le recruteur {recruteur_id}")
        return jsonify({
            "offres": result,
            "pagination": pagination
        }), 200

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans /offres-with-candidates: {str(e)}")
        return jsonify({"error": "Erreur de base de données", "code": "DB_ERROR"}), 500
    except Exception as e:
        logger.error(f"Erreur dans /offres-with-candidates: {str(e)}")
        return jsonify({"error": f"Erreur serveur: {str(e)}", "code": "SERVER_ERROR"}), 500

@candidates_bp.route("/<string:candidate_id>", methods=["PUT"])
@require_auth("recruteur")
def update_candidate_status(candidate_id, auth_payload):
    """Update the status of a candidature."""
    try:
        recruteur_id = auth_payload.get('recruteur_id')
        if not recruteur_id:
            logger.error("ID recruteur non trouvé dans auth_payload")
            return jsonify({"error": "Impossible d'identifier le recruteur", "code": "MISSING_RECRUITER_ID"}), 400

        data = request.get_json()
        if not data or 'status' not in data:
            return jsonify({"error": "Statut requis", "code": "MISSING_STATUS"}), 400

        valid_statuses = ["En attente", "En cours", "Accepté", "Refusé"]
        if data['status'] not in valid_statuses:
            return jsonify({"error": f"Statut invalide. Valeurs autorisées: {valid_statuses}", "code": "INVALID_STATUS"}), 400

        if not ObjectId.is_valid(candidate_id):
            logger.error(f"Format d'ID candidature invalide: {candidate_id}")
            return jsonify({"error": "Format d'ID invalide", "code": "INVALID_ID"}), 400

        db = current_app.mongo
        candidature = db[CANDIDATURES_COLLECTION].find_one({"_id": ObjectId(candidate_id)})
        if not candidature:
            logger.error(f"Candidature non trouvée pour l'ID: {candidate_id}")
            return jsonify({"error": "Candidature non trouvée", "code": "NOT_FOUND"}), 404

        offre_id = candidature.get("offre_id")
        if not offre_id:
            logger.error(f"Offre non trouvée pour la candidature: {candidate_id}")
            return jsonify({"error": "Offre non trouvée pour cette candidature", "code": "MISSING_OFFER"}), 404

        offre = db[OFFRES_COLLECTION].find_one({"_id": ObjectId(offre_id)})
        if not offre:
            logger.error(f"Offre non trouvée pour l'ID: {offre_id}")
            return jsonify({"error": "Offre non trouvée", "code": "OFFER_NOT_FOUND"}), 404

        if str(offre.get("recruteur_id")) != recruteur_id:
            logger.error(f"Tentative non autorisée de mise à jour - recruteur {recruteur_id} essaie de modifier une candidature pour l'offre de {offre.get('recruteur_id')}")
            return jsonify({"error": "Vous n'êtes pas autorisé à modifier cette candidature", "code": "UNAUTHORIZED_ACCESS"}), 403

        # Si le statut est "Accepté", générer les questions et créer l'entretien
        if data['status'] == "Accepté":
            # Extraire le texte du CV
            cv_text = ""
            if candidature.get("cv_path"):
                with open(candidature["cv_path"], 'rb') as f:
                    cv_text = extract_text_from_pdf(f.read())

            # Générer les questions
            questions_result = generate_interview_questions(cv_text, offre, candidate_id, str(offre_id))
            
            if questions_result == ['error']:
                logger.error("Erreur lors de la génération des questions")
                return jsonify({"error": "Erreur lors de la génération des questions", "code": "QUESTIONS_GENERATION_ERROR"}), 500

            # Récupérer les questions stockées pour obtenir l'ID
            stored_questions = get_stored_questions(candidate_id)
            if not stored_questions:
                logger.error("Questions non trouvées après génération")
                return jsonify({"error": "Erreur lors de la récupération des questions", "code": "QUESTIONS_NOT_FOUND"}), 500

            # Créer l'entretien
            entretien = {
                "candidature_id": ObjectId(candidate_id),
                "offre_id": ObjectId(offre_id),
                "candidat_id": candidature.get("user_id"),
                "recruteur_id": ObjectId(recruteur_id),
                "questions_id": stored_questions["_id"],
                "date_prevue": None,  # À définir plus tard
                "statut": "planifie",
                "transcription_ids": [],
                "rapport_id": None,
                "date_creation": datetime.now(timezone.utc),
                "date_maj": datetime.now(timezone.utc)
            }

            # Insérer l'entretien dans la base de données
            entretien_result = db[ENTRETIENS_COLLECTION].insert_one(entretien)
            
            # Mettre à jour la candidature avec l'ID de l'entretien
            result = db[CANDIDATURES_COLLECTION].update_one(
                {"_id": ObjectId(candidate_id)},
                {"$set": {
                    "statut": data['status'],
                    "entretien_id": entretien_result.inserted_id,
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
        else:
            # Mise à jour simple du statut
            result = db[CANDIDATURES_COLLECTION].update_one(
            {"_id": ObjectId(candidate_id)},
                {"$set": {
                    "statut": data['status'],
                    "updated_at": datetime.now(timezone.utc)
                }}
        )

        if result.modified_count == 0:
            logger.warning(f"Aucune modification effectuée pour la candidature {candidate_id}")
            return jsonify({"error": "Aucune modification effectuée", "code": "NO_CHANGES"}), 400

        logger.info(f"Statut de la candidature {candidate_id} mis à jour vers {data['status']} par le recruteur {recruteur_id}")
        return jsonify({"message": "Statut mis à jour"}), 200

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans /candidates/{candidate_id}: {str(e)}")
        return jsonify({"error": "Erreur de base de données", "code": "DB_ERROR"}), 500
    except Exception as e:
        logger.error(f"Erreur lors de la mise à jour du statut: {str(e)}")
        return jsonify({"error": f"Échec de la mise à jour du statut: {str(e)}", "code": "SERVER_ERROR"}), 500

@candidates_bp.route("/cv/<candidature_id>", methods=["GET"])
def get_cv(candidature_id):
    """Récupérer le CV d'une candidature."""
    try:
        # Récupérer le token depuis l'URL ou les headers
        token = request.args.get('token')
        logger.info(f"Token reçu dans l'URL: {token[:20]}...")  # Log seulement le début du token pour la sécurité

        if not token:
            logger.error("Aucun token d'authentification fourni")
            return jsonify({"error": "Authentification requise", "code": "NO_TOKEN"}), 401

        # Nettoyer le token
        if token.startswith("Bearer "):
            token = token[7:]
            logger.info("Préfixe 'Bearer ' retiré du token")
        elif "Bearer " in token:
            token = token.split("Bearer ")[1]
            logger.info("Token extrait après 'Bearer '")

        # Vérifier le token
        jwt_manager = get_jwt_manager()
        if not jwt_manager:
            logger.error("JWT manager non disponible")
            return jsonify({"error": "Erreur de configuration", "code": "JWT_ERROR"}), 500

        user_id = jwt_manager.verify_token(token)
        if not user_id:
            logger.error("Token invalide ou expiré")
            return jsonify({"error": "Token invalide ou expiré", "code": "INVALID_TOKEN"}), 401

        logger.info(f"User ID extrait du token: {user_id}")
        
        db = current_app.mongo
        # D'abord, récupérer l'utilisateur
        user = db[UTILISATEURS_COLLECTION].find_one({"_id": ObjectId(str(user_id))})
        if not user:
            logger.error(f"Utilisateur non trouvé pour l'ID: {user_id}")
            return jsonify({"error": "Utilisateur non trouvé", "code": "USER_NOT_FOUND"}), 404

        # Ensuite, chercher le recruteur correspondant
        recruteur = db[RECRUTEURS_COLLECTION].find_one({"utilisateur_id": ObjectId(str(user_id))})
        if not recruteur:
            logger.error(f"Recruteur non trouvé pour l'utilisateur: {user_id}")
            return jsonify({"error": "Recruteur non trouvé", "code": "RECRUITER_NOT_FOUND"}), 404

        # Récupérer la candidature
        try:
            candidature = db[CANDIDATURES_COLLECTION].find_one({"_id": ObjectId(candidature_id)})
        except Exception as e:
            logger.error(f"Erreur lors de la récupération de la candidature: {str(e)}")
            return jsonify({"error": "Candidature non trouvée", "code": "CANDIDATURE_NOT_FOUND"}), 404

        if not candidature:
            logger.error(f"Candidature non trouvée: {candidature_id}")
            return jsonify({"error": "Candidature non trouvée", "code": "CANDIDATURE_NOT_FOUND"}), 404

        # Vérifier que la candidature appartient à une offre du recruteur
        offre = db[OFFRES_COLLECTION].find_one({"_id": candidature["offre_id"]})
        if not offre or str(offre["recruteur_id"]) != str(recruteur["_id"]):
            logger.error(f"Accès non autorisé au CV: {candidature_id}")
            return jsonify({"error": "Accès non autorisé", "code": "UNAUTHORIZED"}), 403

        # Récupérer le chemin du CV
        cv_path = candidature.get("cv_path")
        if not cv_path or not os.path.exists(cv_path):
            logger.warning(f"CV non trouvé pour la candidature: {candidature_id}")
            # Générer un PDF de remplacement
            pdf_data = generate_not_available_pdf()
            response = make_response(pdf_data)
            response.headers["Content-Type"] = "application/pdf"
            response.headers["Content-Disposition"] = "inline; filename=cv_non_disponible.pdf"
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            return response

        try:
            with open(cv_path, "rb") as f:
                pdf_data = f.read()
            response = make_response(pdf_data)
            response.headers["Content-Type"] = "application/pdf"
            response.headers["Content-Disposition"] = "inline; filename=cv.pdf"
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            return response
        except Exception as e:
            logger.error(f"Erreur lors de la lecture du CV: {str(e)}")
            return jsonify({"error": "Erreur lors de la lecture du CV", "code": "CV_READ_ERROR"}), 500

    except Exception as e:
        logger.error(f"Erreur lors de la récupération du CV: {str(e)}")
        return jsonify({"error": "Erreur lors de la récupération du CV", "code": "SERVER_ERROR"}), 500

@candidates_bp.route("/lettre/<candidature_id>", methods=["GET"])
def get_lettre_motivation(candidature_id):
    """Récupérer la lettre de motivation d'une candidature."""
    try:
        # Récupérer le token depuis les headers
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            logger.error("Aucun token d'authentification fourni dans les headers")
            return jsonify({"error": "Authentification requise", "code": "NO_TOKEN"}), 401

        # Nettoyer le token
        token = auth_header
        if token.startswith("Bearer "):
            token = token[7:]
            logger.info("Préfixe 'Bearer ' retiré du token")

        # Vérifier le token
        jwt_manager = get_jwt_manager()
        if not jwt_manager:
            logger.error("JWT manager non disponible")
            return jsonify({"error": "Erreur de configuration", "code": "JWT_ERROR"}), 500

        user_id = jwt_manager.verify_token(token)
        if not user_id:
            logger.error("Token invalide ou expiré")
            return jsonify({"error": "Token invalide ou expiré", "code": "INVALID_TOKEN"}), 401

        logger.info(f"User ID extrait du token: {user_id}")

        db = current_app.mongo
        # D'abord, récupérer l'utilisateur
        user = db[UTILISATEURS_COLLECTION].find_one({"_id": ObjectId(str(user_id))})
        if not user:
            logger.error(f"Utilisateur non trouvé pour l'ID: {user_id}")
            return jsonify({"error": "Utilisateur non trouvé", "code": "USER_NOT_FOUND"}), 404

        # Ensuite, chercher le recruteur correspondant
        recruteur = db[RECRUTEURS_COLLECTION].find_one({"utilisateur_id": ObjectId(str(user_id))})
        if not recruteur:
            logger.error(f"Recruteur non trouvé pour l'utilisateur: {user_id}")
            return jsonify({"error": "Recruteur non trouvé", "code": "RECRUITER_NOT_FOUND"}), 404

        # Récupérer la candidature
        try:
            candidature = db[CANDIDATURES_COLLECTION].find_one({"_id": ObjectId(candidature_id)})
        except Exception as e:
            logger.error(f"Erreur lors de la récupération de la candidature: {str(e)}")
            return jsonify({"error": "Candidature non trouvée", "code": "CANDIDATURE_NOT_FOUND"}), 404

        if not candidature:
            logger.error(f"Candidature non trouvée: {candidature_id}")
            return jsonify({"error": "Candidature non trouvée", "code": "CANDIDATURE_NOT_FOUND"}), 404

        # Vérifier que la candidature appartient à une offre du recruteur
        offre = db[OFFRES_COLLECTION].find_one({"_id": candidature["offre_id"]})
        if not offre or str(offre["recruteur_id"]) != str(recruteur["_id"]):
            logger.error(f"Accès non autorisé à la lettre de motivation: {candidature_id}")
            return jsonify({"error": "Accès non autorisé", "code": "UNAUTHORIZED"}), 403

        # Récupérer la lettre de motivation
        lettre_motivation = candidature.get("lettre_motivation")
        if not lettre_motivation:
            logger.warning(f"Lettre de motivation non trouvée pour la candidature: {candidature_id}")
            return jsonify({
                "error": "Lettre de motivation non disponible",
                "code": "LETTER_NOT_FOUND"
            }), 404

        # Retourner la lettre de motivation
        return jsonify({
            "lettre_motivation": lettre_motivation,
            "candidat": {
                "nom": candidature.get("nom", "Inconnu"),
                "prenom": candidature.get("prenom", ""),
                "email": candidature.get("email", "")
            }
        }), 200

    except Exception as e:
        logger.error(f"Erreur lors de la récupération de la lettre de motivation: {str(e)}")
        return jsonify({"error": "Erreur lors de la récupération de la lettre de motivation", "code": "SERVER_ERROR"}), 500

@candidates_bp.route("/entretiens-acceptes/<string:candidat_id>", methods=["GET"])
@require_auth("candidat")
def get_accepted_interviews(candidat_id, auth_payload):
    """Récupérer les entretiens acceptés pour un candidat."""
    try:
        db = current_app.mongo
        
        # Vérifier que le candidat existe
        candidat = db[CANDIDATS_COLLECTION].find_one({"_id": ObjectId(candidat_id)})
        if not candidat:
            return jsonify({"error": "Candidat non trouvé", "code": "CANDIDATE_NOT_FOUND"}), 404

        # Récupérer les entretiens acceptés
        entretiens = db[ENTRETIENS_COLLECTION].find({
            "candidat_id": ObjectId(candidat_id),
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

@candidates_bp.route("/interviews/<string:interview_id>/start", methods=["POST"])
@require_auth("candidat")
def start_interview(interview_id, auth_payload):
    """Démarrer un entretien."""
    try:
        db = current_app.mongo
        
        # Vérifier que l'entretien existe
        entretien = db[ENTRETIENS_COLLECTION].find_one({"_id": ObjectId(interview_id)})
        if not entretien:
            return jsonify({"error": "Entretien non trouvé", "code": "INTERVIEW_NOT_FOUND"}), 404

        # Vérifier que l'entretien appartient au candidat
        if str(entretien["candidat_id"]) != auth_payload["sub"]:
            return jsonify({"error": "Accès non autorisé", "code": "UNAUTHORIZED"}), 403

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

def extract_text_from_pdf(pdf_data):
    """Extrait le texte d'un fichier PDF."""
    try:
        if not pdf_data:
            logger.error("Aucune donnée PDF fournie")
            return ""

        # Créer un objet BytesIO pour PyPDF2
        pdf_file = io.BytesIO(pdf_data)
        
        try:
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            if not pdf_reader.pages:
                logger.error("Le PDF ne contient aucune page")
                return ""
        except Exception as e:
            logger.error(f"Erreur lors de la lecture du PDF: {str(e)}")
            return ""

        # Extraire le texte de chaque page
        text = ""
        for i, page in enumerate(pdf_reader.pages):
            try:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
                else:
                    logger.warning(f"Page {i+1} ne contient pas de texte")
            except Exception as e:
                logger.error(f"Erreur lors de l'extraction du texte de la page {i+1}: {str(e)}")

        if not text.strip():
            logger.error("Aucun texte n'a pu être extrait du PDF")
            return ""

        logger.info(f"Texte extrait avec succès du PDF ({len(text)} caractères)")
        return text

    except Exception as e:
        logger.error(f"Erreur lors de l'extraction du texte du PDF: {str(e)}")
        return ""

@candidates_bp.route("/entretiens/<string:entretien_id>", methods=["GET"])
@require_auth("candidat")
def get_interview_details(entretien_id, auth_payload):
    try:
        db = current_app.mongo
        
        # Vérifier que l'utilisateur est un candidat
        current_user_id = auth_payload.get('sub')
        user = db[UTILISATEURS_COLLECTION].find_one({"_id": ObjectId(current_user_id)})
        if not user or user.get("role") != "candidat":
            return jsonify({"error": "Accès non autorisé", "code": "UNAUTHORIZED"}), 403

        # Récupérer l'entretien
        entretien = db[ENTRETIENS_COLLECTION].find_one({"_id": ObjectId(entretien_id)})
        if not entretien:
            return jsonify({"error": "Entretien non trouvé", "code": "INTERVIEW_NOT_FOUND"}), 404

        # Vérifier que l'entretien appartient au candidat
        if str(entretien.get("candidat_id")) != current_user_id:
            return jsonify({"error": "Accès non autorisé", "code": "UNAUTHORIZED"}), 403

        # Récupérer les questions associées
        questions = db["questions"].find_one({"_id": ObjectId(entretien.get("questions_id"))})
        if not questions:
            # Si les questions ne sont pas trouvées, essayer de les générer à nouveau
            candidature = db[CANDIDATURES_COLLECTION].find_one({"_id": ObjectId(entretien.get("candidature_id"))})
            if not candidature:
                return jsonify({"error": "Candidature non trouvée", "code": "APPLICATION_NOT_FOUND"}), 404

            offre = db[OFFRES_COLLECTION].find_one({"_id": ObjectId(entretien.get("offre_id"))})
            if not offre:
                return jsonify({"error": "Offre non trouvée", "code": "OFFER_NOT_FOUND"}), 404

            # Générer les questions
            questions = generate_interview_questions(
                candidature.get("cv_text", ""),
                offre,
                str(candidature["_id"]),
                str(offre["_id"])
            )

            if questions == ['error']:
                return jsonify({"error": "Erreur lors de la génération des questions", "code": "QUESTIONS_GENERATION_ERROR"}), 500

            # Stocker les questions dans la base de données
            questions_doc = {
                "candidature_id": ObjectId(candidature["_id"]),
                "offre_id": ObjectId(offre["_id"]),
                "questions": questions,
                "date_creation": datetime.now(timezone.utc)
            }
            
            result = db["questions"].insert_one(questions_doc)
            questions = {"_id": result.inserted_id, "questions": questions}

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

@candidates_bp.route("/entretiens/<string:entretien_id>/recordings", methods=["GET"])
@require_auth("candidat")
def get_interview_recordings(entretien_id, auth_payload):
    try:
        db = current_app.mongo
        
        # Vérifier que l'utilisateur est un candidat
        current_user_id = auth_payload.get('sub')
        user = db[UTILISATEURS_COLLECTION].find_one({"_id": ObjectId(current_user_id)})
        if not user or user.get("role") != "candidat":
            return jsonify({"error": "Accès non autorisé", "code": "UNAUTHORIZED"}), 403

        # Récupérer l'entretien
        entretien = db[ENTRETIENS_COLLECTION].find_one({"_id": ObjectId(entretien_id)})
        if not entretien:
            return jsonify({"error": "Entretien non trouvé", "code": "INTERVIEW_NOT_FOUND"}), 404

        # Vérifier que l'entretien appartient au candidat
        if str(entretien.get("candidat_id")) != current_user_id:
            return jsonify({"error": "Accès non autorisé", "code": "UNAUTHORIZED"}), 403

        # Récupérer les enregistrements
        recordings = list(db["recordings"].find({
            "entretien_id": ObjectId(entretien_id)
        }).sort("timestamp", 1))

        # Formater les enregistrements
        formatted_recordings = []
        for recording in recordings:
            formatted_recordings.append({
                "id": str(recording["_id"]),
                "question_index": recording.get("question_index"),
                "transcript": recording.get("transcript"),
                "video_url": recording.get("video_path"),
                "timestamp": recording.get("timestamp"),
                "question": recording.get("question")
            })

        return jsonify({
            "success": True,
            "data": formatted_recordings
        }), 200

    except Exception as e:
        logger.error(f"Erreur lors de la récupération des enregistrements: {str(e)}")
        return jsonify({
            "error": "Erreur lors de la récupération des enregistrements",
            "code": "RECORDINGS_ERROR"
        }), 500

@candidates_bp.route("/entretiens", methods=["POST"])
@require_auth("candidat")
def create_interview(auth_payload):
    """Créer un nouvel entretien."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Données manquantes"}), 400

        candidature_id = data.get("candidature_id")
        offre_id = data.get("offre_id")
        questions_id = data.get("questions_id")
        statut = data.get("statut", "planifie")

        if not all([candidature_id, offre_id, questions_id]):
            return jsonify({"error": "Tous les champs sont requis"}), 400

        db = current_app.mongo

        # Vérifier que la candidature existe et appartient au candidat
        candidature = db[CANDIDATURES_COLLECTION].find_one({
            "_id": ObjectId(candidature_id),
            "candidat_id": ObjectId(auth_payload["sub"])
        })
        if not candidature:
            return jsonify({"error": "Candidature non trouvée ou non autorisée"}), 404

        # Vérifier que l'offre existe
        offre = db[OFFRES_COLLECTION].find_one({"_id": ObjectId(offre_id)})
        if not offre:
            return jsonify({"error": "Offre non trouvée"}), 404

        # Vérifier que les questions existent
        questions = db["questions"].find_one({"_id": ObjectId(questions_id)})
        if not questions:
            return jsonify({"error": "Questions non trouvées"}), 404

        # Créer l'entretien
        entretien = {
            "candidature_id": ObjectId(candidature_id),
            "offre_id": ObjectId(offre_id),
            "candidat_id": ObjectId(auth_payload["sub"]),
            "recruteur_id": ObjectId(offre["recruteur_id"]),
            "questions_id": ObjectId(questions_id),
            "statut": statut,
            "date_creation": datetime.now(timezone.utc),
            "date_maj": datetime.now(timezone.utc)
        }

        result = db[ENTRETIENS_COLLECTION].insert_one(entretien)

        # Mettre à jour la candidature avec l'ID de l'entretien
        db[CANDIDATURES_COLLECTION].update_one(
            {"_id": ObjectId(candidature_id)},
            {"$set": {"entretien_id": result.inserted_id}}
        )

        return jsonify({
            "success": True,
            "entretien_id": str(result.inserted_id),
            "message": "Entretien créé avec succès"
        }), 201

    except Exception as e:
        logger.error(f"Erreur lors de la création de l'entretien: {str(e)}")
        return jsonify({"error": str(e)}), 500

def store_video_and_transcribe(video_base64, entretien_id):
    try:
        # Vérifier la taille de la vidéo (max 100MB)
        video_size = len(base64.b64decode(video_base64.split(',')[1]))
        if video_size > 100 * 1024 * 1024:  # 100MB en bytes
            raise ValueError("La taille de la vidéo dépasse la limite de 100MB")

        # Créer un dossier temporaire pour les fichiers
        temp_dir = tempfile.mkdtemp()
        try:
            # Décoder la vidéo base64
            video_data = base64.b64decode(video_base64.split(',')[1])
            video_path = os.path.join(temp_dir, 'interview.webm')
            
            # Sauvegarder la vidéo temporairement
            with open(video_path, 'wb') as f:
                f.write(video_data)
            
            # Extraire l'audio
            audio_path = os.path.join(temp_dir, 'audio.wav')
            video = VideoFileClip(video_path)
            video.audio.write_audiofile(audio_path)
            
            # Transcrire avec Whisper
            model = whisper.load_model("base")
            result = model.transcribe(audio_path)
            transcription = result["text"]
            
            # Générer une URL unique pour la vidéo
            video_url = f"/api/videos/{entretien_id}"
            
            # Stocker la vidéo dans MongoDB
            video_doc = {
                "entretien_id": ObjectId(entretien_id),
                "video_data": video_base64,
                "video_url": video_url,
                "transcription": transcription,
                "created_at": datetime.now(timezone.utc)
            }
            video_id = current_app.mongo.db.videos.insert_one(video_doc).inserted_id
            
            # Mettre à jour l'entretien
            current_app.mongo.db.entretiens.update_one(
                {"_id": ObjectId(entretien_id)},
                {
                    "$set": {
                        "video_id": video_id,
                        "video_url": video_url,
                        "transcription": transcription,
                        "status": "termine",
                        "date_fin": datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )
            
            return video_id, transcription, video_url
            
        finally:
            # Nettoyage des fichiers temporaires
            try:
                shutil.rmtree(temp_dir)
            except Exception as e:
                logger.error(f"Erreur lors du nettoyage des fichiers temporaires: {str(e)}")
            
    except ValueError as ve:
        logger.error(f"Erreur de validation: {str(ve)}")
        raise
    except Exception as e:
        logger.error(f"Erreur lors du traitement de la vidéo: {str(e)}")
        raise

@candidates_bp.route('/entretiens/<entretien_id>/recordings', methods=['POST'])
@require_auth("candidat")
def save_interview_recordings(entretien_id, auth_payload):
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Données manquantes"}), 400

        # Vérifier que l'entretien existe et appartient au candidat
        entretien = current_app.mongo.db.entretiens.find_one({
            "_id": ObjectId(entretien_id),
            "candidat_id": ObjectId(auth_payload["sub"])
        })
        
        if not entretien:
            return jsonify({"success": False, "error": "Entretien non trouvé"}), 404

        # Vérifier que la vidéo est présente
        if not data.get('video'):
            return jsonify({"success": False, "error": "Vidéo manquante"}), 400

        # Traiter la vidéo et obtenir la transcription
        try:
            video_id, transcription, video_url = store_video_and_transcribe(data.get('video'), entretien_id)
        except ValueError as ve:
            return jsonify({"success": False, "error": str(ve)}), 400
        except Exception as e:
            return jsonify({"success": False, "error": "Erreur lors du traitement de la vidéo"}), 500

        # Sauvegarder les enregistrements
        recordings = data.get('recordings', [])
        for recording in recordings:
            recording_doc = {
                "entretien_id": ObjectId(entretien_id),
                "question_index": recording.get('questionIndex'),
                "question": recording.get('question'),
                "transcript": recording.get('transcript'),
                "timestamp": recording.get('timestamp'),
                "created_at": datetime.now(timezone.utc)
            }
            current_app.mongo.db.recordings.insert_one(recording_doc)

        return jsonify({
            "success": True,
            "message": "Enregistrements sauvegardés avec succès",
            "video_id": str(video_id),
            "video_url": video_url,
            "transcription": transcription
        })

    except Exception as e:
        logger.error(f"Erreur lors de la sauvegarde des enregistrements: {str(e)}")
        return jsonify({"success": False, "error": "Erreur lors de la sauvegarde des enregistrements"}), 500

@candidates_bp.route('/videos/<entretien_id>', methods=['GET'])
@require_auth(["candidat", "recruteur"])
def get_interview_video(entretien_id, auth_payload):
    try:
        # Vérifier que l'entretien existe
        entretien = current_app.mongo.db.entretiens.find_one({
            "_id": ObjectId(entretien_id)
        })
        
        if not entretien:
            return jsonify({"error": "Entretien non trouvé"}), 404

        # Vérifier les permissions
        user_id = ObjectId(auth_payload["sub"])
        user_role = auth_payload.get("role")
        
        if user_role == "candidat" and str(entretien.get("candidat_id")) != str(user_id):
            return jsonify({"error": "Accès non autorisé"}), 403
        elif user_role == "recruteur" and str(entretien.get("recruteur_id")) != str(user_id):
            return jsonify({"error": "Accès non autorisé"}), 403

        # Récupérer la vidéo
        video = current_app.mongo.db.videos.find_one({
            "entretien_id": ObjectId(entretien_id)
        })
        
        if not video:
            return jsonify({"error": "Vidéo non trouvée"}), 404

        # Retourner la vidéo en base64
        return jsonify({
            "success": True,
            "video_data": video.get("video_data"),
            "transcription": video.get("transcription")
        })

    except Exception as e:
        logger.error(f"Erreur lors de la récupération de la vidéo: {str(e)}")
        return jsonify({"error": "Erreur lors de la récupération de la vidéo"}), 500