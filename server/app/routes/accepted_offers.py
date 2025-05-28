from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from datetime import datetime, timezone
import logging
from pymongo.errors import PyMongoError
from jwt_manager import jwt_manager
import PyPDF2
import io
import base64
from flask_cors import CORS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Blueprint avec préfixe
accepted_offers_bp = Blueprint('accepted_offers', __name__, url_prefix='/api/accepted-offers')

# Configure CORS
CORS(accepted_offers_bp, 
     resources={r"/*": {"origins": "http://localhost:3000"}},
     supports_credentials=True,
     max_age=3600)

def auth_required(f):
    """Decorator to ensure user is authenticated and is a candidate"""
    def wrapper(*args, **kwargs):
        token = request.headers.get("Authorization")
        if not token:
            logger.error("Pas de token dans les headers")
            return jsonify({"error": "Authentification requise"}), 401
        
        try:
            user_id = jwt_manager.verify_token(token)
            if not user_id:
                logger.error("Token invalide ou expiré")
                return jsonify({"error": "Token invalide ou expiré"}), 401
        
            db = current_app.mongo
            user = db.utilisateurs.find_one({"_id": ObjectId(user_id)})
            
            if not user:
                logger.error(f"Utilisateur non trouvé pour l'ID: {user_id}")
                return jsonify({"error": "Utilisateur non trouvé"}), 404
            
            if user.get("role") != "candidat":
                logger.error(f"Rôle invalide: {user.get('role')}")
                return jsonify({"error": "Accès réservé aux candidats"}), 403
            
            request.user = {
                "id": str(user["_id"]),
                "email": user["email"],
                "role": user["role"]
            }

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
    
    id_fields = ["_id", "user_id", "offre_id", "candidature_id", "candidat_id", 
                 "recruteur_id", "rapport_id", "questions_id"]
    for field in id_fields:
        if field in doc:
            doc[field] = str(doc[field])
    
    if "transcription_ids" in doc and isinstance(doc["transcription_ids"], list):
        doc["transcription_ids"] = [str(tid) for tid in doc["transcription_ids"]]
    
    date_fields = ["date_prevue", "date_creation", "date_maj", "date_postulation", 
                   "interviewDate", "created_at", "updated_at"]
    for field in date_fields:
        if field in doc and isinstance(doc[field], datetime):
            doc[field] = doc[field].isoformat() + "Z"
    
    if "jobDetails" in doc and isinstance(doc["jobDetails"], dict):
        if "entreprise_id" in doc["jobDetails"]:
            doc["jobDetails"]["entreprise_id"] = str(doc["jobDetails"]["entreprise_id"])
    
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
        
        # Vérification de l'utilisateur
        user = db.utilisateurs.find_one({"_id": ObjectId(user_id)})
        if not user:
            logger.error(f"Utilisateur non trouvé: {user_id}")
            return jsonify({"error": "Utilisateur non trouvé"}), 404
            
        # Pipeline d'agrégation
        pipeline = [
            {"$match": {
            "user_id": ObjectId(user_id),
            "statut": {"$in": ["Accepté", "En attente", "Terminé"]}
            }},
            {"$lookup": {
                "from": "offres",
                "localField": "offre_id",
                "foreignField": "_id",
                "as": "offre"
            }},
            {"$unwind": {"path": "$offre", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "recruteurs",
                "localField": "offre.recruteur_id",
                "foreignField": "_id",
                "as": "recruteur"
            }},
            {"$unwind": {"path": "$recruteur", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "entretiens",
                "localField": "_id",
                "foreignField": "candidature_id",
                "as": "entretien"
            }},
            {"$unwind": {"path": "$entretien", "preserveNullAndEmptyArrays": True}},
            {"$project": {
                "_id": 1,
                "statut": 1,
                "created_at": 1,
                "jobDetails": {
                    "title": "$offre.titre",
                    "department": "$offre.departement",
                    "location": "$offre.localisation",
                    "description": "$offre.description",
                    "company": "$recruteur.nomEntreprise"
                },
                "entretien": {
                    "$cond": {
                        "if": {"$eq": ["$entretien", {}]},
                        "then": None,
                        "else": {
                            "id": "$entretien._id",
                            "statut": "$entretien.statut",
                            "date_prevue": "$entretien.date_prevue",
                            "date_creation": "$entretien.date_creation",
                            "date_maj": "$entretien.date_maj"
                        }
                    }
                }
            }}
        ]
        
        candidatures = list(db.candidatures.aggregate(pipeline))
        
        if not candidatures:
            return jsonify({"acceptedOffers": []}), 200
            
        # Transformer les ObjectId en strings
        for candidature in candidatures:
            if candidature.get("entretien"):
                candidature["entretien"]["id"] = str(candidature["entretien"]["id"])
            candidature["_id"] = str(candidature["_id"])
                
        return jsonify({"acceptedOffers": candidatures}), 200
        
    except Exception as e:
        logger.error(f"Erreur serveur: {str(e)}")
        return jsonify({"error": str(e)}), 500

