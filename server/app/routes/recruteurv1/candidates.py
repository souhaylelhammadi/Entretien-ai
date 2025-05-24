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