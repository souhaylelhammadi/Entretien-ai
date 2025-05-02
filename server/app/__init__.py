# This file makes the app directory a Python package 

from flask import Flask
from flask_cors import CORS
from pymongo import MongoClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def create_app():
    app = Flask(__name__)
    CORS(app)

    # Configure MongoDB
    app.config["MONGO_URI"] = os.getenv("MONGO_URI", "mongodb://localhost:27017/interview-ai")
    app.mongo = MongoClient(app.config["MONGO_URI"])

    # Register blueprints
    from app.auth import auth_bp
    from app.routes.recruteur.profile import profile_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(profile_bp)

    return app 