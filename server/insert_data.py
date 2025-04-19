# server/insert_sample_data.py
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
from werkzeug.security import generate_password_hash

# Connect to MongoDB
client = MongoClient("mongodb+srv://user1:souhayl2005@cluster0.e1muy.mongodb.net/recruitment_platform_ia")
db = client["recruitment_db_ai"]

# Clear existing collections (optional, comment out if you want to keep existing data)
db.users.drop()
db.candidates.drop()
db.recruiters.drop()
db.offers.drop()
db.applications.drop()
db.interviews.drop()

# 1. Insert a recruiter user
recruiter_user = {
    "_id": ObjectId(),
    "name": "Alice Martin",
    "email": "alice@techcorp.com",
    "password": generate_password_hash("password123"),
    "role": "recruiter"
}
recruiter_user_id = db.users.insert_one(recruiter_user).inserted_id

# 2. Insert recruiter profile
recruiter_profile = {
    "userId": recruiter_user_id,
    "offers": []
}
recruiter_profile_id = db.recruiters.insert_one(recruiter_profile).inserted_id

# 3. Insert a candidate user
candidate_user = {
    "_id": ObjectId(),
    "name": "Bob Dupont",
    "email": "bob@example.com",
    "password": generate_password_hash("password123"),
    "role": "candidate"
}
candidate_user_id = db.users.insert_one(candidate_user).inserted_id

# 4. Insert candidate profile
candidate_profile = {
    "userId": candidate_user_id,
    "cvPath": "",
    "applications": []
}
candidate_profile_id = db.candidates.insert_one(candidate_profile).inserted_id

# 5. Insert two job offers
offer_1 = {
    "_id": ObjectId(),
    "title": "Développeur Full Stack",
    "company": "Tech Corp",
    "location": "Paris",
    "description": "Développer des applications web avec React et Flask.",
    "requiredSkills": ["React", "Flask", "MongoDB"],
    "salaryMin": 50000,
    "status": "open",
    "createdAt": datetime.utcnow(),
    "recruiterId": recruiter_user_id,
    "questions": [
        {"id": "1", "text": "Comment implémenter une API REST ?", "type": "technical"},
        {"id": "2", "text": "Décrivez un projet récent.", "type": "general"}
    ],
    "applications": []
}
offer_2 = {
    "_id": ObjectId(),
    "title": "Data Scientist",
    "company": "Data Inc",
    "location": "Lyon",
    "description": "Analyser des données avec Python et TensorFlow.",
    "requiredSkills": ["Python", "TensorFlow", "SQL"],
    "salaryMin": 60000,
    "status": "open",
    "createdAt": datetime.utcnow(),
    "recruiterId": recruiter_user_id,
    "questions": [
        {"id": "3", "text": "Expliquez le fonctionnement d'un modèle ML.", "type": "technical"}
    ],
    "applications": []
}
offer_1_id = db.offers.insert_one(offer_1).inserted_id
offer_2_id = db.offers.insert_one(offer_2).inserted_id

# Update recruiter with offers
db.recruiters.update_one(
    {"userId": recruiter_user_id},
    {"$set": {"offers": [offer_1_id, offer_2_id]}}
)

# 6. Insert an application
application = {
    "_id": ObjectId(),
    "candidateId": candidate_user_id,
    "offerId": offer_1_id,
    "status": "pending",
    "cvPath": "uploads/cv_bob.pdf",
    "lettreMotivation": "Je suis motivé pour rejoindre Tech Corp.",
    "createdAt": datetime.utcnow()
}
application_id = db.applications.insert_one(application).inserted_id

# Update offer and candidate with application
db.offers.update_one(
    {"_id": offer_1_id},
    {"$push": {"applications": application_id}}
)
db.candidates.update_one(
    {"userId": candidate_user_id},
    {"$push": {"applications": application_id}}
)

# 7. Insert an interview
interview = {
    "_id": ObjectId(),
    "offerId": offer_1_id,
    "candidateId": candidate_user_id,
    "videoPath": "uploads/interview_bob.mp4",
    "transcriptions": [
        {"questionId": "1", "text": "J'ai implémenté une API REST avec Flask."},
        {"questionId": "2", "text": "J'ai travaillé sur un projet e-commerce."}
    ],
    "score": 85,
    "report": {
        "sentiment": "positive",
        "coherence": 90,
        "relevance": 80
    },
    "createdAt": datetime.utcnow()
}
interview_id = db.interviews.insert_one(interview).inserted_id

# Associate interview with application
db.applications.update_one(
    {"_id": application_id},
    {"$set": {"interview": interview_id}}
)

print("Sample data inserted successfully!")
print(f"Recruiter User ID: {recruiter_user_id}")
print(f"Candidate User ID: {candidate_user_id}")
print(f"Offer 1 ID: {offer_1_id}")
print(f"Offer 2 ID: {offer_2_id}")
print(f"Application ID: {application_id}")
print(f"Interview ID: {interview_id}")

client.close()