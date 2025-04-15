from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from azure.storage.blob import BlobServiceClient
from bson import ObjectId
import os
from datetime import datetime, timezone
import logging
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# MongoDB Configuration
mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017/recruitment_db')  # Updated to use MONGO_URI
client = MongoClient(mongo_uri)
db = client['recruitment_db']

# Azure Blob Storage Configuration
AZURE_STORAGE_CONNECTION_STRING = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
AZURE_CONTAINER_NAME = os.getenv('AZURE_CONTAINER_NAME', 'blobbyy1')
# Initialize Azure Blob Storage clients
try:
    blob_service_client = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
    container_client = blob_service_client.get_container_client(AZURE_CONTAINER_NAME)
    
    # Check if container exists, create if not
    try:
        container_client.get_container_properties()
        logger.info(f"Connected to existing container '{AZURE_CONTAINER_NAME}'")
    except Exception as e:
        if "ContainerNotFound" in str(e):
            logger.info(f"Container '{AZURE_CONTAINER_NAME}' not found, creating...")
            container_client.create_container()
            logger.info(f"Container '{AZURE_CONTAINER_NAME}' created successfully")
        else:
            raise Exception(f"Failed to access container: {str(e)}")

except Exception as e:
    logger.error(f"Azure Blob Storage connection error: {str(e)}")
    raise

# Utility function to upload a file to Azure Blob Storage
def upload_to_azure(file_content, file_name):
    try:
        blob_client = container_client.get_blob_client(file_name)
        blob_client.upload_blob(file_content, overwrite=True)
        logger.info(f"File '{file_name}' uploaded successfully to Azure")
        return blob_client.url
    except Exception as e:
        logger.error(f"Error uploading to Azure: {str(e)}")
        raise

