from flask import Flask, request, redirect, url_for
from flask_cors import CORS
from auth import auth_bp
from routes.offres import offres_emploi_bp
from server.app.routes.acceptee_offers import accepted_offers_bp
from server.app.routes.recruteurSection.candidatesSection import candidates_bp
from routes.recruteurSection.profile import profile_bp
from routes.recruteurSection.dashboard_recruteur import Dashboard_recruteur_bp
from routes.recruteurSection import recruteurv1_bp
from routes.postuler import candidatures_bp
from routes.entretiens import entretiens_bp
from server.app.routes.recruteurSection.entretiensSection import entretiensection_bp
from pymongo import MongoClient
import logging
from datetime import datetime, timezone
from config.config import MONGO_URI
import os

def create_app():
    app = Flask(__name__)
    
    # Set default configuration values
    app.config['JWT_SECRET_KEY'] = "default_secret_key_for_development"
    app.config['SECRET_KEY'] = "default_secret_key_for_development"
    app.config['MONGODB_URI'] = MONGO_URI
    
    # Configure logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    
    # Configure CORS
    CORS(app, resources={r"/api/*": {
        "origins": ["http://localhost:3000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }})
    
    
    
    # Configuration de la base de données
    try:
        mongo_uri = app.config['MONGODB_URI']
        logger.info(f"Connecting to MongoDB at: {mongo_uri}")
        client = MongoClient(mongo_uri)
        app.mongo = client.get_database("Entretien_ai")
        logger.info("Connexion MongoDB réussie.")
        
        # Vérification des collections
        collections = app.mongo.list_collection_names()
        logger.info(f"Collections disponibles: {collections}")
        
       
        
    except Exception as e:
        logger.error(f"Erreur de connexion MongoDB: {str(e)}")
        raise
    
    # Configuration du dossier d'upload
    app.config["UPLOAD_FOLDER"] = "Uploads"
    
    # Initialize JWT manager with app context
    with app.app_context():
        from jwt_manager import jwt_manager
        jwt_manager._initialize()
        # Register jwt_manager as a Flask extension
        if not hasattr(app, 'extensions'):
            app.extensions = {}
        app.extensions['jwt_manager'] = jwt_manager
        logger.info("JWT Manager initialized and registered as an extension")

    # Register the blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(offres_emploi_bp, url_prefix='/api')
    app.register_blueprint(accepted_offers_bp, url_prefix='/api')
    app.register_blueprint(candidatures_bp, url_prefix='/api')
    
    # Routes spécifiques aux recruteurs
    app.register_blueprint(profile_bp, url_prefix='/api/recruteur')
    app.register_blueprint(Dashboard_recruteur_bp, url_prefix='/api/recruteur')
    app.register_blueprint(recruteurv1_bp, url_prefix='/api/recruteur')
    app.register_blueprint(candidates_bp, url_prefix='/api/candidates')
    app.register_blueprint(entretiens_bp,url_prefix='/api/candidates/entretiens')
    app.register_blueprint(entretiensection_bp,url_prefix='/api/recruteur/entretiens')
    
    # Log des routes enregistrées
    logger.info("Routes enregistrées:")
    for rule in app.url_map.iter_rules():
        logger.info(f"Route: {rule.endpoint} - {rule.methods} - {rule}")
    return app

if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, host="0.0.0.0", port=5000)