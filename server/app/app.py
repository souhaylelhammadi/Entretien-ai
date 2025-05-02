from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_pymongo import PyMongo
import os
from dotenv import load_dotenv
from datetime import datetime
import logging
from config.database import initialize_database, get_mongo_client

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Debug environment variables
logger.info(f"JWT_SECRET_KEY: {os.getenv('JWT_SECRET_KEY')}")
logger.info(f"MONGO_URI: {os.getenv('MONGO_URI')}")

def create_app():
    app = Flask(__name__)

    # Application configuration
    app.config["MONGO_URI"] = os.getenv("MONGO_URI", "mongodb://localhost:27017/DB_entretien_ai")
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "your_jwt_secret_key")
    app.config["MAINTENANCE_MODE"] = os.getenv("MAINTENANCE_MODE", "false").lower() == "true"
    app.config["TRACK_IP_CHANGES"] = os.getenv("TRACK_IP_CHANGES", "true").lower() == "true"
    app.config["MAX_LOGIN_ATTEMPTS"] = int(os.getenv("MAX_LOGIN_ATTEMPTS", "5"))
    app.config["LOCKOUT_TIME_MINUTES"] = int(os.getenv("LOCKOUT_TIME_MINUTES", "30"))
    app.config["UPLOAD_FOLDER"] = os.getenv("UPLOAD_FOLDER", "Uploads")
    app.config["JWT_EXPIRES_IN_HOURS"] = int(os.getenv("JWT_EXPIRES_IN_HOURS", "24"))

    # Validate critical environment variables
    if not app.config["MONGO_URI"]:
        raise ValueError("MONGO_URI environment variable is not set")
    if not app.config["JWT_SECRET_KEY"]:
        raise ValueError("JWT_SECRET_KEY environment variable is not set")

    # Initialize MongoDB
    try:
        mongo = PyMongo(app, uri=app.config["MONGO_URI"])
        app.mongo = mongo
        with app.app_context():
            mongo.db.command("ping")
            logger.info("Connexion à MongoDB établie")
            # Create indexes
            mongo.db.utilisateurs.create_index("email", unique=True)
            mongo.db.blacklisted_tokens.create_index("token", unique=True)
            mongo.db.blacklisted_tokens.create_index("exp", expireAfterSeconds=0)
            mongo.db.candidats.create_index("utilisateur_id", unique=True)
            mongo.db.recruteurs.create_index("utilisateur_id", unique=True)
            mongo.db.user_sessions.create_index("user_id")
            mongo.db.activities.create_index("user_id")
            mongo.db.auth_logs.create_index("user_id")
    except Exception as e:
        logger.error(f"Échec de la connexion à MongoDB: {str(e)}")
        raise RuntimeError("Impossible d'initialiser la base de données MongoDB") from e

    # Configure CORS
    CORS(app,
         resources={r"/api/*": {
             "origins": os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
             "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
             "allow_headers": ["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
             "expose_headers": ["Content-Type", "Authorization"],
             "supports_credentials": True,
             "max_age": 3600,
             "automatic_options": True,
             "vary_header": True
         }},
         supports_credentials=True,
         automatic_options=True)

    # Register blueprints
    try:
        from auth.jwt_manager import jwt_manager
        from auth.auth import auth_bp, init_auth
        
        # Initialize auth module with jwt_manager
        with app.app_context():
            init_auth(jwt_manager)
        
        # Register blueprints
        app.register_blueprint(auth_bp)
        from routes.recruteur import recruteur_bp
        app.register_blueprint(recruteur_bp)
        # Temporarily comment out the candidat blueprint until it's created
        # from routes.candidat import candidat_bp
        # app.register_blueprint(candidat_bp)
        #from routes.entreprise import entreprise_bp
        #app.register_blueprint(entreprise_bp)
        #from routes.admin import admin_bp
        #app.register_blueprint(admin_bp)
        
        logger.info("Blueprints enregistrés avec succès")
    except Exception as e:
        logger.error(f"Erreur lors de l'enregistrement des blueprints: {str(e)}")
        raise RuntimeError("Impossible d'enregistrer les blueprints") from e

    # Maintenance mode middleware
    @app.before_request
    def check_maintenance_mode():
        if app.config["MAINTENANCE_MODE"] and request.path != "/api/maintenance":
            return jsonify({"message": "Application en maintenance"}), 503

    # Error handling for 404
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"message": "Ressource non trouvée"}), 404

    # Error handling for 500
    @app.errorhandler(500)
    def internal_error(error):
        logger.error(f"Erreur serveur: {str(error)}", exc_info=True)
        return jsonify({"message": "Erreur serveur interne"}), 500

    # CLI command for initialization
    @app.cli.command("init-db")
    def init_db_command():
        """Initialize the database with sample data."""
        initialize_database(app)
        logger.info("Initialisation de la base de données terminée")

    return app

if __name__ == "__main__":
    app = create_app()
    init_db = os.getenv("INIT_DB", "false").lower() in ('true', '1', 't')
    if init_db:
        initialize_database(app)
    port = int(os.getenv("PORT", 5000))
    logger.info(f"Démarrage de l'application sur le port {port}")
    app.run(host="0.0.0.0", port=port, debug=True)