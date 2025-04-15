from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timezone
import os
from auth import init_auth, register_recruiter, login_recruiter, get_profile

app = Flask(__name__)
CORS(app, supports_credentials=True)
# Connexion à MongoDB
client = MongoClient("mongodb://localhost:27017/")
db = client["recruitment_db"]
jobs_collection = db["jobs"]
candidates_collection = db["candidates"]
interviews_collection = db["interviews"]
accepted_offers_collection = db["accepted_offers"]

# Fonction pour convertir ObjectId en string
def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    if doc and "jobId" in doc:
        doc["jobId"] = str(doc["jobId"])
    if doc and "candidateId" in doc:
        doc["candidateId"] = str(doc["candidateId"])
    return doc

# --- Routes pour Jobs ---
@app.route("/api/jobs", methods=["GET"])
def get_jobs():
    try:
        jobs = list(jobs_collection.find())
        serialized_jobs = [serialize_doc(job) for job in jobs]
        return jsonify(serialized_jobs), 200
    except Exception as e:
        print(f"Erreur serveur: {e}")
        return jsonify({"error": "Erreur lors de la récupération des offres."}), 500

@app.route("/api/jobs/<string:job_id>", methods=["GET"])
def get_job_by_id(job_id):
    try:
        if not ObjectId.is_valid(job_id):
            return jsonify({"error": "ID invalide"}), 400
        job = jobs_collection.find_one({"_id": ObjectId(job_id)})
        if job:
            return jsonify(serialize_doc(job)), 200
        return jsonify({"error": "Offre non trouvée"}), 404
    except Exception as e:
        print(f"Erreur lors de la recherche: {e}")
        return jsonify({"error": "Erreur lors de la récupération de l’offre"}), 400

@app.route("/api/jobs", methods=["POST"])
def create_job():
    try:
        data = request.json
        required_fields = ["title", "department", "location", "requirements"]
        if not data or not all(field in data for field in required_fields):
            return jsonify({"error": f"Champs requis manquants: {required_fields}"}), 400
        
        data["created_at"] = datetime.now(timezone.utc)
        result = jobs_collection.insert_one(data)
        return jsonify({"message": "Offre créée", "id": str(result.inserted_id)}), 201
    except Exception as e:
        print(f"Erreur création offre: {e}")
        return jsonify({"error": "Erreur lors de la création de l’offre."}), 500

@app.route("/api/jobs/<string:job_id>", methods=["PUT"])
def update_job(job_id):
    try:
        if not ObjectId.is_valid(job_id):
            return jsonify({"error": "ID invalide"}), 400
        data = request.json
        if not data:
            return jsonify({"error": "Aucune donnée fournie"}), 400
        data["updated_at"] = datetime.now(timezone.utc)
        result = jobs_collection.update_one({"_id": ObjectId(job_id)}, {"$set": data})
        if result.matched_count:
            return jsonify({"message": "Offre mise à jour"}), 200
        return jsonify({"error": "Offre non trouvée"}), 404
    except Exception as e:
        print(f"Erreur mise à jour: {e}")
        return jsonify({"error": "Erreur lors de la mise à jour"}), 500

@app.route("/api/jobs/<string:job_id>", methods=["DELETE"])
def delete_job(job_id):
    try:
        if not ObjectId.is_valid(job_id):
            return jsonify({"error": "ID invalide"}), 400
        result = jobs_collection.delete_one({"_id": ObjectId(job_id)})
        if result.deleted_count:
            return jsonify({"message": "Offre supprimée"}), 200
        return jsonify({"error": "Offre non trouvée"}), 404
    except Exception as e:
        print(f"Erreur suppression: {e}")
        return jsonify({"error": "Erreur lors de la suppression"}), 500

# --- Routes pour Candidates ---
@app.route("/api/candidates", methods=["GET"])
def get_candidates():
    try:
        job_id = request.args.get("jobId")
        query = {}
        if job_id:
            if not ObjectId.is_valid(job_id):
                return jsonify({"error": "ID de job invalide"}), 400
            query["jobId"] = ObjectId(job_id)
        candidates = list(candidates_collection.find(query))
        serialized_candidates = [serialize_doc(candidate) for candidate in candidates]
        return jsonify(serialized_candidates), 200
    except Exception as e:
        print(f"Erreur récupération candidats: {e}")
        return jsonify({"error": "Erreur lors de la récupération des candidats"}), 500

