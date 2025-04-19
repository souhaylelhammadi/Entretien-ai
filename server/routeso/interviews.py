from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from datetime import datetime, timezone

interviews_bp = Blueprint('interviews', __name__)

def serialize_doc(doc):
    """Serialize MongoDB document to JSON-compatible format."""
    if not doc:
        return None
    doc = doc.copy()
    if "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    if "candidateId" in doc:
        doc["candidateId"] = str(doc["candidateId"])
    if "jobId" in doc:
        doc["jobId"] = str(doc["jobId"])
    if "interviewDate" in doc:
        doc["date"] = doc["interviewDate"].isoformat()
        del doc["interviewDate"]
    return doc

@interviews_bp.route("/interviews", methods=["GET"])
def get_interviews():
    try:
        db = current_app.mongo.db
        if db is None:
            print("Erreur : Base de données non connectée")
            return jsonify({"error": "Base de données non initialisée"}), 500

        # Vérifier l'existence de la collection
        collections = db.list_collection_names()
        if "interviews" not in collections:
            print("Collection 'interviews' non trouvée")
            return jsonify({"message": "Aucun entretien trouvé", "interviews": []}), 200

        interviews = list(db.interviews.find())
        print(f"Entretiens récupérés : {len(interviews)}")
        serialized_interviews = [serialize_doc(i) for i in interviews]
        return jsonify(serialized_interviews), 200
    except Exception as e:
        print(f"Erreur récupération entretiens: {e}")
        return jsonify({"error": "Erreur lors de la récupération des entretiens"}), 500

@interviews_bp.route("/interviews", methods=["POST"])
def create_interview():
    try:
        db = current_app.mongo.db
        if db is None:
            print("Erreur : Base de données non connectée")
            return jsonify({"error": "Base de données non initialisée"}), 500

        data = request.get_json()
        required_fields = ["candidateId", "jobId", "interviewDate"]
        if not all(field in data for field in required_fields):
            return jsonify({"error": f"Champs requis manquants: {required_fields}"}), 400

        if not ObjectId.is_valid(data["candidateId"]) or not ObjectId.is_valid(data["jobId"]):
            return jsonify({"error": "ID de candidat ou d'offre invalide"}), 400

        candidat = db.candidats.find_one({"_id": ObjectId(data["candidateId"])})
        if not candidat:
            return jsonify({"error": "Candidat non trouvé"}), 404

        offre = db.offres.find_one({"_id": ObjectId(data["jobId"])})
        if not offre:
            return jsonify({"error": "Offre non trouvée"}), 404

        try:
            interview_date = datetime.fromisoformat(data["interviewDate"])
        except ValueError:
            return jsonify({"error": "Format de date invalide"}), 400

        interview_data = {
            "candidateId": ObjectId(data["candidateId"]),
            "jobId": ObjectId(data["jobId"]),
            "interviewDate": interview_date,
            "status": data.get("status", "Planifié"),
            "created_at": datetime.now(timezone.utc)
        }

        result = db.interviews.insert_one(interview_data)
        print(f"Entretien créé avec ID : {str(result.inserted_id)}")
        return jsonify({
            "message": "Entretien créé",
            "interview": serialize_doc(db.interviews.find_one({"_id": result.inserted_id}))
        }), 201
    except Exception as e:
        print(f"Erreur création entretien: {e}")
        return jsonify({"error": "Erreur lors de la création de l'entretien"}), 500

@interviews_bp.route("/interviews/<string:interview_id>", methods=["PUT"])
def update_interview(interview_id):
    try:
        db = current_app.mongo.db
        if db is None:
            print("Erreur : Base de données non connectée")
            return jsonify({"error": "Base de données non initialisée"}), 500

        if not ObjectId.is_valid(interview_id):
            return jsonify({"error": "ID invalide"}), 400

        data = request.get_json()
        if not data:
            return jsonify({"error": "Aucune donnée fournie"}), 400

        interview = db.interviews.find_one({"_id": ObjectId(interview_id)})
        if not interview:
            return jsonify({"error": "Entretien non trouvé"}), 404

        update_data = {}
        if "interviewDate" in data:
            try:
                update_data["interviewDate"] = datetime.fromisoformat(data["interviewDate"])
            except ValueError:
                return jsonify({"error": "Format de date invalide"}), 400
        if "status" in data:
            update_data["status"] = data["status"]
        update_data["updated_at"] = datetime.now(timezone.utc)

        result = db.interviews.update_one(
            {"_id": ObjectId(interview_id)},
            {"$set": update_data}
        )
        if result.modified_count:
            updated_interview = db.interviews.find_one({"_id": ObjectId(interview_id)})
            return jsonify({
                "message": "Entretien mis à jour",
                "interview": serialize_doc(updated_interview)
            }), 200
        return jsonify({"error": "Aucune modification effectuée"}), 404
    except Exception as e:
        print(f"Erreur mise à jour entretien: {e}")
        return jsonify({"error": "Erreur lors de la mise à jour"}), 500

@interviews_bp.route("/interviews/<string:interview_id>", methods=["DELETE"])
def delete_interview(interview_id):
    try:
        db = current_app.mongo.db
        if db is None:
            print("Erreur : Base de données non connectée")
            return jsonify({"error": "Base de données non initialisée"}), 500

        if not ObjectId.is_valid(interview_id):
            return jsonify({"error": "ID invalide"}), 400

        result = db.interviews.delete_one({"_id": ObjectId(interview_id)})
        if result.deleted_count:
            return jsonify({"message": "Entretien supprimé"}), 200
        return jsonify({"error": "Entretien non trouvé"}), 404
    except Exception as e:
        print(f"Erreur suppression entretien: {e}")
        return jsonify({"error": "Erreur lors de la suppression"}), 500