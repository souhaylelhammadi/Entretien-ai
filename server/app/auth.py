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
        "exp": datetime.utcnow() + timedelta(hours=current_app.config.get("JWT_EXPIRES_IN_HOURS", 24)),
        "iat": datetime.utcnow(),
        "jti": str(ObjectId())  # Add a unique token ID for tracking in the blacklist
    }
    secret = current_app.config["JWT_SECRET"]
    token = encode(payload, secret, algorithm="HS256")
    
    # Ajouter le préfixe 'Bearer ' au token
    return f"Bearer {token}"

def verify_token(token):
    """Verify JWT token"""
    try:
        if not token:
            logger.warning("Token missing")
            return None
            
        # Si le token commence par 'Bearer ', on le nettoie
        if isinstance(token, str) and token.startswith("Bearer "):
            token = token.split(" ")[1]
            
        logger.info(f"Vérifiant le token: {token[:10]}...")
        secret = current_app.config["JWT_SECRET"]
        
        # Vérifier si le token est blacklisté
        if current_app.mongo.db.blacklist.find_one({"token": token}):
            logger.warning("Token is blacklisted")
            return None

        try:
            payload = decode(token, secret, algorithms=["HS256"])
            logger.info(f"Token décodé avec succès: {payload.get('id')}, rôle: {payload.get('role')}")
            
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
                
            # Check if user account is active
            if user.get("status") == "suspended":
                logger.warning(f"User account is suspended: {payload['id']}")
                return None
                
            # Pour les recruteurs, effectuer des vérifications supplémentaires
            if payload["role"] == "recruteur":
                # Vérifier si le mot de passe a été changé depuis l'émission du token
                if user.get("password_changed_at") and payload.get("iat"):
                    password_changed_at = user["password_changed_at"]
                    token_issued_at = datetime.fromtimestamp(payload["iat"])
                    if password_changed_at > token_issued_at:
                        logger.warning(f"Password changed after token was issued for user {payload['id']}")
                        return None
                        
                # Vérifier si le compte est verrouillé
                if user.get("login_attempts", 0) >= current_app.config.get("MAX_LOGIN_ATTEMPTS", 5):
                    if user.get("lockout_until") and user["lockout_until"] > datetime.utcnow():
                        logger.warning(f"User account is locked: {payload['id']}")
                        return None
                        
            # Ajouter les données utilisateur de la base au payload pour faciliter l'accès
            payload["user_db_data"] = {
                "id": str(user["_id"]),
                "firstName": user.get("firstName", ""),
                "lastName": user.get("lastName", ""),
                "email": user.get("email", ""),
                "role": user.get("role", ""),
                "createdAt": user.get("createdAt", datetime.utcnow()).isoformat(),
                "permissions": user.get("permissions", {}),
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
        logger.info(f"Received registration payload: {data}")
        required_fields = ["firstName", "lastName", "email", "password", "acceptTerms", "role"]
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            logger.warning(f"Missing fields: {missing_fields}")
            return jsonify({"message": f"Champs manquants: {', '.join(missing_fields)}"}), 400
        
        if not isinstance(data["acceptTerms"], bool) or not data["acceptTerms"]:
            logger.warning("Invalid or missing acceptTerms")
            return jsonify({"message": "Vous devez accepter les conditions d'utilisation"}), 400

        role = data["role"]
        if role not in ["candidat", "recruteur"]:
            logger.warning(f"Invalid role provided: {role}")
            return jsonify({"message": "Rôle invalide. Doit être 'candidat' ou 'recruteur'"}), 400

        if role == "recruteur" and "entreprise_id" not in data:
            logger.warning("Missing entreprise_id for recruteur")
            return jsonify({"message": "ID de l'entreprise requis pour les recruteurs"}), 400

        password = data["password"]
        if len(password) < 8 or not any(c.isupper() for c in password) or not any(c.isdigit() for c in password):
            logger.warning("Invalid password format")
            return jsonify({"message": "Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre"}), 400

        if current_app.mongo.db.users.find_one({"email": data["email"]}):
            logger.warning(f"Email already exists: {data['email']}")
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
                logger.warning(f"Invalid entreprise_id format: {data['entreprise_id']}")
                return jsonify({"message": "Format d'ID d'entreprise invalide"}), 400
            entreprise = current_app.mongo.db.entreprises.find_one({"_id": ObjectId(data["entreprise_id"])})
            if not entreprise:
                logger.warning(f"Entreprise not found for ID: {data['entreprise_id']}")
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
            logger.warning("Missing email or password")
            return jsonify({"message": "Email et mot de passe requis"}), 400

        user = current_app.mongo.db.users.find_one({"email": data["email"]})
        if not user:
            logger.warning(f"User not found with email: {data['email']}")
            return jsonify({"message": "Identifiants invalides"}), 401
            
        # Check for account lockout
        if user.get("login_attempts", 0) >= current_app.config.get("MAX_LOGIN_ATTEMPTS", 5):
            if user.get("lockout_until") and user["lockout_until"] > datetime.utcnow():
                # Account is locked
                logger.warning(f"Account locked for user {user['_id']}")
                lockout_minutes = current_app.config.get("LOCKOUT_TIME_MINUTES", 30)
                return jsonify({
                    "message": f"Compte verrouillé. Veuillez réessayer dans {lockout_minutes} minutes.",
                    "locked_until": user["lockout_until"].isoformat()
                }), 403

        # Verify password
        if not checkpw(data["password"].encode("utf-8"), user["password"]):
            # Increment login attempts for failed login
            current_app.mongo.db.users.update_one(
                {"_id": user["_id"]},
                {"$inc": {"login_attempts": 1}}
            )
            
            # Check if account should be locked
            updated_user = current_app.mongo.db.users.find_one({"_id": user["_id"]})
            if updated_user.get("login_attempts", 0) >= current_app.config.get("MAX_LOGIN_ATTEMPTS", 5):
                # Lock the account
                lockout_minutes = current_app.config.get("LOCKOUT_TIME_MINUTES", 30)
                lockout_until = datetime.utcnow() + timedelta(minutes=lockout_minutes)
                current_app.mongo.db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"lockout_until": lockout_until}}
                )
                logger.warning(f"Account locked for user {user['_id']} until {lockout_until}")
                return jsonify({
                    "message": f"Trop de tentatives échouées. Compte verrouillé pour {lockout_minutes} minutes.",
                    "locked_until": lockout_until.isoformat()
                }), 403
                
            logger.warning(f"Invalid password for user {user['_id']}")
            return jsonify({"message": "Identifiants invalides"}), 401

        if user["role"] not in ["candidat", "recruteur"]:
            logger.warning(f"Invalid role for user {user['_id']}: {user['role']}")
            return jsonify({"message": "Rôle utilisateur invalide"}), 400
            
        # Reset login attempts on successful login
        current_app.mongo.db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"login_attempts": 0, "lockout_until": None}}
        )

        # Generate token
        token = generate_token(user["_id"], user["role"])
        
        # Record the user session
        current_app.mongo.db.user_sessions.insert_one({
            "user_id": user["_id"],
            "token": token.split(".")[2],  # Store only the signature part for lookup
            "ip": request.remote_addr,
            "user_agent": request.headers.get("User-Agent", ""),
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(hours=current_app.config.get("JWT_EXPIRES_IN_HOURS", 24))
        })
        
        # Prepare user data to return
        user_data = {
            "id": str(user["_id"]),
            "firstName": user["firstName"],
            "lastName": user["lastName"],
            "email": user["email"],
            "role": user["role"],
        }
        
        # Add additional data for recruiters
        if user["role"] == "recruteur":
            user_data["entreprise_id"] = str(user.get("entreprise_id", "")) if user.get("entreprise_id") else ""
            
            # Get profile completion status
            profile_data = current_app.mongo.db.recruiter_profiles.find_one({"user_id": user["_id"]})
            user_data["profile_completed"] = profile_data is not None
            
            # Get permissions
            user_data["permissions"] = user.get("permissions", {})
            
            # Get company name if available
            if user.get("entreprise_id"):
                entreprise = current_app.mongo.db.entreprises.find_one({"_id": user["entreprise_id"]})
                if entreprise:
                    user_data["entreprise_name"] = entreprise.get("nom", "")

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
            logger.warning("Invalid or missing token")
            return jsonify({"message": "Authentification requise ou invalide."}), 401

        user = current_app.mongo.db.users.find_one({"_id": ObjectId(decoded["id"])})
        if not user:
            logger.warning(f"User not found: {decoded['id']}")
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
            logger.warning("Invalid or missing token")
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

@auth_bp.route("/entreprise", methods=["POST"])
def create_entreprise():
    """Create a new enterprise"""
    try:
        data = request.get_json()
        logger.info(f"Received entreprise creation payload: {data}")
        if not data.get("name"):
            logger.warning("Missing entreprise name")
            return jsonify({"message": "Nom de l'entreprise requis"}), 400
        result = current_app.mongo.db.entreprises.insert_one({
            "name": data["name"],
            "createdAt": datetime.utcnow(),
        })
        logger.info(f"Entreprise créée avec ID: {result.inserted_id}")
        return jsonify({
            "message": "Entreprise créée",
            "entreprise_id": str(result.inserted_id),
        }), 201
    except Exception as e:
        logger.error(f"Erreur création entreprise: {str(e)}", exc_info=True)
        return jsonify({"message": "Erreur serveur lors de la création de l'entreprise", "details": str(e)}), 500