from flask import Blueprint, jsonify, request, current_app, send_file
from bson import ObjectId
import logging
from datetime import datetime, timedelta
from jwt_manager import jwt_manager
from config.config import OFFRES_COLLECTION, CANDIDATURES_COLLECTION, ENTRETIENS_COLLECTION, CANDIDATS_COLLECTION, ACTIVITIES_COLLECTION
from pymongo.errors import PyMongoError
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

Dashboard_recruteur_bp = Blueprint("dashboard", __name__)

# Collections
OFFRES_COLLECTION = 'offres'
CANDIDATURES_COLLECTION = 'candidatures'
ENTRETIENS_COLLECTION = 'entretiens'
CANDIDATS_COLLECTION = 'candidats'
ACTIVITIES_COLLECTION = 'activities'
USERS_COLLECTION = 'utilisateurs'
RECRUTEURS_COLLECTION = 'recruteurs'

# Middleware to require authentication
def require_auth(role):
    def decorator(f):
        def wrapped_function(*args, **kwargs):
            token = request.headers.get("Authorization")
            if not token:
                logger.warning("Jeton manquant")
                return jsonify({"error": "Jeton manquant"}), 401

            # Logging pour debug
            logger.info(f"Token reçu (type: {type(token)}): {token[:20]}..." if isinstance(token, str) else f"Token reçu binaire (type: {type(token)})")

            try:
                # Nettoyage du token: s'assurer qu'il est en format str et sans caractères non valides
                if isinstance(token, bytes):
                    try:
                        token = token.decode('utf-8')
                        logger.info(f"Token converti de bytes à str: {token[:20]}...")
                    except UnicodeDecodeError as e:
                        logger.warning(f"Token contient des caractères non valides en UTF-8: {e}")
                        # Tenter de décoder avec 'latin-1' qui accepte tous les octets
                        try:
                            token = token.decode('latin-1')
                            logger.info(f"Token décodé avec latin-1: {token[:20]}...")
                        except Exception as e2:
                            logger.warning(f"Échec du décodage latin-1: {e2}")
                            return jsonify({"error": "Format de token invalide"}), 401
                
                # Vérifier si le token contient des caractères invalides
                if not isinstance(token, str):
                    logger.warning(f"Token n'est pas une chaîne de caractères: {type(token)}")
                    return jsonify({"error": "Format de token invalide"}), 401
                
                # Si le token commence par 'Bearer', s'assurer qu'il y a un espace après
                if token.startswith('Bearer') and len(token) > 6:
                    if token[6] != ' ':
                        token = 'Bearer ' + token[6:]
                        logger.info("Espace ajouté après 'Bearer'")
                elif not token.startswith('Bearer '):
                    # Ajouter le préfixe si nécessaire
                    token = f'Bearer {token}'
                    logger.info("Préfixe 'Bearer ' ajouté")
                
                logger.info(f"Token final transmis: {token[:20]}...")
                
                # Vérifier le token et obtenir l'ID de l'utilisateur (sub)
                user_id = jwt_manager.verify_token(token)
                logger.info(f"ID utilisateur extrait du token: {user_id}")
                
                # Récupérer l'utilisateur depuis la base de données par ID
                db = current_app.mongo
                user = db[USERS_COLLECTION].find_one({"_id": ObjectId(user_id)})
                if not user:
                    logger.warning(f"Utilisateur non trouvé pour l'ID: {user_id}")
                    return jsonify({"error": "Utilisateur non trouvé"}), 401
                
                # Vérifier le rôle
                if user.get("role") != role:
                    logger.warning(f"Rôle non autorisé: {user.get('role')}")
                    return jsonify({"error": f"Accès non autorisé. Rôle {role} requis."}), 403
                
                # Si c'est un recruteur, récupérer son profil recruteur
                recruteur = None
                if role == "recruteur":
                    recruteur = db[RECRUTEURS_COLLECTION].find_one({"utilisateur_id": ObjectId(user_id)})
                    if not recruteur:
                        logger.warning(f"Profil recruteur non trouvé pour l'utilisateur: {user_id}")
                        return jsonify({"error": "Profil recruteur non trouvé"}), 404
                
                # Créer le payload à passer à la fonction
                auth_payload = {
                    "sub": user_id,
                    "role": user.get("role"),
                    "email": user.get("email"),
                    "recruteur_id": str(recruteur.get("_id")) if recruteur else None
                }
                logger.info(f"Payload d'authentification créé: {auth_payload}")
                
                return f(auth_payload=auth_payload, *args, **kwargs)
            except Exception as e:
                logger.warning(f"Erreur de vérification du token: {str(e)}")
                return jsonify({"error": str(e)}), 401

        wrapped_function.__name__ = f.__name__
        return wrapped_function
    return decorator

