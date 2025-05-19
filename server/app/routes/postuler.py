from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from datetime import datetime, timezone
import os
import logging
from werkzeug.utils import secure_filename
from pymongo.errors import PyMongoError
from flask_cors import CORS
from utils import verify_token

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Blueprint avec préfixe
offres_bp = Blueprint('offres', __name__, url_prefix='/api/offres')
candidatures_bp = Blueprint('candidatures', __name__, url_prefix='/api/candidatures')

# Configure CORS
CORS(offres_bp, resources={r"/*": {"origins": "http://localhost:3000"}}, supports_credentials=True)
CORS(candidatures_bp, resources={r"/*": {"origins": "http://localhost:3000"}}, supports_credentials=True)

# Noms des collections
OFFRES_COLLECTION = 'offres'
CANDIDATURES_COLLECTION = 'candidatures'
CANDIDATS_COLLECTION = 'candidats'
UTILISATEURS_COLLECTION = 'utilisateurs'

# Configuration pour le stockage des CV
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'uploads', 'cv')
ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx'}

# S'assurer que le dossier d'upload existe
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@candidatures_bp.route("", methods=["POST"])
def create_candidature():
    """Crée une nouvelle candidature."""
    try:
        # Récupérer les données de la requête
        data = request.form
        cv_file = request.files.get('cv')
        offre_id = data.get('offre_id')
        lettre_motivation = data.get('lettre_motivation')

        # Vérifier les données requises
        if not all([offre_id, data.get('email'), data.get('nom'), data.get('prenom')]):
            logger.error("Données manquantes dans la requête")
            return jsonify({"error": "Données manquantes", "code": "MISSING_DATA"}), 400

        db = current_app.mongo

        # Vérifier si l'offre existe
        try:
            offre = db[OFFRES_COLLECTION].find_one({"_id": ObjectId(offre_id)})
            if not offre:
                logger.error(f"Offre non trouvée: {offre_id}")
                return jsonify({"error": "Offre non trouvée", "code": "OFFRE_NOT_FOUND"}), 404
        except Exception as e:
            logger.error(f"Erreur lors de la recherche de l'offre: {str(e)}")
            return jsonify({"error": "Format d'ID offre invalide", "code": "INVALID_OFFER_ID"}), 400

        # Vérifier si l'offre est toujours ouverte
        if offre.get("statut") != "ouverte":
            logger.warning(f"Tentative de postulation à une offre fermée: {offre_id}")
            return jsonify({"error": "Cette offre n'est plus disponible", "code": "OFFRE_CLOSED"}), 400

        # Vérifier le CV
        if not cv_file:
            logger.error("Aucun CV fourni")
            return jsonify({"error": "CV requis", "code": "CV_REQUIRED"}), 400

        if not allowed_file(cv_file.filename):
            logger.error(f"Format de fichier non autorisé: {cv_file.filename}")
            return jsonify({"error": "Format de fichier non autorisé", "code": "INVALID_FILE_TYPE"}), 400

        # Vérifier si l'utilisateur existe déjà
        user = db[UTILISATEURS_COLLECTION].find_one({"email": data['email']})
        if not user:
            logger.error(f"Utilisateur non trouvé pour l'email: {data['email']}")
            return jsonify({"error": "Utilisateur non trouvé", "code": "USER_NOT_FOUND"}), 404

        # Vérifier si le candidat existe
        candidat = db[CANDIDATS_COLLECTION].find_one({"utilisateur_id": user["_id"]})
        if not candidat:
            logger.error(f"Candidat non trouvé pour l'utilisateur: {data['email']}")
            return jsonify({"error": "Candidat non trouvé", "code": "CANDIDATE_NOT_FOUND"}), 404

        # Vérifier si le candidat a déjà postulé
        existing_candidature = db[CANDIDATURES_COLLECTION].find_one({
            "offre_id": ObjectId(offre_id),
            "user_email": data['email']
        })
        if existing_candidature:
            logger.warning(f"Candidat déjà postulé: {data['email']}")
            return jsonify({"error": "Vous avez déjà postulé à cette offre", "code": "ALREADY_APPLIED"}), 400

        # Sauvegarder le CV
        filename = secure_filename(f"{data['email']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{cv_file.filename}")
        cv_path = os.path.join(UPLOAD_FOLDER, filename)
        cv_file.save(cv_path)

        # Créer la candidature
        candidature = {
            "offre_id": ObjectId(offre_id),
            "user_id": user["_id"],
            "user_email": data['email'],
            "nom": data['nom'],
            "prenom": data['prenom'],
            "cv_path": cv_path,
            "lettre_motivation": lettre_motivation,
            "statut": "En attente",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }

        # Insérer la candidature dans la base de données
        result = db[CANDIDATURES_COLLECTION].insert_one(candidature)
        
        # Mettre à jour l'offre avec l'ID de la candidature
        db[OFFRES_COLLECTION].update_one(
            {"_id": ObjectId(offre_id)},
            {"$push": {"candidature_ids": result.inserted_id}}
        )

        logger.info(f"Nouvelle candidature créée pour l'offre {offre_id} par {data['email']}")
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

