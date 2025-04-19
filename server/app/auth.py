from flask import Blueprint, request, jsonify, current_app
from flask_pymongo import PyMongo
from bson import ObjectId
from bcrypt import hashpw, gensalt, checkpw
from jwt import encode, decode, ExpiredSignatureError, InvalidTokenError
from datetime import datetime, timedelta
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

def generate_token(user_id, role):
    """Generate a JWT token with user ID and role"""
    payload = {
        "id": str(user_id),
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=1),
        "iat": datetime.utcnow(),
    }
    secret = current_app.config["JWT_SECRET"]
    return encode(payload, secret, algorithm="HS256")

def verify_token(token):
    """Verify JWT token"""
    if not token or not token.startswith("Bearer "):
        logger.warning("Token missing or invalid format")
        return None
    
    token = token.split(" ")[1]
    secret = current_app.config["JWT_SECRET"]
    
    if current_app.mongo.db.blacklist.find_one({"token": token}):
        logger.warning("Token is blacklisted")
        return None

    try:
        payload = decode(token, secret, algorithms=["HS256"])
        if "id" not in payload or "role" not in payload:
            logger.warning("Token payload missing required fields")
            return None
        if payload["role"] not in ["candidat", "recruteur"]:
            logger.warning(f"Invalid role in token: {payload['role']}")
            return None
        user = current_app.mongo.db.users.find_one({"_id": ObjectId(payload["id"])})
        if not user:
            logger.warning(f"User ID {payload['id']} not found")
            return None
        if user["role"] != payload["role"]:
            logger.warning(f"Role mismatch: DB {user['role']} vs Token {payload['role']}")
            return None
        payload["user_db_data"] = {
            "id": str(user["_id"]),
            "firstName": user["firstName"],
            "lastName": user["lastName"],
            "email": user["email"],
            "role": user["role"],
            "createdAt": user["createdAt"].isoformat(),
            "entreprise_id": str(user.get("entreprise_id", "")) if user.get("entreprise_id") else "",
        }
        return payload
    except ExpiredSignatureError:
        logger.warning("Token has expired")
        return None
    except InvalidTokenError as e:
        logger.warning(f"Invalid token: {e}")
        return None
    except Exception as e:
        logger.error(f"Token verification error: {e}", exc_info=True)
        return None

@auth_bp.route("/register", methods=["POST"])
def register():
    """Register a new candidate or recruiter"""
    try:
        data = request.get_json()
        required_fields = ["firstName", "lastName", "email", "password", "acceptTerms", "role"]
        
        if not all(field in data for field in required_fields):
            return jsonify({"message": "Tous les champs de base sont requis"}), 400
        
        if not isinstance(data["acceptTerms"], bool) or not data["acceptTerms"]:
            return jsonify({"message": "Vous devez accepter les conditions d'utilisation"}), 400

        role = data["role"]
        if role not in ["candidat", "recruteur"]:
            logger.warning(f"Invalid role provided: {role}")
            return jsonify({"message": "Rôle invalide. Doit être 'candidat' ou 'recruteur'"}), 400

        if role == "recruteur" and "entreprise_id" not in data:
            return jsonify({"message": "ID de l'entreprise requis pour les recruteurs"}), 400

        password = data["password"]
        if len(password) < 8 or not any(c.isupper() for c in password) or not any(c.isdigit() for c in password):
            return jsonify({"message": "Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre"}), 400

        if current_app.mongo.db.users.find_one({"email": data["email"]}):
            return jsonify({"message": "Cet email existe déjà"}), 400

        hashed_password = hashpw(data["password"].encode("utf-8"), gensalt())

        user_data = {
            "firstName": data["firstName"],
            "lastName": data["lastName"],
            "email": data["email"],
            "password": hashed_password,
            "role": role,
            "createdAt": datetime.utcnow(),
        }
        if role == "recruteur":
            if not ObjectId.is_valid(data["entreprise_id"]):
                return jsonify({"message": "Format d'ID d'entreprise invalide"}), 400
            entreprise = current_app.mongo.db.entreprises.find_one({"_id": ObjectId(data["entreprise_id"])})
            if not entreprise:
                return jsonify({"message": "Entreprise non trouvée"}), 404
            user_data["entreprise_id"] = ObjectId(data["entreprise_id"])

        result = current_app.mongo.db.users.insert_one(user_data)
        token = generate_token(result.inserted_id, role)

        response_data = {
            "id": str(result.inserted_id),
            "firstName": data["firstName"],
            "lastName": data["lastName"],
            "email": data["email"],
            "role": role,
        }
        if role == "recruteur":
            response_data["entreprise_id"] = data["entreprise_id"]

        logger.info(f"Utilisateur ID {result.inserted_id} enregistré avec rôle {role}")
        return jsonify({
            "message": f"{role.capitalize()} enregistré avec succès",
            "token": token,
            "user": response_data,
        }), 201

    except Exception as e:
        logger.error(f"Erreur d'enregistrement : {str(e)}", exc_info=True)
        return jsonify({"message": "Erreur serveur lors de l'enregistrement", "details": str(e)}), 500

