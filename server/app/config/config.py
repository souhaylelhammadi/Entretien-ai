import os

# MongoDB configuration
MONGO_URI = "mongodb://localhost:27017/Entretien_ai"

# JWT configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key")


