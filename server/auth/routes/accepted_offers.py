from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from datetime import datetime, timezone
import logging
from pymongo.errors import PyMongoError
from jwt_manager import jwt_manager
from utils import verify_token

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

accepted_offers_bp = Blueprint('accepted_offers', __name__)

def auth_required(f):
    """Decorator to ensure user is authenticated and is a candidate"""
    def wrapper(*args, **kwargs):
        token = request.headers.get("Authorization")
        if not token:
            return jsonify({"error": "Authentification requise"}), 401
        
        # Use the existing token verification
        decoded = verify_token(token)
        if not decoded:
            return jsonify({"error": "Token invalide ou expiré"}), 401
        
        # Extract email from token
        email = decoded.split(":")[1] if decoded.startswith("EMAIL:") else None
        if not email:
            return jsonify({"error": "Format de token invalide"}), 401
            
        # Get user from database
        db = current_app.mongo.db
        user = db.utilisateurs.find_one({"email": email})
        if not user:
            return jsonify({"error": "Utilisateur non trouvé"}), 404
            
        if user.get("role") != "candidat":
            return jsonify({"error": "Accès réservé aux candidats"}), 403
            
        request.user = {
            "id": str(user["_id"]),
            "email": email,
            "role": user["role"]
        }
        return f(*args, **kwargs)
    wrapper.__name__ = f.__name__
    return wrapper

def serialize_doc(doc):
    """Serialize a MongoDB document for JSON."""
    if not doc:
        return None
    doc = dict(doc)
    
    # Convert ObjectId fields to strings
    id_fields = ["_id", "user_id", "offre_id", "candidature_id", "candidat_id", 
                "recruteur_id", "rapport_id", "entreprise_id"]
    for field in id_fields:
        if field in doc:
            doc[field] = str(doc[field])
    
    # Handle transcription_ids array
    if "transcription_ids" in doc and isinstance(doc["transcription_ids"], list):
        doc["transcription_ids"] = [str(tid) for tid in doc["transcription_ids"]]
    
    # Format date fields to ISO 8601 with UTC 'Z'
    date_fields = ["date_prevue", "date_creation", "date_maj", "date_postulation", 
                  "interviewDate", "created_at", "updated_at"]
    for field in date_fields:
        if field in doc and isinstance(doc[field], datetime):
            doc[field] = doc[field].isoformat() + "Z"
    
    # Handle nested jobDetails
    if "jobDetails" in doc and isinstance(doc["jobDetails"], dict):
        if "entreprise_id" in doc["jobDetails"]:
            doc["jobDetails"]["entreprise_id"] = str(doc["jobDetails"]["entreprise_id"])
    
    # Handle nested entretiens
    if "entretiens" in doc and doc["entretiens"]:
        if isinstance(doc["entretiens"], dict):
            if "id" in doc["entretiens"]:
                doc["entretiens"]["id"] = str(doc["entretiens"]["id"])
            date_fields = ["timestamp"]
            for field in date_fields:
                if field in doc["entretiens"] and isinstance(doc["entretiens"][field], datetime):
                    doc["entretiens"][field] = doc["entretiens"][field].isoformat() + "Z"
    
    return doc