@app.route("/api/candidates", methods=["POST"])
def create_candidate():
    try:
        data = request.form
        files = request.files
        required_fields = ["name", "email", "jobId"]
        if not all(field in data for field in required_fields):
            return jsonify({"error": f"Champs requis manquants: {required_fields}"}), 400

        job_id = data["jobId"]
        if not ObjectId.is_valid(job_id):
            return jsonify({"error": "ID de job invalide"}), 400
        if not jobs_collection.find_one({"_id": ObjectId(job_id)}):
            return jsonify({"error": "Offre non trouvée"}), 404

        # Simuler les URLs des fichiers sans Azure
        resume_url = ""
        cover_letter_url = ""
        if "resume" in files:
            resume = files["resume"]
            allowed_mimetypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
            if resume.mimetype not in allowed_mimetypes:
                return jsonify({"error": "Le CV doit être un PDF, DOC ou DOCX"}), 400
            resume_url = f"placeholder/resumes/{job_id}/{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{resume.filename}"
        
        if "coverLetter" in files:
            cover_letter = files["coverLetter"]
            allowed_mimetypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"]
            if cover_letter.mimetype not in allowed_mimetypes:
                return jsonify({"error": "La lettre doit être un PDF, DOC, DOCX ou TXT"}), 400
            cover_letter_url = f"placeholder/letters/{job_id}/{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{cover_letter.filename}"
        elif "coverLetter" in data and data["coverLetter"].strip():
            cover_letter_url = f"placeholder/letters/{job_id}/{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_cover_letter.txt"

        candidate_data = {
            "name": data["name"],
            "email": data["email"],
            "phone": data.get("phone", ""),
            "jobId": ObjectId(job_id),
            "status": data.get("status", "applied"),
            "resumeUrl": resume_url,
            "coverLetterUrl": cover_letter_url,
            "appliedDate": datetime.now(timezone.utc)
        }
        result = candidates_collection.insert_one(candidate_data)
        return jsonify({
            "message": "Candidat créé",
            "candidate": serialize_doc({**candidate_data, "_id": str(result.inserted_id)})
        }), 201
    except Exception as e:
        print(f"Erreur création candidat: {e}")
        return jsonify({"error": "Erreur lors de la création du candidat"}), 500

@app.route("/api/candidates/<string:candidate_id>", methods=["PUT"])
def update_candidate(candidate_id):
    try:
        if not ObjectId.is_valid(candidate_id):
            return jsonify({"error": "ID invalide"}), 400
        data = request.json
        if not data:
            return jsonify({"error": "Aucune donnée fournie"}), 400

        valid_statuses = ["applied", "invited", "interviewed", "accepted", "rejected"]
        if "status" in data and data["status"] not in valid_statuses:
            return jsonify({"error": f"Statut invalide. Valeurs acceptées: {valid_statuses}"}), 400

        if "status" in data and data["status"] == "accepted":
            candidate = candidates_collection.find_one({"_id": ObjectId(candidate_id)})
            if not candidate:
                return jsonify({"error": "Candidat non trouvé"}), 404
            job = jobs_collection.find_one({"_id": candidate["jobId"]})
            if not job:
                return jsonify({"error": "Offre associée non trouvée"}), 404
            
            existing_offer = accepted_offers_collection.find_one({"candidateId": ObjectId(candidate_id)})
            if not existing_offer:
                accepted_offer = {
                    "candidateId": ObjectId(candidate_id),
                    "jobId": candidate["jobId"],
                    "candidateName": candidate["name"],
                    "candidateEmail": candidate["email"],
                    "jobTitle": job["title"],
                    "department": job["department"],
                    "company": job.get("company", ""),
                    "location": job["location"],
                    "requirements": job["requirements"],
                    "acceptedAt": datetime.now(timezone.utc),
                    "status": "pending_interview"
                }
                accepted_offers_collection.insert_one(accepted_offer)

        update_data = {k: v for k, v in data.items() if k in ["name", "email", "phone", "status", "resumeUrl", "coverLetterUrl", "feedback"]}
        if not update_data:
            return jsonify({"error": "Aucune mise à jour spécifiée"}), 400
        
        update_data["updatedAt"] = datetime.now(timezone.utc)
        result = candidates_collection.update_one({"_id": ObjectId(candidate_id)}, {"$set": update_data})
        if result.modified_count:
            updated_candidate = candidates_collection.find_one({"_id": ObjectId(candidate_id)})
            return jsonify({
                "message": "Candidat mis à jour",
                "candidate": serialize_doc(updated_candidate)
            }), 200
        return jsonify({"error": "Candidat non trouvé ou aucune modification"}), 404
    except Exception as e:
        print(f"Erreur mise à jour candidat: {e}")
        return jsonify({"error": "Erreur lors de la mise à jour"}), 500

