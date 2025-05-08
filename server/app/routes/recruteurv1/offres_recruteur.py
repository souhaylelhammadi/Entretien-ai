from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from pymongo.errors import PyMongoError
import datetime
import logging
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from middleware import require_auth
import os
# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

offres_recruteur_bp = Blueprint('offres_recruteur', __name__)

# Standardized collection names
OFFRES_COLLECTION = 'offres'
USERS_COLLECTION = 'utilisateurs'
CANDIDATURES_COLLECTION = 'candidatures'
RECRUTEURS_COLLECTION = 'recruteurs'

# Configure CORS
CORS(offres_recruteur_bp, 
     resources={r"/*": {"origins": "http://localhost:3000"}},
     supports_credentials=True,
     max_age=3600)

# Configure rate limiting
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# Helper function to get the JWT manager
def get_jwt_manager():
    """Helper function to get the JWT manager instance"""
    from flask import current_app
    try:
        # First try to get jwt_manager from Flask extensions
        if hasattr(current_app, 'extensions') and 'jwt_manager' in current_app.extensions:
            return current_app.extensions['jwt_manager']
        
        # If not in extensions, import directly
        import sys, os
        # Add the current directory to the Python path
        current_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        if current_dir not in sys.path:
            sys.path.insert(0, current_dir)
        # Import directly from the module
        from jwt_manager import jwt_manager
        
        # If not initialized yet, initialize it
        if not jwt_manager._initialized:
            jwt_manager._initialize()
            
        return jwt_manager
        
    except Exception as e:
        logger.error(f"Error getting JWT manager: {str(e)}")
        # Return an empty object that can be used as a fallback
        class EmptyJWTManager:
            def verify_token(self, token):
                logger.error("Using empty JWT manager - token verification failed")
                return None
        return EmptyJWTManager()

# Helper function to format job offer response
def format_offre(offre):
    return {
        "id": str(offre["_id"]),
        "titre": str(offre.get("titre", "Titre non spécifié")),
        "description": str(offre.get("description", "Description non disponible")),
        "localisation": str(offre.get("localisation", "Localisation non spécifiée")),
        "departement": str(offre.get("departement", "Département non spécifié")),
        "entreprise": str(offre.get("entreprise", "")),
        "recruteur_id": str(offre.get("recruteur_id", "")),
        "date_creation": offre.get("date_creation", datetime.datetime.utcnow()).isoformat() + "Z",
        "date_maj": offre.get("date_maj", datetime.datetime.utcnow()).isoformat() + "Z",
        "statut": str(offre.get("statut", "ouverte")),
        "competences_requises": offre.get("competences_requises", []),
        "questions_ids": [str(qid) for qid in offre.get("questions_ids", [])],
        "candidature_ids": [str(cid) for cid in offre.get("candidature_ids", [])],
        "valide": offre.get("statut", "ouverte") == "ouverte",
    }

# Route to fetch all job offers
@offres_recruteur_bp.route("/offres-emploi", methods=["GET"])
@require_auth("recruteur")
def get_offres_emploi(auth_payload):
    try:
        user_id = auth_payload["user_id"]
        logger.info(f"User ID: {user_id}")
        
        db = current_app.mongo
        # D'abord, récupérer l'utilisateur
        user = db[USERS_COLLECTION].find_one({"_id": ObjectId(str(user_id))})
        if not user:
            logger.error(f"Utilisateur non trouvé pour l'ID: {user_id}")
            return jsonify({"error": "Utilisateur non trouvé", "code": "USER_NOT_FOUND"}), 404
            
        # Ensuite, chercher le recruteur correspondant
        recruteur = db[RECRUTEURS_COLLECTION].find_one({"utilisateur_id": ObjectId(str(user_id))})
        if not recruteur:
            logger.error(f"Recruteur non trouvé pour l'utilisateur: {user_id}")
            return jsonify({"error": "Recruteur non trouvé", "code": "RECRUITER_NOT_FOUND"}), 404
            
        recruteur_id = recruteur["_id"]
        logger.info(f"Recruteur ID: {recruteur_id}")
        
        # Filtrer les offres par recruteur connecté
        offres_collection = db[OFFRES_COLLECTION]
        offres = list(offres_collection.find({"recruteur_id": ObjectId(recruteur_id)}))
        logger.info(f"Nombre d'offres trouvées: {len(offres)}")
        
        formatted_offres = [format_offre(offre) for offre in offres]
        logger.info(f"Retour de {len(formatted_offres)} offres d'emploi pour le recruteur {recruteur_id}")
        return jsonify({"offres": formatted_offres}), 200

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans /offres-emploi: {str(e)}")
        return jsonify({"error": "Erreur de base de données"}), 500
    except Exception as e:
        logger.error(f"Erreur dans /offres-emploi: {str(e)}")
        return jsonify({"error": f"Erreur serveur: {str(e)}"}), 500

