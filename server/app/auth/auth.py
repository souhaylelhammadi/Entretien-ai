from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from datetime import datetime, timedelta
import logging
import re
from bcrypt import hashpw, gensalt, checkpw

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__, url_prefix="/api/auth")

# jwt_manager will be set in init_auth
jwt_manager = None

def init_auth(jwt_mgr):
    """Initialize the auth blueprint with the JWT manager."""
    global jwt_manager
    jwt_manager = jwt_mgr
    logger.info("Auth blueprint initialized with JWTManager")

# Helper functions
def hash_password(password):
    """Hash a password using bcrypt."""
    return hashpw(password.encode("utf-8"), gensalt())

def verify_password(plain_password, hashed_password):
    """Verify a password against its hash."""
    return checkpw(plain_password.encode("utf-8"), hashed_password)

def validate_email(email):
    """Validate email format."""
    return re.match(r"^\S+@\S+\.\S+$", email)

def validate_password(password):
    """Validate password strength."""
    return (
        len(password) >= 8 and
        any(c.isupper() for c in password) and
        any(c.isdigit() for c in password)
    )

def validate_telephone(telephone):
    """Validate telephone format (10 digits)."""
    return re.match(r"^\d{10}$", telephone)

# Register
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

        if not validate_email(data["email"]):
            logger.warning(f"Format d'email invalide: {data['email']}")
            return jsonify({"message": "Format d'email invalide"}), 400

        if not validate_password(data["mot_de_passe"]):
            logger.warning("Format de mot de passe invalide")
            return jsonify({"message": "Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre"}), 400

        if not validate_telephone(data["telephone"]):
            logger.warning(f"Format de téléphone invalide: {data['telephone']}")
            return jsonify({"message": "Le numéro de téléphone doit contenir 10 chiffres"}), 400

        # Rate limiting
        db = current_app.mongo.db
        max_attempts = current_app.config.get("MAX_LOGIN_ATTEMPTS", 5)
        lockout_minutes = current_app.config.get("LOCKOUT_TIME_MINUTES", 30)
        lockout_time = datetime.utcnow() - timedelta(minutes=lockout_minutes)

        attempts = db.activities.count_documents({
            "user_id": None,
            "activity_type": "register_attempt",
            "timestamp": {"$gte": lockout_time},
            "ip_address": request.remote_addr
        })

        if attempts >= max_attempts:
            logger.warning(f"Trop de tentatives d'inscription depuis IP: {request.remote_addr}")
            return jsonify({"message": f"Trop de tentatives. Réessayez dans {lockout_minutes} minutes"}), 429

        # Log attempt
        db.activities.insert_one({
            "user_id": None,
            "activity_type": "register_attempt",
            "timestamp": datetime.utcnow(),
            "ip_address": request.remote_addr
        })

        # Check if user exists
        if db.utilisateurs.find_one({"email": data["email"]}):
            logger.warning(f"Email déjà utilisé: {data['email']}")
            return jsonify({"message": "Cet email est déjà utilisé"}), 400

        hashed_password = hash_password(data["mot_de_passe"])

        user_data = {
            "nom": data["nom"],
            "email": data["email"],
            "mot_de_passe": hashed_password,
            "telephone": data["telephone"],
            "role": role,
            "acceptTerms": data["acceptTerms"],
            "date_creation": datetime.utcnow(),
            "date_maj": datetime.utcnow()
        }

        if role == "recruteur":
            if not ObjectId.is_valid(data["entreprise_id"]):
                logger.warning(f"Format entreprise_id invalide: {data['entreprise_id']}")
                return jsonify({"message": "Format d'ID d'entreprise invalide"}), 400
            entreprise = db.entreprises.find_one({"_id": ObjectId(data["entreprise_id"])})
            if not entreprise:
                logger.warning(f"Entreprise introuvable: {data['entreprise_id']}")
                return jsonify({"message": "Entreprise non trouvée"}), 404
            user_data["entreprise_id"] = ObjectId(data["entreprise_id"])

        result = db.utilisateurs.insert_one(user_data)
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
            db.candidats.insert_one(candidat_data)
        elif role == "recruteur":
            recruteur_data = {
                "utilisateur_id": user_id,
                "entreprise_id": ObjectId(data["entreprise_id"]),
                "poste": "Recruteur",
                "offres_ids": [],
                "date_creation": datetime.utcnow(),
                "date_maj": datetime.utcnow()
            }
            db.recruteurs.insert_one(recruteur_data)

        token = jwt_manager.create_token(str(user_id), role)

        # Log successful registration
        jwt_manager.log_auth_event(
            user_id=str(user_id),
            event_type="register_success",
            success=True,
            ip_address=request.remote_addr
        )

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
        jwt_manager.log_auth_event(
            user_id=None,
            event_type="register_failure",
            success=False,
            error=str(e),
            ip_address=request.remote_addr
        )
        return jsonify({"message": "Erreur serveur lors de l'inscription", "details": str(e)}), 500

