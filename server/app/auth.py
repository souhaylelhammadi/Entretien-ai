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
    """Generate a JWT token with user ID and role."""
    payload = {
        "id": str(user_id),
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=current_app.config.get("JWT_EXPIRES_IN_HOURS", 24)),
        "iat": datetime.utcnow(),
        "jti": str(ObjectId())
    }
    secret = current_app.config["JWT_SECRET"]
    token = encode(payload, secret, algorithm="HS256")
    return f"Bearer {token}"

def verify_token(token):
    """Verify JWT token."""
    try:
        if not token:
            logger.warning("Jeton manquant")
            return None

        if isinstance(token, str) and token.startswith("Bearer "):
            token = token.split(" ")[1]

        logger.info(f"Vérification du jeton: {token[:10]}...")
        secret = current_app.config["JWT_SECRET"]

        if current_app.mongo.db.blacklist.find_one({"token": token}):
            logger.warning("Jeton blacklisté")
            return None

        payload = decode(token, secret, algorithms=["HS256"])
        logger.info(f"Jeton décodé: ID {payload.get('id')}, rôle: {payload.get('role')}")

        if "id" not in payload or "role" not in payload:
            logger.warning("Champs requis absents dans le jeton")
            return None

        if payload["role"] not in ["candidat", "recruteur"]:
            logger.warning(f"Rôle invalide: {payload['role']}")
            return None

        user = current_app.mongo.db.utilisateurs.find_one({"_id": ObjectId(payload["id"])})
        if not user:
            logger.warning(f"Utilisateur ID {payload['id']} introuvable")
            return None

        if user["role"] != payload["role"]:
            logger.warning(f"Incohérence de rôle: DB {user['role']} vs Jeton {payload['role']}")
            return None

        # Additional checks for recruiters
        if payload["role"] == "recruteur":
            recruteur = current_app.mongo.db.recruteurs.find_one({"utilisateur_id": ObjectId(payload["id"])})
            if not recruteur:
                logger.warning(f"Profil recruteur introuvable pour ID {payload['id']}")
                return None
            if user.get("entreprise_id") != recruteur.get("entreprise_id"):
                logger.warning(f"Incohérence entreprise_id pour ID {payload['id']}")
                return None

        payload["user_db_data"] = {
            "id": str(user["_id"]),
            "nom": user.get("nom", ""),
            "email": user.get("email", ""),
            "role": user.get("role", ""),
            "telephone": user.get("telephone", ""),
            "entreprise_id": str(user.get("entreprise_id", "")) if user.get("entreprise_id") else "",
            "date_creation": user.get("date_creation", datetime.utcnow()).isoformat()
        }
        return payload

    except ExpiredSignatureError:
        logger.warning("Jeton expiré")
        return None
    except InvalidTokenError as e:
        logger.warning(f"Jeton invalide: {e}")
        return None
    except Exception as e:
        logger.error(f"Erreur de vérification du jeton: {e}", exc_info=True)
        return None