# Route to fetch a single job offer by ID
@offres_recruteur_bp.route("/offres-emploi/<id>", methods=["GET"])
@require_auth("recruteur")
def get_offre_by_id(auth_payload, id):
    try:
        user_id = auth_payload["user_id"]
        logger.info(f"User ID: {user_id}")
        
        if not ObjectId.is_valid(id):
            logger.warning(f"ID invalide fourni: {id}")
            return jsonify({"error": "ID de l'offre invalide"}), 400

        db = current_app.mongo
        # D'abord, récupérer l'utilisateur
        user = db[USERS_COLLECTION].find_one({"_id": ObjectId(str(user_id))})
        if not user:
            logger.error(f"Utilisateur non trouvé pour l'ID: {user_id}")
            return jsonify({"error": "Utilisateur non trouvé", "code": "USER_NOT_FOUND"}), 404
            
        # Ensuite, chercher le recruteur correspondant
        recruteur = db[RECRUTEURS_COLLECTION].find_one({"utilisateur_id": ObjectId(str(user_id))})
        if not recruteur:
            logger.error(f"Recruteur non trouvé pour l'utilisateur: {user_id}")
            return jsonify({"error": "Recruteur non trouvé", "code": "RECRUITER_NOT_FOUND"}), 404
            
        recruteur_id = recruteur["_id"]
        logger.info(f"Recruteur ID: {recruteur_id}")
        
        offres_collection = db[OFFRES_COLLECTION]
        offre = offres_collection.find_one({
            "_id": ObjectId(id),
            "recruteur_id": ObjectId(recruteur_id)
        })
        
        if not offre:
            logger.info(f"Offre non trouvée pour ID: {id} ou n'appartient pas au recruteur: {recruteur_id}")
            return jsonify({"error": "Offre non trouvée ou accès non autorisé"}), 404

        formatted_offre = format_offre(offre)
        logger.info(f"Offre trouvée pour ID: {id}")
        return jsonify(formatted_offre), 200

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans /offres-emploi/{id}: {str(e)}")
        return jsonify({"error": "Erreur de base de données"}), 500
    except Exception as e:
        logger.error(f"Erreur dans /offres-emploi/{id}: {str(e)}")
        return jsonify({"error": f"Erreur serveur: {str(e)}"}), 500