# Create entreprise (for recruiters)
@auth_bp.route("/entreprise", methods=["POST"])
def create_entreprise():
    """Create a new entreprise for recruiters."""
    try:
        data = request.get_json()
        if not data.get("nom"):
            logger.warning("Nom de l'entreprise manquant")
            return jsonify({"message": "Le nom de l'entreprise est requis"}), 400

        db = current_app.mongo.db
        if db.entreprises.find_one({"nom": data["nom"]}):
            logger.warning(f"Entreprise déjà existante: {data['nom']}")
            return jsonify({"message": "Cette entreprise existe déjà"}), 400

        entreprise_data = {
            "nom": data["nom"],
            "secteur": data.get("secteur", ""),
            "taille": data.get("taille", ""),
            "date_creation": datetime.utcnow()
        }

        result = db.entreprises.insert_one(entreprise_data)
        entreprise_id = str(result.inserted_id)

        logger.info(f"Entreprise ID {entreprise_id} créée")
        return jsonify({"entreprise_id": entreprise_id}), 201

    except Exception as e:
        logger.error(f"Erreur lors de la création de l'entreprise: {str(e)}", exc_info=True)
        return jsonify({"message": "Erreur serveur lors de la création de l'entreprise", "details": str(e)}), 500

# Login
@auth_bp.route("/login", methods=["POST"])
def login():
    """Login a candidate or recruiter."""
    try:
        data = request.get_json()
        if not all(field in data for field in ["email", "mot_de_passe"]):
            logger.warning("Email ou mot de passe manquant")
            return jsonify({"message": "Email et mot de passe requis"}), 400

        # Rate limiting
        db = current_app.mongo.db
        max_attempts = current_app.config.get("MAX_LOGIN_ATTEMPTS", 5)
        lockout_minutes = current_app.config.get("LOCKOUT_TIME_MINUTES", 30)
        lockout_time = datetime.utcnow() - timedelta(minutes=lockout_minutes)

        attempts = db.activities.count_documents({
            "user_id": None,
            "activity_type": "login_attempt",
            "timestamp": {"$gte": lockout_time},
            "ip_address": request.remote_addr
        })

        if attempts >= max_attempts:
            logger.warning(f"Trop de tentatives de connexion depuis IP: {request.remote_addr}")
            return jsonify({"message": f"Trop de tentatives. Réessayez dans {lockout_minutes} minutes"}), 429

        # Log attempt
        db.activities.insert_one({
            "user_id": None,
            "activity_type": "login_attempt",
            "timestamp": datetime.utcnow(),
            "ip_address": request.remote_addr
        })

        user = db.utilisateurs.find_one({"email": data["email"]})
        if not user:
            logger.warning(f"Utilisateur introuvable avec email: {data['email']}")
            jwt_manager.log_auth_event(
                user_id=None,
                event_type="login_failure",
                success=False,
                error="Utilisateur introuvable",
                ip_address=request.remote_addr
            )
            return jsonify({"message": "Identifiants incorrects"}), 401

        if not verify_password(data["mot_de_passe"], user["mot_de_passe"]):
            logger.warning(f"Mot de passe incorrect pour ID {user['_id']}")
            jwt_manager.log_auth_event(
                user_id=str(user["_id"]),
                event_type="login_failure",
                success=False,
                error="Mot de passe incorrect",
                ip_address=request.remote_addr
            )
            return jsonify({"message": "Identifiants incorrects"}), 401

        if user["role"] not in ["candidat", "recruteur"]:
            logger.warning(f"Rôle invalide pour ID {user['_id']}: {user['role']}")
            return jsonify({"message": "Rôle utilisateur invalide"}), 400

        user_id = str(user["_id"])
        token = jwt_manager.create_token(user_id, user["role"])

        # Create user session
        db.user_sessions.insert_one({
            "user_id": user_id,
            "ip_address": request.remote_addr,
            "login_time": datetime.utcnow(),
            "active": True
        })

        # Log successful login
        jwt_manager.log_auth_event(
            user_id=user_id,
            event_type="login_success",
            success=True,
            ip_address=request.remote_addr
        )

        user_data = {
            "id": user_id,
            "nom": user["nom"],
            "email": user["email"],
            "telephone": user["telephone"],
            "role": user["role"]
        }
        if user["role"] == "recruteur":
            user_data["entreprise_id"] = str(user.get("entreprise_id", "")) if user.get("entreprise_id") else ""

        logger.info(f"Utilisateur ID {user_id} connecté avec rôle {user['role']}")
        return jsonify({
            "message": "Connexion réussie",
            "token": token,
            "user": user_data
        }), 200

    except Exception as e:
        logger.error(f"Erreur de connexion: {str(e)}", exc_info=True)
        jwt_manager.log_auth_event(
            user_id=None,
            event_type="login_failure",
            success=False,
            error=str(e),
            ip_address=request.remote_addr
        )
        return jsonify({"message": "Erreur serveur lors de la connexion", "details": str(e)}), 500