@auth_bp.route("/register", methods=["POST"])
def register():
    """Register a new candidate or recruiter."""
    try:
        data = request.get_json()
        logger.info(f"Données d'inscription reçues: {data}")
        required_fields = ["nom", "email", "mot_de_passe", "telephone", "acceptTerms", "role"]
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            logger.warning(f"Champs manquants: {missing_fields}")
            return jsonify({"message": f"Champs manquants: {', '.join(missing_fields)}"}), 400

        if not isinstance(data["acceptTerms"], bool) or not data["acceptTerms"]:
            logger.warning("acceptTerms invalide ou manquant")
            return jsonify({"message": "Vous devez accepter les conditions d'utilisation"}), 400

        role = data["role"]
        if role not in ["candidat", "recruteur"]:
            logger.warning(f"Rôle invalide: {role}")
            return jsonify({"message": "Rôle invalide. Doit être 'candidat' ou 'recruteur'"}), 400

        if role == "recruteur" and "entreprise_id" not in data:
            logger.warning("entreprise_id manquant pour recruteur")
            return jsonify({"message": "ID de l'entreprise requis pour les recruteurs"}), 400

        mot_de_passe = data["mot_de_passe"]
        if len(mot_de_passe) < 8 or not any(c.isupper() for c in mot_de_passe) or not any(c.isdigit() for c in mot_de_passe):
            logger.warning("Format de mot de passe invalide")
            return jsonify({"message": "Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre"}), 400

        if current_app.mongo.db.utilisateurs.find_one({"email": data["email"]}):
            logger.warning(f"Email déjà utilisé: {data['email']}")
            return jsonify({"message": "Cet email existe déjà"}), 400

        hashed_password = hashpw(data["mot_de_passe"].encode("utf-8"), gensalt())

        user_data = {
            "nom": data["nom"],
            "email": data["email"],
            "mot_de_passe": hashed_password,
            "telephone": data["telephone"],
            "role": role,
            "date_creation": datetime.utcnow(),
            "date_maj": datetime.utcnow()
        }

        if role == "recruteur":
            if not ObjectId.is_valid(data["entreprise_id"]):
                logger.warning(f"Format entreprise_id invalide: {data['entreprise_id']}")
                return jsonify({"message": "Format d'ID d'entreprise invalide"}), 400
            entreprise = current_app.mongo.db.entreprises.find_one({"_id": ObjectId(data["entreprise_id"])})
            if not entreprise:
                logger.warning(f"Entreprise introuvable: {data['entreprise_id']}")
                return jsonify({"message": "Entreprise non trouvée"}), 404
            user_data["entreprise_id"] = ObjectId(data["entreprise_id"])

        result = current_app.mongo.db.utilisateurs.insert_one(user_data)
        user_id = result.inserted_id

        # Create corresponding candidate or recruiter profile
        if role == "candidat":
            candidat_data = {
                "utilisateur_id": user_id,
                "cv_path": "",
                "competences": [],
                "experience": 0,
                "date_creation": datetime.utcnow(),
                "date_maj": datetime.utcnow()
            }
            current_app.mongo.db.candidats.insert_one(candidat_data)
        elif role == "recruteur":
            recruteur_data = {
                "utilisateur_id": user_id,
                "entreprise_id": ObjectId(data["entreprise_id"]),
                "poste": "Recruteur",
                "offres_ids": [],
                "date_creation": datetime.utcnow(),
                "date_maj": datetime.utcnow()
            }
            current_app.mongo.db.recruteurs.insert_one(recruteur_data)

        token = generate_token(user_id, role)

        response_data = {
            "id": str(user_id),
            "nom": data["nom"],
            "email": data["email"],
            "telephone": data["telephone"],
            "role": role
        }
        if role == "recruteur":
            response_data["entreprise_id"] = data["entreprise_id"]

        logger.info(f"Utilisateur ID {user_id} enregistré avec rôle {role}")
        return jsonify({
            "message": f"{role.capitalize()} enregistré avec succès",
            "token": token,
            "user": response_data
        }), 201

    except Exception as e:
        logger.error(f"Erreur d'inscription: {str(e)}", exc_info=True)
        return jsonify({"message": "Erreur serveur lors de l'inscription", "details": str(e)}), 500

@auth_bp.route("/login", methods=["POST"])
def login():
    """Login a candidate or recruiter."""
    try:
        data = request.get_json()
        if not all(field in data for field in ["email", "mot_de_passe"]):
            logger.warning("Email ou mot de passe manquant")
            return jsonify({"message": "Email et mot de passe requis"}), 400

        user = current_app.mongo.db.utilisateurs.find_one({"email": data["email"]})
        if not user:
            logger.warning(f"Utilisateur introuvable avec email: {data['email']}")
            return jsonify({"message": "Identifiants invalides"}), 401

        if not checkpw(data["mot_de_passe"].encode("utf-8"), user["mot_de_passe"]):
            logger.warning(f"Mot de passe incorrect pour ID {user['_id']}")
            return jsonify({"message": "Identifiants invalides"}), 401

        if user["role"] not in ["candidat", "recruteur"]:
            logger.warning(f"Rôle invalide pour ID {user['_id']}: {user['role']}")
            return jsonify({"message": "Rôle utilisateur invalide"}), 400

        token = generate_token(user["_id"], user["role"])

        user_data = {
            "id": str(user["_id"]),
            "nom": user["nom"],
            "email": user["email"],
            "telephone": user["telephone"],
            "role": user["role"]
        }
        if user["role"] == "recruteur":
            user_data["entreprise_id"] = str(user.get("entreprise_id", "")) if user.get("entreprise_id") else ""

        logger.info(f"Utilisateur ID {user['_id']} connecté avec rôle {user['role']}")
        return jsonify({
            "message": "Connexion réussie",
            "token": token,
            "user": user_data
        }), 200

    except Exception as e:
        logger.error(f"Erreur de connexion: {str(e)}", exc_info=True)
        return jsonify({"message": "Erreur serveur lors de la connexion", "details": str(e)}), 500