# Routes for jobs
@app.route('/api/jobs', methods=['GET'])
def get_jobs():
    try:
        jobs = list(db.jobs.find())
        for job in jobs:
            job['_id'] = str(job['_id'])
        return jsonify(jobs), 200
    except Exception as e:
        logger.error(f"Error retrieving jobs: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/jobs', methods=['POST'])
def create_job():
    try:
        job_data = request.json
        if not job_data or 'title' not in job_data:
            return jsonify({'error': 'Job title is required'}), 400
        job_data['created_at'] = datetime.now(timezone.utc)
        result = db.jobs.insert_one(job_data)
        return jsonify({'message': 'Job created successfully', 'id': str(result.inserted_id)}), 201
    except Exception as e:
        logger.error(f"Error creating job: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/jobs/<job_id>', methods=['GET'])
def get_job(job_id):
    try:
        if not ObjectId.is_valid(job_id):
            return jsonify({'error': 'Invalid job ID'}), 400
        job = db.jobs.find_one({'_id': ObjectId(job_id)})
        if not job:
            return jsonify({'error': 'Job not found'}), 404
        job['_id'] = str(job['_id'])
        return jsonify(job), 200
    except Exception as e:
        logger.error(f"Error retrieving job: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/jobs/<job_id>', methods=['PUT'])
def update_job(job_id):
    try:
        if not ObjectId.is_valid(job_id):
            return jsonify({'error': 'Invalid job ID'}), 400
        job_data = request.json
        if not job_data:
            return jsonify({'error': 'No data provided'}), 400
        result = db.jobs.update_one(
            {'_id': ObjectId(job_id)},
            {'$set': job_data}
        )
        if result.modified_count == 0:
            return jsonify({'error': 'Job not found'}), 404
        return jsonify({'message': 'Job updated successfully'}), 200
    except Exception as e:
        logger.error(f"Error updating job: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/jobs/<job_id>', methods=['DELETE'])
def delete_job(job_id):
    try:
        if not ObjectId.is_valid(job_id):
            return jsonify({'error': 'Invalid job ID'}), 400
        result = db.jobs.delete_one({'_id': ObjectId(job_id)})
        if result.deleted_count == 0:
            return jsonify({'error': 'Job not found'}), 404
        return jsonify({'message': 'Job deleted successfully'}), 200
    except Exception as e:
        logger.error(f"Error deleting job: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Routes for candidates
@app.route('/api/candidates', methods=['GET'])
def get_candidates():
    try:
        job_id = request.args.get('jobId')
        query = {}
        if job_id:
            if not ObjectId.is_valid(job_id):
                return jsonify({'error': 'Invalid job ID'}), 400
            query['jobId'] = ObjectId(job_id)
        
        candidates = list(db.candidates.find(query))
        for candidate in candidates:
            candidate['_id'] = str(candidate['_id'])
            candidate['jobId'] = str(candidate['jobId'])
        return jsonify(candidates), 200
    except Exception as e:
        logger.error(f"Error retrieving candidates: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/candidates', methods=['POST'])
def create_candidate():
    try:
        data = request.form
        files = request.files

        # Required fields validation
        required_fields = ["name", "email", "jobId"]
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Field '{field}' is required"}), 400

        # Verify jobId exists
        if not ObjectId.is_valid(data["jobId"]):
            return jsonify({'error': 'Invalid job ID'}), 400
        if not db.jobs.find_one({"_id": ObjectId(data["jobId"])}):
            return jsonify({"error": "Job not found"}), 404

        # Handle resume and cover letter files
        resume_url = ""
        cover_letter_url = ""
        if "resume" in files:
            resume = files["resume"]
            if resume.mimetype not in ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]:
                return jsonify({"error": "Resume must be PDF, DOC, or DOCX"}), 400
            resume_filename = f"resumes/{data['jobId']}/{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{resume.filename}"
            resume_url = upload_to_azure(resume.read(), resume_filename)
        else:
            return jsonify({"error": "Resume is required"}), 400

        if "coverLetter" in data and data["coverLetter"].strip():
            cover_letter_content = data["coverLetter"].encode('utf-8')
            cover_letter_filename = f"letters/{data['jobId']}/{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_cover_letter.txt"
            cover_letter_url = upload_to_azure(cover_letter_content, cover_letter_filename)
        elif "coverLetter" in files:
            cover_letter = files["coverLetter"]
            if cover_letter.mimetype not in ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"]:
                return jsonify({"error": "Cover letter must be PDF, DOC, DOCX, or TXT"}), 400
            cover_letter_filename = f"letters/{data['jobId']}/{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{cover_letter.filename}"
            cover_letter_url = upload_to_azure(cover_letter.read(), cover_letter_filename)

        # Create candidate
        candidate_data = {
            "name": data["name"],
            "email": data["email"],
            "phone": data.get("phone", ""),
            "jobId": ObjectId(data["jobId"]),
            "status": data.get("status", "applied"),
            "resumeUrl": resume_url,
            "coverLetterUrl": cover_letter_url,
            "appliedDate": datetime.now(timezone.utc)
        }

        result = db.candidates.insert_one(candidate_data)
        candidate_data["_id"] = str(result.inserted_id)
        candidate_data["jobId"] = str(candidate_data["jobId"])

        return jsonify({'message': 'Candidate created successfully', 'candidate': candidate_data}), 201
    except Exception as e:
        logger.error(f"Error creating candidate: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/candidates/<candidate_id>', methods=['PUT'])
def update_candidate(candidate_id):
    try:
        if not ObjectId.is_valid(candidate_id):
            return jsonify({'error': 'Invalid candidate ID'}), 400
        
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        if "status" in data:
            valid_statuses = ["applied", "invited", "interviewed", "accepted", "rejected"]
            if data["status"] not in valid_statuses:
                return jsonify({"error": f"Invalid status. Accepted values: {valid_statuses}"}), 400

        update_data = {field: data[field] for field in ["name", "email", "phone", "status", "resumeUrl", "coverLetterUrl", "feedback"] if field in data}
        
        if not update_data:
            return jsonify({'error': 'No updates specified'}), 400

        result = db.candidates.update_one(
            {'_id': ObjectId(candidate_id)},
            {'$set': update_data}
        )
        if result.modified_count == 0:
            return jsonify({'error': 'Candidate not found'}), 404

        updated_candidate = db.candidates.find_one({'_id': ObjectId(candidate_id)})
        updated_candidate['_id'] = str(updated_candidate['_id'])
        updated_candidate['jobId'] = str(updated_candidate['jobId'])

        return jsonify({'message': 'Candidate updated successfully', 'candidate': updated_candidate}), 200
    except Exception as e:
        logger.error(f"Error updating candidate: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/candidates/<candidate_id>', methods=['DELETE'])
def delete_candidate(candidate_id):
    try:
        if not ObjectId.is_valid(candidate_id):
            return jsonify({'error': 'Invalid candidate ID'}), 400
        
        result = db.candidates.delete_one({'_id': ObjectId(candidate_id)})
        if result.deleted_count == 0:
            return jsonify({'error': 'Candidate not found'}), 404
        return jsonify({'message': 'Candidate deleted successfully'}), 200
    except Exception as e:
        logger.error(f"Error deleting candidate: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Routes for interviews
@app.route('/api/interviews', methods=['GET'])
def get_interviews():
    try:
        interviews = list(db.interviews.find())
        for interview in interviews:
            interview['_id'] = str(interview['_id'])
            interview['candidateId'] = str(interview['candidateId'])
            interview['jobId'] = str(interview['jobId'])
        return jsonify(interviews), 200
    except Exception as e:
        logger.error(f"Error retrieving interviews: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/interviews', methods=['POST'])
def create_interview():
    try:
        interview_data = request.json
        interview_data['created_at'] = datetime.now(timezone.utc)

        if not ObjectId.is_valid(interview_data.get('candidateId')):
            return jsonify({'error': 'Invalid candidate ID'}), 400
        if not ObjectId.is_valid(interview_data.get('jobId')):
            return jsonify({'error': 'Invalid job ID'}), 400

        result = db.interviews.insert_one(interview_data)
        return jsonify({'message': 'Interview created successfully', 'id': str(result.inserted_id)}), 201
    except Exception as e:
        logger.error(f"Error creating interview: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/interviews/<interview_id>', methods=['PUT'])
def update_interview(interview_id):
    try:
        if not ObjectId.is_valid(interview_id):
            return jsonify({'error': 'Invalid interview ID'}), 400
        
        interview_data = request.json
        result = db.interviews.update_one(
            {'_id': ObjectId(interview_id)},
            {'$set': interview_data}
        )
        if result.modified_count == 0:
            return jsonify({'error': 'Interview not found'}), 404
        return jsonify({'message': 'Interview updated successfully'}), 200
    except Exception as e:
        logger.error(f"Error updating interview: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Route for additional file uploads (videos and reports)
@app.route('/api/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        file_type = request.form.get('type')  # 'video' or 'report'
        candidate_id = request.form.get('candidateId')
        
        if not file or not file_type or not candidate_id:
            return jsonify({'error': 'Missing required fields'}), 400
        
        if not ObjectId.is_valid(candidate_id):
            return jsonify({'error': 'Invalid candidate ID'}), 400
        
        timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
        file_extension = os.path.splitext(file.filename)[1]
        blob_name = f"{candidate_id}/{file_type}_{timestamp}{file_extension}"
        
        url = upload_to_azure(file.read(), blob_name)
        
        update_field = 'videoUrl' if file_type == 'video' else 'reportUrl'
        db.candidates.update_one(
            {'_id': ObjectId(candidate_id)},
            {'$set': {update_field: url}}
        )
        
        return jsonify({
            'message': 'File uploaded successfully',
            'url': url
        }), 200
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Enable debug mode based on environment variable
    debug = os.getenv('DEBUG', 'False').lower() in ('true', '1', 't')
    app.run(debug=debug)