@accepted_offers_bp.route("/accepted-offers", methods=["GET"])
@auth_required
def get_accepted_offers():
    """Retrieve accepted candidatures for the authenticated candidate."""
    try:
        user_id = ObjectId(request.user["id"])
        
        # Fetch candidatures with status="accepted" or "pending_interview" for the candidate
        candidatures = list(current_app.mongo.db.candidatures.find({
            "user_id": user_id,
            "statut": {"$in": ["accepted", "pending_interview"]}
        }).sort("date_postulation", -1))

        # Enrich each candidature with offer and entreprise details
        for candidature in candidatures:
            # Fetch offer details
            offer = current_app.mongo.db.offres.find_one({"_id": ObjectId(candidature["offre_id"])})
            if offer:
                entreprise = current_app.mongo.db.entreprises.find_one({"_id": offer.get("entreprise", {}).get("_id")})
                candidature["jobDetails"] = {
                    "title": offer.get("titre", "N/A"),
                    "company": entreprise.get("nom", "N/A") if entreprise else offer.get("entreprise", {}).get("nom", "N/A"),
                    "departement": offer.get("departement", "N/A"),
                    "location": offer.get("localisation", "N/A"),
                    "description": offer.get("description", "N/A"),
                    "entreprise_id": str(offer.get("entreprise", {}).get("_id", "")) if offer.get("entreprise", {}).get("_id") else ""
                }
            else:
                candidature["jobDetails"] = {
                    "title": "Offre inconnue",
                    "company": "N/A",
                    "department": "N/A",
                    "location": "N/A",
                    "description": "N/A",
                    "entreprise_id": ""
                }

            # Fetch interview details if available
            interview = current_app.mongo.db.entretiens.find_one({
                "applicationId": candidature["_id"],
                "candidateId": user_id
            }) if "interviews" in current_app.mongo.db.list_collection_names() else None
            if interview:
                candidature["interview"] = {
                    "id": str(interview["_id"]),
                    "videoPath": interview.get("videoPath", ""),
                    "score": interview.get("score", None),
                    "timestamp": interview.get("createdAt", None)
                }
            else:
                candidature["entretiens"] = None

        serialized_candidatures = [serialize_doc(candidature) for candidature in candidatures]
        logger.info(f"Récupéré {len(serialized_candidatures)} candidatures acceptées pour User ID: {user_id}")
        return jsonify({
            "success": True,
            "data": serialized_candidatures,
            "message": "Candidatures acceptées récupérées avec succès"
        }), 200

    except ValueError as e:
        logger.error(f"Erreur de validation lors de la récupération des candidatures acceptées: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Erreur de validation",
            "details": str(e)
        }), 400
    except PyMongoError as e:
        logger.error(f"Erreur MongoDB lors de la récupération des candidatures acceptées pour User ID {request.user['id']}: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "Erreur base de données",
            "details": str(e)
        }), 500
    except Exception as e:
        logger.error(f"Erreur serveur lors de la récupération des candidatures acceptées pour User ID {request.user['id']}: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "Erreur serveur",
            "details": str(e)
        }), 500

