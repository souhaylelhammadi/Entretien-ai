from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
import logging
from datetime import datetime
from auth.jwt_manager import jwt_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

candidatures_bp = Blueprint("candidatures", __name__, url_prefix="/api/candidatures")

@candidatures_bp.route("/", methods=["GET"])
@jwt_manager.require_auth(role="recruteur")
def get_candidatures(auth_payload):
    """Get all candidatures for the authenticated recruiter."""
    try:
        db = current_app.mongo.db
        recruiter_id = auth_payload['sub']
        
        # Get recruiter's offers
        offers = list(db.offres.find({"recruteur_id": ObjectId(recruiter_id)}))
        offer_ids = [offer['_id'] for offer in offers]
        
        # Get candidatures for these offers
        candidatures = list(db.candidatures.find({"offre_id": {"$in": offer_ids}}))
        
        # Format response
        candidatures_list = []
        for candidature in candidatures:
            # Get candidate info
            candidate = db.utilisateurs.find_one({"_id": ObjectId(candidature['user_id'])})
            if not candidate:
                continue
                
            # Get offer info
            offer = db.offres.find_one({"_id": ObjectId(candidature['offre_id'])})
            if not offer:
                continue
                
            candidatures_list.append({
                "id": str(candidature['_id']),
                "candidate": {
                    "id": str(candidate['_id']),
                    "firstName": candidate.get('firstName', ''),
                    "lastName": candidate.get('lastName', ''),
                    "email": candidate.get('email', '')
                },
                "offer": {
                    "id": str(offer['_id']),
                    "title": offer.get('titre', ''),
                    "company": offer.get('entreprise', '')
                },
                "status": candidature.get('status', 'pending'),
                "created_at": candidature.get('created_at', datetime.utcnow()).isoformat()
            })
            
        return jsonify(candidatures_list), 200
        
    except Exception as e:
        logger.error(f"Error fetching candidatures: {str(e)}")
        return jsonify({"error": "Erreur serveur lors de la récupération des candidatures"}), 500

@candidatures_bp.route("/<candidature_id>", methods=["GET"])
@jwt_manager.require_auth(role="recruteur")
def get_candidature(auth_payload, candidature_id):
    """Get a specific candidature by ID."""
    try:
        db = current_app.mongo.db
        recruiter_id = auth_payload['sub']
        
        # Get the candidature
        candidature = db.candidatures.find_one({"_id": ObjectId(candidature_id)})
        if not candidature:
            return jsonify({"error": "Candidature non trouvée"}), 404
            
        # Verify the candidature belongs to one of the recruiter's offers
        offer = db.offres.find_one({
            "_id": ObjectId(candidature['offre_id']),
            "recruteur_id": ObjectId(recruiter_id)
        })
        if not offer:
            return jsonify({"error": "Accès non autorisé à cette candidature"}), 403
            
        # Get candidate info
        candidate = db.utilisateurs.find_one({"_id": ObjectId(candidature['user_id'])})
        if not candidate:
            return jsonify({"error": "Candidat non trouvé"}), 404
            
        # Format response
        candidature_data = {
            "id": str(candidature['_id']),
            "candidate": {
                "id": str(candidate['_id']),
                "firstName": candidate.get('firstName', ''),
                "lastName": candidate.get('lastName', ''),
                "email": candidate.get('email', ''),
                "phone": candidate.get('telephone', ''),
                "cv": candidate.get('cv', '')
            },
            "offer": {
                "id": str(offer['_id']),
                "title": offer.get('titre', ''),
                "company": offer.get('entreprise', ''),
                "description": offer.get('description', '')
            },
            "status": candidature.get('status', 'pending'),
            "created_at": candidature.get('created_at', datetime.utcnow()).isoformat(),
            "cover_letter": candidature.get('cover_letter', ''),
            "additional_documents": candidature.get('additional_documents', [])
        }
        
        return jsonify(candidature_data), 200
        
    except Exception as e:
        logger.error(f"Error fetching candidature: {str(e)}")
        return jsonify({"error": "Erreur serveur lors de la récupération de la candidature"}), 500

@candidatures_bp.route("/<candidature_id>/status", methods=["PUT"])
@jwt_manager.require_auth(role="recruteur")
def update_candidature_status(auth_payload, candidature_id):
    """Update the status of a candidature."""
    try:
        data = request.get_json()
        if not data or 'status' not in data:
            return jsonify({"error": "Statut requis"}), 400
            
        db = current_app.mongo.db
        recruiter_id = auth_payload['sub']
        
        # Get the candidature
        candidature = db.candidatures.find_one({"_id": ObjectId(candidature_id)})
        if not candidature:
            return jsonify({"error": "Candidature non trouvée"}), 404
            
        # Verify the candidature belongs to one of the recruiter's offers
        offer = db.offres.find_one({
            "_id": ObjectId(candidature['offre_id']),
            "recruteur_id": ObjectId(recruiter_id)
        })
        if not offer:
            return jsonify({"error": "Accès non autorisé à cette candidature"}), 403
            
        # Update the status
        result = db.candidatures.update_one(
            {"_id": ObjectId(candidature_id)},
            {"$set": {
                "status": data['status'],
                "updated_at": datetime.utcnow()
            }}
        )
        
        if result.modified_count == 0:
            return jsonify({"error": "Aucune modification effectuée"}), 400
            
        return jsonify({"message": "Statut de la candidature mis à jour avec succès"}), 200
        
    except Exception as e:
        logger.error(f"Error updating candidature status: {str(e)}")
        return jsonify({"error": "Erreur serveur lors de la mise à jour du statut"}), 500 