from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from datetime import datetime, timezone
import logging
from pymongo.errors import PyMongoError
from jwt_manager import jwt_manager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

accepted_offers_bp = Blueprint('accepted_offers', __name__)

def auth_required(f):
    """Decorator to ensure user is authenticated and is a candidate"""
    def wrapper(*args, **kwargs):
        # Vérifier la présence du token
        token = request.headers.get("Authorization")
        if not token:
            logger.error("Pas de token dans les headers")
            return jsonify({"error": "Authentification requise"}), 401
        
        try:
            # Vérifier le token
            user_id = jwt_manager.verify_token(token)
            if not user_id:
                logger.error("Token invalide ou expiré")
                return jsonify({"error": "Token invalide ou expiré"}), 401
        
            # Récupérer l'utilisateur
            db = current_app.mongo
            user = db.utilisateurs.find_one({"_id": ObjectId(user_id)})
            
            # Vérifier que l'utilisateur existe
            if not user:
                logger.error(f"Utilisateur non trouvé pour l'ID: {user_id}")
                return jsonify({"error": "Utilisateur non trouvé"}), 404
            
            # Vérifier le rôle
            if user.get("role") != "candidat":
                logger.error(f"Rôle invalide: {user.get('role')}")
                return jsonify({"error": "Accès réservé aux candidats"}), 403
            
            # Stocker les informations de l'utilisateur
            request.user = {
            "id": str(user["_id"]),
                "email": user["email"],
            "role": user["role"]
        }

            # Exécuter la fonction décorée
            return f(*args, **kwargs)

        except Exception as e:
            logger.error(f"Erreur d'authentification: {str(e)}")
            return jsonify({"error": "Erreur d'authentification"}), 401

    wrapper.__name__ = f.__name__
    return wrapper

def serialize_doc(doc):
    """Serialize a MongoDB document for JSON."""
    if not doc:
        return None
    doc = dict(doc)
    
    # Convert ObjectId fields to strings
    id_fields = ["_id", "user_id", "offre_id", "candidature_id", "candidat_id", 
                "recruteur_id", "rapport_id"]
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

def serialize_mongo_doc(doc):
    """Convertit tous les ObjectId en chaînes de caractères dans un document MongoDB."""
    if doc is None:
        return None
        
    if isinstance(doc, ObjectId):
        return str(doc)
        
    if isinstance(doc, dict):
        return {k: serialize_mongo_doc(v) for k, v in doc.items()}
        
    if isinstance(doc, list):
        return [serialize_mongo_doc(item) for item in doc]
        
    return doc

@accepted_offers_bp.route('/accepted-offers', methods=['GET'])
@auth_required
def get_accepted_offers():
    try:
        user_id = request.user["id"]
        
        
        db = current_app.mongo
        
        # D'abord, récupérer l'utilisateur pour obtenir son ID de candidat
        user = db.utilisateurs.find_one({"_id": ObjectId(user_id)})
        if not user:
            logger.error(f"Utilisateur non trouvé: {user_id}")
            return jsonify({"error": "Utilisateur non trouvé"}), 404
            
        logger.info(f"Utilisateur trouvé: {serialize_mongo_doc(user)}")
        
        # Récupérer les candidatures avec les statuts spécifiés
        query = {
            "user_id": ObjectId(user_id),
            "statut": {"$in": ["Accepté", "En cours", "En attente"]}
        }
        logger.info(f"Requête MongoDB: {serialize_mongo_doc(query)}")
        
        candidatures = list(db.candidatures.find(query))
        logger.info(f"Nombre de candidatures trouvées: {len(candidatures)}")
        
        if not candidatures:
            logger.info("Aucune candidature trouvée")
            return jsonify({"acceptedOffers": []}), 200
            
        # Enrichir chaque candidature avec les détails de l'offre et de l'entreprise
        for candidature in candidatures:
            try:
                # Récupérer les détails de l'offre
                offre = db.offres.find_one({"_id": candidature["offre_id"]})
                recruteur=offre.get('recruteur_id')
                rec=db.recruteurs.find_one({"_id": ObjectId(recruteur)})
                nomentreprise=rec.get('nomEntreprise')
                if offre:
                    # Transformer les données dans le format attendu par le frontend
                    candidature["jobDetails"] = {
                        "title": offre.get("titre", "N/A"),
                        "department": offre.get("departement", "N/A"),
                        "location": offre.get("localisation", "N/A"),
                        "description": offre.get("description", "N/A"),
                        "company": nomentreprise
                    }
                    
                    
                        
                # Récupérer les détails de l'entretien si disponible
                if "entretien_id" in candidature:
                    entretien = db.entretiens.find_one({"_id": candidature["entretien_id"]})
                    if entretien:
                        candidature["entretien"] = serialize_mongo_doc(entretien)
            except Exception as e:
                logger.error(f"Erreur lors de l'enrichissement de la candidature {candidature.get('_id')}: {str(e)}")
                continue
                    
        # Sérialiser toutes les candidatures
        candidatures = [serialize_mongo_doc(candidature) for candidature in candidatures]
                
       
        return jsonify({"acceptedOffers": candidatures}), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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