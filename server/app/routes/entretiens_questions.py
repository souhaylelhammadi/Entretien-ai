from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from pymongo.errors import PyMongoError
import datetime
from utils import verify_token
import logging
from flask_cors import CORS
import os
import PyPDF2
import io
import requests
from dotenv import load_dotenv
import base64
import json
import httpx

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

entretiens_questions_bp = Blueprint('entretiens_questions', __name__)

# Configure CORS
CORS(entretiens_questions_bp, resources={r"/*": {"origins": "http://localhost:3000"}}, supports_credentials=True)

# Standardized collection names
CANDIDATURES_COLLECTION = 'candidatures'
OFFRES_COLLECTION = 'offres'
ENTRETIENS_COLLECTION = 'entretiens'
USERS_COLLECTION = 'utilisateurs'
QUESTIONS_COLLECTION = 'questions'

# Configuration Groq
load_dotenv()
GROQ_API_KEY = "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"
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

logger.info("Configuration Groq initialisée")

def store_questions(candidature_id, offre_id, questions, cv_text, job_offer):
    """Stocke les questions générées dans la collection questions"""
    try:
        # Créer le document questions
        questions_doc = {
            "candidature_id": ObjectId(candidature_id),
            "offre_id": ObjectId(offre_id),
            "questions": questions,
            "cv_context": cv_text[:1000],  # Stocker un extrait du CV
            "offre_context": job_offer,
            "date_creation": datetime.datetime.utcnow(),
            "statut": "actif"
        }

        # Insérer dans la collection questions
        db = current_app.mongo
        result = db[QUESTIONS_COLLECTION].insert_one(questions_doc)
        
        if result.inserted_id:
            logger.info(f"Questions stockées avec succès pour la candidature {candidature_id}")
            return result.inserted_id
        else:
            logger.error("Erreur lors du stockage des questions")
            return None

    except Exception as e:
        logger.error(f"Erreur lors du stockage des questions: {str(e)}")
        return None

def get_stored_questions(candidature_id):
    """Récupère les questions stockées pour une candidature"""
    try:
        db = current_app.mongo
        questions = db[QUESTIONS_COLLECTION].find_one(
            {"candidature_id": ObjectId(candidature_id)},
            sort=[("date_creation", -1)]  # Récupérer les plus récentes
        )
        
        if questions:
            logger.info(f"Questions trouvées pour la candidature {candidature_id}")
            return questions
        else:
            logger.info(f"Aucune question trouvée pour la candidature {candidature_id}")
            return None

    except Exception as e:
        logger.error(f"Erreur lors de la récupération des questions: {str(e)}")
        return None