@accepted_offers_bp.route("/accepted-offers/<string:application_id>", methods=["PUT"])
@auth_required
def update_accepted_offer(application_id):
    """Update an accepted candidature for the authenticated candidate."""
    try:
        if not ObjectId.is_valid(application_id):
            return jsonify({"error": "ID de la candidature invalide"}), 400

        user_id = ObjectId(request.user["id"])
        data = request.get_json()
        if not data:
            return jsonify({"error": "Aucune donnée fournie"}), 400

        # Validate status
        valid_statuses = ["accepted", "pending_interview", "completed", "cancelled"]
        if "status" in data and data["status"] not in valid_statuses:
            return jsonify({
                "error": f"Statut invalide. Valeurs autorisées : {', '.join(valid_statuses)}"
            }), 400

        # Validate interview date if provided
        if "interviewDate" in data:
            try:
                data["interviewDate"] = datetime.fromisoformat(data["interviewDate"].replace("Z", "+00:00"))
            except ValueError:
                return jsonify({
                    "error": "Format de date invalide. Utilisez ISO 8601 (ex. '2023-10-01T10:00:00Z')"
                }), 400

        # Validate feedback length
        if "feedback" in data and len(data["feedback"]) > 1000:
            return jsonify({"error": "Le feedback ne peut pas dépasser 1000 caractères"}), 400

        # Prepare update data
        update_data = {
            k: v for k, v in data.items()
            if k in ["status", "interviewDate", "feedback"]
        }
        update_data["updated_at"] = datetime.now(timezone.utc)

        # Ensure the candidature belongs to the authenticated candidate
        result = current_app.mongo.db.candidatures.update_one(
            {
                "_id": ObjectId(application_id),
                "user_id": user_id,
                "statut": {"$in": ["accepted", "pending_interview"]}
            },
            {"$set": update_data}
        )

        if result.matched_count == 0:
            return jsonify({
                "error": "Candidature non trouvée, non acceptée ou non autorisée pour ce candidat"
            }), 404

        # Fetch the updated candidature
        updated_candidature = current_app.mongo.db.candidatures.find_one({"_id": ObjectId(application_id)})
        if updated_candidature:
            # Enrich with offer details
            offer = current_app.mongo.db.offres.find_one({"_id": ObjectId(updated_candidature["offre_id"])})
            if offer:
                entreprise = current_app.mongo.db.entreprises.find_one({"_id": offer.get("entreprise", {}).get("_id")})
                updated_candidature["jobDetails"] = {
                    "title": offer.get("titre", "N/A"),
                    "company": entreprise.get("nom", "N/A") if entreprise else offer.get("entreprise", {}).get("nom", "N/A"),
                    "department": offer.get("departement", "N/A"),
                    "location": offer.get("localisation", "N/A"),
                    "description": offer.get("description", "N/A"),
                    "entreprise_id": str(offer.get("entreprise", {}).get("_id", "")) if offer.get("entreprise", {}).get("_id") else ""
                }
            else:
                updated_candidature["jobDetails"] = {
                    "title": "Offre inconnue",
                    "company": "N/A",
                    "department": "N/A",
                    "location": "N/A",
                    "description": "N/A",
                    "entreprise_id": ""
                }

            # Fetch interview details if available
            interview = current_app.mongo.db.interviews.find_one({
                "applicationId": updated_candidature["_id"],
                "candidateId": user_id
            }) if "interviews" in current_app.mongo.db.list_collection_names() else None
            if interview:
                updated_candidature["interview"] = {
                    "id": str(interview["_id"]),
                    "videoPath": interview.get("videoPath", ""),
                    "score": interview.get("score", None),
                    "timestamp": interview.get("createdAt", None)
                }
            else:
                updated_candidature["interview"] = None

        logger.info(f"Candidature ID: {application_id} mise à jour pour User ID: {user_id}")
        return jsonify({
            "success": True,
            "data": serialize_doc(updated_candidature),
            "message": "Candidature mise à jour avec succès"
        }), 200

    except ValueError as e:
        logger.error(f"Erreur de validation lors de la mise à jour de la candidature {application_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Erreur de validation",
            "details": str(e)
        }), 400
    except PyMongoError as e:
        logger.error(f"Erreur MongoDB lors de la mise à jour de la candidature {application_id} pour User ID {request.user['id']}: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "Erreur base de données",
            "details": str(e)
        }), 500
    except Exception as e:
        logger.error(f"Erreur serveur lors de la mise à jour de la candidature {application_id} pour User ID {request.user['id']}: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "Erreur serveur",
            "details": str(e)
        }), 500

@accepted_offers_bp.route("/entretiens/<string:entretien_id>", methods=["GET"])
@auth_required
def get_entretien(entretien_id):
    """Retrieve interview details for the authenticated candidate."""
    try:
        if not ObjectId.is_valid(entretien_id):
            return jsonify({"error": "ID de l'entretien invalide"}), 400

        user_id = ObjectId(request.user["id"])
        
        # Fetch interview details
        entretien = current_app.mongo.db.entretiens.find_one({
            "_id": ObjectId(entretien_id),
            "candidat_id": user_id
        })

        if not entretien:
            return jsonify({"error": "Entretien non trouvé ou non autorisé"}), 404

        # Fetch related data
        candidature = current_app.mongo.db.candidatures.find_one({
            "_id": ObjectId(entretien["candidature_id"])
        })
        
        offre = current_app.mongo.db.offres.find_one({
            "_id": ObjectId(entretien["offre_id"])
        })
        
        recruteur = current_app.mongo.db.utilisateurs.find_one({
            "_id": ObjectId(entretien["recruteur_id"])
        })

        # Fetch transcriptions if available
        transcriptions = []
        if "transcription_ids" in entretien:
            transcriptions = list(current_app.mongo.db.transcriptions.find({
                "_id": {"$in": [ObjectId(tid) for tid in entretien["transcription_ids"]]}
            }))

        # Fetch rapport if available
        rapport = None
        if "rapport_id" in entretien:
            rapport = current_app.mongo.db.rapports.find_one({
                "_id": ObjectId(entretien["rapport_id"])
            })

        # Format the response
        response = {
            "entretien": {
                "id": str(entretien["_id"]),
                "candidature_id": str(entretien["candidature_id"]),
                "offre_id": str(entretien["offre_id"]),
                "candidat_id": str(entretien["candidat_id"]),
                "recruteur_id": str(entretien["recruteur_id"]),
                "date_prevue": entretien["date_prevue"].isoformat() + "Z",
                "statut": entretien["statut"],
                "date_creation": entretien["date_creation"].isoformat() + "Z",
                "date_maj": entretien["date_maj"].isoformat() + "Z"
            },
            "candidature": serialize_doc(candidature) if candidature else None,
            "offre": serialize_doc(offre) if offre else None,
            "recruteur": {
                "id": str(recruteur["_id"]),
                "nom": recruteur.get("nom", "N/A"),
                "email": recruteur.get("email", "N/A")
            } if recruteur else None,
            "transcriptions": [serialize_doc(t) for t in transcriptions],
            "rapport": serialize_doc(rapport) if rapport else None
        }

        logger.info(f"Récupéré l'entretien {entretien_id} pour User ID: {user_id}")
        return jsonify({
            "success": True,
            "data": response,
            "message": "Détails de l'entretien récupérés avec succès"
        }), 200

    except ValueError as e:
        logger.error(f"Erreur de validation lors de la récupération de l'entretien {entretien_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Erreur de validation",
            "details": str(e)
        }), 400
    except PyMongoError as e:
        logger.error(f"Erreur MongoDB lors de la récupération de l'entretien {entretien_id} pour User ID {request.user['id']}: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "Erreur base de données",
            "details": str(e)
        }), 500
    except Exception as e:
        logger.error(f"Erreur serveur lors de la récupération de l'entretien {entretien_id} pour User ID {request.user['id']}: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "Erreur serveur",
            "details": str(e)
        }), 500

