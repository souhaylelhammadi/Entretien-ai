import os

# MongoDB configuration
MONGO_URI = "mongodb+srv://user1:souhayl2005@cluster0.e1muy.mongodb.net/Entretien_ai"

# JWT configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key")

# Collection names
OFFRES_COLLECTION = "offres"
CANDIDATURES_COLLECTION = "candidatures"
USERS_COLLECTION = "utilisateurs"
ENTRETIENS_COLLECTION = "entretiens"
CANDIDATS_COLLECTION = "candidats"
ACTIVITIES_COLLECTION = "activities"
RECRUTEURS_COLLECTION = "recruteurs"