@accepted_offers_bp.route("/accepted-offers/<string:application_id>", methods=["PUT"])
@auth_required
def update_accepted_offer(application_id):
    try:
        if not ObjectId.is_valid(application_id):
            return jsonify({"error": "ID de la candidature invalide"}), 400

        user_id = ObjectId(request.user["id"])
        data = request.get_json()
        if not data:
            return jsonify({"error": "Aucune donnée fournie"}), 400

        valid_statuses = ["accepted", "pending_interview", "completed", "cancelled"]
        if "status" in data and data["status"] not in valid_statuses:
            return jsonify({
                "error": f"Statut invalide. Valeurs autorisées : {', '.join(valid_statuses)}"
            }), 400

        if "interviewDate" in data:
            try:
                data["interviewDate"] = datetime.fromisoformat(data["interviewDate"].replace("Z", "+00:00"))
            except ValueError:
                return jsonify({
                    "error": "Format de date invalide. Utilisez ISO 8601 (ex. '2023-10-01T10:00:00Z')"
                }), 400

        if "feedback" in data and len(data["feedback"]) > 1000:
            return jsonify({"error": "Le feedback ne peut pas dépasser 1000 caractères"}), 400

        update_data = {
            k: v for k, v in data.items()
            if k in ["status", "interviewDate", "feedback"]
        }
        update_data["updated_at"] = datetime.now(timezone.utc)

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

        updated_candidature = current_app.mongo.db.candidatures.find_one({"_id": ObjectId(application_id)})
        if updated_candidature:
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

            interview = current_app.mongo.db.entretiens.find_one({
                "_id": updated_candidature.get("entretien_id"),
                "candidature_id": ObjectId(application_id)
            }) if updated_candidature.get("entretien_id") else None
            if interview:
                updated_candidature["interview"] = serialize_doc(interview)
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
        logger.error(f"Erreur MongoDB lors de la mise à jour de la candidature {application_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Erreur base de données",
            "details": str(e)
        }), 500
    except Exception as e:
        logger.error(f"Erreur serveur lors de la mise à jour de la candidature {application_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Erreur serveur",
            "details": str(e)
        }), 500