@app.route("/api/candidates/<string:candidate_id>", methods=["DELETE"])
def delete_candidate(candidate_id):
    try:
        if not ObjectId.is_valid(candidate_id):
            return jsonify({"error": "ID invalide"}), 400
        result = candidates_collection.delete_one({"_id": ObjectId(candidate_id)})
        if result.deleted_count:
            return jsonify({"message": "Candidat supprimé"}), 200
        return jsonify({"error": "Candidat non trouvé"}), 404
    except Exception as e:
        print(f"Erreur suppression candidat: {e}")
        return jsonify({"error": "Erreur lors de la suppression"}), 500

# --- Routes pour Interviews ---
@app.route("/api/interviews", methods=["GET"])
def get_interviews():
    try:
        interviews = list(interviews_collection.find())
        serialized_interviews = [serialize_doc(interview) for interview in interviews]
        return jsonify(serialized_interviews), 200
    except Exception as e:
        print(f"Erreur récupération entretiens: {e}")
        return jsonify({"error": "Erreur lors de la récupération des entretiens"}), 500

@app.route("/api/interviews", methods=["POST"])
def create_interview():
    try:
        data = request.json
        required_fields = ["candidateId", "jobId", "interviewDate"]
        if not data or not all(field in data for field in required_fields):
            return jsonify({"error": f"Champs requis manquants: {required_fields}"}), 400

        if not ObjectId.is_valid(data["candidateId"]) or not ObjectId.is_valid(data["jobId"]):
            return jsonify({"error": "ID de candidat ou de job invalide"}), 400

        try:
            data["interviewDate"] = datetime.fromisoformat(data["interviewDate"].replace("Z", "+00:00"))
        except ValueError:
            return jsonify({"error": "Format de date d’entretien invalide (ISO 8601 attendu)"}), 400

        data["created_at"] = datetime.now(timezone.utc)
        result = interviews_collection.insert_one(data)
        return jsonify({"message": "Entretien créé", "id": str(result.inserted_id)}), 201
    except Exception as e:
        print(f"Erreur création entretien: {e}")
        return jsonify({"error": "Erreur lors de la création de l’entretien"}), 500

@app.route("/api/interviews/<string:interview_id>", methods=["PUT"])
def update_interview(interview_id):
    try:
        if not ObjectId.is_valid(interview_id):
            return jsonify({"error": "ID invalide"}), 400
        data = request.json
        if not data:
            return jsonify({"error": "Aucune donnée fournie"}), 400

        if "interviewDate" in data:
            try:
                data["interviewDate"] = datetime.fromisoformat(data["interviewDate"].replace("Z", "+00:00"))
            except ValueError:
                return jsonify({"error": "Format de date d’entretien invalide (ISO 8601 attendu)"}), 400

        data["updated_at"] = datetime.now(timezone.utc)
        result = interviews_collection.update_one({"_id": ObjectId(interview_id)}, {"$set": data})
        if result.modified_count:
            return jsonify({"message": "Entretien mis à jour"}), 200
        return jsonify({"error": "Entretien non trouvé ou aucune modification"}), 404
    except Exception as e:
        print(f"Erreur mise à jour entretien: {e}")
        return jsonify({"error": "Erreur lors de la mise à jour"}), 500