@Dashboard_recruteur_bp.route("/dashboard", methods=["GET"])
@require_auth("recruteur")
def get_dashboard_data(auth_payload):
    try:
        user_id = auth_payload["sub"]
        recruteur_id = auth_payload["recruteur_id"]
        logger.info(f"Récupération des données du dashboard pour le recruteur {recruteur_id}")

        period = request.args.get("period", "week")
        logger.info(f"Période sélectionnée: {period}")

        end_date = datetime.utcnow()
        if period == "week":
            start_date = end_date - timedelta(days=7)
        elif period == "month":
            start_date = end_date - timedelta(days=30)
        else:
            start_date = end_date - timedelta(days=365)

        db = current_app.mongo

        total_candidates = db[CANDIDATS_COLLECTION].count_documents({})
        total_jobs = db[OFFRES_COLLECTION].count_documents({"recruteur_id": ObjectId(recruteur_id)})
        total_interviews = db[ENTRETIENS_COLLECTION].count_documents({"recruteur_id": ObjectId(recruteur_id)})

        new_candidates = db[CANDIDATS_COLLECTION].count_documents({
            "date_creation": {"$gte": start_date, "$lte": end_date}
        })

        active_jobs = db[OFFRES_COLLECTION].count_documents({
            "recruteur_id": ObjectId(recruteur_id),
            "statut": "ouverte"
        })

        upcoming_interviews = db[ENTRETIENS_COLLECTION].count_documents({
            "recruteur_id": ObjectId(recruteur_id),
            "date": {"$gte": datetime.utcnow()}
        })

        conversion_rate = 0
        if total_candidates > 0:
            accepted_candidates = db[CANDIDATS_COLLECTION].count_documents({"statut": "accepté"})
            conversion_rate = (accepted_candidates / total_candidates) * 100

        candidates_by_date = db[CANDIDATS_COLLECTION].aggregate([
            {"$match": {"date_creation": {"$gte": start_date, "$lte": end_date}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$date_creation"}},
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ])

        interviews_by_date = db[ENTRETIENS_COLLECTION].aggregate([
            {"$match": {
                "recruteur_id": ObjectId(recruteur_id),
                "date": {"$gte": start_date, "$lte": end_date}
            }},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$date"}},
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ])

        status_distribution = db[CANDIDATS_COLLECTION].aggregate([
            {"$group": {
                "_id": "$statut",
                "count": {"$sum": 1}
            }}
        ])

        interview_status_distribution = db[ENTRETIENS_COLLECTION].aggregate([
            {"$match": {"recruteur_id": ObjectId(recruteur_id)}},
            {"$group": {
                "_id": "$statut",
                "count": {"$sum": 1}
            }}
        ])

        recent_activity = db[ACTIVITIES_COLLECTION].find({
            "user_id": recruteur_id,
            "date": {"$gte": start_date}
        }).sort("date", -1).limit(10)

        upcoming_interviews_list = db[ENTRETIENS_COLLECTION].find({
            "recruteur_id": ObjectId(recruteur_id),
            "date": {"$gte": datetime.utcnow()}
        }).sort("date", 1).limit(5)

        offres = list(db[OFFRES_COLLECTION].find({"recruteur_id": ObjectId(recruteur_id)}))
        offres_list = []
        for offre in offres:
            date_creation = offre.get("date_creation", datetime.utcnow())
            date_maj = offre.get("date_maj", datetime.utcnow())
            offres_list.append({
                "id": str(offre["_id"]),
                "titre": offre.get("titre", ""),
                "description": offre.get("description", ""),
                "localisation": offre.get("localisation", ""),
                "departement": offre.get("departement", ""),
                "entreprise": str(offre.get("entreprise", "")),
                "recruteur_id": str(offre.get("recruteur_id", "")),
                "date_creation": date_creation.isoformat() + "Z",
                "date_maj": date_maj.isoformat() + "Z",
                "statut": offre.get("statut", "ouverte"),
                "competences_requises": offre.get("competences_requises", []),
                "questions_ids": [str(qid) for qid in offre.get("questions_ids", [])],
                "candidature_ids": [str(cid) for cid in offre.get("candidature_ids", [])],
            })

        response = {
            "totalCandidates": total_candidates,
            "newCandidates": new_candidates,
            "totalJobs": total_jobs,
            "activeJobs": active_jobs,
            "totalInterviews": total_interviews,
            "upcomingInterviews": upcoming_interviews,
            "conversionRate": conversion_rate,
            "graphData": {
                "candidatesByDate": {item["_id"]: item["count"] for item in candidates_by_date},
                "interviewsByDate": {item["_id"]: item["count"] for item in interviews_by_date},
                "statusDistribution": {item["_id"] or "unknown": item["count"] for item in status_distribution},
                "interviewStatusDistribution": {item["_id"] or "unknown": item["count"] for item in interview_status_distribution},
            },
            "recentActivity": [{
                "date": activity.get("date", datetime.utcnow()).isoformat() + "Z",
                "description": activity.get("description", "")
            } for activity in recent_activity],
            "upcomingInterviewsList": [{
                "date": interview.get("date", datetime.utcnow()).isoformat() + "Z",
                "candidateName": interview.get("candidate_name", ""),
                "jobTitle": interview.get("job_title", "")
            } for interview in upcoming_interviews_list],
            "offres": offres_list,
        }

        return jsonify(response), 200

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans /dashboard: {str(e)}")
        return jsonify({"error": "Erreur de base de données"}), 500
    except Exception as e:
        logger.error(f"Erreur dans /dashboard: {str(e)}")
        return jsonify({"error": f"Erreur serveur: {str(e)}"}), 500

# Route pour récupérer les candidats pour les offres du recruteur
@Dashboard_recruteur_bp.route("/candidates", methods=["GET"])
@require_auth("recruteur")
def get_recruiter_candidates(auth_payload):
    try:
        user_id = auth_payload["sub"]
        recruteur_id = auth_payload["recruteur_id"]
        
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        
        # Calcul de l'offset pour la pagination
        skip = (page - 1) * per_page
        
        db = current_app.mongo
        
        # Vérifier les noms des collections disponibles
        collections = db.list_collection_names()
        logger.info(f"Collections disponibles: {collections}")
        
        # D'abord récupérer toutes les offres du recruteur
        logger.info(f"Recherche des offres pour le recruteur_id: {recruteur_id}")
        offres = list(db[OFFRES_COLLECTION].find({"recruteur_id": ObjectId(recruteur_id)}))
        logger.info(f"Nombre d'offres trouvées: {len(offres)}")
        
        # Log d'une offre d'exemple si disponible
        if len(offres) > 0:
            logger.info(f"Exemple d'offre: {offres[0]}")
            logger.info(f"Champs disponibles dans une offre: {offres[0].keys()}")
        
        if len(offres) == 0:
            logger.warning(f"Aucune offre trouvée pour le recruteur_id: {recruteur_id}")
            
            # Vérifier si des offres existent avec d'autres formats de recruteur_id
            alt_offres = list(db[OFFRES_COLLECTION].find({
                "$or": [
                    {"recruteur_id": recruteur_id},  # Essayer le recruteur_id en tant que chaîne
                    {"recruteur": ObjectId(recruteur_id)},  # Essayer avec le champ "recruteur"
                    {"recruiter_id": ObjectId(recruteur_id)}  # Essayer avec le champ "recruiter_id"
                ]
            }))
            
            if len(alt_offres) > 0:
                logger.info(f"Trouvé {len(alt_offres)} offres avec d'autres formats de recruteur_id")
                offres = alt_offres
            else:
                return jsonify({
                    "candidates": [],
                    "pagination": {
                        "page": page,
                        "per_page": per_page,
                        "total": 0,
                        "pages": 0
                    }
                }), 200
        
        offre_ids = [offre["_id"] for offre in offres]
        logger.info(f"IDs des offres trouvées: {[str(oid) for oid in offre_ids]}")
        
        # Vérifier la structure de la collection candidatures
        sample_candidature = db[CANDIDATURES_COLLECTION].find_one()
        if sample_candidature:
            logger.info(f"Structure d'une candidature type: {sample_candidature}")
            logger.info(f"Champs disponibles dans une candidature: {sample_candidature.keys()}")
        
        # Récupérer les candidatures pour ces offres
        logger.info(f"Recherche des candidatures pour les offres: {[str(oid) for oid in offre_ids]}")
        
        # Essayer avec différents formats possibles pour le champ offre_id
        query = {
            "$or": [
                {"offre_id": {"$in": offre_ids}},  # Format standard
                {"id_offre": {"$in": offre_ids}},  # Alternative 1
                {"job_id": {"$in": offre_ids}},    # Alternative 2
                {"offer_id": {"$in": offre_ids}}   # Alternative 3
            ]
        }
        
        logger.info(f"Requête de recherche de candidatures: {query}")
        candidatures = list(db[CANDIDATURES_COLLECTION].find(query).sort("created_at", -1).skip(skip).limit(per_page))
        
        logger.info(f"Nombre de candidatures trouvées: {len(candidatures)}")
        
        if len(candidatures) == 0:
            # Vérifier si la collection candidatures contient des données
            total_candidatures_in_db = db[CANDIDATURES_COLLECTION].count_documents({})
            logger.info(f"Nombre total de candidatures dans la base de données: {total_candidatures_in_db}")
            
            # Vérifier si les champs correspondent
            if total_candidatures_in_db > 0:
                example_candidature = db[CANDIDATURES_COLLECTION].find_one({})
                logger.info(f"Exemple de candidature: {example_candidature}")
                logger.info(f"Champs disponibles dans une candidature: {example_candidature.keys() if example_candidature else 'Aucun'}")
        
        # Compter le nombre total de candidatures
        total_candidatures = db[CANDIDATURES_COLLECTION].count_documents(query)
        
        # Préparer la liste des candidats
        candidates_list = []
        
        for candidature in candidatures:
            # Récupérer les informations de l'offre associée
            offre_id = candidature.get("offre_id") or candidature.get("id_offre") or candidature.get("job_id") or candidature.get("offer_id")
            logger.info(f"Offre ID de la candidature: {str(offre_id) if offre_id else 'Non défini'}")
            
            offre = db[OFFRES_COLLECTION].find_one({"_id": offre_id}) if offre_id else None
            
            # Récupérer les informations de l'utilisateur candidat
            candidat_email = candidature.get("user_email") or candidature.get("email") or candidature.get("candidat_email")
            logger.info(f"Email du candidat: {candidat_email if candidat_email else 'Non défini'}")
            
            # Si l'email n'est pas trouvé, essayer avec l'ID du candidat
            candidat = None
            if candidat_email:
                candidat = db[USERS_COLLECTION].find_one({"email": candidat_email})
            elif candidature.get("candidat_id") or candidature.get("user_id"):
                candidat_id = candidature.get("candidat_id") or candidature.get("user_id")
                candidat = db[USERS_COLLECTION].find_one({"_id": ObjectId(candidat_id) if isinstance(candidat_id, str) else candidat_id})
            
            if candidat and offre:
                candidates_list.append({
                    "id": str(candidature["_id"]),
                    "nom": candidat.get("nom", "") or candidat.get("name", ""),
                    "prenom": candidat.get("prenom", "") or candidat.get("firstname", ""),
                    "email": candidat_email or candidat.get("email", ""),
                    "offre_titre": offre.get("titre", "") or offre.get("title", ""),
                    "offre_id": str(offre["_id"]),
                    "status": candidature.get("status", "") or candidature.get("statut", "en_attente"),
                    "date_candidature": (candidature.get("created_at") or candidature.get("date_creation") or datetime.utcnow()).isoformat() + "Z" if isinstance(candidature.get("created_at") or candidature.get("date_creation"), datetime) else datetime.utcnow().isoformat() + "Z",
                    "cv_path": candidature.get("cv_path", "") or candidature.get("resume_path", "")
                })
            else:
                logger.warning(f"Candidat ou offre non trouvé pour la candidature {str(candidature['_id'])}")
                logger.warning(f"Candidat trouvé: {bool(candidat)}, Offre trouvée: {bool(offre)}")
        
        logger.info(f"Retour de {len(candidates_list)} candidats pour le recruteur {recruteur_id}")
        
        return jsonify({
            "candidates": candidates_list,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total_candidatures,
                "pages": (total_candidatures + per_page - 1) // per_page
            }
        }), 200
        
    except ValueError:
        return jsonify({"error": "Paramètres de pagination invalides"}), 400
    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans GET /candidates: {str(e)}")
        return jsonify({"error": "Erreur de base de données"}), 500
    except Exception as e:
        logger.error(f"Erreur dans GET /candidates: {str(e)}")
        return jsonify({"error": f"Erreur serveur: {str(e)}"}), 500

# Route pour récupérer les entretiens pour le recruteur
@Dashboard_recruteur_bp.route("/interviews", methods=["GET"])
@require_auth("recruteur")
def get_recruiter_interviews(auth_payload):
    try:
        user_id = auth_payload["sub"]
        recruteur_id = auth_payload["recruteur_id"]
        
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        
        # Calcul de l'offset pour la pagination
        skip = (page - 1) * per_page
        
        db = current_app.mongo
        
        # Vérifier la structure de la collection entretiens
        sample_entretien = db[ENTRETIENS_COLLECTION].find_one()
        if sample_entretien:
            logger.info(f"Structure d'un entretien type: {sample_entretien}")
            logger.info(f"Champs disponibles dans un entretien: {sample_entretien.keys()}")
        
        # Récupérer les entretiens pour ce recruteur avec différents formats possibles
        logger.info(f"Recherche des entretiens pour le recruteur_id: {recruteur_id}")
        
        query = {
            "$or": [
                {"recruteur_id": ObjectId(recruteur_id)},
                {"recruiter_id": ObjectId(recruteur_id)},
                {"recruteur": ObjectId(recruteur_id)},
                {"recruiter": ObjectId(recruteur_id)},
                {"recruteur_id": recruteur_id},  # Essayer aussi en format string
                {"recruiter_id": recruteur_id}
            ]
        }
        
        logger.info(f"Requête de recherche d'entretiens: {query}")
        entretiens = list(db[ENTRETIENS_COLLECTION].find(query).sort("date", -1).skip(skip).limit(per_page))
        
        logger.info(f"Nombre d'entretiens trouvés: {len(entretiens)}")
        
        if len(entretiens) == 0:
            # Vérifier si la collection entretiens contient des données
            total_entretiens_in_db = db[ENTRETIENS_COLLECTION].count_documents({})
            logger.info(f"Nombre total d'entretiens dans la base de données: {total_entretiens_in_db}")
            
            # Vérifier les champs disponibles
            if total_entretiens_in_db > 0:
                example_entretien = db[ENTRETIENS_COLLECTION].find_one({})
                logger.info(f"Exemple d'entretien: {example_entretien}")
                logger.info(f"Champs disponibles dans un entretien: {example_entretien.keys() if example_entretien else 'Aucun'}")
                
                # Si des entretiens existent mais ne sont pas liés au recruteur, vérifier quel recruteur
                if "recruteur_id" in (example_entretien or {}):
                    other_recruteur_id = example_entretien.get("recruteur_id")
                    logger.info(f"Recruteur_id dans l'exemple d'entretien: {str(other_recruteur_id) if other_recruteur_id else 'Non défini'}")
        
        # Compter le nombre total d'entretiens
        total_entretiens = db[ENTRETIENS_COLLECTION].count_documents(query)
        
        # Préparer la liste des entretiens
        interviews_list = []
        
        for entretien in entretiens:
            # Récupérer les informations de l'offre associée
            offre_id = entretien.get("offre_id") or entretien.get("job_id") or entretien.get("offer_id")
            logger.info(f"Offre ID de l'entretien: {str(offre_id) if offre_id else 'Non défini'}")
            
            offre = None
            if offre_id:
                if isinstance(offre_id, str) and ObjectId.is_valid(offre_id):
                    offre_id = ObjectId(offre_id)
                offre = db[OFFRES_COLLECTION].find_one({"_id": offre_id})
            
            # Récupérer les informations du candidat
            candidat_id = entretien.get("candidat_id") or entretien.get("user_id") or entretien.get("candidate_id")
            candidat_email = entretien.get("candidat_email") or entretien.get("email") or entretien.get("candidate_email")
            
            logger.info(f"Candidat ID de l'entretien: {str(candidat_id) if candidat_id else 'Non défini'}")
            logger.info(f"Candidat Email de l'entretien: {candidat_email if candidat_email else 'Non défini'}")
            
            candidat = None
            if candidat_id:
                if isinstance(candidat_id, str) and ObjectId.is_valid(candidat_id):
                    candidat_id = ObjectId(candidat_id)
                candidat = db[USERS_COLLECTION].find_one({"_id": candidat_id})
            elif candidat_email:
                candidat = db[USERS_COLLECTION].find_one({"email": candidat_email})
            
            # Log des informations sur l'entretien
            logger.info(f"Entretien ID: {str(entretien['_id'])}")
            logger.info(f"Candidat trouvé: {bool(candidat)}, Offre trouvée: {bool(offre)}")
            
            candidat_nom = ""
            if candidat:
                candidat_nom = candidat.get("nom", "") or candidat.get("name", "")
                if candidat.get("prenom") or candidat.get("firstname"):
                    candidat_nom += " " + (candidat.get("prenom", "") or candidat.get("firstname", ""))
            
            # Liste des champs possibles pour chaque valeur
            candidat_nom = candidat_nom or entretien.get("candidat_nom", "") or entretien.get("candidate_name", "")
            candidat_email = (candidat.get("email", "") if candidat else "") or candidat_email or ""
            position = (offre.get("titre", "") or offre.get("title", "") if offre else "") or entretien.get("poste", "") or entretien.get("position", "") or ""
            status = entretien.get("statut", "") or entretien.get("status", "planifié")
            notes = entretien.get("notes", "") or entretien.get("commentaires", "") or ""
            recording_url = entretien.get("enregistrement_url", "") or entretien.get("recording_url", "") or ""
            feedback = entretien.get("feedback", "") or entretien.get("retour", "") or ""
            rating = entretien.get("note", 0) or entretien.get("rating", 0) or 0
            
            # Gestion de la date
            date_obj = None
            if isinstance(entretien.get("date"), datetime):
                date_obj = entretien.get("date")
            elif isinstance(entretien.get("interview_date"), datetime):
                date_obj = entretien.get("interview_date")
            else:
                date_obj = datetime.utcnow()
            
            date_str = date_obj.isoformat() + "Z"
            
            interviews_list.append({
                "id": str(entretien["_id"]),
                "candidateName": candidat_nom,
                "candidateEmail": candidat_email,
                "position": position,
                "date": date_str,
                "status": status,
                "notes": notes,
                "recording_url": recording_url,
                "feedback": feedback,
                "rating": rating
            })
        
        logger.info(f"Retour de {len(interviews_list)} entretiens pour le recruteur {recruteur_id}")
        
        return jsonify({
            "interviews": interviews_list,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total_entretiens,
                "pages": (total_entretiens + per_page - 1) // per_page
            }
        }), 200
        
    except ValueError:
        return jsonify({"error": "Paramètres de pagination invalides"}), 400
    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans GET /interviews: {str(e)}")
        return jsonify({"error": "Erreur de base de données"}), 500
    except Exception as e:
        logger.error(f"Erreur dans GET /interviews: {str(e)}")
        return jsonify({"error": f"Erreur serveur: {str(e)}"}), 500