# Logout
@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Logout the user and blacklist the token."""
    if not jwt_manager:
        logger.error("jwt_manager non initialisé")
        return jsonify({"message": "Erreur serveur: authentification non configurée"}), 500

    @jwt_manager.require_auth()
    def protected_logout(payload):
        try:
            token = request.headers.get("Authorization")
            if not token:
                logger.warning("Token manquant dans les headers")
                return jsonify({"message": "Token manquant"}), 400

            user_id = payload["sub"]
            if jwt_manager.blacklist_token(token):
                db = current_app.mongo.db
                # Update user session
                db.user_sessions.update_one(
                    {"user_id": user_id, "active": True},
                    {"$set": {"active": False, "logout_time": datetime.utcnow()}}
                )

                # Log logout
                jwt_manager.log_auth_event(
                    user_id=user_id,
                    event_type="logout",
                    success=True,
                    ip_address=request.remote_addr
                )

                logger.info(f"Utilisateur ID {user_id} déconnecté")
                return jsonify({"message": "Déconnexion réussie"}), 200
            else:
                logger.warning("Échec de la mise en liste noire du token")
                jwt_manager.log_auth_event(
                    user_id=user_id,
                    event_type="logout_failure",
                    success=False,
                    error="Échec de la mise en liste noire du token",
                    ip_address=request.remote_addr
                )
                return jsonify({"message": "Erreur lors de la déconnexion"}), 400
        except Exception as e:
            logger.error(f"Erreur lors de la déconnexion: {str(e)}", exc_info=True)
            jwt_manager.log_auth_event(
                user_id=payload["sub"],
                event_type="logout_failure",
                success=False,
                error=str(e),
                ip_address=request.remote_addr
            )
            return jsonify({"message": "Erreur serveur lors de la déconnexion"}), 500

    return protected_logout()

# Get user profile
@auth_bp.route('/me', methods=['GET'])
def get_profile():
    """Get current user profile."""
    if not jwt_manager:
        logger.error("jwt_manager non initialisé")
        return jsonify({"message": "Erreur serveur: authentification non configurée"}), 500

    @jwt_manager.require_auth()
    def protected_get_profile(payload):
        try:
            user_id = payload["sub"]
            db = current_app.mongo.db
            user = db.utilisateurs.find_one({"_id": ObjectId(user_id)})

            if not user:
                logger.warning(f"Utilisateur introuvable: {user_id}")
                return jsonify({"message": "Utilisateur non trouvé"}), 404

            user_data = {
                "id": str(user["_id"]),
                "nom": user["nom"],
                "email": user["email"],
                "telephone": user["telephone"],
                "role": user["role"]
            }

            if user["role"] == "recruteur":
                recruteur = db.recruteurs.find_one({"utilisateur_id": ObjectId(user_id)})
                if recruteur:
                    user_data["poste"] = recruteur.get("poste", "")
                    user_data["entreprise_id"] = str(recruteur.get("entreprise_id", ""))
                    user_data["offres_ids"] = [str(oid) for oid in recruteur.get("offres_ids", [])]

                    entreprise = db.entreprises.find_one({"_id": recruteur.get("entreprise_id")})
                    if entreprise:
                        user_data["entreprise"] = {
                            "id": str(entreprise["_id"]),
                            "nom": entreprise["nom"],
                            "secteur": entreprise.get("secteur", ""),
                            "taille": entreprise.get("taille", "")
                        }

            # Log profile access
            jwt_manager.log_auth_event(
                user_id=user_id,
                event_type="profile_access",
                success=True,
                ip_address=request.remote_addr
            )

            return jsonify(user_data), 200

        except Exception as e:
            logger.error(f"Erreur lors de la récupération du profil: {str(e)}", exc_info=True)
            jwt_manager.log_auth_event(
                user_id=payload["sub"],
                event_type="profile_access_failure",
                success=False,
                error=str(e),
                ip_address=request.remote_addr
            )
            return jsonify({"message": "Erreur serveur"}), 500

    return protected_get_profile()

# Update user profile
@auth_bp.route('/update', methods=['PUT'])
def update_user_profile():
    """Update the current user's profile."""
    if not jwt_manager:
        logger.error("jwt_manager non initialisé")
        return jsonify({"message": "Erreur serveur: authentification non configurée"}), 500

    @jwt_manager.require_auth()
    def protected_update_user_profile(payload):
        try:
            data = request.get_json()
            db = current_app.mongo.db
            user_id = payload['sub']

            # Validate allowed fields
            update_data = {}
            if 'nom' in data and data['nom']:
                update_data['nom'] = data['nom']
            if 'email' in data and data['email']:
                if not validate_email(data['email']):
                    logger.warning(f"Format d'email invalide: {data['email']}")
                    return jsonify({"message": "Format d'email invalide"}), 400
                # Check if email is taken by another user
                existing_user = db.utilisateurs.find_one({"email": data["email"], "_id": {"$ne": ObjectId(user_id)}})
                if existing_user:
                    logger.warning(f"Email déjà utilisé: {data['email']}")
                    return jsonify({"message": "Cet email est déjà utilisé"}), 400
                update_data['email'] = data['email']
            if 'telephone' in data and data['telephone']:
                if not validate_telephone(data['telephone']):
                    logger.warning(f"Format de téléphone invalide: {data['telephone']}")
                    return jsonify({"message": "Le numéro de téléphone doit contenir 10 chiffres"}), 400
                update_data['telephone'] = data['telephone']
            if 'mot_de_passe' in data and data['mot_de_passe']:
                if not validate_password(data['mot_de_passe']):
                    logger.warning("Format de mot de passe invalide")
                    return jsonify({"message": "Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre"}), 400
                update_data['mot_de_passe'] = hash_password(data['mot_de_passe'])

            if not update_data:
                logger.warning("Aucune donnée valide à mettre à jour")
                return jsonify({"message": "Aucune donnée valide à mettre à jour"}), 400

            update_data['date_maj'] = datetime.utcnow()

            result = db.utilisateurs.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": update_data}
            )

            if result.modified_count == 0:
                logger.warning(f"Aucune modification pour l'utilisateur ID {user_id}")
                return jsonify({"message": "Aucune modification effectuée"}), 400

            updated_user = db.utilisateurs.find_one({"_id": ObjectId(user_id)})
            user_data = {
                "id": str(updated_user["_id"]),
                "nom": updated_user["nom"],
                "email": updated_user["email"],
                "telephone": updated_user["telephone"],
                "role": updated_user["role"]
            }
            if updated_user["role"] == "recruteur":
                user_data["entreprise_id"] = str(updated_user.get("entreprise_id", "")) if updated_user.get("entreprise_id") else ""

            # Log profile update
            jwt_manager.log_auth_event(
                user_id=user_id,
                event_type="profile_update",
                success=True,
                ip_address=request.remote_addr
            )

            logger.info(f"Profil utilisateur ID {user_id} mis à jour")
            return jsonify({
                "message": "Profil mis à jour avec succès",
                "user": user_data
            }), 200

        except Exception as e:
            logger.error(f"Erreur lors de la mise à jour du profil: {str(e)}", exc_info=True)
            jwt_manager.log_auth_event(
                user_id=payload['sub'],
                event_type="profile_update_failure",
                success=False,
                error=str(e),
                ip_address=request.remote_addr
            )
            return jsonify({"message": "Erreur serveur lors de la mise à jour du profil", "details": str(e)}), 500

    return protected_update_user_profile()