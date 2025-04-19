from flask import Flask
from flask_cors import CORS
from pymongo import MongoClient
import os
from dotenv import load_dotenv
import logging

# Configure logging with detailed output
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('app.log')  # Save logs to a file for debugging
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

def create_app():
    # Initialize Flask app
    app = Flask(__name__)
    
    # Enable CORS with support for credentials
    CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": "*"}})

    # Configuration
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "your-secret-key")
    app.config["JWT_SECRET"] = os.getenv("JWT_SECRET", "your-jwt-secret")
    app.config["UPLOAD_FOLDER"] = os.getenv("UPLOAD_FOLDER", os.path.join(os.getcwd(), "Uploads"))
    app.config["MONGO_URI"] = os.getenv("MONGO_URI")
    app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024  # Limit file uploads to 5MB

    # Validate critical configuration
    if not app.config["MONGO_URI"]:
        logger.error("MONGO_URI environment variable is not set")
        raise ValueError("MONGO_URI environment variable is not set")
    if not app.config["JWT_SECRET"]:
        logger.warning("JWT_SECRET is not set, using default value. This is insecure for production.")
    if not app.config["SECRET_KEY"]:
        logger.warning("SECRET_KEY is not set, using default value. This is insecure for production.")

    # Ensure upload folder exists
    upload_folder = app.config["UPLOAD_FOLDER"]
    try:
        os.makedirs(upload_folder, exist_ok=True)
        logger.info(f"Upload folder ensured: {upload_folder}")
    except OSError as e:
        logger.error(f"Failed to create upload folder {upload_folder}: {e}")
        raise RuntimeError(f"Cannot create upload folder: {e}") from e

    # Initialize MongoDB
    try:
        client = MongoClient(app.config["MONGO_URI"])
        app.mongo = client.get_database()
        logger.info("MongoDB connection established successfully")
        # Test connection and create collections if they don't exist
        collections = app.mongo.list_collection_names()
        required_collections = ['offres', 'candidates', 'candidatures', 'users', 'entreprises', 'blacklist']
        for collection in required_collections:
            if collection not in collections:
                app.mongo.create_collection(collection)
                logger.info(f"Created collection: {collection}")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {str(e)}", exc_info=True)
        raise RuntimeError("Unable to initialize MongoDB database") from e

    # Register blueprints
    try:
        from routeso.offres_emploi import offres_emploi_bp
        from routeso.candidates import candidates_bp
        from auth import auth_bp

        # Register blueprints with appropriate URL prefixes
        app.register_blueprint(offres_emploi_bp, url_prefix="/api")
        app.register_blueprint(candidates_bp, url_prefix="/api")
        app.register_blueprint(auth_bp, url_prefix="/api/auth")

        logger.info("All blueprints registered successfully")
    except ImportError as e:
        logger.error(f"Failed to import blueprints: {e}", exc_info=True)
        raise ImportError(f"Error importing blueprints: {e}") from e

    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        logger.warning(f"404 error: {error}")
        return {"error": "Resource not found"}, 404

    @app.errorhandler(500)
    def internal_error(error):
        logger.error(f"Internal server error: {error}", exc_info=True)
        return {"error": "Internal server error"}, 500

    # Health check endpoint for debugging
    @app.route('/api/health', methods=['GET'])
    def health_check():
        try:
            app.mongo.command("ping")
            return {"status": "healthy", "mongodb": "connected"}, 200
        except Exception as e:
            logger.error(f"Health check failed: {str(e)}")
            return {"status": "unhealthy", "mongodb": str(e)}, 500

    return app

if __name__ == "__main__":
    try:
        app = create_app()
        port = int(os.getenv("PORT", 5000))
        logger.info(f"Starting Flask application on port {port}")
        app.run(host="0.0.0.0", port=port, debug=True)
    except Exception as e:
        logger.error(f"Failed to start application: {e}", exc_info=True)
        raise RuntimeError("Unable to start Flask application") from e