import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from azure.storage.blob import BlobServiceClient
from pymongo import MongoClient
from dotenv import load_dotenv
import logging
from datetime import datetime
import uuid

# Charger les variables d'environnement
load_dotenv()

# Configuration de l'application Flask
app = Flask(__name__)
CORS(app)  


# Configuration MongoDB
mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/interview_db")
mongo_client = MongoClient(mongo_uri)
db = mongo_client["interview_db"]
recordings_collection = db["recordings"]

# Route pour sauvegarder un enregistrement
@app.route("/api/save-recording", methods=["POST"])
def save_recording():
    """
    Sauvegarde la vidéo dans Azure Blob Storage et les métadonnées dans MongoDB.
    Requiert : video (fichier), transcript, questionIndex, question, timestamp
    """
    try:
        # Vérifier la présence du fichier vidéo
        if "video" not in request.files:
            return jsonify({"success": False, "error": "No video file provided"}), 400
        transcript = request.form.get("transcript")
        question_index = request.form.get("questionIndex")
        question = request.form.get("question")
        timestamp = request.form.get("timestamp")
        
        # Créer l'objet d'enregistrement pour MongoDB
        recording = {
            "_id": str(uuid.uuid4()),  # Utiliser un UUID comme ID unique
            "questionIndex": int(question_index),
            "transcript": transcript,
           
            "question": question,
            "timestamp": timestamp,
        }

        # Insérer dans MongoDB
        result = recordings_collection.insert_one(recording)
        logger.info(f"Recording saved with ID: {recording['_id']}")

        return jsonify({"success": True, "data": {"_id": recording["_id"], "videoUrl": video_url}}), 201

    except ValueError as ve:
        logger.error(f"Validation error: {str(ve)}")
        return jsonify({"success": False, "error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Error saving recording: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

# Route pour récupérer tous les enregistrements
@app.route("/api/recordings", methods=["GET"])
def get_recordings():
    """
    Récupère la liste de tous les enregistrements depuis MongoDB.
    """
    try:
        recordings = list(recordings_collection.find())
        for recording in recordings:
            recording["_id"] = str(recording["_id"])
        return jsonify({"success": True, "data": recordings}), 200
    except Exception as e:
        logger.error(f"Error retrieving recordings: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)