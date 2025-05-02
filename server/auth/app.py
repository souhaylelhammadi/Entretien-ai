from flask import Flask, request
from flask_cors import CORS
from auth import auth_bp
from routes.offres import offres_emploi_bp
from routes.accepted_offers import accepted_offers_bp
from pymongo import MongoClient
import logging
from datetime import datetime, timezone

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_app():
    app = Flask(__name__)
    app.config.from_prefixed_env()  # Load environment variables with FLASK_ prefix
    
    # Configure CORS to allow all origins and methods
    CORS(app, resources={r"/api/*": {"origins": "*", "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]}})
    
    # Middleware to log all requests
    @app.before_request
    def log_request():
        print(f"Requête reçue: {request.method} {request.url}")
        print(f"Headers: {request.headers}")
        print(f"Données brutes: {request.data}")
        if request.method == "OPTIONS":
            print("Requête OPTIONS reçue pour CORS")
    
    # Configuration de la base de données
    try:
        client = MongoClient("mongodb://localhost:27017/")
        app.mongo = client.get_database("DB_entretien_ai")
        print("Connexion MongoDB réussie.")
    except Exception as e:
        print(f"Erreur de connexion MongoDB: {str(e)}")
        raise
    
    # Configuration du dossier d'upload
    app.config["UPLOAD_FOLDER"] = "Uploads"
    
    # Register the blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(offres_emploi_bp, url_prefix='/api')
    app.register_blueprint(accepted_offers_bp, url_prefix='/api')

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, host="0.0.0.0", port=5000)