@accepted_offers_bp.route("/entretiens/<string:entretien_id>", methods=["PUT"])
@auth_required
def update_entretien(entretien_id):
    """Update interview details for the authenticated candidate."""
    try:
        if not ObjectId.is_valid(entretien_id):
            return jsonify({"error": "ID de l'entretien invalide"}), 400

        user_id = ObjectId(request.user["id"])
        data = request.get_json()
        if not data:
            return jsonify({"error": "Aucune donnée fournie"}), 400

        # Validate status
        valid_statuses = ["planifie", "en_cours", "termine", "annule"]
        if "statut" in data and data["statut"] not in valid_statuses:
            return jsonify({
                "error": f"Statut invalide. Valeurs autorisées : {', '.join(valid_statuses)}"
            }), 400

        # Validate interview date if provided
        if "date_prevue" in data:
            try:
                data["date_prevue"] = datetime.fromisoformat(data["date_prevue"].replace("Z", "+00:00"))
            except ValueError:
                return jsonify({
                    "error": "Format de date invalide. Utilisez ISO 8601 (ex. '2023-10-01T10:00:00Z')"
                }), 400

        # Prepare update data
        update_data = {
            k: v for k, v in data.items()
            if k in ["statut", "date_prevue"]
        }
        update_data["date_maj"] = datetime.now(timezone.utc)

        # Ensure the interview belongs to the authenticated candidate
        result = current_app.mongo.db.entretiens.update_one(
            {
                "_id": ObjectId(entretien_id),
                "candidat_id": user_id
            },
            {"$set": update_data}
        )

        if result.matched_count == 0:
            return jsonify({
                "error": "Entretien non trouvé ou non autorisé"
            }), 404

        # Fetch the updated interview
        updated_entretien = current_app.mongo.db.entretiens.find_one({"_id": ObjectId(entretien_id)})
        
        logger.info(f"Entretien ID: {entretien_id} mis à jour pour User ID: {user_id}")
        return jsonify({
            "success": True,
            "data": serialize_doc(updated_entretien),
            "message": "Entretien mis à jour avec succès"
        }), 200

    except ValueError as e:
        logger.error(f"Erreur de validation lors de la mise à jour de l'entretien {entretien_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Erreur de validation",
            "details": str(e)
        }), 400
    except PyMongoError as e:
        logger.error(f"Erreur MongoDB lors de la mise à jour de l'entretien {entretien_id} pour User ID {request.user['id']}: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "Erreur base de données",
            "details": str(e)
        }), 500
    except Exception as e:
        logger.error(f"Erreur serveur lors de la mise à jour de l'entretien {entretien_id} pour User ID {request.user['id']}: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "Erreur serveur",
            "details": str(e)
        }), 500