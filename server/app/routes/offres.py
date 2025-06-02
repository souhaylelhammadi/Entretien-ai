from flask import Blueprint, request, jsonify, current_app, send_file
from bson import ObjectId
from pymongo.errors import PyMongoError
import datetime
from utils import verify_token
import os
import logging
from jwt_manager import jwt_manager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

offres_emploi_bp = Blueprint('offres_emploi', __name__)

# Standardized collection names
OFFRES_COLLECTION = 'offres'
CANDIDATURES_COLLECTION = 'candidatures'
USERS_COLLECTION = 'utilisateurs'

def format_offre(offre):
    """Format a single job offer for JSON response."""
    return {
                'id': str(offre['_id']),
                'titre': str(offre.get('titre', 'Titre non spécifié')),
                'description': str(offre.get('description', 'Description non disponible')),
                'localisation': str(offre.get('localisation', 'Localisation non spécifiée')),
                'departement': str(offre.get('departement', 'Département non spécifié')),
                'entreprise': str(offre.get('entreprise', '')),
                'recruteur_id': str(offre.get('recruteur_id', '')),
                'date_creation': offre.get('date_creation', datetime.datetime.utcnow()).isoformat(),
                'date_maj': offre.get('date_maj', datetime.datetime.utcnow()).isoformat(),

                'questions_ids': offre.get('competences_requises', []),
                'candidature_ids': [str(cid) for cid in offre.get('candidature_ids', [])],
    }

# Route to fetch all job offers
@offres_emploi_bp.route('/offres-emploi', methods=['GET'])
def get_offres_emploi():
    try:
        db = current_app.mongo
        offres_collection = db[OFFRES_COLLECTION]
        
        # Get query parameters
        recruteur_id = request.args.get('recruteur_id')
       
        
        # Build query
        query = {}
        if recruteur_id and ObjectId.is_valid(recruteur_id):
            query['recruteur_id'] = ObjectId(recruteur_id)
        
        
        # Fetch job offers
        offres = list(offres_collection.find(query))
        
        # Format the response
        formatted_offres = [format_offre(offre) for offre in offres]
        
        logger.info(f"Retour de {len(formatted_offres)} offres d'emploi")
        return jsonify({'offres': formatted_offres}), 200

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans /offres-emploi: {str(e)}")
        return jsonify({'error': 'Erreur de base de données'}), 500
    except Exception as e:
        logger.error(f"Erreur dans /offres-emploi: {str(e)}")
        return jsonify({'error': f'Erreur serveur: {str(e)}'}), 500

# Route to fetch a single job offer by ID
@offres_emploi_bp.route('/offres-emploi/<id>', methods=['GET'])
def get_offre_by_id(id):
    try:
        if not ObjectId.is_valid(id):
            logger.warning(f"ID invalide fourni: {id}")
            return jsonify({'error': 'ID de l\'offre invalide'}), 400

        db = current_app.mongo
        offres_collection = db[OFFRES_COLLECTION]
        
        # Fetch the job offer
        offre = offres_collection.find_one({'_id': ObjectId(id)})
        if not offre:
            logger.info(f"Offre non trouvée pour ID: {id}")
            return jsonify({'error': 'Offre non trouvée'}), 404
        
        # Format the response
        formatted_offre = format_offre(offre)
        
        logger.info(f"Offre trouvée pour ID: {id}")
        return jsonify(formatted_offre), 200

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans /offres-emploi/{id}: {str(e)}")
        return jsonify({'error': 'Erreur de base de données'}), 500
    except Exception as e:
        logger.error(f"Erreur dans /offres-emploi/{id}: {str(e)}")
        return jsonify({'error': f'Erreur serveur: {str(e)}'}), 500

# Route to fetch job offers by recruteur
@offres_emploi_bp.route('/offres-emploi/recruteur/<recruteur_id>', methods=['GET'])
def get_offres_by_recruteur(recruteur_id):
    try:
        if not ObjectId.is_valid(recruteur_id):
            logger.warning(f"ID recruteur invalide fourni: {recruteur_id}")
            return jsonify({'error': 'ID du recruteur invalide'}), 400

        db = current_app.mongo
        
        # Vérifier si le recruteur existe
        recruteur = db[USERS_COLLECTION].find_one({'_id': ObjectId(recruteur_id), 'role': 'recruteur'})
        if not recruteur:
            logger.warning(f"Recruteur non trouvé pour ID: {recruteur_id}")
            return jsonify({'error': 'Recruteur non trouvé'}), 404

        # Récupérer les offres du recruteur
        offres = list(db[OFFRES_COLLECTION].find({'recruteur_id': ObjectId(recruteur_id)}))
        
        # Formater la réponse
        formatted_offres = [format_offre(offre) for offre in offres]
        
        logger.info(f"Retour de {len(formatted_offres)} offres pour le recruteur {recruteur_id}")
        return jsonify({'offres': formatted_offres}), 200

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans /offres-emploi/recruteur/{recruteur_id}: {str(e)}")
        return jsonify({'error': 'Erreur de base de données'}), 500
    except Exception as e:
        logger.error(f"Erreur dans /offres-emploi/recruteur/{recruteur_id}: {str(e)}")
        return jsonify({'error': f'Erreur serveur: {str(e)}'}), 500

