from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from pymongo.errors import PyMongoError
import datetime
from utils import verify_token
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

offres_emploi_bp = Blueprint('offres_emploi', __name__)

# Standardized collection names
OFFRES_COLLECTION = 'offres'
CANDIDATURES_COLLECTION = 'candidatures'
USERS_COLLECTION = 'utilisateurs'
ENTREPRISES_COLLECTION = 'entreprises'

# Route to fetch all job offers
@offres_emploi_bp.route('/offres-emploi', methods=['GET'])
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
                'entreprise_id': str(offre.get('entreprise_id', '')) if offre.get('entreprise_id') else '',
                'recruteur_id': str(offre.get('recruteur_id', '')) if offre.get('recruteur_id') else '',
                'date_creation': offre.get('date_creation', datetime.datetime.utcnow()).isoformat(),
                'date_maj': offre.get('date_maj', datetime.datetime.utcnow()).isoformat(),
                'statut': str(offre.get('statut', 'ouverte')),
                'questions_ids': [str(qid) for qid in offre.get('questions_ids', [])],
                'candidature_ids': [str(cid) for cid in offre.get('candidature_ids', [])],
                'valide': offre.get('statut', 'ouverte') == 'ouverte'  # Derive valide from statut
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
@offres_emploi_bp.route('/offres-emploi/<id>', methods=['GET'])
def get_offre_by_id(id):
    try:
        if not ObjectId.is_valid(id):
            logger.warning(f"ID invalide fourni: {id}")
            return jsonify({'error': 'ID de l’offre invalide'}), 400

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
            'entreprise_id': str(offre.get('entreprise_id', '')) if offre.get('entreprise_id') else '',
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

# Route to submit a job application
@offres_emploi_bp.route('/candidatures', methods=['POST'])
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
        users_collection = db[USERS_COLLECTION]
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
            logger.warning(f"ID d’offre invalide: {offre_id}")
            return jsonify({'error': 'ID de l’offre invalide'}), 400

        # Check if the job offer exists and is open
        offres_collection = db[OFFRES_COLLECTION]
        offre = offres_collection.find_one({'_id': ObjectId(offre_id)})
        if not offre:
            logger.info(f"Offre non trouvée pour ID: {offre_id}")
            return jsonify({'error': 'Offre non trouvée'}), 404
        if offre.get('statut', 'ouverte') != 'ouverte':
            logger.info(f"Offre fermée pour ID: {offre_id}")
            return jsonify({'error': 'Cette offre est fermée'}), 400

        # Validate entreprise_id and recruteur_id
        entreprises_collection = db[ENTREPRISES_COLLECTION]
        if not entreprises_collection.find_one({'_id': ObjectId(offre['entreprise_id'])}):
            logger.warning(f"Entreprise non trouvée pour ID: {offre['entreprise_id']}")
            return jsonify({'error': 'Entreprise non trouvée'}), 404
        
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
    