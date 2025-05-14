from flask import Blueprint, request, jsonify
from flask_cors import CORS
from bson import ObjectId
from datetime import datetime
import logging
from .entretiens_questions import generate_interview_questions, extract_text_from_pdf

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

candidates_bp = Blueprint('candidates', __name__)
CORS(candidates_bp)

# Collections MongoDB
CANDIDATURES_COLLECTION = 'candidatures'
OFFRES_COLLECTION = 'offres'
QUESTIONS_COLLECTION = 'questions'

@candidates_bp.route('/candidates/<candidature_id>/accept', methods=['POST'])
def accept_candidate(candidature_id):
    try:
        # Vérification du token
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Token manquant"}), 401

        # Récupération de la candidature
        candidature = CANDIDATURES_COLLECTION.find_one({"_id": ObjectId(candidature_id)})
        if not candidature:
            return jsonify({"error": "Candidature non trouvée"}), 404

        # Récupération de l'offre
        offre = OFFRES_COLLECTION.find_one({"_id": ObjectId(candidature["offre_id"])})
        if not offre:
            return jsonify({"error": "Offre non trouvée"}), 404

        # Extraction du texte du CV
        cv_text = extract_text_from_pdf(candidature.get("cv", b""))

        # Génération des questions
        questions = generate_interview_questions(cv_text, offre)

        # Affichage des questions générées dans la console
        print("\n=== Questions générées pour l'entretien ===")
        for i, question in enumerate(questions, 1):
            print(f"{i}. {question}")
        print("=========================================\n")

        # Création du document questions
        questions_doc = {
            "candidature_id": ObjectId(candidature_id),
            "offre_id": ObjectId(candidature["offre_id"]),
            "questions": questions,
            "date_creation": datetime.utcnow(),
            "statut": "actif"
        }

        # Insertion des questions dans la base de données
        questions_result = QUESTIONS_COLLECTION.insert_one(questions_doc)

        # Mise à jour de la candidature
        update_result = CANDIDATURES_COLLECTION.update_one(
            {"_id": ObjectId(candidature_id)},
            {
                "$set": {
                    "statut": "Accepté",
                    "date_modification": datetime.utcnow(),
                    "questions_id": questions_result.inserted_id
                }
            }
        )

        if update_result.modified_count == 0:
            return jsonify({"error": "Erreur lors de la mise à jour de la candidature"}), 500

        return jsonify({
            "success": True,
            "message": "Candidature acceptée et questions générées avec succès",
            "questions_id": str(questions_result.inserted_id)
        }), 200

    except Exception as e:
        logger.error(f"Erreur lors de l'acceptation de la candidature: {str(e)}")
        return jsonify({"error": str(e)}), 500 