@auth_bp.route("/me", methods=["GET"])
def get_profile():
    """Get the authenticated user's profile."""
    try:
        token = request.headers.get("Authorization")
        decoded = verify_token(token)
        if not decoded:
            logger.warning("Jeton invalide ou manquant")
            return jsonify({"message": "Authentification requise ou invalide."}), 401

        user = current_app.mongo.db.utilisateurs.find_one({"_id": ObjectId(decoded["id"])})
        if not user:
            logger.warning(f"Utilisateur introuvable: {decoded['id']}")
            return jsonify({"message": "Utilisateur non trouvé"}), 404

        user_data = {
            "id": str(user["_id"]),
            "nom": user["nom"],
            "email": user["email"],
            "telephone": user["telephone"],
            "role": user["role"],
            "date_creation": user["date_creation"].isoformat()
        }
        if user["role"] == "recruteur":
            user_data["entreprise_id"] = str(user.get("entreprise_id", "")) if user.get("entreprise_id") else ""

        logger.info(f"Profil récupéré pour ID {user['_id']}")
        return jsonify({"user": user_data}), 200

    except Exception as e:
        logger.error(f"Erreur de récupération de profil: {str(e)}", exc_info=True)
        return jsonify({"message": "Erreur serveur lors de la récupération du profil", "details": str(e)}), 500

@auth_bp.route("/logout", methods=["POST"])
def logout():
    """Logout the authenticated user."""
    try:
        token = request.headers.get("Authorization")
        decoded = verify_token(token)
        if not decoded:
            logger.warning("Jeton invalide ou manquant")
            return jsonify({"message": "Authentification requise ou invalide."}), 401

        token = token.split(" ")[1]
        current_app.mongo.db.blacklist.insert_one({
            "token": token,
            "expires_at": datetime.utcnow() + timedelta(hours=1)
        })

        logger.info(f"Utilisateur ID {decoded['id']} déconnecté")
        return jsonify({"message": "Déconnexion réussie"}), 200

    except Exception as e:
        logger.error(f"Erreur de déconnexion: {str(e)}", exc_info=True)
        return jsonify({"message": "Erreur serveur lors de la déconnexion", "details": str(e)}), 500

@auth_bp.route("/entreprise", methods=["POST"])
def create_entreprise():
    """Create a new enterprise."""
    try:
        data = request.get_json()
        logger.info(f"Données de création d'entreprise reçues: {data}")
        if not data.get("nom"):
            logger.warning("Nom d'entreprise manquant")
            return jsonify({"message": "Nom de l'entreprise requis"}), 400
        result = current_app.mongo.db.entreprises.insert_one({
            "nom": data["nom"],
            "secteur": data.get("secteur", ""),
            "localisation": data.get("localisation", ""),
            "description": data.get("description", ""),
            "date_creation": datetime.utcnow(),
            "date_maj": datetime.utcnow()
        })
        logger.info(f"Entreprise créée avec ID: {result.inserted_id}")
        return jsonify({
            "message": "Entreprise créée",
            "entreprise_id": str(result.inserted_id)
        }), 201
    except Exception as e:
        logger.error(f"Erreur de création d'entreprise: {str(e)}", exc_info=True)
        return jsonify({"message": "Erreur serveur lors de la création de l'entreprise", "details": str(e)}), 500