from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError, ConnectionFailure
from azure.storage.blob import BlobServiceClient
import os
from dotenv import load_dotenv
from datetime import datetime
from bson import ObjectId
import json
import logging
import time

# Configuration initiale
load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

# Configuration du logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Encoder JSON personnalisé
class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        if isinstance(o, datetime):
            return o.isoformat()
        return super().default(o)

app.json_encoder = JSONEncoder

# Connexion MongoDB avec retry
def get_mongo_client():
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/recruitment_db")
    max_retries = 3
    retry_delay = 1  # seconds
    
    for attempt in range(max_retries):
        try:
            client = MongoClient(
                mongo_uri,
                serverSelectionTimeoutMS=5000,  # Reduced timeout
                connectTimeoutMS=5000,
                socketTimeoutMS=10000,
                maxPoolSize=50,  # Increased connection pool
                retryWrites=True
            )
            # Test connection
            client.admin.command('ping')
            logger.info("Connecté à MongoDB")
            return client
        except (ServerSelectionTimeoutError, ConnectionFailure) as e:
            if attempt < max_retries - 1:
                logger.warning(f"Tentative de connexion MongoDB échouée: {str(e)}. Nouvelle tentative...")
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                logger.error(f"Échec de la connexion à MongoDB après {max_retries} tentatives: {str(e)}")
                raise

# Initialiser la connexion
try:
    mongo_client = get_mongo_client()
    db = mongo_client["recruitment_db"]
    
    # Collections
    jobs_collection = db["jobs"]
    candidates_collection = db["candidates"]
    interviews_collection = db["interviews"]
except Exception as e:
    logger.error(f"Impossible d'initialiser MongoDB: {str(e)}")
    # Allow application to start even if MongoDB is temporarily unavailable
    mongo_client = None
    db = None
    jobs_collection = None
    candidates_collection = None
    interviews_collection = None

# Azure Blob Storage avec gestion d'erreur améliorée
def get_blob_service():
    azure_connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    if not azure_connection_string:
        logger.error("AZURE_STORAGE_CONNECTION_STRING environnement variable is not set")
        return None
        
    try:
        blob_service = BlobServiceClient.from_connection_string(azure_connection_string)
        container_name = "recruitment-files"
        container_client = blob_service.get_container_client(container_name)
        # Ensure container exists
        if not container_client.exists():
            logger.warning(f"Container {container_name} does not exist, creating it")
            container_client.create_container()
        logger.info("Connecté à Azure Blob Storage")
        return container_client
    except Exception as e:
        logger.error(f"Échec de la connexion à Azure Blob Storage: {str(e)}")
        return None

# Initialize blob service
blob_container = get_blob_service()

def upload_to_azure(file, filename):
    if not blob_container:
        raise Exception("Azure Blob Storage not configured correctly")
    
    try:
        blob_client = blob_container.get_blob_client(filename)
        blob_client.upload_blob(file, overwrite=True)
        return blob_client.url
    except Exception as e:
        logger.error(f"Erreur lors de l'upload du fichier: {str(e)}")
        raise

# Middleware to check MongoDB connection before each request
@app.before_request
def check_mongo_connection():
    global mongo_client, db, jobs_collection, candidates_collection, interviews_collection
    
    if request.path.startswith('/api/') and not request.path.startswith('/api/health'):
        if not mongo_client:
            try:
                mongo_client = get_mongo_client()
                db = mongo_client["recruitment_db"]
                jobs_collection = db["jobs"]
                candidates_collection = db["candidates"]
                interviews_collection = db["interviews"]
            except Exception as e:
                logger.error(f"MongoDB connection failed: {str(e)}")
                return jsonify({"error": "Database connection unavailable"}), 503

# Health check endpoint
@app.route("/api/health", methods=["GET"])
def health_check():
    health = {"status": "up", "services": {}}
    
    # Check MongoDB
    try:
        if mongo_client:
            mongo_client.admin.command('ping')
            health["services"]["mongodb"] = "up"
        else:
            health["services"]["mongodb"] = "down"
    except Exception:
        health["services"]["mongodb"] = "down"
        health["status"] = "degraded"
    
    # Check Azure
    if blob_container:
        health["services"]["azure_storage"] = "up"
    else:
        health["services"]["azure_storage"] = "down"
        health["status"] = "degraded"
    
    status_code = 200 if health["status"] == "up" else 503
    return jsonify(health), status_code

