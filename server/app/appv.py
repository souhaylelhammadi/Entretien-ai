from flask import Flask
from flask_cors import CORS
from flask_pymongo import PyMongo
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()  # Load environment variables from .env

def setup_background_tasks(app):
    """Setup tasks that should run once at application startup"""
    # Clean up expired tokens
    try:
        # Tokens older than JWT_EXPIRES_IN_HOURS will be removed
        # (MongoDB TTL index will handle this if set up correctly)
        print("Configuration des tâches d'arrière-plan terminée")
    except Exception as e:
        print(f"Erreur lors de la configuration des tâches d'arrière-plan : {e}")

def create_app():
    app = Flask(__name__)
    CORS(app, supports_credentials=True)

    # Configuration
    app.config["MONGO_URI"] = os.getenv("MONGODB_URI")
    app.config["JWT_SECRET"] = os.getenv("JWT_SECRET", "your-secret-key")
    
    # Security and feature flags
    app.config["MAINTENANCE_MODE"] = os.getenv("MAINTENANCE_MODE", "false").lower() == "true"
    app.config["TRACK_IP_CHANGES"] = os.getenv("TRACK_IP_CHANGES", "true").lower() == "true"
    app.config["MAX_LOGIN_ATTEMPTS"] = int(os.getenv("MAX_LOGIN_ATTEMPTS", "5"))
    app.config["LOCKOUT_TIME_MINUTES"] = int(os.getenv("LOCKOUT_TIME_MINUTES", "30"))
    app.config["UPLOAD_FOLDER"] = os.getenv("UPLOAD_FOLDER", "uploads")
    app.config["JWT_EXPIRES_IN_HOURS"] = int(os.getenv("JWT_EXPIRES_IN_HOURS", "24"))
    
    if not app.config["MONGO_URI"]:
        raise ValueError("MONGODB_URI environment variable is not set")

    # Initialize MongoDB
    mongo = PyMongo(app)
    app.mongo = mongo
    
    try:
        with app.app_context():
            mongo.db.command("ping")
            print("Connexion à MongoDB établie")
            
            # Create indexes for better performance and security
            mongo.db.users.create_index("email", unique=True)
            mongo.db.blacklist.create_index("token", unique=True)
            mongo.db.blacklist.create_index("expires_at", expireAfterSeconds=0)
            mongo.db.user_sessions.create_index("user_id")
            mongo.db.user_sessions.create_index("token")
            mongo.db.activities.create_index([("timestamp", -1)])
            mongo.db.recruiter_profiles.create_index("user_id", unique=True)
            
            # Run initialization tasks that would have been in before_first_request
            setup_background_tasks(app)
            
    except Exception as e:
        print(f"Échec de la connexion à MongoDB : {str(e)}")
        raise RuntimeError("Impossible d'initialiser la base de données MongoDB") from e

    # Register blueprints
    try:
        from routes.recruteur.candidates import candidates_bp
        from routes.recruteur.interview import interviews_bp
        from routes.offres import offres_emploi_bp
        from routes.accepted_offers import accepted_offers_bp
        #from routes.recordings import recordings_bp
        from auth import auth_bp  # Import the auth blueprint
        from routes.recruteur.dashboard import dashboard_bp
        from routes.recruteur.jobs import jobs_bp
        from routes.recruteur.profile import profile_bp  # Import the new profile blueprint
        
        app.register_blueprint(auth_bp)
        app.register_blueprint(offres_emploi_bp, url_prefix="/api")
        app.register_blueprint(candidates_bp, url_prefix="/api")
        app.register_blueprint(interviews_bp, url_prefix="/api")
        app.register_blueprint(accepted_offers_bp, url_prefix="/api")
        app.register_blueprint(dashboard_bp)
        app.register_blueprint(jobs_bp)
        app.register_blueprint(profile_bp)  # Register the profile blueprint
        
    except ImportError as e:
        print(f"Erreur d'importation des blueprints : {e}")
        raise
        
    # CLI command for running tasks (alternative to before_first_request)
    @app.cli.command("init-app")
    def init_app_command():
        """Initialize application data and run startup tasks."""
        setup_background_tasks(app)
        print("Application initialization complete")

    return app

if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)