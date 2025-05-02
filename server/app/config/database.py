from flask_pymongo import PyMongo
from datetime import datetime
from bcrypt import hashpw, gensalt
import logging

logger = logging.getLogger(__name__)

def get_mongo_client(app):
    """Initialize MongoDB client for the Flask app."""
    try:
        mongo = PyMongo(app)
        return mongo
    except Exception as e:
        logger.error(f"Erreur lors de l'initialisation de MongoDB: {str(e)}")
        raise

def initialize_database(app):
    """Initialize the database with sample data if empty."""
    try:
        with app.app_context():
            db = app.mongo.db
            if not db.utilisateurs.count_documents({}):
                db.utilisateurs.insert_one({
                    "nom": "Admin User",
                    "email": "admin@example.com",
                    "mot_de_passe": hashpw("Admin123".encode("utf-8"), gensalt()),
                    "telephone": "1234567890",
                    "role": "admin",
                    "acceptTerms": True,
                    "date_creation": datetime.utcnow(),
                    "date_maj": datetime.utcnow()
                })
                logger.info("Base de données initialisée avec un utilisateur admin.")
            return True
    except Exception as e:
        logger.error(f"Erreur lors de l'initialisation de la base de données: {str(e)}")
        return False