# Route to submit a job application
@offres_recruteur_bp.route("/candidatures", methods=["POST"])
def submit_candidature():
    try:
        token = request.headers.get("Authorization")
        if not token:
            logger.warning("Jeton manquant dans la requête /candidatures")
            return jsonify({"error": "Jeton manquant"}), 401

        # Vérifier le token et obtenir l'ID de l'utilisateur
        user_id = get_jwt_manager().verify_token(token)
        if not user_id:
            logger.warning("Échec de la vérification du token")
            return jsonify({"error": "Token invalide ou expiré"}), 401
        
        # Récupérer l'utilisateur depuis la base de données
        db = current_app.mongo
        user = db[USERS_COLLECTION].find_one({"_id": ObjectId(user_id)})
        if not user:
            logger.warning(f"Utilisateur non trouvé pour ID: {user_id}")
            return jsonify({"error": "Utilisateur non trouvé"}), 404
            
        user_email = user.get("email")

        offre_id = request.form.get("offre_id")
        lettre_motivation = request.form.get("lettre_motivation")
        cv_file = request.files.get("cv")

        if not ObjectId.is_valid(offre_id):
            logger.warning(f"ID d'offre invalide: {offre_id}")
            return jsonify({"error": "ID de l'offre invalide"}), 400

        offres_collection = db[OFFRES_COLLECTION]
        offre = offres_collection.find_one({"_id": ObjectId(offre_id)})
        if not offre:
            logger.info(f"Offre non trouvée pour ID: {offre_id}")
            return jsonify({"error": "Offre non trouvée"}), 404
        if offre.get("statut", "ouverte") != "ouverte":
            logger.info(f"Offre fermée pour ID: {offre_id}")
            return jsonify({"error": "Cette offre est fermée"}), 400

        if not db[USERS_COLLECTION].find_one({"_id": ObjectId(offre["recruteur_id"]), "role": "recruteur"}):
            logger.warning(f"Recruteur non trouvé pour ID: {offre['recruteur_id']}")
            return jsonify({"error": "Recruteur non trouvé"}), 404

        upload_folder = current_app.config.get("UPLOAD_FOLDER", "uploads")
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder)

        cv_filename = f"{user_email}_{offre_id}_{cv_file.filename}"
        cv_path = os.path.join(upload_folder, cv_filename)
        cv_file.save(cv_path)
        logger.info(f"CV sauvegardé à: {cv_path}")

        candidatures_collection = db[CANDIDATURES_COLLECTION]
        candidature = {
            "user_email": user_email,
            "offre_id": ObjectId(offre_id),
            "lettre_motivation": lettre_motivation,
            "cv_path": cv_path,
            "created_at": datetime.datetime.utcnow(),
        }

        result = candidatures_collection.insert_one(candidature)
        candidature_id = str(result.inserted_id)

        offres_collection.update_one(
            {"_id": ObjectId(offre_id)},
            {"$push": {"candidature_ids": ObjectId(candidature_id)}}
        )

        logger.info(f"Candidature soumise pour utilisateur: {user_email}, offre: {offre_id}, candidature: {candidature_id}")
        return jsonify({"message": "Candidature soumise avec succès", "candidature_id": candidature_id}), 201

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans /candidatures: {str(e)}")
        return jsonify({"error": "Erreur de base de données"}), 500
    except Exception as e:
        logger.error(f"Erreur dans /candidatures: {str(e)}")
        return jsonify({"error": f"Erreur serveur: {str(e)}"}), 500

# Route to create a new job offer
@offres_recruteur_bp.route("/offres-emploi", methods=["POST"])
@require_auth("recruteur")
def create_offre(auth_payload):
    try:
        user_id = auth_payload["user_id"]
        logger.info(f"User ID: {user_id}")
        
        db = current_app.mongo
        # D'abord, récupérer l'utilisateur
        user = db[USERS_COLLECTION].find_one({"_id": ObjectId(str(user_id))})
        if not user:
            logger.error(f"Utilisateur non trouvé pour l'ID: {user_id}")
            return jsonify({"error": "Utilisateur non trouvé", "code": "USER_NOT_FOUND"}), 404
            
        # Ensuite, chercher le recruteur correspondant
        recruteur = db[RECRUTEURS_COLLECTION].find_one({"utilisateur_id": ObjectId(str(user_id))})
        if not recruteur:
            logger.error(f"Recruteur non trouvé pour l'utilisateur: {user_id}")
            return jsonify({"error": "Recruteur non trouvé", "code": "RECRUITER_NOT_FOUND"}), 404
            
        recruteur_id = recruteur["_id"]
        logger.info(f"Recruteur ID: {recruteur_id}")
        
        email = user.get("email", "")
        entreprise = email.split("@")[1].split(".")[0] if "@" in email else ""
        
        data = request.json
        if not data:
            return jsonify({"error": "Aucune donnée fournie"}), 400
            
        required_fields = ["titre", "description", "localisation", "departement"]
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Champ obligatoire manquant: {field}"}), 400
                
        offre = {
            "titre": data["titre"],
            "description": data["description"],
            "localisation": data["localisation"],
            "departement": data["departement"],
            "recruteur_id": ObjectId(recruteur_id),
            "entreprise": auth_payload.get("entreprise", entreprise),
            "date_creation": datetime.datetime.utcnow(),
            "date_maj": datetime.datetime.utcnow(),
            "statut": "ouverte",
            "competences_requises": data.get("competences_requises", []),
            "questions_ids": [],
            "candidature_ids": []
        }
        
        offres_collection = db[OFFRES_COLLECTION]
        result = offres_collection.insert_one(offre)
        offre_id = result.inserted_id
        
        created_offre = offres_collection.find_one({"_id": offre_id})
        formatted_offre = format_offre(created_offre)
        
        logger.info(f"Nouvelle offre créée: {offre_id} par recruteur {recruteur_id}")
        
        return jsonify({
            "success": True,
            "message": "Offre créée avec succès",
            "offre": formatted_offre
        }), 201

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans la création d'offre: {str(e)}")
        return jsonify({"error": "Erreur de base de données"}), 500
    except Exception as e:
        logger.error(f"Erreur dans la création d'offre: {str(e)}")
        return jsonify({"error": f"Erreur serveur: {str(e)}"}), 500

