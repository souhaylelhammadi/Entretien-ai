import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime
from functools import wraps
from werkzeug.utils import secure_filename
import jwt

app = Flask(__name__)
CORS(app)

# Configuration
app.config['SECRET_KEY'] = 'your-secret-key'  # Replace with a secure key
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['ALLOWED_EXTENSIONS'] = {'webm'}

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# MongoDB setup
client = MongoClient('mongodb://localhost:27017')
db = client['interview_db']
questions_collection = db['questions']
recordings_collection = db['recordings']

# Initialize questions if collection is empty
def init_db():
    if questions_collection.count_documents({}) == 0:
        sample_questions = [
            {"text": "Expliquez comment fonctionne une requête HTTP."},
            {"text": "Décrivez un algorithme de tri que vous connaissez."},
            {"text": "Comment gérez-vous les erreurs dans une application Python ?"}
        ]
        questions_collection.insert_many(sample_questions)
        print("Sample questions inserted into MongoDB")

init_db()

# JWT authentication decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'success': False, 'error': 'Token manquant'}), 401
        if token.startswith('Bearer '):
            token = token[7:]
        try:
            jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        except jwt.InvalidTokenError:
            return jsonify({'success': False, 'error': 'Token invalide'}), 401
        return f(*args, **kwargs)
    return decorated

# Helper function to check allowed file extensions
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

# API Endpoints
@app.route('/api/questions', methods=['GET'])
@token_required
def get_questions():
    try:
        questions = [q['text'] for q in questions_collection.find({}, {'text': 1, '_id': 0})]
        return jsonify({'success': True, 'questions': questions})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/save-recording', methods=['POST'])
@token_required
def save_recording():
    try:
        application_id = request.form.get('applicationId')
        if not application_id:
            return jsonify({'success': False, 'error': 'applicationId requis'}), 400

        # Handle video file
        video_file = request.files.get('video')
        video_path = None
        if video_file and allowed_file(video_file.filename):
            filename = secure_filename(f"interview_{datetime.now().isoformat()}.webm")
            video_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            video_file.save(video_path)

        # Handle recordings data
        recordings = []
        i = 0
        while f'transcript_{i}' in request.form:
            recordings.append({
                'application_id': application_id,
                'video_path': video_path,
                'transcript': request.form.get(f'transcript_{i}'),
                'question_index': int(request.form.get(f'questionIndex_{i}')),
                'question': request.form.get(f'question_{i}'),
                'timestamp': request.form.get(f'timestamp_{i}')
            })
            i += 1

        # Save to MongoDB
        if recordings:
            recordings_collection.insert_many(recordings)

        return jsonify({'success': True, 'message': 'Enregistrement sauvegardé'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/recordings', methods=['GET'])
@token_required
def fetch_recordings():
    try:
        application_id = request.args.get('applicationId')
        if not application_id:
            return jsonify({'success': False, 'error': 'applicationId requis'}), 400

        recordings = [
            {
                'questionIndex': rec['question_index'],
                'transcript': rec['transcript'],
                'videoUrl': rec['video_path'] if rec.get('video_path') else None,
                'timestamp': rec['timestamp'],
                'question': rec['question']
            }
            for rec in recordings_collection.find({'application_id': application_id})
        ]

        return jsonify({'success': True, 'data': recordings})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

