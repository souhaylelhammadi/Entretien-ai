import os

# Configuration MongoDB
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/DB_entretien_ai")

# Configuration Flask
SECRET_KEY = os.getenv("SECRET_KEY", "votre_clé_secrète_très_sécurisée")