# Route pour télécharger le CV d'un candidat
@Dashboard_recruteur_bp.route("/cv/<candidature_id>", methods=["GET"])
@require_auth("recruteur")
def download_candidate_cv(auth_payload, candidature_id):
    try:
        user_id = auth_payload["sub"]
        recruteur_id = auth_payload["recruteur_id"]
        
        if not ObjectId.is_valid(candidature_id):
            return jsonify({"error": "ID de candidature invalide"}), 400
            
        db = current_app.mongo
        
        # Récupérer la candidature
        candidature = db[CANDIDATURES_COLLECTION].find_one({"_id": ObjectId(candidature_id)})
        if not candidature:
            return jsonify({"error": "Candidature non trouvée"}), 404
            
        # Vérifier que la candidature est pour une offre du recruteur
        offre_id = candidature.get("offre_id")
        offre = db[OFFRES_COLLECTION].find_one({"_id": offre_id, "recruteur_id": ObjectId(recruteur_id)})
        if not offre:
            return jsonify({"error": "Vous n'êtes pas autorisé à accéder à ce CV"}), 403
            
        # Récupérer le chemin du CV
        cv_path = candidature.get("cv_path")
        if not cv_path or not os.path.exists(cv_path):
            return jsonify({"error": "CV non trouvé"}), 404
            
        # Renvoyer le fichier
        return send_file(cv_path, as_attachment=True, download_name=os.path.basename(cv_path))

    except Exception as e:
        logger.error(f"Erreur lors du téléchargement du CV: {str(e)}")
        return jsonify({"error": f"Erreur serveur: {str(e)}"}), 500