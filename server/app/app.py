from flask import Flask, request, redirect, url_for
from flask_cors import CORS
from auth import auth_bp
from routes.offres import offres_emploi_bp
from routes.accepted_offers import accepted_offers_bp
from routes.recruteurv1.candidates import candidates_bp

from routes.recruteurv1.profile import profile_bp
from routes.recruteurv1.dashboard_recruteur import Dashboard_recruteur_bp
from routes.recruteurv1 import recruteurv1_bp


from pymongo import MongoClient
import logging
from datetime import datetime, timezone
from middleware import role_redirect

def create_app():
    app = Flask(__name__)
    
    # Set default configuration values
    app.config['JWT_SECRET_KEY'] = "default_secret_key_for_development"
    app.config['SECRET_KEY'] = "default_secret_key_for_development"
    app.config['MONGODB_URI'] = "mongodb://localhost:27017/Entretien_ai"
    
    # Configure logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    
    # Configure CORS
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    
    # Middleware to log all requests
    @app.before_request
    def log_request():
        logger.info(f"Requête reçue: {request.method} {request.url}")
        logger.info(f"Headers: {request.headers}")
        logger.info(f"Données brutes: {request.data}")
        if request.method == "OPTIONS":
            logger.info("Requête OPTIONS reçue pour CORS")
            return '', 204
    
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
        
        # Ensure required collections exist
        required_collections = ['utilisateurs', 'recruteurs', 'candidats', 'offres_emploi', 'cvs', 'candidatures']
        for collection in required_collections:
            if collection not in collections:
                app.mongo.create_collection(collection)
                logger.info(f"Collection créée: {collection}")
        
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
    
    # Route principale pour rediriger selon le rôle
    @app.route("/", methods=["GET"])
    @role_redirect({
        "recruteur": "recruteur_dashboard",
        "candidat": "candidat_profile"
    })
    def index():
        return redirect("/login")
    
    # Page de dashboard recruteur
    @app.route("/dashboard-recruteur", methods=["GET"])
    def recruteur_dashboard():
        return redirect("/api/recruteur/dashboard")
        
    # Page de profil candidat
    @app.route("/dashboard-candidat", methods=["GET"])
    def candidat_profile():
        return redirect("/api/candidat/profile")
    
    # Register the blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(offres_emploi_bp, url_prefix='/api')
    app.register_blueprint(accepted_offers_bp, url_prefix='/api')

    
    # Routes spécifiques aux recruteurs
    app.register_blueprint(profile_bp, url_prefix='/api/recruteur')
    app.register_blueprint(Dashboard_recruteur_bp, url_prefix='/api/recruteur')
    app.register_blueprint(recruteurv1_bp, url_prefix='/api/recruteur')
    app.register_blueprint(candidates_bp, url_prefix='/api/recruteur')
    
    # Routes spécifiques aux candidats
    
    
    # Log des routes enregistrées
    logger.info("Routes enregistrées:")
    for rule in app.url_map.iter_rules():
        logger.info(f"Route: {rule.endpoint} - {rule.methods} - {rule}")

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, host="0.0.0.0", port=5000)