@app.route("/api/jobs", methods=["GET"])
def get_jobs():
    try:
        jobs = list(jobs_collection.find({}).sort("createdAt", -1))
        logger.debug(f"Jobs récupérés: {len(jobs)}")
        return jsonify(jobs)
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des jobs: {str(e)}")
        return jsonify({"error": f"Erreur serveur: {str(e)}"}), 500

@app.route("/api/jobs", methods=["POST"])
def add_job():
    try:
        job_data = request.get_json()
        job_data["createdAt"] = datetime.utcnow()
        result = jobs_collection.insert_one(job_data)
        job_data["_id"] = str(result.inserted_id)
        logger.info(f"Job ajouté avec ID: {job_data['_id']}")
        return jsonify(job_data), 201
    except Exception as e:
        logger.error(f"Erreur lors de l'ajout du job: {str(e)}")
        return jsonify({"error": str(e)}), 400

@app.route("/api/jobs/<job_id>", methods=["DELETE"])
def delete_job(job_id):
    try:
        # Validate ObjectId format
        if not ObjectId.is_valid(job_id):
            return jsonify({"error": "Invalid job ID format"}), 400
            
        result = jobs_collection.delete_one({"_id": ObjectId(job_id)})
        if result.deleted_count > 0:
            logger.info(f"Job supprimé: {job_id}")
            return jsonify({"message": "Job deleted successfully"}), 200
        logger.warning(f"Job non trouvé: {job_id}")
        return jsonify({"error": "Job not found"}), 404
    except Exception as e:
        logger.error(f"Erreur lors de la suppression du job: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/candidates", methods=["GET"])
def get_candidates():
    try:
        job_id = request.args.get("jobId")
        if not job_id:
            return jsonify({"error": "jobId is required"}), 400
            
        # Validate ObjectId format
        if not ObjectId.is_valid(job_id):
            return jsonify({"error": "Invalid job ID format"}), 400
            
        candidates = list(candidates_collection.find({"jobId": job_id}).sort("appliedDate", -1))
        logger.debug(f"Candidats récupérés pour job {job_id}: {len(candidates)}")
        return jsonify(candidates)
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des candidats: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/upload", methods=["POST"])
def upload_file():
    try:
        if not blob_container:
            return jsonify({"error": "Azure Blob Storage not configured"}), 503
            
        if "file" not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files["file"]
        if file.filename == '':
            return jsonify({"error": "Empty filename"}), 400
            
        filename = request.form.get("filename", file.filename)
        # Add timestamp to avoid overwriting files with same name
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        safe_filename = f"{timestamp}_{filename}"
        
        file_url = upload_to_azure(file.read(), safe_filename)
        logger.info(f"Fichier uploadé: {safe_filename}")
        return jsonify({"url": file_url}), 200
    except Exception as e:
        logger.error(f"Erreur lors de l'upload du fichier: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/candidates", methods=["POST"])
def add_candidate():
    try:
        candidate_data = request.get_json()
        
        # Validate required fields
        required_fields = ["name", "email", "jobId"]
        for field in required_fields:
            if field not in candidate_data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        # Validate jobId format
        if not ObjectId.is_valid(candidate_data["jobId"]):
            return jsonify({"error": "Invalid job ID format"}), 400
        
        candidate_data["appliedDate"] = datetime.utcnow()
        candidate_data["status"] = candidate_data.get("status", "Applied")
        
        result = candidates_collection.insert_one(candidate_data)
        candidate_data["_id"] = str(result.inserted_id)
        logger.info(f"Candidat ajouté avec ID: {candidate_data['_id']}")
        return jsonify(candidate_data), 201
    except Exception as e:
        logger.error(f"Erreur lors de l'ajout du candidat: {str(e)}")
        return jsonify({"error": str(e)}), 400

