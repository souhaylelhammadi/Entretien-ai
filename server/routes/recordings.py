from flask import Blueprint, jsonify, request
from bson import ObjectId
from datetime import datetime, timezone
import os
from werkzeug.utils import secure_filename

recordings_bp = Blueprint('recordings', __name__)

# Dossier pour stocker les vidéos uploadées
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Liste des questions techniques
TECHNICAL_QUESTIONS = [
    "Can you explain how you would implement a microservices architecture in a .NET environment and what benefits it would bring to a project?",
    "Describe your experience with containerization and how you would use Docker with .NET applications.",
    "How would you implement authentication and authorization in a distributed system?",
    "Explain your approach to testing in a microservices architecture.",
    "What strategies would you use for data management across microservices?",
]

@recordings_bp.route("/api/questions", methods=["GET"])
def get_questions():
    """Retourne la liste des questions techniques."""
    try:
        return jsonify({
            "success": True,
            "questions": TECHNICAL_QUESTIONS
        }), 200
    except Exception as e:
        print(f"Erreur lors de la récupération des questions: {str(e)}")
        return jsonify({"success": False, "error": "Erreur serveur", "details": str(e)}), 500

@recordings_bp.route("/api/save-recording", methods=["POST"])
def save_recording():
    """Enregistre la vidéo et les données de l'interview dans la base de données."""
    from app import mongo  # Importation différée à l'intérieur de la fonction
    try:
        if "video" not in request.files or "offerId" not in request.form:
            return jsonify({"success": False, "error": "Vidéo ou offerId manquant"}), 400

        video = request.files["video"]
        offer_id = request.form["offerId"]

        filename = secure_filename(f"interview_{offer_id}_{datetime.now(timezone.utc).isoformat()}.webm")
        video_path = os.path.join(UPLOAD_FOLDER, filename)
        video.save(video_path)

        recordings = []
        i = 0
        while f"transcript_{i}" in request.form:
            recordings.append({
                "transcript": request.form.get(f"transcript_{i}", ""),
                "questionIndex": int(request.form.get(f"questionIndex_{i}", 0)),
                "question": request.form.get(f"question_{i}", ""),
                "timestamp": request.form.get(f"timestamp_{i}", "")
            })
            i += 1

        result = mongo.db.accepted_offers.update_one(
            {"_id": ObjectId(offer_id)},
            {
                "$set": {
                    "status": "completed",
                    "recordings": recordings,
                    "videoPath": video_path,
                    "updatedAt": datetime.now(timezone.utc)
                }
            }
        )

        if result.matched_count == 0:
            return jsonify({"success": False, "error": "Offre non trouvée"}), 404

        return jsonify({
            "success": True,
            "message": "Interview enregistrée avec succès",
            "videoPath": video_path
        }), 200

    except Exception as e:
        print(f"Erreur lors de la sauvegarde: {str(e)}")
        return jsonify({"success": False, "error": "Erreur serveur", "details": str(e)}), 500

@recordings_bp.route("/api/recordings", methods=["GET"])
def get_recordings():
    """Récupère les enregistrements existants pour une offre donnée."""
    from app import mongo  # Importation différée à l'intérieur de la fonction
    try:
        offer_id = request.args.get("offerId")
        if not offer_id or not ObjectId.is_valid(offer_id):
            return jsonify({"success": False, "error": "offerId invalide ou manquant"}), 400

        offer = mongo.db.accepted_offers.find_one({"_id": ObjectId(offer_id)})
        if not offer or "recordings" not in offer:
            return jsonify({"success": True, "data": []}), 200

        return jsonify({
            "success": True,
            "data": offer.get("recordings", [])
        }), 200

    except Exception as e:
        print(f"Erreur lors de la récupération des enregistrements: {str(e)}")
        return jsonify({"success": False, "error": "Erreur serveur", "details": str(e)}), 500