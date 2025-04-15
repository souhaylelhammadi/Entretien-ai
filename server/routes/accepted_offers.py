from flask import Blueprint, jsonify, request
from bson import ObjectId
from datetime import datetime, timezone

accepted_offers_bp = Blueprint('accepted_offers', __name__)

def serialize_doc(doc):
    """Serialize a MongoDB document for JSON."""
    if not doc:
        return None
    doc = dict(doc)  # Create a copy to avoid modifying the original
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    if "jobId" in doc:
        doc["jobId"] = str(doc["jobId"])
    if "candidateId" in doc:
        doc["candidateId"] = str(doc["candidateId"])
    
    # Format date fields to ISO 8601 with UTC 'Z'
    date_fields = ["acceptedAt", "interviewDate", "createdAt", "updatedAt"]
    for field in date_fields:
        if field in doc and isinstance(doc[field], datetime):
            doc[field] = doc[field].isoformat() + "Z"
    
    return doc

@accepted_offers_bp.route("/accepted-offers", methods=["GET"])
def get_accepted_offers():
    """Retrieve all accepted offers from the database."""
    from app import mongo
    try:
        # Fetch all accepted offers, sorted by acceptedAt in descending order
        offers = list(mongo.db.accepted_offers.find().sort("acceptedAt", -1))

        # Enrich each offer with job details
        for offer in offers:
            job = mongo.db.jobs.find_one({"_id": ObjectId(offer["jobId"])})
            if job:
                offer["jobDetails"] = {
                    "title": job.get("title"),
                    "company": job.get("company", "N/A"),
                    "department": job.get("department"),
                    "location": job.get("location"),
                    "requirements": job.get("requirements", [])
                }
            else:
                offer["jobDetails"] = {
                    "title": "Unknown Job",
                    "company": "N/A",
                    "department": "N/A",
                    "location": "N/A",
                    "requirements": []
                }

        serialized_offers = [serialize_doc(offer) for offer in offers]
        return jsonify({
            "message": "Accepted offers retrieved successfully",
            "offers": serialized_offers
        }), 200

    except Exception as e:
        print(f"Error fetching accepted offers: {str(e)}")
        return jsonify({"error": "Server error", "details": str(e)}), 500

@accepted_offers_bp.route("/accepted-offers/<string:offer_id>", methods=["PUT"])
def update_accepted_offer(offer_id):
    """Update an accepted offer."""
    from app import mongo
    try:
        if not ObjectId.is_valid(offer_id):
            return jsonify({"error": "Invalid offer ID"}), 400

        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Validate status
        valid_statuses = ["pending_interview", "completed", "cancelled"]
        if "status" in data and data["status"] not in valid_statuses:
            return jsonify({
                "error": f"Invalid status. Allowed values: {', '.join(valid_statuses)}"
            }), 400

        # Validate interview date if provided
        if "interviewDate" in data:
            try:
                data["interviewDate"] = datetime.fromisoformat(data["interviewDate"].replace("Z", "+00:00"))
            except ValueError:
                return jsonify({
                    "error": "Invalid date format. Use ISO 8601 (e.g., '2023-10-01T10:00:00Z')"
                }), 400

        # Prepare update data
        update_data = {
            k: v for k, v in data.items()
            if k in ["status", "interviewDate", "feedback"]
        }
        update_data["updatedAt"] = datetime.now(timezone.utc)

        # Update the offer in the database
        result = mongo.db.accepted_offers.update_one(
            {"_id": ObjectId(offer_id)},
            {"$set": update_data}
        )

        if result.matched_count == 0:
            return jsonify({"error": "Offer not found"}), 404

        # Fetch the updated offer
        updated_offer = mongo.db.accepted_offers.find_one({"_id": ObjectId(offer_id)})
        return jsonify({
            "message": "Offer updated successfully",
            "offer": serialize_doc(updated_offer)
        }), 200

    except Exception as e:
        print(f"Error updating offer: {str(e)}")
        return jsonify({"error": "Server error", "details": str(e)}), 500