@auth_bp.route("/login", methods=["POST"])
def login():
    """Login a candidate or recruiter"""
    try:
        data = request.get_json()
        if not all(field in data for field in ["email", "password"]):
            return jsonify({"message": "Email et mot de passe requis"}), 400

        user = current_app.mongo.db.users.find_one({"email": data["email"]})
        if not user or not checkpw(data["password"].encode("utf-8"), user["password"]):
            return jsonify({"message": "Identifiants invalides"}), 401

        if user["role"] not in ["candidat", "recruteur"]:
            logger.warning(f"Invalid role for user {user['_id']}: {user['role']}")
            return jsonify({"message": "Rôle utilisateur invalide"}), 400

        token = generate_token(user["_id"], user["role"])
        user_data = {
            "id": str(user["_id"]),
            "firstName": user["firstName"],
            "lastName": user["lastName"],
            "email": user["email"],
            "role": user["role"],
        }
        if user["role"] == "recruteur":
            user_data["entreprise_id"] = str(user.get("entreprise_id", "")) if user.get("entreprise_id") else ""

        logger.info(f"Utilisateur ID {user['_id']} connecté avec rôle {user['role']}")
        return jsonify({
            "message": "Connexion réussie",
            "token": token,
            "user": user_data,
        }), 200

    except Exception as e:
        logger.error(f"Erreur de connexion : {str(e)}", exc_info=True)
        return jsonify({"message": "Erreur serveur lors de la connexion", "details": str(e)}), 500

@auth_bp.route("/me", methods=["GET"])
def get_profile():
    """Get the authenticated user's profile"""
    try:
        token = request.headers.get("Authorization")
        decoded = verify_token(token)
        if not decoded:
            return jsonify({"message": "Authentification requise ou invalide."}), 401

        user = current_app.mongo.db.users.find_one({"_id": ObjectId(decoded["id"])})
        if not user:
            return jsonify({"message": "Utilisateur non trouvé"}), 404

        user_data = {
            "id": str(user["_id"]),
            "firstName": user["firstName"],
            "lastName": user["lastName"],
            "email": user["email"],
            "role": user["role"],
            "createdAt": user["createdAt"].isoformat(),
        }
        if user["role"] == "recruteur":
            user_data["entreprise_id"] = str(user.get("entreprise_id", "")) if user.get("entreprise_id") else ""

        logger.info(f"Profil récupéré pour Utilisateur ID {user['_id']}")
        return jsonify({"user": user_data}), 200

    except Exception as e:
        logger.error(f"Erreur de profil : {str(e)}", exc_info=True)
        return jsonify({"message": "Erreur serveur lors de la récupération du profil", "details": str(e)}), 500

@auth_bp.route("/logout", methods=["POST"])
def logout():
    """Logout the authenticated user"""
    try:
        token = request.headers.get("Authorization")
        decoded = verify_token(token)
        if not decoded:
            return jsonify({"message": "Authentification requise ou invalide."}), 401
        
        token = token.split(" ")[1]
        current_app.mongo.db.blacklist.insert_one({
            "token": token,
            "expires_at": datetime.utcnow() + timedelta(hours=1),
        })
        
        logger.info(f"Utilisateur ID {decoded['id']} déconnecté")
        return jsonify({"message": "Déconnexion réussie"}), 200

    except Exception as e:
        logger.error(f"Erreur de déconnexion : {str(e)}", exc_info=True)
        return jsonify({"message": "Erreur serveur lors de la déconnexion", "details": str(e)}), 500

@auth_bp.route("/update", methods=["PUT"])
def update_profile():
    """Update the authenticated user's profile"""
    try:
        token = request.headers.get("Authorization")
        decoded = verify_token(token)
        if not decoded:
            return jsonify({"message": "Authentification requise ou invalide."}), 401

        user_id = ObjectId(decoded["id"])
        data = request.get_json()
        required_fields = ["firstName", "lastName", "email"]

        if not all(field in data for field in required_fields):
            return jsonify({"message": "Tous les champs (prénom, nom, email) sont requis"}), 400

        # Validate input
        first_name = data["firstName"].strip()
        last_name = data["lastName"].strip()
        email = data["email"].strip()

        if not first_name or not last_name or not email:
            return jsonify({"message": "Les champs ne peuvent pas être vides"}), 400

        import re
        if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
            return jsonify({"message": "Format d'email invalide"}), 400

        # Check if email is already in use by another user
        existing_user = current_app.mongo.db.users.find_one(
            {"email": email, "_id": {"$ne": user_id}}
        )
        if existing_user:
            return jsonify({"message": "Cet email est déjà utilisé"}), 400

        # Update user data
        update_data = {
            "firstName": first_name,
            "lastName": last_name,
            "email": email,
            "updatedAt": datetime.utcnow(),
        }

        result = current_app.mongo.db.users.update_one(
            {"_id": user_id},
            {"$set": update_data}
        )

        if result.matched_count == 0:
            return jsonify({"message": "Utilisateur non trouvé"}), 404

        # Fetch updated user data
        updated_user = current_app.mongo.db.users.find_one({"_id": user_id})
        user_data = {
            "id": str(updated_user["_id"]),
            "firstName": updated_user["firstName"],
            "lastName": updated_user["lastName"],
            "email": updated_user["email"],
            "role": updated_user["role"],
            "createdAt": updated_user["createdAt"].isoformat(),
            "updatedAt": updated_user.get("updatedAt", datetime.utcnow()).isoformat(),
        }
        if updated_user["role"] == "recruteur":
            user_data["entreprise_id"] = (
                str(updated_user.get("entreprise_id", ""))
                if updated_user.get("entreprise_id")
                else ""
            )

        logger.info(f"Profil mis à jour pour Utilisateur ID {user_id}")
        return jsonify({
            "message": "Profil mis à jour avec succès",
            "user": user_data
        }), 200

    except Exception as e:
        logger.error(f"Erreur de mise à jour du profil : {str(e)}", exc_info=True)
        return jsonify({
            "message": "Erreur serveur lors de la mise à jour du profil",
            "details": str(e)
        }), 500