def auth_required(f):
    """Decorator to ensure user is authenticated"""
    def wrapper(*args, **kwargs):
        # Vérifier le token dans l'en-tête ou dans l'URL
        token = request.headers.get("Authorization")
        if not token:
            # Essayer de récupérer le token depuis l'URL
            token = request.args.get('token')
            if not token:
                return jsonify({"error": "Authentification requise"}), 401
        
        try:
            # Nettoyer le token s'il contient le préfixe "Bearer "
            if token.startswith('Bearer '):
                token = token[7:]
            
            # Vérifier le token avec jwt_manager
            user_id = jwt_manager.verify_token(token)
            if not user_id:
                return jsonify({"error": "Token invalide ou expiré"}), 401
            
            # Récupérer l'utilisateur depuis la base de données
            db = current_app.mongo
            user = db.utilisateurs.find_one({"_id": ObjectId(user_id)})
            if not user:
                return jsonify({"error": "Utilisateur non trouvé"}), 404
            
            request.user = {
                "id": str(user["_id"]),
                "email": user["email"],
                "role": user["role"]
            }
            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"Erreur d'authentification: {str(e)}")
            return jsonify({"error": "Erreur d'authentification"}), 401
            
    wrapper.__name__ = f.__name__
    return wrapper

@offres_emploi_bp.route('/candidatures', methods=['POST'])
@auth_required
def submit_candidature():
    try:
        # Log des données reçues
        logger.info(f"Données reçues - form: {request.form}")
        logger.info(f"Données reçues - files: {request.files}")
        logger.info(f"Données reçues - headers: {request.headers}")
        logger.info(f"Données reçues - json: {request.get_json(silent=True)}")
        
        # Récupérer les données de la requête
        data = request.get_json(silent=True) or request.form
        cv_file = request.files.get('cv')

        # Vérifier les données requises
        if not data:
            logger.error("Aucune donnée fournie")
            return jsonify({"error": "Données manquantes", "code": "MISSING_DATA"}), 400

        # Log des valeurs spécifiques
        offre_id = data.get('offreId') or data.get('offre_id')
        lettre_motivation = data.get('lettreMotivation') or data.get('lettre_motivation')
        user_email = request.user["email"]  # Récupérer l'email depuis le token
        user_id = request.user["id"]  # Récupérer l'ID depuis le token
        logger.info(f"offreId reçu: {offre_id}")
        logger.info(f"lettreMotivation reçue: {lettre_motivation}")
        logger.info(f"user_email reçu: {user_email}")
        logger.info(f"user_id reçu: {user_id}")
        logger.info(f"cv_file reçu: {cv_file}")

        if not offre_id:
            logger.error("ID de l'offre manquant")
            return jsonify({"error": "ID de l'offre requis", "code": "MISSING_OFFRE_ID"}), 400

        if not lettre_motivation:
            logger.error("Lettre de motivation manquante")
            return jsonify({"error": "Lettre de motivation requise", "code": "MISSING_MOTIVATION"}), 400

        if not cv_file:
            logger.error("CV manquant")
            return jsonify({"error": "CV requis", "code": "MISSING_CV"}), 400

        db = current_app.mongo

        # Récupérer l'ID du candidat
        candidat = db.candidats.find_one({"utilisateur_id": ObjectId(user_id)})
        if not candidat:
            logger.error(f"Candidat non trouvé pour l'utilisateur: {user_id}")
            return jsonify({"error": "Candidat non trouvé", "code": "CANDIDATE_NOT_FOUND"}), 404
            
        candidat_id = candidat["_id"]
        logger.info(f"ID du candidat trouvé: {candidat_id}")

        # Vérifier si l'offre existe
        try:
            offre = db[OFFRES_COLLECTION].find_one({"_id": ObjectId(offre_id)})
            if not offre:
                logger.error(f"Offre non trouvée: {offre_id}")
                return jsonify({"error": "Offre non trouvée", "code": "OFFRE_NOT_FOUND"}), 404
        except Exception as e:
            logger.error(f"Erreur lors de la recherche de l'offre: {str(e)}")
            return jsonify({"error": "Format d'ID offre invalide", "code": "INVALID_OFFER_ID"}), 400

     

        # Vérifier si le candidat a déjà postulé
        existing_candidature = db[CANDIDATURES_COLLECTION].find_one({
            "offre_id": ObjectId(offre_id),
            "candidats_id": candidat_id
        })
        if existing_candidature:
            logger.warning(f"Candidat déjà postulé: {user_email}")
            return jsonify({
                "error": "Vous avez déjà postulé à cette offre",
                "code": "ALREADY_APPLIED",
                "candidature_id": str(existing_candidature["_id"])
            }), 400

        # Sauvegarder le CV
        upload_folder = current_app.config.get('UPLOAD_FOLDER', 'Uploads')
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder)
        
        filename = f"{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}_{cv_file.filename}"
        cv_path = os.path.join(upload_folder, filename)
        cv_file.save(cv_path)

        # Créer la candidature
        candidature = {
            "offre_id": ObjectId(offre_id),
            "user_id": ObjectId(user_id),
            "user_email": user_email,
            "candidats_id": candidat_id,  # Utiliser l'ID du candidat
            "cv_path": cv_path,
            "lettre_motivation": lettre_motivation,
            "statut": "En attente",
            "date_postulation": datetime.datetime.utcnow(),
            "created_at": datetime.datetime.utcnow(),
            "updated_at": datetime.datetime.utcnow()
        }

        # Insérer la candidature dans la base de données
        result = db[CANDIDATURES_COLLECTION].insert_one(candidature)
        
        # Mettre à jour l'offre avec l'ID de la candidature
        db[OFFRES_COLLECTION].update_one(
            {"_id": ObjectId(offre_id)},
            {"$push": {"candidature_ids": result.inserted_id}}
        )

        logger.info(f"Nouvelle candidature créée pour l'offre {offre_id} par le candidat {candidat_id}")
        return jsonify({
            "message": "Candidature enregistrée avec succès",
            "candidature_id": str(result.inserted_id)
        }), 201

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB lors de la création de la candidature: {str(e)}")
        return jsonify({"error": "Erreur de base de données", "code": "DB_ERROR"}), 500
    except Exception as e:
        logger.error(f"Erreur lors de la création de la candidature: {str(e)}")
        return jsonify({"error": f"Erreur serveur: {str(e)}", "code": "SERVER_ERROR"}), 500