# Route to update a job offer
@offres_recruteur_bp.route("/offres-emploi/<id>", methods=["PUT"])
@require_auth("recruteur")
def update_offre(auth_payload, id):
    try:
        user_id = auth_payload["user_id"]
        logger.info(f"User ID: {user_id}")
        
        if not ObjectId.is_valid(id):
            logger.warning(f"ID invalide fourni: {id}")
            return jsonify({"error": "ID de l'offre invalide"}), 400
            
        db = current_app.mongo
        # D'abord, récupérer l'utilisateur
        user = db[USERS_COLLECTION].find_one({"_id": ObjectId(str(user_id))})
        if not user:
            logger.error(f"Utilisateur non trouvé pour l'ID: {user_id}")
            return jsonify({"error": "Utilisateur non trouvé", "code": "USER_NOT_FOUND"}), 404
            
        # Ensuite, chercher le recruteur correspondant
        recruteur = db[RECRUTEURS_COLLECTION].find_one({"utilisateur_id": ObjectId(str(user_id))})
        if not recruteur:
            logger.error(f"Recruteur non trouvé pour l'utilisateur: {user_id}")
            return jsonify({"error": "Recruteur non trouvé", "code": "RECRUITER_NOT_FOUND"}), 404
            
        recruteur_id = recruteur["_id"]
        logger.info(f"Recruteur ID: {recruteur_id}")
        
        data = request.json
        if not data:
            return jsonify({"error": "Aucune donnée fournie"}), 400
            
        offres_collection = db[OFFRES_COLLECTION]
        existing_offre = offres_collection.find_one({
            "_id": ObjectId(id),
            "recruteur_id": ObjectId(recruteur_id)
        })
        
        if not existing_offre:
            logger.info(f"Offre non trouvée pour ID: {id} ou n'appartient pas au recruteur: {recruteur_id}")
            return jsonify({"error": "Offre non trouvée ou accès non autorisé"}), 404
            
        update_data = {}
        allowed_fields = ["titre", "description", "localisation", "departement", 
                         "statut", "competences_requises"]
                         
        for field in allowed_fields:
            if field in data:
                update_data[field] = data[field]
                
        update_data["date_maj"] = datetime.datetime.utcnow()
        
        if "entreprise" in data or "recruteur_id" in data:
            logger.warning(f"Tentative de modification de l'entreprise ou du recruteur_id pour l'offre {id}")
            
        offres_collection.update_one(
            {"_id": ObjectId(id)},
            {"$set": update_data}
        )
        
        updated_offre = offres_collection.find_one({"_id": ObjectId(id)})
        formatted_offre = format_offre(updated_offre)

        logger.info(f"Offre mise à jour: {id} par recruteur {recruteur_id}")
        
        return jsonify({
            "success": True,
            "message": "Offre mise à jour avec succès",
            "offre": formatted_offre
        }), 200

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans la mise à jour d'offre: {str(e)}")
        return jsonify({"error": "Erreur de base de données"}), 500
    except Exception as e:
        logger.error(f"Erreur dans la mise à jour d'offre: {str(e)}")
        return jsonify({"error": f"Erreur serveur: {str(e)}"}), 500