# Garder la route existante pour la postulation via l'offre
@offres_bp.route("/<string:offre_id>/postuler", methods=["POST"])
def postuler(offre_id):
    """Permet à un candidat de postuler à une offre d'emploi."""
    try:
        # Vérifier si l'offre existe
        db = current_app.mongo
        offre = db[OFFRES_COLLECTION].find_one({"_id": ObjectId(offre_id)})
        if not offre:
            logger.error(f"Offre non trouvée: {offre_id}")
            return jsonify({"error": "Offre non trouvée", "code": "OFFRE_NOT_FOUND"}), 404

        # Vérifier si l'offre est toujours ouverte
        if offre.get("statut") != "ouverte":
            logger.warning(f"Tentative de postulation à une offre fermée: {offre_id}")
            return jsonify({"error": "Cette offre n'est plus disponible", "code": "OFFRE_CLOSED"}), 400

        # Récupérer les données de la requête
        data = request.form
        cv_file = request.files.get('cv')
        lettre_motivation = data.get('lettre_motivation')

        # Vérifier les données requises
        if not all([data.get('email'), data.get('nom'), data.get('prenom')]):
            logger.error("Données manquantes dans la requête")
            return jsonify({"error": "Données manquantes", "code": "MISSING_DATA"}), 400

        # Vérifier le CV
        if not cv_file:
            logger.error("Aucun CV fourni")
            return jsonify({"error": "CV requis", "code": "CV_REQUIRED"}), 400

        if not allowed_file(cv_file.filename):
            logger.error(f"Format de fichier non autorisé: {cv_file.filename}")
            return jsonify({"error": "Format de fichier non autorisé", "code": "INVALID_FILE_TYPE"}), 400

        # Vérifier si l'utilisateur existe déjà
        user = db[UTILISATEURS_COLLECTION].find_one({"email": data['email']})
        if not user:
            logger.error(f"Utilisateur non trouvé pour l'email: {data['email']}")
            return jsonify({"error": "Utilisateur non trouvé", "code": "USER_NOT_FOUND"}), 404

        # Vérifier le rôle de l'utilisateur
        if user.get("role") != "candidat":
            logger.warning(f"Tentative de postulation par un non-candidat: {data['email']}")
            return jsonify({"error": "Seuls les étudiants peuvent postuler", "code": "UNAUTHORIZED_ROLE"}), 403

        # Vérifier si le candidat existe
        candidat = db[CANDIDATS_COLLECTION].find_one({"utilisateur_id": user["_id"]})
        if not candidat:
            logger.error(f"Candidat non trouvé pour l'utilisateur: {data['email']}")
            return jsonify({"error": "Candidat non trouvé", "code": "CANDIDATE_NOT_FOUND"}), 404

        # Vérifier si le candidat a déjà postulé
        existing_candidature = db[CANDIDATURES_COLLECTION].find_one({
            "offre_id": ObjectId(offre_id),
            "user_email": data['email']
        })
        if existing_candidature:
            logger.warning(f"Candidat déjà postulé: {data['email']}")
            return jsonify({"error": "Vous avez déjà postulé à cette offre", "code": "ALREADY_APPLIED"}), 400

        # Sauvegarder le CV
        filename = secure_filename(f"{data['email']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{cv_file.filename}")
        cv_path = os.path.join(UPLOAD_FOLDER, filename)
        cv_file.save(cv_path)

        # Créer la candidature
        candidature = {
            "offre_id": ObjectId(offre_id),
            "user_email": data['email'],
            "nom": data['nom'],
            "prenom": data['prenom'],
            "cv_path": cv_path,
            "lettre_motivation": lettre_motivation,
            "statut": "En attente",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }

        # Insérer la candidature dans la base de données
        result = db[CANDIDATURES_COLLECTION].insert_one(candidature)
        
        # Mettre à jour l'offre avec l'ID de la candidature
        db[OFFRES_COLLECTION].update_one(
            {"_id": ObjectId(offre_id)},
            {"$push": {"candidature_ids": result.inserted_id}}
        )

        logger.info(f"Nouvelle candidature créée pour l'offre {offre_id} par {data['email']}")
        return jsonify({
            "message": "Candidature enregistrée avec succès",
            "candidature_id": str(result.inserted_id)
        }), 201

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB lors de la postulation: {str(e)}")
        return jsonify({"error": "Erreur de base de données", "code": "DB_ERROR"}), 500
    except Exception as e:
        logger.error(f"Erreur lors de la postulation: {str(e)}")
        return jsonify({"error": f"Erreur serveur: {str(e)}", "code": "SERVER_ERROR"}), 500