@offres_emploi_bp.route('/candidates/cv/<candidature_id>', methods=['GET'])
@auth_required
def get_cv(candidature_id):
    """Récupérer le CV d'une candidature"""
    try:
        if not ObjectId.is_valid(candidature_id):
            return jsonify({"error": "ID de candidature invalide"}), 400

        db = current_app.mongo
        
        # Récupérer la candidature
        candidature = db[CANDIDATURES_COLLECTION].find_one({"_id": ObjectId(candidature_id)})
        if not candidature:
            return jsonify({"error": "Candidature non trouvée"}), 404

        # Log des informations pour le débogage
        logger.info(f"User role: {request.user['role']}")
        logger.info(f"User ID: {request.user['id']}")
        logger.info(f"Candidature user_id: {candidature.get('user_id')}")
        logger.info(f"Candidature offre_id: {candidature.get('offre_id')}")

        # Vérifier les permissions
        user_role = request.user["role"]
        if user_role == "candidat":
            # Un candidat ne peut voir que ses propres CV
            if str(candidature.get("user_id")) != request.user["id"]:
                logger.warning(f"Accès refusé - Candidat {request.user['id']} tente d'accéder au CV de {candidature.get('user_id')}")
                return jsonify({"error": "Accès non autorisé"}), 403
        elif user_role == "recruteur":
            # Un recruteur peut voir tous les CV des candidatures
            logger.info("Accès accordé - Utilisateur est un recruteur")
        else:
            logger.warning(f"Accès refusé - Rôle non autorisé: {user_role}")
            return jsonify({"error": "Rôle non autorisé"}), 403

        # Vérifier si le fichier existe
        cv_path = candidature.get("cv_path")
        if not cv_path:
            logger.error(f"CV path manquant pour la candidature {candidature_id}")
            return jsonify({"error": "CV non trouvé"}), 404
            
        if not os.path.exists(cv_path):
            logger.error(f"Fichier CV non trouvé à l'emplacement: {cv_path}")
            return jsonify({"error": "CV non trouvé"}), 404

        logger.info(f"Envoi du fichier CV: {cv_path}")
        
        # Lire le contenu du fichier
        with open(cv_path, 'rb') as f:
            pdf_content = f.read()
        
        # Créer la réponse avec les en-têtes appropriés
        response = current_app.make_response(pdf_content)
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = 'inline; filename=' + os.path.basename(cv_path)
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET'
        response.headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'
        
        return response

    except Exception as e:
        logger.error(f"Erreur lors de la récupération du CV: {str(e)}")
        return jsonify({"error": "Erreur serveur"}), 500
    