@app.route("/api/interviews", methods=["GET"])
def get_interviews():
    try:
        query = {}
        candidate_id = request.args.get("candidateId")
        if candidate_id:
            if not ObjectId.is_valid(candidate_id):
                return jsonify({"error": "Invalid candidate ID format"}), 400
            query["candidateId"] = ObjectId(candidate_id)
            
        job_id = request.args.get("jobId")
        if job_id:
            if not ObjectId.is_valid(job_id):
                return jsonify({"error": "Invalid job ID format"}), 400
            query["jobId"] = ObjectId(job_id)
            
        interviews = []
        for interview in interviews_collection.find(query).sort("date", 1):
            # Convert ObjectId to string for JSON serialization
            interview["_id"] = str(interview["_id"])
            
            # Convert ObjectIds for candidateId and jobId
            if "candidateId" in interview and isinstance(interview["candidateId"], ObjectId):
                interview["candidateId"] = str(interview["candidateId"])
                
                # Get candidate name
                candidate = candidates_collection.find_one(
                    {"_id": ObjectId(interview["candidateId"])},
                    {"name": 1}
                )
                interview["candidateName"] = candidate["name"] if candidate else "Unknown"
                
            if "jobId" in interview and isinstance(interview["jobId"], ObjectId):
                interview["jobId"] = str(interview["jobId"])

            interviews.append(interview)
        
        logger.debug(f"Entretiens récupérés: {len(interviews)}")
        return jsonify(interviews)
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des entretiens: {str(e)}")
        return jsonify({"error": f"Failed to fetch interviews: {str(e)}"}), 500

@app.route("/api/interviews", methods=["POST"])
def add_interview():
    try:
        interview_data = request.get_json()
        
        # Validate required fields
        required_fields = ["candidateId", "jobId", "date", "interviewType"]
        for field in required_fields:
            if field not in interview_data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        # Convert string IDs to ObjectId
        if "candidateId" in interview_data and isinstance(interview_data["candidateId"], str):
            if not ObjectId.is_valid(interview_data["candidateId"]):
                return jsonify({"error": "Invalid candidate ID format"}), 400
            interview_data["candidateId"] = ObjectId(interview_data["candidateId"])
            
        if "jobId" in interview_data and isinstance(interview_data["jobId"], str):
            if not ObjectId.is_valid(interview_data["jobId"]):
                return jsonify({"error": "Invalid job ID format"}), 400
            interview_data["jobId"] = ObjectId(interview_data["jobId"])
        
        # Parse date if string
        if "date" in interview_data and isinstance(interview_data["date"], str):
            try:
                interview_data["date"] = datetime.fromisoformat(interview_data["date"].replace('Z', '+00:00'))
            except ValueError:
                return jsonify({"error": "Invalid date format"}), 400
        
        interview_data["createdAt"] = datetime.utcnow()
        result = interviews_collection.insert_one(interview_data)
        
        # Convert back to strings for response
        interview_data["_id"] = str(result.inserted_id)
        interview_data["candidateId"] = str(interview_data["candidateId"])
        interview_data["jobId"] = str(interview_data["jobId"])
        
        logger.info(f"Entretien ajouté avec ID: {interview_data['_id']}")
        return jsonify(interview_data), 201
    except Exception as e:
        logger.error(f"Erreur lors de l'ajout de l'entretien: {str(e)}")
        return jsonify({"error": str(e)}), 400

@app.route("/api/candidates/<candidate_id>", methods=["PUT"])
def update_candidate(candidate_id):
    try:
        if not ObjectId.is_valid(candidate_id):
            return jsonify({"error": "Invalid candidate ID format"}), 400
            
        update_data = request.get_json()
        # Prevent changing immutable fields
        if "_id" in update_data:
            del update_data["_id"]
            
        update_data["updatedAt"] = datetime.utcnow()
        
        result = candidates_collection.update_one(
            {"_id": ObjectId(candidate_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            return jsonify({"error": "Candidate not found"}), 404
            
        # Get updated document
        updated_candidate = candidates_collection.find_one({"_id": ObjectId(candidate_id)})
        logger.info(f"Candidat mis à jour: {candidate_id}")
        return jsonify(updated_candidate)
    except Exception as e:
        logger.error(f"Erreur lors de la mise à jour du candidat: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)