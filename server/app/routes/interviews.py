from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from pymongo.errors import PyMongoError
import datetime
from utils import verify_token
import logging
from flask_cors import CORS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

interviews_bp = Blueprint('interviews', __name__)

# Configure CORS
CORS(interviews_bp, resources={r"/*": {"origins": "http://localhost:3000"}}, supports_credentials=True)

# Standardized collection names
CANDIDATURES_COLLECTION = 'candidatures'
OFFRES_COLLECTION = 'offres'
USERS_COLLECTION = 'utilisateurs'

@interviews_bp.route('/api/accepted-offers', methods=['GET'])
def get_accepted_offers():
    try:
        token = request.headers.get('Authorization')
        if not token:
            logger.warning("Jeton manquant dans la requête /api/accepted-offers")
            return jsonify({'error': 'Jeton manquant'}), 401

        # Convert token to string if necessary
        if isinstance(token, bytes):
            token = token.decode('utf-8')

        # Verify token
        user_email = verify_token(token)
        if not user_email:
            logger.warning("Jeton invalide dans la requête /api/accepted-offers")
            return jsonify({'error': 'Jeton invalide'}), 401

        db = current_app.mongo
        
        # Récupérer les candidatures acceptées pour l'utilisateur
        candidatures = list(db[CANDIDATURES_COLLECTION].find({
            'user_email': user_email,
            'statut': {'$in': ['accepted', 'pending_interview', 'completed', 'cancelled']}
        }))

        # Pour chaque candidature, récupérer les détails de l'offre
        for candidature in candidatures:
            offre = db[OFFRES_COLLECTION].find_one({'_id': candidature['offre_id']})
            if offre:
                candidature['jobDetails'] = {
                    'title': offre.get('titre', 'N/A'),
                    'company': offre.get('entreprise', 'N/A'),
                    'location': offre.get('localisation', 'N/A'),
                    'department': offre.get('departement', 'N/A'),
                    'description': offre.get('description', 'N/A')
                }
            candidature['_id'] = str(candidature['_id'])
            candidature['offre_id'] = str(candidature['offre_id'])

        logger.info(f"Retour de {len(candidatures)} candidatures acceptées pour l'utilisateur {user_email}")
        return jsonify({'offers': candidatures}), 200

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans /api/accepted-offers: {str(e)}")
        return jsonify({'error': 'Erreur de base de données'}), 500
    except Exception as e:
        logger.error(f"Erreur dans /api/accepted-offers: {str(e)}")
        return jsonify({'error': f'Erreur serveur: {str(e)}'}), 500

@interviews_bp.route('/api/accepted-offers/<string:application_id>', methods=['PUT'])
def update_application_status(application_id):
    try:
        token = request.headers.get('Authorization')
        if not token:
            logger.warning("Jeton manquant dans la requête /api/accepted-offers/<id>")
            return jsonify({'error': 'Jeton manquant'}), 401

        # Convert token to string if necessary
        if isinstance(token, bytes):
            token = token.decode('utf-8')

        # Verify token
        user_email = verify_token(token)
        if not user_email:
            logger.warning("Jeton invalide dans la requête /api/accepted-offers/<id>")
            return jsonify({'error': 'Jeton invalide'}), 401

        # Validate application_id
        if not ObjectId.is_valid(application_id):
            logger.warning(f"ID de candidature invalide: {application_id}")
            return jsonify({'error': 'ID de candidature invalide'}), 400

        # Get new status from request
        data = request.get_json()
        if not data or 'status' not in data:
            logger.warning("Statut manquant dans la requête")
            return jsonify({'error': 'Statut requis'}), 400

        new_status = data['status']
        valid_statuses = ['accepted', 'pending_interview', 'completed', 'cancelled']
        if new_status not in valid_statuses:
            logger.warning(f"Statut invalide: {new_status}")
            return jsonify({'error': 'Statut invalide'}), 400

        db = current_app.mongo
        
        # Vérifier que la candidature appartient à l'utilisateur
        candidature = db[CANDIDATURES_COLLECTION].find_one({
            '_id': ObjectId(application_id),
            'user_email': user_email
        })
        
        if not candidature:
            logger.warning(f"Candidature non trouvée ou non autorisée: {application_id}")
            return jsonify({'error': 'Candidature non trouvée ou non autorisée'}), 404

        # Mettre à jour le statut
        result = db[CANDIDATURES_COLLECTION].update_one(
            {'_id': ObjectId(application_id)},
            {'$set': {'statut': new_status, 'date_maj': datetime.datetime.utcnow()}}
        )

        if result.modified_count == 0:
            logger.warning(f"Échec de la mise à jour du statut pour la candidature: {application_id}")
            return jsonify({'error': 'Échec de la mise à jour du statut'}), 500

        # Récupérer la candidature mise à jour
        updated_candidature = db[CANDIDATURES_COLLECTION].find_one({'_id': ObjectId(application_id)})
        
        # Ajouter les détails de l'offre
        offre = db[OFFRES_COLLECTION].find_one({'_id': updated_candidature['offre_id']})
        if offre:
            updated_candidature['jobDetails'] = {
                'title': offre.get('titre', 'N/A'),
                'company': offre.get('entreprise', 'N/A'),
                'location': offre.get('localisation', 'N/A'),
                'department': offre.get('departement', 'N/A'),
                'description': offre.get('description', 'N/A')
            }

        # Convertir les ObjectId en string
        updated_candidature['_id'] = str(updated_candidature['_id'])
        updated_candidature['offre_id'] = str(updated_candidature['offre_id'])

        logger.info(f"Statut mis à jour pour la candidature {application_id}: {new_status}")
        return jsonify({'offer': updated_candidature}), 200

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans /api/accepted-offers/<id>: {str(e)}")
        return jsonify({'error': 'Erreur de base de données'}), 500
    except Exception as e:
        logger.error(f"Erreur dans /api/accepted-offers/<id>: {str(e)}")
        return jsonify({'error': f'Erreur serveur: {str(e)}'}), 500 