# Route to delete a job offer
@offres_recruteur_bp.route("/offres-emploi/<id>", methods=["DELETE"])
@require_auth("recruteur")
def delete_offre(auth_payload, id):
    try:
        user_id = auth_payload["user_id"]
        logger.info(f"User ID: {user_id}")
        
        if not ObjectId.is_valid(id):
            logger.warning(f"ID invalide fourni: {id}")
            return jsonify({"error": "ID de l'offre invalide"}), 400

        db = current_app.mongo
        # D'abord, récupérer l'utilisateur
        user = db[USERS_COLLECTION].find_one({"_id": ObjectId(str(user_id))})
        if not user:
            logger.error(f"Utilisateur non trouvé pour l'ID: {user_id}")
            return jsonify({"error": "Utilisateur non trouvé", "code": "USER_NOT_FOUND"}), 404
            
        # Ensuite, chercher le recruteur correspondant
        recruteur = db[RECRUTEURS_COLLECTION].find_one({"utilisateur_id": ObjectId(str(user_id))})
        if not recruteur:
            logger.error(f"Recruteur non trouvé pour l'utilisateur: {user_id}")
            return jsonify({"error": "Recruteur non trouvé", "code": "RECRUITER_NOT_FOUND"}), 404
            
        recruteur_id = recruteur["_id"]
        logger.info(f"Recruteur ID: {recruteur_id}")
        
        offres_collection = db[OFFRES_COLLECTION]
        existing_offre = offres_collection.find_one({
            "_id": ObjectId(id),
            "recruteur_id": ObjectId(recruteur_id)
        })
        
        if not existing_offre:
            logger.info(f"Offre non trouvée pour ID: {id} ou n'appartient pas au recruteur: {recruteur_id}")
            return jsonify({"error": "Offre non trouvée ou accès non autorisé"}), 404
            
        result = offres_collection.delete_one({
            "_id": ObjectId(id),
            "recruteur_id": ObjectId(recruteur_id)
        })
        
        if result.deleted_count == 0:
            logger.warning(f"Échec de la suppression de l'offre: {id}")
            return jsonify({"error": "Erreur lors de la suppression de l'offre"}), 500
            
        logger.info(f"Offre supprimée: {id} par recruteur {recruteur_id}")
        
        return jsonify({
            "success": True,
            "message": "Offre supprimée avec succès"
        }), 200

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans la suppression d'offre: {str(e)}")
        return jsonify({"error": "Erreur de base de données"}), 500
    except Exception as e:
        logger.error(f"Erreur dans la suppression d'offre: {str(e)}")
        return jsonify({"error": f"Erreur serveur: {str(e)}"}), 500

# Route to get jobs for a specific recruiter
@offres_recruteur_bp.route("/offres-recruteur", methods=["GET"])
@require_auth("recruteur")
def get_offres_recruteur(auth_payload):
    try:
        user_id = auth_payload["user_id"]
        logger.info(f"User ID: {user_id}")
        
        db = current_app.mongo
        # D'abord, récupérer l'utilisateur
        user = db[USERS_COLLECTION].find_one({"_id": ObjectId(str(user_id))})
        if not user:
            logger.error(f"Utilisateur non trouvé pour l'ID: {user_id}")
            return jsonify({"error": "Utilisateur non trouvé", "code": "USER_NOT_FOUND"}), 404
            
        # Ensuite, chercher le recruteur correspondant
        recruteur = db[RECRUTEURS_COLLECTION].find_one({"utilisateur_id": ObjectId(str(user_id))})
        if not recruteur:
            logger.error(f"Recruteur non trouvé pour l'utilisateur: {user_id}")
            return jsonify({"error": "Recruteur non trouvé", "code": "RECRUITER_NOT_FOUND"}), 404
            
        recruteur_id = recruteur["_id"]
        logger.info(f"Recruteur ID: {recruteur_id}")
        
        offres_collection = db[OFFRES_COLLECTION]
        offres = list(offres_collection.find({"recruteur_id": ObjectId(recruteur_id)}))
        formatted_offres = [format_offre(offre) for offre in offres]
        
        logger.info(f"Retour de {len(formatted_offres)} offres pour le recruteur {recruteur_id}")
        return jsonify({"offres": formatted_offres}), 200

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans GET /offres-recruteur: {str(e)}")
        return jsonify({"error": "Erreur de base de données"}), 500
    except Exception as e:
        logger.error(f"Erreur dans GET /offres-recruteur: {str(e)}")
        return jsonify({"error": f"Erreur serveur: {str(e)}"}), 500