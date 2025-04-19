from flask import Flask, request, jsonify
from flask_pymongo import PyMongo
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
import os
from datetime import datetime
from bson import ObjectId
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Configuration
app.config["MONGO_URI"] = "mongodb://localhost:27017/recruitment_db"
app.config["JWT_SECRET_KEY"] = "super-secret-key"  # Changez ceci en production
app.config["UPLOAD_FOLDER"] = "uploads"
app.config["ALLOWED_EXTENSIONS"] = {"pdf", "doc", "docx"}

mongo = PyMongo(app)
jwt = JWTManager(app)

# Créer le dossier d'upload s'il n'existe pas
if not os.path.exists(app.config["UPLOAD_FOLDER"]):
    os.makedirs(app.config["UPLOAD_FOLDER"])

# Vérifier les extensions de fichiers
def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in app.config["ALLOWED_EXTENSIONS"]

# Routes pour l'authentification
@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    role = data.get("role")  # "candidate" ou "recruiter"

    if not all([name, email, password, role]):
        return jsonify({"error": "Tous les champs sont requis"}), 400

    if mongo.db.users.find_one({"email": email}):
        return jsonify({"error": "L'email existe déjà"}), 400

    hashed_password = generate_password_hash(password)
    user_id = mongo.db.users.insert_one({
        "name": name,
        "email": email,
        "password": hashed_password,
        "role": role
    }).inserted_id

    if role == "candidate":
        mongo.db.candidates.insert_one({"userId": user_id, "cvPath": ""})
    elif role == "recruiter":
        mongo.db.recruiters.insert_one({"userId": user_id, "offers": []})

    return jsonify({"message": "Utilisateur enregistré avec succès"}), 201

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    user = mongo.db.users.find_one({"email": email})
    if not user or not check_password_hash(user["password"], password):
        return jsonify({"error": "Email ou mot de passe incorrect"}), 401

    access_token = create_access_token(identity=str(user["_id"]))
    return jsonify({"token": access_token, "role": user["role"]}), 200

# Routes pour les offres
@app.route("/api/offres-emploi", methods=["GET"])
def get_offres():
    offres = mongo.db.offers.find()
    result = []
    for offre in offres:
        result.append({
            "_id": str(offre["_id"]),
            "titre": offre["title"],
            "entreprise": {"nom": offre["company"]},
            "localisation": offre["location"],
            "description": offre["description"],
            "competences_requises": offre.get("requiredSkills", []),
            "created_at": offre["createdAt"].isoformat(),
            "salaire_min": offre.get("salaryMin", 0),
            "status": offre["status"]
        })
    return jsonify(result), 200

@app.route("/api/offres-emploi", methods=["POST"])
@jwt_required()
def create_offre():
    user_id = get_jwt_identity()
    user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
    if user["role"] != "recruiter":
        return jsonify({"error": "Seuls les recruteurs peuvent créer des offres"}), 403

    data = request.get_json()
    title = data.get("title")
    company = data.get("company")
    location = data.get("location")
    description = data.get("description")
    required_skills = data.get("requiredSkills", [])
    salary_min = data.get("salaryMin", 0)
    status = data.get("status", "open")

    if not all([title, company, location, description]):
        return jsonify({"error": "Champs requis manquants"}), 400

    offer_id = mongo.db.offers.insert_one({
        "title": title,
        "company": company,
        "location": location,
        "description": description,
        "requiredSkills": required_skills,
        "salaryMin": salary_min,
        "status": status,
        "createdAt": datetime.utcnow(),
        "recruiterId": ObjectId(user_id),
        "questions": data.get("questions", []),
        "applications": []
    }).inserted_id

    mongo.db.recruiters.update_one(
        {"userId": ObjectId(user_id)},
        {"$push": {"offers": offer_id}}
    )

    return jsonify({"message": "Offre créée avec succès", "offerId": str(offer_id)}), 201

@app.route("/api/offres-emploi/<id>", methods=["GET"])
def get_offre_by_id(id):
    try:
        offre = mongo.db.offers.find_one({"_id": ObjectId(id)})
        if not offre:
            return jsonify({"error": "Offre introuvable"}), 404

        return jsonify({
            "_id": str(offre["_id"]),
            "titre": offre["title"],
            "entreprise": {"nom": offre["company"]},
            "localisation": offre["location"],
            "description": offre["description"],
            "competences_requises": offre.get("requiredSkills", []),
            "salaire_min": offre.get("salaryMin", 0),
            "created_at": offre["createdAt"].isoformat(),
            "status": offre["status"]
        }), 200
    except:
        return jsonify({"error": "ID invalide"}), 400

# Routes pour les candidatures
@app.route("/api/candidatures", methods=["POST"])
@jwt_required()
def submit_candidature():
    user_id = get_jwt_identity()
    user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
    if user["role"] != "candidate":
        return jsonify({"error": "Seuls les candidats peuvent postuler"}), 403

    if "cv" not in request.files:
        return jsonify({"error": "CV requis"}), 400

    cv_file = request.files["cv"]
    if not cv_file or not allowed_file(cv_file.filename):
        return jsonify({"error": "Fichier CV invalide (PDF, DOC, DOCX requis)"}), 400

    offre_id = request.form.get("offre_id")
    lettre_motivation = request.form.get("lettre_motivation")

    if not offre_id or not lettre_motivation:
        return jsonify({"error": "Offre ID et lettre de motivation requis"}), 400

    offre = mongo.db.offers.find_one({"_id": ObjectId(offre_id)})
    if not offre:
        return jsonify({"error": "Offre introuvable"}), 404

    # Sauvegarder le CV
    filename = secure_filename(f"{user_id}_{cv_file.filename}")
    cv_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    cv_file.save(cv_path)

    # Créer la candidature
    application_id = mongo.db.applications.insert_one({
        "candidateId": ObjectId(user_id),
        "offerId": ObjectId(offre_id),
        "status": "pending",
        "cvPath": cv_path,
        "lettreMotivation": lettre_motivation,
        "createdAt": datetime.utcnow()
    }).inserted_id

    # Mettre à jour l'offre
    mongo.db.offers.update_one(
        {"_id": ObjectId(offre_id)},
        {"$push": {"applications": application_id}}
    )

    # Mettre à jour le candidat
    mongo.db.candidates.update_one(
        {"userId": ObjectId(user_id)},
        {"$push": {"applications": application_id}}
    )

    return jsonify({"message": "Candidature soumise avec succès", "applicationId": str(application_id)}), 201