def make_groq_request(prompt):
    """Fait une requête à l'API Groq"""
    try:
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": "llama3-8b-8192",
            "messages": [
                {"role": "system", "content": "Tu es un expert en recrutement qui crée des questions d'entretien pertinentes et ciblées."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7,
            "max_tokens": 1500
        }

        logger.info("Envoi de la requête à l'API Groq...")
        with httpx.Client(timeout=30.0) as client:
            response = client.post(GROQ_API_URL, json=data, headers=headers)
            
            if response.status_code == 401:
                logger.error("Erreur d'authentification avec l'API Groq. Vérifiez votre clé API.")
                return None
            elif response.status_code != 200:
                logger.error(f"Erreur API Groq (status {response.status_code}): {response.text}")
                return None
                
            response.raise_for_status()
            return response.json()

    except httpx.HTTPError as e:
        logger.error(f"Erreur HTTP lors de la requête à l'API Groq: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Erreur inattendue lors de la requête à l'API Groq: {str(e)}")
        return None

def extract_text_from_pdf(pdf_data):
    """Extrait le texte d'un fichier PDF."""
    try:
        if not pdf_data:
            logger.error("Aucune donnée PDF fournie")
            return ""

        # Vérifier si les données sont en base64
        if isinstance(pdf_data, str) and pdf_data.startswith('data:application/pdf;base64,'):
            try:
                # Extraire la partie base64 après la virgule
                base64_data = pdf_data.split(',')[1]
                pdf_data = base64.b64decode(base64_data)
                logger.info("Données PDF décodées depuis base64")
            except Exception as e:
                logger.error(f"Erreur lors du décodage base64: {str(e)}")
                return ""

        # Vérifier si les données sont des bytes
        if not isinstance(pdf_data, bytes):
            logger.error(f"Format de données PDF invalide: {type(pdf_data)}")
            return ""

        # Créer un objet BytesIO pour PyPDF2
        pdf_file = io.BytesIO(pdf_data)
        
        try:
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            if not pdf_reader.pages:
                logger.error("Le PDF ne contient aucune page")
                return ""
        except Exception as e:
            logger.error(f"Erreur lors de la lecture du PDF: {str(e)}")
            return ""

        # Extraire le texte de chaque page
        text = ""
        for i, page in enumerate(pdf_reader.pages):
            try:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
                else:
                    logger.warning(f"Page {i+1} ne contient pas de texte")
            except Exception as e:
                logger.error(f"Erreur lors de l'extraction du texte de la page {i+1}: {str(e)}")

        if not text.strip():
            logger.error("Aucun texte n'a pu être extrait du PDF")
            return ""

        logger.info(f"Texte extrait avec succès du PDF ({len(text)} caractères)")
        return text

    except Exception as e:
        logger.error(f"Erreur lors de l'extraction du texte du PDF: {str(e)}")
        return ""

def generate_interview_questions(cv_text, job_offer, candidature_id=None, offre_id=None):
    """Génère des questions d'entretien en utilisant l'API Groq"""
    try:
        # Vérifier si des questions existent déjà
        if candidature_id:
            stored_questions = get_stored_questions(candidature_id)
            if stored_questions:
                logger.info("Utilisation des questions existantes")
                return stored_questions['questions']

        # Limiter la taille du texte si nécessaire
        if len(cv_text) > 20000:
            cv_text = cv_text[:19000]
        
        # Préparation du prompt pour Groq
        prompt = f"""En tant qu'expert en recrutement, analyse le CV du candidat et l'offre d'emploi pour générer 10 questions pertinentes pour l'entretien.

CV du candidat:
{cv_text}

Offre d'emploi:
{job_offer}

Génère 10 questions qui:
1. Présentez-vous
2. Explorent l'expérience pertinente du candidat
3. Testent la compréhension du rôle
4. Évaluent la motivation et l'adaptation
5. Incluent une question sur un défi technique
6. Questions basées sur le CV du candidat

Format de réponse souhaité (en JSON):
[
    {{
        "question": "Question 1",
        "type": "présentation",
        "objectif": "Connaître le candidat"
    }},
    ...
]"""

        # Appel à l'API Groq
        response = make_groq_request(prompt)
        if not response:
            logger.error("Pas de réponse de l'API Groq")
            return ['error']

        # Extraire et parser la réponse
        questions_text = response['choices'][0]['message']['content'].strip()
        logger.info("Réponse reçue de l'API Groq")
        
        try:
            # Trouver le début et la fin de la structure JSON
            start_index = questions_text.find('[')
            end_index = questions_text.rfind(']') + 1

            if start_index == -1 or end_index == 0:
                logger.error("Format de réponse invalide - aucune liste trouvée")
                return ['error']

            # Extraire la chaîne JSON
            questions_json = questions_text[start_index:end_index]
            logger.info("JSON extrait de la réponse")

            # Parser la chaîne JSON en liste Python
            questions = json.loads(questions_json)
            
            # Stocker les questions si les IDs sont fournis
            if candidature_id and offre_id:
                store_questions(candidature_id, offre_id, questions, cv_text, job_offer)
            
            return questions

        except json.JSONDecodeError as e:
            logger.error(f"Erreur lors du parsing JSON: {str(e)}")
            return ['error']
        except Exception as e:
            logger.error(f"Erreur lors du traitement de la réponse: {str(e)}")
            return ['error']

    except Exception as e:
        logger.error(f"Erreur lors de la génération des questions: {str(e)}")
        return ['error']

@entretiens_questions_bp.route('/interviews/generate', methods=['POST'])
def generate_interview():
    """Endpoint pour générer des questions d'entretien"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Données manquantes"}), 400

        candidature_id = data.get('candidature_id')
        offre_id = data.get('offre_id')
        cv_text = data.get('cv_text')
        job_offer = data.get('job_offer')

        if not all([candidature_id, offre_id, cv_text, job_offer]):
            return jsonify({"error": "Tous les champs sont requis"}), 400

        questions = generate_interview_questions(cv_text, job_offer, candidature_id, offre_id)
        
        if questions == ['error']:
            return jsonify({"error": "Erreur lors de la génération des questions"}), 500

        return jsonify({"questions": questions}), 200

    except Exception as e:
        logger.error(f"Erreur lors de la génération de l'entretien: {str(e)}")
        return jsonify({"error": str(e)}), 500 