from flask import Flask
from flask_cors import CORS
from flask_pymongo import PyMongo
import os
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env

def create_app():
    app = Flask(__name__)
    CORS(app, supports_credentials=True)

    # Configuration
    app.config["MONGO_URI"] = os.getenv("MONGODB_URI")
    app.config["JWT_SECRET"] = os.getenv("JWT_SECRET", "your-secret-key")
    
    if not app.config["MONGO_URI"]:
        raise ValueError("MONGODB_URI environment variable is not set")

    # Initialize MongoDB
    mongo = PyMongo(app)
    app.mongo = mongo
    
    try:
        with app.app_context():
            mongo.db.command("ping")
            print("Connexion à MongoDB établie")
    except Exception as e:
        print(f"Échec de la connexion à MongoDB : {str(e)}")
        raise RuntimeError("Impossible d'initialiser la base de données MongoDB") from e

    # Register blueprints
    try:
       # from routes.candidates import candidates_bp
       # from routes.interviews import interviews_bp
        from routes.offres import offres_emploi_bp
        from routes.accepted_offers import accepted_offers_bp
        #from routes.recordings import recordings_bp
        from auth import auth_bp  # Import the auth blueprint

        app.register_blueprint(auth_bp)
        app.register_blueprint(offres_emploi_bp, url_prefix="/api")
        #app.register_blueprint(candidates_bp, url_prefix="/api")
       # app.register_blueprint(interviews_bp, url_prefix="/api")
        app.register_blueprint(accepted_offers_bp, url_prefix="/api")
       # app.register_blueprint(recordings_bp, url_prefix="/api")
    except ImportError as e:
        print(f"Erreur d'importation des blueprints : {e}")
        raise

    return app

if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)