@app.route("/api/candidatures/<offer_id>", methods=["GET"])
@jwt_required()
def get_candidatures(offer_id):
    user_id = get_jwt_identity()
    user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
    if user["role"] != "recruiter":
        return jsonify({"error": "Seuls les recruteurs peuvent consulter les candidatures"}), 403

    try:
        applications = mongo.db.applications.find({"offerId": ObjectId(offer_id)})
        result = []
        for app in applications:
            candidate = mongo.db.users.find_one({"_id": app["candidateId"]})
            result.append({
                "id": str(app["_id"]),
                "candidate": {
                    "name": candidate["name"],
                    "email": candidate["email"]
                },
                "status": app["status"],
                "cvPath": app["cvPath"],
                "lettreMotivation": app["lettreMotivation"],
                "createdAt": app["createdAt"].isoformat()
            })
        return jsonify(result), 200
    except:
        return jsonify({"error": "ID invalide"}), 400

@app.route("/api/candidatures/<application_id>/accept", methods=["POST"])
@jwt_required()
def accept_candidature(application_id):
    user_id = get_jwt_identity()
    user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
    if user["role"] != "recruiter":
        return jsonify({"error": "Seuls les recruteurs peuvent accepter les candidatures"}), 403

    try:
        mongo.db.applications.update_one(
            {"_id": ObjectId(application_id)},
            {"$set": {"status": "accepted"}}
        )
        return jsonify({"message": "Candidature acceptée"}), 200
    except:
        return jsonify({"error": "ID invalide"}), 400

@app.route("/api/candidatures/<application_id>/reject", methods=["POST"])
@jwt_required()
def reject_candidature(application_id):
    user_id = get_jwt_identity()
    user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
    if user["role"] != "recruiter":
        return jsonify({"error": "Seuls les recruteurs peuvent rejeter les candidatures"}), 403

    try:
        mongo.db.applications.update_one(
            {"_id": ObjectId(application_id)},
            {"$set": {"status": "rejected"}}
        )
        return jsonify({"message": "Candidature rejetée"}), 200
    except:
        return jsonify({"error": "ID invalide"}), 400

# Routes pour les entretiens
@app.route("/api/questions", methods=["GET"])
def get_questions():
    questions = [
        {"id": "1", "text": "Comment implémenter une architecture microservices en .NET ?", "type": "technical"},
        {"id": "2", "text": "Expliquez un projet où vous avez utilisé une base de données NoSQL.", "type": "technical"}
    ]
    return jsonify(questions), 200

@app.route("/api/save-recording", methods=["POST"])
@jwt_required()
def save_recording():
    user_id = get_jwt_identity()
    user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
    if user["role"] != "candidate":
        return jsonify({"error": "Seuls les candidats peuvent sauvegarder des enregistrements"}), 403

    data = request.get_json()
    offer_id = data.get("offerId")
    video_path = data.get("videoPath")  # Simulé, à remplacer par un vrai upload
    transcriptions = data.get("transcriptions", [])

    interview_id = mongo.db.interviews.insert_one({
        "offerId": ObjectId(offer_id),
        "candidateId": ObjectId(user_id),
        "videoPath": video_path,
        "transcriptions": transcriptions,
        "score": data.get("score", 0),
        "report": {
            "sentiment": data.get("sentiment", "neutral"),
            "coherence": data.get("coherence", 0),
            "relevance": data.get("relevance", 0)
        },
        "createdAt": datetime.utcnow()
    }).inserted_id

    # Associer l'interview à l'application
    application = mongo.db.applications.find_one({
        "candidateId": ObjectId(user_id),
        "offerId": ObjectId(offer_id)
    })
    if application:
        mongo.db.applications.update_one(
            {"_id": application["_id"]},
            {"$set": {"interview": interview_id}}
        )

    return jsonify({"message": "Entretien sauvegardé", "interviewId": str(interview_id)}), 201

@app.route("/api/recordings/<offer_id>", methods=["GET"])
@jwt_required()
def get_recordings(offer_id):
    user_id = get_jwt_identity()
    user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
    if user["role"] != "recruiter":
        return jsonify({"error": "Seuls les recruteurs peuvent consulter les enregistrements"}), 403

    try:
        interviews = mongo.db.interviews.find({"offerId": ObjectId(offer_id)})
        result = []
        for interview in interviews:
            candidate = mongo.db.users.find_one({"_id": interview["candidateId"]})
            result.append({
                "id": str(interview["_id"]),
                "candidate": {
                    "name": candidate["name"],
                    "email": candidate["email"]
                },
                "videoPath": interview["videoPath"],
                "transcriptions": interview["transcriptions"],
                "score": interview["score"],
                "report": interview["report"],
                "createdAt": interview["createdAt"].isoformat()
            })
        return jsonify(result), 200
    except:
        return jsonify({"error": "ID invalide"}), 400

if __name__ == "__main__":
    app.run(debug=True, port=5000)