@accepted_offers_bp.route("/entretiens/<string:entretien_id>", methods=["GET"])
@auth_required
def get_entretien(entretien_id):
    try:
        if not ObjectId.is_valid(entretien_id):
            logger.error(f"ID de l'entretien invalide: {entretien_id}")
            return jsonify({"error": "ID de l'entretien invalide"}), 400

        user_id = ObjectId(request.user["id"])
        
        logger.info(f"Recherche de l'entretien {entretien_id} pour candidat {user_id}")
        entretien = current_app.mongo.db.entretiens.find_one({
            "_id": ObjectId(entretien_id),
            "candidat_id": user_id
        })

        if not entretien:
            logger.error(f"Entretien {entretien_id} non trouvé ou non autorisé pour candidat {user_id}")
            return jsonify({"error": "Entretien non trouvé ou non autorisé"}), 404

        candidature = current_app.mongo.db.candidatures.find_one({
            "_id": ObjectId(entretien["candidature_id"])
        })
        
        offre = current_app.mongo.db.offres.find_one({
            "_id": ObjectId(entretien["offre_id"])
        })
        
        recruteur = current_app.mongo.db.utilisateurs.find_one({
            "_id": ObjectId(entretien["recruteur_id"])
        })

        transcriptions = []
        if "transcription_ids" in entretien:
            transcriptions = list(current_app.mongo.db.transcriptions.find({
                "_id": {"$in": [ObjectId(tid) for tid in entretien["transcription_ids"]]}
            }))

        rapport = None
        if "rapport_id" in entretien:
            rapport = current_app.mongo.db.rapports.find_one({
                "_id": ObjectId(entretien["rapport_id"])
            })

        response = {
            "entretien": {
                "id": str(entretien["_id"]),
                "candidature_id": str(entretien["candidature_id"]),
                "offre_id": str(entretien["offre_id"]),
                "candidat_id": str(entretien["candidat_id"]),
                "recruteur_id": str(entretien["recruteur_id"]),
                "date_prevue": entretien["date_prevue"].isoformat() + "Z" if entretien["date_prevue"] else None,
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
        logger.error(f"Erreur MongoDB lors de la récupération de l'entretien {entretien_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Erreur base de données",
            "details": str(e)
        }), 500
    except Exception as e:
        logger.error(f"Erreur serveur lors de la récupération de l'entretien {entretien_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Erreur serveur",
            "details": str(e)
        }), 500

@accepted_offers_bp.route("/entretiens/<string:entretien_id>/messages", methods=["GET", "OPTIONS"])
@auth_required
def get_entretien_messages(entretien_id):
    if request.method == "OPTIONS":
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
        
    try:
        if not ObjectId.is_valid(entretien_id):
            logger.error(f"ID de l'entretien invalide: {entretien_id}")
            return jsonify({"error": "ID de l'entretien invalide"}), 400

        user_id = ObjectId(request.user["id"])
        
        # Vérifier que l'entretien appartient bien au candidat
        entretien = current_app.mongo.db.entretiens.find_one({
            "_id": ObjectId(entretien_id),
            "candidat_id": user_id
        })

        if not entretien:
            logger.error(f"Entretien {entretien_id} non trouvé ou non autorisé pour candidat {user_id}")
            return jsonify({"error": "Entretien non trouvé ou non autorisé"}), 404

        # Récupérer les messages
        messages = list(current_app.mongo.db.messages.find({
            "entretien_id": ObjectId(entretien_id)
        }).sort("date_creation", -1))

        # Marquer les messages comme lus
        if messages:
            current_app.mongo.db.messages.update_many(
                {
                    "entretien_id": ObjectId(entretien_id),
                    "candidat_id": user_id,
                    "lu": False
                },
                {"$set": {"lu": True}}
            )

        # Sérialiser les messages
        serialized_messages = []
        for message in messages:
            recruteur = current_app.mongo.db.utilisateurs.find_one({
                "_id": ObjectId(message["recruteur_id"])
            })
            
            serialized_messages.append({
                "id": str(message["_id"]),
                "message": message["message"],
                "date_creation": message["date_creation"].isoformat() + "Z",
                "lu": message["lu"],
                "recruteur": {
                    "id": str(recruteur["_id"]),
                    "nom": recruteur.get("nom", "N/A"),
                    "email": recruteur.get("email", "N/A")
                } if recruteur else None
            })

        response = jsonify({
            "success": True,
            "messages": serialized_messages
        })
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200

    except Exception as e:
        logger.error(f"Erreur lors de la récupération des messages: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Erreur lors de la récupération des messages",
            "details": str(e)
        }), 500