@app.route("/api/accepted-offers", methods=["GET"])
def get_accepted_offers():
    try:
        candidate_email = request.args.get("email")
        if not candidate_email:
            return jsonify({"error": "Email du candidat requis"}), 400

        candidate = candidates_collection.find_one({"email": candidate_email})
        if not candidate:
            return jsonify({"error": "Candidat non trouvé"}), 404

        offers = list(accepted_offers_collection.find({
            "candidateId": candidate["_id"],
            "status": {"$in": ["pending_interview", "completed", "cancelled"]}
        }))
        serialized_offers = [serialize_doc(offer) for offer in offers]
        return jsonify(serialized_offers), 200
    except Exception as e:
        print(f"Erreur récupération offres acceptées: {e}")
        return jsonify({"error": "Erreur lors de la récupération des offres acceptées"}), 500

@app.route("/api/accepted-offers/<string:offer_id>", methods=["PUT"])
def update_accepted_offer(offer_id):
    try:
        if not ObjectId.is_valid(offer_id):
            return jsonify({"error": "ID invalide"}), 400
        data = request.json
        if not data:
            return jsonify({"error": "Aucune donnée fournie"}), 400

        valid_statuses = ["pending_interview", "completed", "cancelled"]
        if "status" in data and data["status"] not in valid_statuses:
            return jsonify({"error": f"Statut invalide. Valeurs acceptées: {valid_statuses}"}), 400

        if "interviewDate" in data:
            try:
                data["interviewDate"] = datetime.fromisoformat(data["interviewDate"].replace("Z", "+00:00"))
            except ValueError:
                return jsonify({"error": "Format de date d’entretien invalide (ISO 8601 attendu)"}), 400

        update_data = {k: v for k, v in data.items() if k in ["status", "interviewDate", "feedback"]}
        if not update_data:
            return jsonify({"error": "Aucune mise à jour spécifiée"}), 400
        
        update_data["updatedAt"] = datetime.now(timezone.utc)
        result = accepted_offers_collection.update_one({"_id": ObjectId(offer_id)}, {"$set": update_data})
        if result.modified_count:
            updated_offer = accepted_offers_collection.find_one({"_id": ObjectId(offer_id)})
            return jsonify({
                "message": "Offre mise à jour",
                "offer": serialize_doc(updated_offer)
            }), 200
        return jsonify({"error": "Offre non trouvée ou aucune modification"}), 404
    except Exception as e:
        print(f"Erreur mise à jour offre acceptée: {e}")
        return jsonify({"error": "Erreur lors de la mise à jour"}), 500
# --- Routes pour les enregistrements d'entretiens ---
@app.route("/api/save-recording", methods=["POST"])
def save_recording():
    try:
        video = request.files["video"]
        offer_id = request.form["offerId"]
        upload_folder = "uploads"
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder)
        video_path = os.path.join(upload_folder, video.filename)
        video.save(video_path)

        recordings = []
        for i in range(len(request.form) // 4):  # 4 champs par enregistrement
            recordings.append({
                "transcript": request.form.get(f"transcript_{i}", ""),
                "questionIndex": int(request.form.get(f"questionIndex_{i}", 0)),
                "question": request.form.get(f"question_{i}", ""),
                "timestamp": request.form.get(f"timestamp_{i}", ""),
            })

        # Mettre à jour la collection accepted_offers (exemple avec MongoDB)
        result = accepted_offers_collection.update_one(
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

        if result.modified_count == 0:
            return jsonify({"success": False, "error": "Offre non trouvée ou déjà mise à jour"}), 404

        return jsonify({"success": True, "message": "Interview enregistrée avec succès"}), 200
    except Exception as e:
        print(f"Erreur lors de la sauvegarde: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

init_auth(app)

# Enregistrer les routes d'authentification
app.route("/api/recruiters/register", methods=["POST"])(register_recruiter)
app.route("/api/recruiters/login", methods=["POST"])(login_recruiter)
app.route("/api/recruiters/profile", methods=["GET"])(get_profile)
# Lancer le serveur
if __name__ == "__main__":
    app.run(debug=True)