# Route to fetch all job offers
@offres_bp.route('/offres-emploi', methods=['GET'])
def get_offres_emploi():
    try:
        db = current_app.mongo
        offres_collection = db[OFFRES_COLLECTION]
        
        # Fetch all job offers
        offres = list(offres_collection.find())
        
        # Convert ObjectId to string and ensure consistent response format
        formatted_offres = []
        for offre in offres:
            formatted_offres.append({
                'id': str(offre['_id']),
                'titre': str(offre.get('titre', 'Titre non spécifié')),
                'description': str(offre.get('description', 'Description non disponible')),
                'localisation': str(offre.get('localisation', 'Localisation non spécifiée')),
                'departement': str(offre.get('departement', 'Département non spécifié')),
                'entreprise': str(offre.get('entreprise', '')),
                'recruteur_id': str(offre.get('recruteur_id', '')),
                'date_creation': offre.get('date_creation', datetime.datetime.utcnow()).isoformat(),
                'date_maj': offre.get('date_maj', datetime.datetime.utcnow()).isoformat(),
                'statut': str(offre.get('statut', 'ouverte')),
                'competences_requises': offre.get('competences_requises', []),
                'candidature_ids': [str(cid) for cid in offre.get('candidature_ids', [])],
                'valide': offre.get('statut', 'ouverte') == 'ouverte'
            })
        
        logger.info(f"Retour de {len(formatted_offres)} offres d'emploi")
        return jsonify({'offres': formatted_offres}), 200

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans /offres-emploi: {str(e)}")
        return jsonify({'error': 'Erreur de base de données'}), 500
    except Exception as e:
        logger.error(f"Erreur dans /offres-emploi: {str(e)}")
        return jsonify({'error': f'Erreur serveur: {str(e)}'}), 500

# Route to fetch a single job offer by ID
@offres_bp.route('/offres-emploi/<id>', methods=['GET'])
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
        formatted_offre = {
            'id': str(offre['_id']),
            'titre': str(offre.get('titre', 'Titre non spécifié')),
            'description': str(offre.get('description', 'Description non disponible')),
            'localisation': str(offre.get('localisation', 'Localisation non spécifiée')),
            'departement': str(offre.get('departement', 'Département non spécifié')),
            'entreprise': str(offre.get('entreprise', '')) if offre.get('entreprise') else '',
            'recruteur_id': str(offre.get('recruteur_id', '')) if offre.get('recruteur_id') else '',
            'date_creation': offre.get('date_creation', datetime.datetime.utcnow()).isoformat(),
            'date_maj': offre.get('date_maj', datetime.datetime.utcnow()).isoformat(),
            'statut': str(offre.get('statut', 'ouverte')),
            'questions_ids': [str(qid) for qid in offre.get('questions_ids', [])],
            'candidature_ids': [str(cid) for cid in offre.get('candidature_ids', [])],
            'valide': offre.get('statut', 'ouverte') == 'ouverte'
        }
        
        logger.info(f"Offre trouvée pour ID: {id}")
        return jsonify(formatted_offre), 200

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans /offres-emploi/{id}: {str(e)}")
        return jsonify({'error': 'Erreur de base de données'}), 500
    except Exception as e:
        logger.error(f"Erreur dans /offres-emploi/{id}: {str(e)}")
        return jsonify({'error': f'Erreur serveur: {str(e)}'}), 500

