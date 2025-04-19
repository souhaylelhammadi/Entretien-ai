from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from datetime import datetime, timezone
from auth import verify_token  # Import verify_token from auth blueprint

accepted_offers_bp = Blueprint('accepted_offers', __name__, url_prefix="/api")

def auth_required(f):
    """Decorator to ensure user is authenticated and is a candidate"""
    def wrapper(*args, **kwargs):
        token = request.headers.get("Authorization")
        decoded = verify_token(token)
        if not decoded:
            return jsonify({"error": "Authentification requise"}), 401
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
    if "candidateId" in doc:
        doc["candidateId"] = str(doc["candidateId"])
    if "offerId" in doc:
        doc["offerId"] = str(doc["offerId"])
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
    date_fields = ["acceptedAt", "interviewDate", "createdAt", "updatedAt"]
    for field in date_fields:
        if field in doc and isinstance(doc[field], datetime):
            doc[field] = doc[field].isoformat() + "Z"
    
    return doc

@accepted_offers_bp.route("/accepted-offers", methods=["GET"])
@auth_required
def get_accepted_offers():
    """Retrieve accepted applications for the authenticated candidate."""
    from app import mongo
    try:
        user_id = ObjectId(request.user["id"])
        
        # Fetch applications with status="accepted" for the candidate
        applications = list(mongo.db.applications.find({
            "candidateId": user_id,
            "status": "accepted"
        }).sort("acceptedAt", -1))

        # Enrich each application with offer, entreprise, and interview details
        for app in applications:
            # Fetch offer details
            offer = mongo.db.offers.find_one({"_id": ObjectId(app["offerId"])})
            if offer:
                entreprise = mongo.db.entreprises.find_one({"_id": offer.get("entreprise_id")})
                app["jobDetails"] = {
                    "title": offer.get("title", "N/A"),
                    "company": entreprise.get("nom", "N/A") if entreprise else offer.get("company", "N/A"),
                    "department": offer.get("department", "N/A"),
                    "location": offer.get("location", "N/A"),
                    "requirements": offer.get("requirements", []),
                    "entreprise_id": str(offer.get("entreprise_id", "")) if offer.get("entreprise_id") else ""
                }
            else:
                app["jobDetails"] = {
                    "title": "Offre inconnue",
                    "company": "N/A",
                    "department": "N/A",
                    "location": "N/A",
                    "requirements": [],
                    "entreprise_id": ""
                }

            # Fetch interview details if available
            interview = mongo.db.interviews.find_one({
                "applicationId": app["_id"],
                "candidateId": user_id
            })
            if interview:
                app["interview"] = {
                    "id": str(interview["_id"]),
                    "videoPath": interview.get("videoPath", ""),
                    "score": interview.get("score", None),
                    "timestamp": interview.get("createdAt", None)
                }
            else:
                app["interview"] = None

        serialized_applications = [serialize_doc(app) for app in applications]
        return jsonify({
            "success": True,
            "data": serialized_applications,
            "message": "Applications acceptées récupérées avec succès"
        }), 200

    except Exception as e:
        current_app.logger.error(f"Erreur lors de la récupération des applications acceptées : {str(e)}")
        return jsonify({
            "success": False,
            "error": "Erreur serveur",
            "details": str(e)
        }), 500

@accepted_offers_bp.route("/accepted-offers/<string:application_id>", methods=["PUT"])
@auth_required
def update_accepted_offer(application_id):
    """Update an accepted application for the authenticated candidate."""
    from app import mongo
    try:
        if not ObjectId.is_valid(application_id):
            return jsonify({"error": "ID de l'application invalide"}), 400

        user_id = ObjectId(request.user["id"])
        data = request.json
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

        # Prepare update data
        update_data = {
            k: v for k, v in data.items()
            if k in ["status", "interviewDate", "feedback"]
        }
        update_data["updatedAt"] = datetime.now(timezone.utc)

        # Ensure the application belongs to the authenticated candidate
        result = mongo.db.applications.update_one(
            {
                "_id": ObjectId(application_id),
                "candidateId": user_id,
                "status": "accepted"
            },
            {"$set": update_data}
        )

        if result.matched_count == 0:
            return jsonify({
                "error": "Application non trouvée, non acceptée ou non autorisée pour ce candidat"
            }), 404

        # Fetch the updated application
        updated_app = mongo.db.applications.find_one({"_id": ObjectId(application_id)})
        if updated_app:
            # Enrich with offer details
            offer = mongo.db.offers.find_one({"_id": ObjectId(updated_app["offerId"])})
            if offer:
                entreprise = mongo.db.entreprises.find_one({"_id": offer.get("entreprise_id")})
                updated_app["jobDetails"] = {
                    "title": offer.get("title", "N/A"),
                    "company": entreprise.get("nom", "N/A") if entreprise else offer.get("company", "N/A"),
                    "department": offer.get("department", "N/A"),
                    "location": offer.get("location", "N/A"),
                    "requirements": offer.get("requirements", []),
                    "entreprise_id": str(offer.get("entreprise_id", "")) if offer.get("entreprise_id") else ""
                }
            else:
                updated_app["jobDetails"] = {
                    "title": "Offre inconnue",
                    "company": "N/A",
                    "department": "N/A",
                    "location": "N/A",
                    "requirements": [],
                    "entreprise_id": ""
                }

            # Fetch interview details if available
            interview = mongo.db.interviews.find_one({
                "applicationId": updated_app["_id"],
                "candidateId": user_id
            })
            if interview:
                updated_app["interview"] = {
                    "id": str(interview["_id"]),
                    "videoPath": interview.get("videoPath", ""),
                    "score": interview.get("score", None),
                    "timestamp": interview.get("createdAt", None)
                }
            else:
                updated_app["interview"] = None

        return jsonify({
            "success": True,
            "data": serialize_doc(updated_app),
            "message": "Application mise à jour avec succès"
        }), 200

    except Exception as e:
        current_app.logger.error(f"Erreur lors de la mise à jour de l'application : {str(e)}")
        return jsonify({
            "success": False,
            "error": "Erreur serveur",
            "details": str(e)
        }), 500