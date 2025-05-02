from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from datetime import datetime, timezone
import logging
from pymongo.errors import PyMongoError
from auth.jwt_manager import jwt_manager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

accepted_offers_bp = Blueprint('accepted_offers', __name__, url_prefix="/api")

def auth_required(f):
    """Decorator to ensure user is authenticated and is a candidate"""
    def wrapper(*args, **kwargs):
        token = request.headers.get("Authorization")
        if not token:
            return jsonify({"error": "Authentification requise"}), 401
        decoded = jwt_manager.verify_token(token)
        if not decoded:
            return jsonify({"error": "Token invalide ou expiré"}), 401
        if decoded.get("role") != "candidat":
            return jsonify({"error": "Accès réservé aux candidats"}), 403
        request.user = decoded
        return f(*args, **kwargs)
    wrapper.__name__ = f.__name__
    return wrapper

def serialize_doc(doc):
    """Serialize a MongoDB document for JSON."""
    if not doc:
        return None
    doc = dict(doc)
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    if "candidate_id" in doc:
        doc["candidateId"] = str(doc["candidate_id"])
    if "offre_id" in doc:
        doc["offerId"] = str(doc["offre_id"])
    if "jobDetails" in doc and "entreprise_id" in doc["jobDetails"]:
        doc["jobDetails"]["entreprise_id"] = str(doc["jobDetails"]["entreprise_id"])
    if "interview" in doc and doc["interview"]:
        if "id" in doc["interview"]:
            doc["interview"]["id"] = str(doc["interview"]["id"])
        date_fields = ["timestamp"]
        for field in date_fields:
            if field in doc["interview"] and isinstance(doc["interview"][field], datetime):
                doc["interview"][field] = doc["interview"][field].isoformat() + "Z"
    
    # Format date fields to ISO 8601 with UTC 'Z'
    date_fields = ["date_postulation", "interviewDate", "created_at", "updated_at"]
    for field in date_fields:
        if field in doc and isinstance(doc[field], datetime):
            doc[field] = doc[field].isoformat() + "Z"
    
    return doc

@accepted_offers_bp.route("/accepted-offers", methods=["GET"])
@auth_required
def get_accepted_offers():
    """Retrieve accepted candidatures for the authenticated candidate."""
    try:
        user_id = ObjectId(request.user["id"])
        
        # Fetch candidatures with status="accepted" or "pending_interview" for the candidate
        candidatures = list(current_app.mongo.db.candidatures.find({
            "user_id": user_id,
            "statut": {"$in": ["accepted", "pending_interview"]}
        }).sort("date_postulation", -1))

        # Enrich each candidature with offer and entreprise details
        for candidature in candidatures:
            # Fetch offer details
            offer = current_app.mongo.db.offres.find_one({"_id": ObjectId(candidature["offre_id"])})
            if offer:
                entreprise = current_app.mongo.db.entreprises.find_one({"_id": offer.get("entreprise", {}).get("_id")})
                candidature["jobDetails"] = {
                    "title": offer.get("titre", "N/A"),
                    "company": entreprise.get("nom", "N/A") if entreprise else offer.get("entreprise", {}).get("nom", "N/A"),
                    "departement": offer.get("departement", "N/A"),
                    "location": offer.get("localisation", "N/A"),
                    "description": offer.get("description", "N/A"),
                    

                    "entreprise_id": str(offer.get("entreprise", {}).get("_id", "")) if offer.get("entreprise", {}).get("_id") else ""
                }
            else:
                candidature["jobDetails"] = {
                    "title": "Offre inconnue",
                    "company": "N/A",
                    "department": "N/A",
                    "location": "N/A",
                    "requirements": [],
                    "entreprise_id": ""
                }

            # Fetch interview details if available
            interview = current_app.mongo.db.interviews.find_one({
                "applicationId": candidature["_id"],
                "candidateId": user_id
            }) if "interviews" in current_app.mongo.db.list_collection_names() else None
            if interview:
                candidature["interview"] = {
                    "id": str(interview["_id"]),
                    "videoPath": interview.get("videoPath", ""),
                    "score": interview.get("score", None),
                    "timestamp": interview.get("createdAt", None)
                }
            else:
                candidature["interview"] = None

        serialized_candidatures = [serialize_doc(candidature) for candidature in candidatures]
        logger.info(f"Récupéré {len(serialized_candidatures)} candidatures acceptées pour User ID: {user_id}")
        return jsonify({
            "success": True,
            "data": serialized_candidatures,
            "message": "Candidatures acceptées récupérées avec succès"
        }), 200

    except ValueError as e:
        logger.error(f"Erreur de validation lors de la récupération des candidatures acceptées: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Erreur de validation",
            "details": str(e)
        }), 400
    except PyMongoError as e:
        logger.error(f"Erreur MongoDB lors de la récupération des candidatures acceptées pour User ID {request.user['id']}: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "Erreur base de données",
            "details": str(e)
        }), 500
    except Exception as e:
        logger.error(f"Erreur serveur lors de la récupération des candidatures acceptées pour User ID {request.user['id']}: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "Erreur serveur",
            "details": str(e)
        }), 500

