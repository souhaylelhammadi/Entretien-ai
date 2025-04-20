from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from datetime import datetime, timezone

candidates_bp = Blueprint('candidates', __name__)

def serialize_doc(doc):
    """Serialize a MongoDB document to JSON-compatible format."""
    if not doc:
        return None
    doc = dict(doc)
    if "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    if "candidate_id" in doc:
        doc["candidate_id"] = str(doc["candidate_id"])
    if "offre_id" in doc:
        doc["offre_id"] = str(doc["offre_id"])
    return doc

@candidates_bp.route("/candidates", methods=["GET"])
def get_candidates():
    """Retrieve all candidatures with associated candidate and job offer details."""
    try:
        db = current_app.mongo.db
        candidatures = db.candidatures.find()
        result = []
        for candidature in candidatures:
            if "candidate_id" not in candidature or not ObjectId.is_valid(candidature["candidate_id"]):
                continue
            candidate = db.candidates.find_one({"_id": candidature["candidate_id"]})
            if not candidate:
                continue
            offre = db.offres.find_one({"_id": candidature["offre_id"]})
            if not offre:
                continue
            
            cv_url = f"/api/candidates/cv/{str(candidate['_id'])}" if candidate.get("cv") else ""
            
            candidature_data = {
                "id": str(candidature["_id"]),
                "candidat": {
                    "nom": candidate.get("nom", "Inconnu"),
                    "email": candidate.get("email", ""),
                    "telephone": candidate.get("telephone", ""),
                    "cv": cv_url,
                    "lettre_motivation": candidate.get("lettre_motivation", ""),
                },
                "offreEmploiId": str(candidature["offre_id"]),
                "offreEmploi": {
                    "id": str(offre["_id"]),
                    "titre": offre.get("titre", "Offre inconnue"),
                },
                "statut": candidature.get("statut", "en_attente"),
                "date_postulation": candidature.get("date_postulation", datetime.now(timezone.utc)).isoformat(),
            }
            result.append(candidature_data)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": f"Échec de la récupération des candidatures : {str(e)}"}), 500

@candidates_bp.route("/candidates/<string:candidate_id>", methods=["PUT"])
def update_candidate_status(candidate_id):
    """Update the status of a candidature."""
    try:
        db = current_app.mongo.db
        data = request.get_json()
        if not data or "statut" not in data:
            return jsonify({"error": "Statut requis"}), 400
        if data["statut"] not in ["en_attente", "acceptee", "refusee"]:
            return jsonify({"error": "Statut invalide"}), 400
        if not ObjectId.is_valid(candidate_id):
            return jsonify({"error": "Format d'ID invalide"}), 400
        result = db.candidatures.update_one(
            {"_id": ObjectId(candidate_id)},
            {"$set": {"statut": data["statut"]}}
        )
        if result.matched_count == 0:
            return jsonify({"error": "Candidature non trouvée"}), 404
        return jsonify({"message": "Statut mis à jour"}), 200
    except Exception as e:
        return jsonify({"error": "Échec de la mise à jour du statut"}), 500