# Route to submit a job application (ancienne route conservée)
@offres_bp.route('/candidatures', methods=['POST'])
def submit_candidature():
    try:
        token = request.headers.get('Authorization')
        if not token:
            logger.warning("Jeton manquant dans la requête /candidatures")
            return jsonify({'error': 'Jeton manquant'}), 401

        # Convert token to string if necessary
        if isinstance(token, bytes):
            token = token.decode('utf-8')

        # Verify token
        user_email = verify_token(token)
        if not user_email:
            logger.warning("Jeton invalide dans la requête /candidatures")
            return jsonify({'error': 'Jeton invalide'}), 401

        # Check if user exists
        db = current_app.mongo
        users_collection = db[UTILISATEURS_COLLECTION]
        user = users_collection.find_one({'email': user_email})
        if not user:
            logger.warning(f"Utilisateur non trouvé pour email: {user_email}")
            return jsonify({'error': 'Utilisateur non trouvé'}), 404

        # Validate form data
        if not request.form.get('offre_id') or not request.files.get('cv') or not request.form.get('lettre_motivation'):
            logger.warning("Champs requis manquants dans la requête /candidatures")
            return jsonify({'error': 'Tous les champs (offre_id, cv, lettre_motivation) sont requis'}), 400

        offre_id = str(request.form.get('offre_id'))
        lettre_motivation = str(request.form.get('lettre_motivation'))
        cv_file = request.files.get('cv')

        # Validate offre_id
        if not ObjectId.is_valid(offre_id):
            logger.warning(f"ID d'offre invalide: {offre_id}")
            return jsonify({'error': 'ID de l\'offre invalide'}), 400

        # Check if the job offer exists and is open
        offres_collection = db[OFFRES_COLLECTION]
        offre = offres_collection.find_one({'_id': ObjectId(offre_id)})
        if not offre:
            logger.info(f"Offre non trouvée pour ID: {offre_id}")
            return jsonify({'error': 'Offre non trouvée'}), 404
        if offre.get('statut', 'ouverte') != 'ouverte':
            logger.info(f"Offre fermée pour ID: {offre_id}")
            return jsonify({'error': 'Cette offre est fermée'}), 400

        # Validate entreprise and recruteur_id
        entreprise = offre.get('entreprise')
        
        if not users_collection.find_one({'_id': ObjectId(offre['recruteur_id']), 'role': 'recruteur'}):
            logger.warning(f"Recruteur non trouvé pour ID: {offre['recruteur_id']}")
            return jsonify({'error': 'Recruteur non trouvé'}), 404

        # Save CV file
        upload_folder = current_app.config.get('UPLOAD_FOLDER', 'Uploads')
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder)
        
        cv_filename = f"{user_email}_{offre_id}_{cv_file.filename}"
        cv_path = os.path.join(upload_folder, cv_filename)
        cv_file.save(cv_path)
        logger.info(f"CV sauvegardé à: {cv_path}")

        # Store candidature in MongoDB
        candidatures_collection = db[CANDIDATURES_COLLECTION]
        candidature = {
            'user_email': user_email,
            'offre_id': ObjectId(offre_id),
            'lettre_motivation': lettre_motivation,
            'cv_path': cv_path,
            'created_at': datetime.datetime.utcnow()
        }
        
        result = candidatures_collection.insert_one(candidature)
        candidature_id = str(result.inserted_id)
        
        # Update the offre with the new candidature_id
        offres_collection.update_one(
            {'_id': ObjectId(offre_id)},
            {'$push': {'candidature_ids': ObjectId(candidature_id)}}
        )
        
        logger.info(f"Candidature soumise pour utilisateur: {user_email}, offre: {offre_id}, candidature: {candidature_id}")

        return jsonify({'message': 'Candidature soumise avec succès', 'candidature_id': candidature_id}), 201

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans /candidatures: {str(e)}")
        return jsonify({'error': 'Erreur de base de données'}), 500
    except Exception as e:
        logger.error(f"Erreur dans /candidatures: {str(e)}")
        return jsonify({'error': f'Erreur serveur: {str(e)}'}), 500 