@accepted_offers_bp.route("/accepted-offers/<string:application_id>", methods=["PUT"])
@auth_required
def update_accepted_offer(application_id):
    """Update an accepted candidature for the authenticated candidate."""
    try:
        if not ObjectId.is_valid(application_id):
            return jsonify({"error": "ID de la candidature invalide"}), 400

        user_id = ObjectId(request.user["id"])
        data = request.get_json()
        if not data:
            return jsonify({"error": "Aucune donnée fournie"}), 400

        # Validate status
        valid_statuses = ["accepted", "pending_interview", "completed", "cancelled"]
        if "status" in data and data["status"] not in valid_statuses:
            return jsonify({
                "error": f"Statut invalide. Valeurs autorisées : {', '.join(valid_statuses)}"
            }), 400

        # Validate interview date if provided
        if "interviewDate" in data:
            try:
                data["interviewDate"] = datetime.fromisoformat(data["interviewDate"].replace("Z", "+00:00"))
            except ValueError:
                return jsonify({
                    "error": "Format de date invalide. Utilisez ISO 8601 (ex. '2023-10-01T10:00:00Z')"
                }), 400

        # Validate feedback length
        if "feedback" in data and len(data["feedback"]) > 1000:
            return jsonify({"error": "Le feedback ne peut pas dépasser 1000 caractères"}), 400

        # Prepare update data
        update_data = {
            k: v for k, v in data.items()
            if k in ["status", "interviewDate", "feedback"]
        }
        update_data["updated_at"] = datetime.now(timezone.utc)

        # Ensure the candidature belongs to the authenticated candidate
        result = current_app.mongo.db.candidatures.update_one(
            {
                "_id": ObjectId(application_id),
                "user_id": user_id,
                "statut": {"$in": ["accepted", "pending_interview"]}
            },
            {"$set": update_data}
        )

        if result.matched_count == 0:
            return jsonify({
                "error": "Candidature non trouvée, non acceptée ou non autorisée pour ce candidat"
            }), 404

        # Fetch the updated candidature
        updated_candidature = current_app.mongo.db.candidatures.find_one({"_id": ObjectId(application_id)})
        if updated_candidature:
            # Enrich with offer details
            offer = current_app.mongo.db.offres.find_one({"_id": ObjectId(updated_candidature["offre_id"])})
            if offer:
                entreprise = current_app.mongo.db.entreprises.find_one({"_id": offer.get("entreprise", {}).get("_id")})
                updated_candidature["jobDetails"] = {
                    "title": offer.get("titre", "N/A"),
                    "company": entreprise.get("nom", "N/A") if entreprise else offer.get("entreprise", {}).get("nom", "N/A"),
                    "department": offer.get("departement", "N/A"),
                    "location": offer.get("localisation", "N/A"),
                    "requirements": offer.get("competences_requises", []),
                    "entreprise_id": str(offer.get("entreprise", {}).get("_id", "")) if offer.get("entreprise", {}).get("_id") else ""
                }
            else:
                updated_candidature["jobDetails"] = {
                    "title": "Offre inconnue",
                    "company": "N/A",
                    "department": "N/A",
                    "location": "N/A",
                    "requirements": [],
                    "entreprise_id": ""
                }

            # Fetch interview details if available
            interview = current_app.mongo.db.interviews.find_one({
                "applicationId": updated_candidature["_id"],
                "candidateId": user_id
            }) if "interviews" in current_app.mongo.db.list_collection_names() else None
            if interview:
                updated_candidature["interview"] = {
                    "id": str(interview["_id"]),
                    "videoPath": interview.get("videoPath", ""),
                    "score": interview.get("score", None),
                    "timestamp": interview.get("createdAt", None)
                }
            else:
                updated_candidature["interview"] = None

        logger.info(f"Candidature ID: {application_id} mise à jour pour User ID: {user_id}")
        return jsonify({
            "success": True,
            "data": serialize_doc(updated_candidature),
            "message": "Candidature mise à jour avec succès"
        }), 200

    except ValueError as e:
        logger.error(f"Erreur de validation lors de la mise à jour de la candidature {application_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Erreur de validation",
            "details": str(e)
        }), 400
    except PyMongoError as e:
        logger.error(f"Erreur MongoDB lors de la mise à jour de la candidature {application_id} pour User ID {request.user['id']}: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "Erreur base de données",
            "details": str(e)
        }), 500
    except Exception as e:
        logger.error(f"Erreur serveur lors de la mise à jour de la candidature {application_id} pour User ID {request.user['id']}: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "Erreur serveur",
            "details": str(e)
        }), 500