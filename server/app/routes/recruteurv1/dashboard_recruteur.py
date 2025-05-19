from flask import Blueprint, jsonify, request, current_app, send_file
from bson import ObjectId
import logging
from datetime import datetime, timedelta, timezone
from jwt_manager import jwt_manager
from config.config import OFFRES_COLLECTION, CANDIDATURES_COLLECTION, ENTRETIENS_COLLECTION, CANDIDATS_COLLECTION, ACTIVITIES_COLLECTION
from pymongo.errors import PyMongoError
import os
from collections import defaultdict

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
        logger.info(f"Récupération des données du dashboard pour l'utilisateur {user_id}")

        # Récupérer le recruteur
        db = current_app.mongo
        recruteur = db[RECRUTEURS_COLLECTION].find_one({"utilisateur_id": ObjectId(user_id)})
        if not recruteur:
            logger.error(f"Recruteur non trouvé pour l'utilisateur {user_id}")
            return jsonify({"error": "Recruteur non trouvé"}), 404

        recruteur_id = str(recruteur["_id"])
        logger.info(f"ID du recruteur trouvé: {recruteur_id}")

        # Calculer la période
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=7)  # Semaine par défaut

        # Récupérer les offres du recruteur
        offres = list(db[OFFRES_COLLECTION].find(
                {"recruteur_id": ObjectId(recruteur_id)},
            {"_id": 1, "titre": 1, "departement": 1, "statut": 1}
        ))
        offre_ids = [offre["_id"] for offre in offres]

        # Statistiques des offres
        total_jobs = len(offre_ids)
        active_jobs = sum(1 for offre in offres if offre.get("statut") == "ouverte")

        # Statistiques des candidatures
        candidatures_query = {
            "offre_id": {"$in": offre_ids}
        }
        
        # Récupérer toutes les candidatures
        candidatures = list(db[CANDIDATURES_COLLECTION].find(candidatures_query))
        total_candidates = len(candidatures)
        
        # Nouvelles candidatures de la semaine
        new_candidates = sum(1 for c in candidatures if c.get("created_at", datetime.utcnow()) >= start_date)

        # Statistiques des entretiens
        interview_query = {
            "recruteur_id": ObjectId(recruteur_id)
        }
        
        # Récupérer tous les entretiens
        entretiens = list(db[ENTRETIENS_COLLECTION].find(interview_query))
        total_interviews = len(entretiens)
        
        # Prochains entretiens
        upcoming_interviews = sum(1 for e in entretiens if e.get("date", datetime.utcnow()) >= datetime.utcnow())

        # Distribution des statuts des candidatures
        status_distribution = {
            "En attente": 0,
            "En cours": 0,
            "Accepté": 0,
            "Refusé": 0
        }
        
        for candidature in candidatures:
            statut = candidature.get("statut", "En attente")
            if statut in status_distribution:
                status_distribution[statut] += 1
            else:
                status_distribution["En attente"] += 1

        # Calcul du taux de conversion
        conversion_rate = 0
        if total_candidates > 0:
            accepted_count = status_distribution["Accepté"]
            conversion_rate = (accepted_count / total_candidates) * 100

        # Distribution des statuts des entretiens
        interview_status_distribution = {
            "Planifié": 0,
            "En cours": 0,
            "Terminé": 0,
            "Annulé": 0
        }
        
        for entretien in entretiens:
            statut = entretien.get("statut", "Planifié")
            if statut in interview_status_distribution:
                interview_status_distribution[statut] += 1
            else:
                interview_status_distribution["Planifié"] += 1

        # Distribution des offres par département
        offres_by_department = {}
        for offre in offres:
            departement = offre.get("departement", "Non spécifié")
            offres_by_department[departement] = offres_by_department.get(departement, 0) + 1

        # Activité récente
        recent_activity = list(db[ACTIVITIES_COLLECTION].find({
            "user_id": recruteur_id,
            "date": {"$gte": start_date}
        }).sort("date", -1).limit(10))

        recent_activity_list = []
        for activity in recent_activity:
            recent_activity_list.append({
                "id": str(activity["_id"]),
                "type": activity.get("type", ""),
                "message": activity.get("message", ""),
                "date": activity.get("date", datetime.utcnow()).isoformat() + "Z"
            })

        response = {
            "totalCandidates": total_candidates,
            "newCandidates": new_candidates,
            "totalJobs": total_jobs,
            "activeJobs": active_jobs,
            "totalInterviews": total_interviews,
            "upcomingInterviews": upcoming_interviews,
            "conversionRate": round(conversion_rate, 2),
            "hiredCandidates": status_distribution["Accepté"],
            "recentActivity": recent_activity_list,
            "graphData": {
                "statusDistribution": status_distribution,
                "interviewStatusDistribution": interview_status_distribution,
                "offresByDepartment": offres_by_department
            }
        }

        logger.info(f"Données du dashboard générées avec succès pour le recruteur {recruteur_id}")
        return jsonify(response), 200

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans /dashboard: {str(e)}")
        return jsonify({"error": "Erreur de base de données"}), 500
    except Exception as e:
        logger.error(f"Erreur dans /dashboard: {str(e)}")
        return jsonify({"error": f"Erreur serveur: {str(e)}"}), 500

@Dashboard_recruteur_bp.route("/dashboard/init", methods=["GET"])
@require_auth("recruteur")
def get_initial_dashboard_data(auth_payload):
    """
    Fetch initial dashboard data for the connected recruiter.
    Returns aggregated statistics and latest entries for each section.
    """
    try:
        user_id = auth_payload["sub"]
        recruteur_id = auth_payload["recruteur_id"]
        logger.info(f"Récupération des données initiales pour le recruteur {recruteur_id}")
        
        db = current_app.mongo
        
        # Get period from request args with default value
        period = request.args.get("period", "week")
        
        # Calculate date range based on period
        end_date = datetime.utcnow()
        if period == "week":
            start_date = end_date - timedelta(days=7)
        elif period == "month":
            start_date = end_date - timedelta(days=30)
        else:  # year
            start_date = end_date - timedelta(days=365)
            
        # Get active job offers count - Vérifier avec les deux formats possibles d'ID
        activeJobs = db[OFFRES_COLLECTION].count_documents({
            "$or": [
                {"recruteur_id": ObjectId(recruteur_id)},
                {"recruteur_id": ObjectId(user_id)}
            ],
            "statut": "ouverte"
        })
        
        # Get total job offers count - Vérifier avec les deux formats possibles d'ID
        totalJobs = db[OFFRES_COLLECTION].count_documents({
            "$or": [
                {"recruteur_id": ObjectId(recruteur_id)},
                {"recruteur_id": ObjectId(user_id)}
            ]
        })
        
        # Get new candidates count (for this recruiter's job offers)
        # First get all offres for this recruiter - Vérifier avec les deux formats possibles d'ID
        offres = list(db[OFFRES_COLLECTION].find({
            "$or": [
                {"recruteur_id": ObjectId(recruteur_id)},
                {"recruteur_id": ObjectId(user_id)}
            ]
        }))
        
        # Debug - Afficher les IDs des offres trouvées
        offre_ids = [offre["_id"] for offre in offres]
        logger.info(f"Offres trouvées ({len(offres)}) pour les IDs {user_id} et {recruteur_id}: {[str(oid) for oid in offre_ids]}")
        
        newCandidates = db[CANDIDATURES_COLLECTION].count_documents({
            "offre_id": {"$in": offre_ids},
            "date_creation": {"$gte": start_date, "$lte": end_date}
        })
        
        # Get total candidates count for this recruiter's offers
        totalCandidates = db[CANDIDATURES_COLLECTION].count_documents({
            "offre_id": {"$in": offre_ids}
        })
        
        # Get total interviews count
        totalInterviews = db[ENTRETIENS_COLLECTION].count_documents({
            "$or": [
                {"recruteur_id": ObjectId(recruteur_id)},
                {"recruteur_id": ObjectId(user_id)}
            ]
        })
        
        # Get upcoming interviews count
        upcomingInterviews = db[ENTRETIENS_COLLECTION].count_documents({
            "$or": [
                {"recruteur_id": ObjectId(recruteur_id)},
                {"recruteur_id": ObjectId(user_id)}
            ],
            "date": {"$gte": datetime.utcnow()}
        })
        
        # Calculate conversion rate
        conversionRate = 0
        if totalCandidates > 0:
            acceptedCandidates = db[CANDIDATURES_COLLECTION].count_documents({
                "offre_id": {"$in": offre_ids},
                "status": "accepté"
            })
            conversionRate = (acceptedCandidates / totalCandidates) * 100
            
        # Get recent activity
        recentActivity = list(db[ACTIVITIES_COLLECTION].find({
            "user_id": recruteur_id,
            "date": {"$gte": start_date}
        }).sort("date", -1).limit(10))
        
        recentActivity_list = []
        for activity in recentActivity:
            recentActivity_list.append({
                "id": str(activity["_id"]),
                "type": activity.get("type", ""),
                "message": activity.get("message", ""),
                "date": activity.get("date", datetime.utcnow()).isoformat() + "Z"
            })
            
        # Get latest offers
        latest_offers = list(db[OFFRES_COLLECTION].find({
            "recruteur_id": ObjectId(recruteur_id)
        }).sort("date_creation", -1).limit(5))
        
        offres_list = []
        for offre in latest_offers:
            offres_list.append({
                "id": str(offre["_id"]),
                "titre": offre.get("titre", ""),
                "description": offre.get("description", ""),
                "localisation": offre.get("localisation", ""),
                "departement": offre.get("departement", ""),
                "statut": offre.get("statut", "ouverte"),
                "date_creation": offre.get("date_creation", datetime.utcnow()).isoformat() + "Z"
            })
            
        # Prepare graph data
        # Candidates by date
        candidates_date_range = {}
        current = start_date
        while current <= end_date:
            date_str = current.strftime("%Y-%m-%d")
            candidates_date_range[date_str] = 0
            current += timedelta(days=1)
            
        # Interviews by date
        interviews_date_range = candidates_date_range.copy()
        
        # Status distribution
        status_distribution = {}
        
        # Query MongoDB for real data
        candidate_stats = db[CANDIDATURES_COLLECTION].aggregate([
            {"$match": {
                "offre_id": {"$in": offre_ids},
                "date_creation": {"$gte": start_date, "$lte": end_date}
            }},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$date_creation"}},
                "count": {"$sum": 1}
            }}
        ])
        
        for stat in candidate_stats:
            date_str = stat["_id"]
            if date_str in candidates_date_range:
                candidates_date_range[date_str] = stat["count"]
                
        interview_stats = db[ENTRETIENS_COLLECTION].aggregate([
            {"$match": {
                "$or": [
                    {"recruteur_id": ObjectId(recruteur_id)},
                    {"recruteur_id": ObjectId(user_id)}
                ],
                "date": {"$gte": start_date, "$lte": end_date}
            }},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$date"}},
                "count": {"$sum": 1}
            }}
        ])
        
        for stat in interview_stats:
            date_str = stat["_id"]
            if date_str in interviews_date_range:
                interviews_date_range[date_str] = stat["count"]
                
        status_stats = db[CANDIDATURES_COLLECTION].aggregate([
            {"$match": {
                "offre_id": {"$in": offre_ids}
            }},
            {"$group": {
                "_id": "$status",
                "count": {"$sum": 1}
            }}
        ])
        
        for stat in status_stats:
            status = stat["_id"] or "Non défini"
            status_distribution[status] = stat["count"]
            
        interview_status_stats = db[ENTRETIENS_COLLECTION].aggregate([
            {"$match": {
                "$or": [
                    {"recruteur_id": ObjectId(recruteur_id)},
                    {"recruteur_id": ObjectId(user_id)}
                ]
            }},
            {"$group": {
                "_id": "$statut",
                "count": {"$sum": 1}
            }}
        ])
        
        interview_status_distribution = {}
        for stat in interview_status_stats:
            status = stat["_id"] or "Non défini"
            interview_status_distribution[status] = stat["count"]
            
        # Get offers by department
        offers_by_department = {}
        dept_stats = db[OFFRES_COLLECTION].aggregate([
            {"$match": {
                "$or": [
                    {"recruteur_id": ObjectId(recruteur_id)},
                    {"recruteur_id": ObjectId(user_id)}
                ]
            }},
            {"$group": {
                "_id": "$departement",
                "count": {"$sum": 1}
            }}
        ])
        
        for stat in dept_stats:
            dept = stat["_id"] or "Non défini"
            offers_by_department[dept] = stat["count"]
            
        # Assemble response data
        response_data = {
            "activeJobs": activeJobs,
            "totalJobs": totalJobs,
            "newCandidates": newCandidates,
            "totalCandidates": totalCandidates,
            "totalInterviews": totalInterviews,
            "upcomingInterviews": upcomingInterviews,
            "conversionRate": conversionRate,
            "recentActivity": recentActivity_list,
            "offres": offres_list,
            "graphData": {
                "candidatesByDate": candidates_date_range,
                "interviewsByDate": interviews_date_range,
                "statusDistribution": status_distribution,
                "interviewStatusDistribution": interview_status_distribution,
                "offresByDepartment": offers_by_department
            }
        }
        
        logger.info(f"Données initiales récupérées avec succès pour le recruteur {recruteur_id}")
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des données initiales: {str(e)}")
        return jsonify({"error": f"Erreur serveur: {str(e)}"}), 500

@Dashboard_recruteur_bp.route("/candidates", methods=["GET"])
@require_auth("recruteur")
def get_recruiter_candidates(auth_payload):
    try:
        user_id = auth_payload["sub"]
        recruteur_id = auth_payload["recruteur_id"]
        
        db = current_app.mongo
        
        # Récupérer toutes les offres du recruteur
        offres = list(db[OFFRES_COLLECTION].find(
            {"recruteur_id": ObjectId(recruteur_id)},
            {"_id": 1, "titre": 1}
        ))
        offre_ids = [offre["_id"] for offre in offres]
        
        # Récupérer toutes les candidatures pour ces offres
        candidatures = list(db[CANDIDATURES_COLLECTION].find({
            "offre_id": {"$in": offre_ids}
        }))
            
        # Préparer la liste des candidats avec leurs statuts
        candidates = []
        for candidature in candidatures:
            try:
                # Récupérer les informations de l'offre
                offre = next((o for o in offres if o["_id"] == candidature["offre_id"]), None)
            
                # Récupérer les informations du candidat
                candidat = db[USERS_COLLECTION].find_one({"email": candidature.get("user_email")})
            
                if candidat:
                    candidates.append({
                    "id": str(candidature["_id"]),
                        "nom": candidat.get("nom", ""),
                        "prenom": candidat.get("prenom", ""),
                        "email": candidature.get("user_email", ""),
                        "offre_titre": offre.get("titre", "") if offre else "Offre non trouvée",
                        "status": candidature.get("statut", "En attente"),
                        "date_candidature": candidature.get("created_at", datetime.utcnow()).isoformat() + "Z"
                    })
            except Exception as e:
                logger.error(f"Erreur lors du traitement de la candidature {candidature.get('_id')}: {str(e)}")
                continue
        
        # Calculer la distribution des statuts
        status_distribution = {
            "En attente": 0,
            "En cours": 0,
            "Accepté": 0,
            "Refusé": 0
        }
        
        for candidate in candidates:
            status = candidate["status"]
            if status in status_distribution:
                status_distribution[status] += 1
            else:
                status_distribution["En attente"] += 1
        
        # Trier les candidats par date de candidature (plus récent en premier)
        candidates.sort(key=lambda x: x["date_candidature"], reverse=True)
        
        return jsonify({
            "candidates": candidates,
            "status_distribution": status_distribution,
            "total": len(candidates)
        }), 200
        
    except PyMongoError as e:
        logger.error(f"Erreur MongoDB lors de la récupération des candidats: {str(e)}")
        return jsonify({"error": "Erreur de base de données"}), 500
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des candidats: {str(e)}")
        return jsonify({"error": f"Erreur serveur: {str(e)}"}), 500

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

@Dashboard_recruteur_bp.route("/statistics", methods=["GET"])
@require_auth("recruteur")
def get_recruiter_statistics(auth_payload):
    """Récupère les statistiques générales pour le dashboard du recruteur."""
    try:
        user_id = auth_payload["sub"]
        recruteur_id = auth_payload["recruteur_id"]
        
        db = current_app.mongo
        
        # Récupérer les IDs des offres du recruteur
        offre_ids = [offre["_id"] for offre in db[OFFRES_COLLECTION].find(
            {"recruteur_id": ObjectId(recruteur_id)},
            {"_id": 1}
        )]
        logger.info(f"IDs des offres du recruteur: {[str(oid) for oid in offre_ids]}")
        
        # Statistiques des offres
        total_offres = len(offre_ids)
        offres_actives = db[OFFRES_COLLECTION].count_documents({
            "recruteur_id": ObjectId(recruteur_id),
            "statut": "ouverte"
        })
        
        # Statistiques des candidatures
        candidatures_query = {
            "offre_id": {"$in": offre_ids}
        }
        
        total_candidatures = db[CANDIDATURES_COLLECTION].count_documents(candidatures_query)
        logger.info(f"Nombre total de candidatures trouvées: {total_candidatures}")
        
        # Statistiques par statut
        candidatures_par_statut = defaultdict(int)
        candidatures = db[CANDIDATURES_COLLECTION].find(candidatures_query)
        
        for candidature in candidatures:
            statut = candidature.get("statut", "En attente")
            candidatures_par_statut[statut] += 1
        
        # Statistiques des 30 derniers jours
        date_limite = datetime.now(timezone.utc) - timedelta(days=30)
        candidatures_recentes = db[CANDIDATURES_COLLECTION].count_documents({
            "offre_id": {"$in": offre_ids},
            "created_at": {"$gte": date_limite}
        })
        
        # Statistiques par département
        offres_par_departement = defaultdict(int)
        offres = db[OFFRES_COLLECTION].find({"recruteur_id": ObjectId(recruteur_id)})
        for offre in offres:
            departement = offre.get("departement", "Non spécifié")
            offres_par_departement[departement] += 1
        
        # Statistiques des candidatures par département
        candidatures_par_departement = defaultdict(int)
        for offre in offres:
            departement = offre.get("departement", "Non spécifié")
            nb_candidatures = db[CANDIDATURES_COLLECTION].count_documents({
                "offre_id": offre["_id"]
            })
            candidatures_par_departement[departement] += nb_candidatures
        
        # Statistiques des candidatures par jour (30 derniers jours)
        candidatures_par_jour = defaultdict(int)
        pipeline = [
            {
                "$match": {
                    "offre_id": {"$in": offre_ids},
                    "created_at": {"$gte": date_limite}
                }
            },
            {
                "$group": {
                    "_id": {
                        "$dateToString": {
                            "format": "%Y-%m-%d",
                            "date": "$created_at"
                        }
                    },
                    "count": {"$sum": 1}
                }
            }
        ]
        
        result = list(db[CANDIDATURES_COLLECTION].aggregate(pipeline))
        for item in result:
            candidatures_par_jour[item["_id"]] = item["count"]
        
        return jsonify({
            "statistics": {
                "offres": {
                    "total": total_offres,
                    "actives": offres_actives,
                    "par_departement": dict(offres_par_departement)
                },
                "candidatures": {
                    "total": total_candidatures,
                    "recentes": candidatures_recentes,
                    "par_statut": dict(candidatures_par_statut),
                    "par_departement": dict(candidatures_par_departement),
                    "par_jour": dict(candidatures_par_jour)
                }
            }
        }), 200
        
    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans /statistics: {str(e)}")
        return jsonify({"error": "Erreur de base de données", "code": "DB_ERROR"}), 500
    except Exception as e:
        logger.error(f"Erreur dans /statistics: {str(e)}")
        return jsonify({"error": f"Erreur serveur: {str(e)}", "code": "SERVER_ERROR"}), 500

@Dashboard_recruteur_bp.route("/candidatures-trend", methods=["GET"])
@require_auth("recruteur")
def get_candidatures_trend(auth_payload):
    """Récupère l'évolution des candidatures sur les 30 derniers jours."""
    try:
        user_id = auth_payload["sub"]
        recruteur_id = auth_payload["recruteur_id"]
        
        db = current_app.mongo
        
        # Récupérer les IDs des offres du recruteur
        offre_ids = [offre["_id"] for offre in db[OFFRES_COLLECTION].find(
            {"recruteur_id": ObjectId(recruteur_id)},
            {"_id": 1}
        )]
        
        # Initialiser les données pour les 30 derniers jours
        date_limite = datetime.now(timezone.utc) - timedelta(days=30)
        dates = [(datetime.now(timezone.utc) - timedelta(days=i)).date() for i in range(30)]
        candidatures_par_jour = {date.isoformat(): 0 for date in dates}
        
        # Récupérer les candidatures des 30 derniers jours
        pipeline = [
            {
                "$match": {
                    "offre_id": {"$in": offre_ids},
                    "created_at": {"$gte": date_limite}
                }
            },
            {
                "$group": {
                    "_id": {
                        "$dateToString": {
                            "format": "%Y-%m-%d",
                            "date": "$created_at"
                        }
                    },
                    "count": {"$sum": 1}
                }
            }
        ]
        
        result = list(db[CANDIDATURES_COLLECTION].aggregate(pipeline))
        
        # Mettre à jour les données avec les résultats de l'agrégation
        for item in result:
            candidatures_par_jour[item["_id"]] = item["count"]
        
        return jsonify({
            "trend": {
                "dates": list(candidatures_par_jour.keys()),
                "counts": list(candidatures_par_jour.values())
            }
        }), 200
        
    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans /candidatures-trend: {str(e)}")
        return jsonify({"error": "Erreur de base de données", "code": "DB_ERROR"}), 500
    except Exception as e:
        logger.error(f"Erreur dans /candidatures-trend: {str(e)}")
        return jsonify({"error": f"Erreur serveur: {str(e)}", "code": "SERVER_ERROR"}), 500

@Dashboard_recruteur_bp.route("/top-candidates", methods=["GET"])
@require_auth("recruteur")
def get_top_candidates(auth_payload):
    """Récupère les meilleurs candidats basés sur le nombre de candidatures acceptées."""
    try:
        user_id = auth_payload["sub"]
        recruteur_id = auth_payload["recruteur_id"]
        
        db = current_app.mongo
        
        # Récupérer les IDs des offres du recruteur
        offre_ids = [offre["_id"] for offre in db[OFFRES_COLLECTION].find(
            {"recruteur_id": ObjectId(recruteur_id)},
            {"_id": 1}
        )]
        
        # Pipeline d'agrégation pour obtenir les meilleurs candidats
        pipeline = [
            {
                "$match": {
                    "offre_id": {"$in": offre_ids},
                    "statut": "Accepté"
                }
            },
            {
                "$group": {
                    "_id": "$user_email",
                    "count": {"$sum": 1}
                }
            },
            {
                "$sort": {"count": -1}
            },
            {
                "$limit": 5
            }
        ]
        
        top_candidates = list(db[CANDIDATURES_COLLECTION].aggregate(pipeline))
        
        # Enrichir les données avec les informations des candidats
        result = []
        for candidate in top_candidates:
            user = db[USERS_COLLECTION].find_one({"email": candidate["_id"]})
            if user:
                candidat = db[CANDIDATS_COLLECTION].find_one({"utilisateur_id": user["_id"]})
                if candidat:
                    result.append({
                        "email": candidate["_id"],
                        "nom": candidat.get("nom", ""),
                        "prenom": candidat.get("prenom", ""),
                        "candidatures_acceptees": candidate["count"]
                    })
        
        return jsonify({
            "top_candidates": result
        }), 200
        
    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans /top-candidates: {str(e)}")
        return jsonify({"error": "Erreur de base de données", "code": "DB_ERROR"}), 500
    except Exception as e:
        logger.error(f"Erreur dans /top-candidates: {str(e)}")
        return jsonify({"error": f"Erreur serveur: {str(e)}", "code": "SERVER_ERROR"}), 500

@Dashboard_recruteur_bp.route("/candidatures/status", methods=["GET"])
@require_auth("recruteur")
def get_candidatures_status(auth_payload):
    """Récupère les statuts des candidatures pour le dashboard."""
    try:
        user_id = auth_payload["sub"]
        logger.info(f"Récupération des statuts des candidatures pour l'utilisateur {user_id}")

        # Récupérer le recruteur
        db = current_app.mongo
        recruteur = db[RECRUTEURS_COLLECTION].find_one({"utilisateur_id": ObjectId(user_id)})
        if not recruteur:
            logger.error(f"Recruteur non trouvé pour l'utilisateur {user_id}")
            return jsonify({"error": "Recruteur non trouvé"}), 404

        recruteur_id = str(recruteur["_id"])
        
        # Récupérer les offres du recruteur
        offres = list(db[OFFRES_COLLECTION].find(
            {"recruteur_id": ObjectId(recruteur_id)},
            {"_id": 1, "titre": 1}
        ))
        offre_ids = [offre["_id"] for offre in offres]

        # Récupérer toutes les candidatures pour ces offres
        candidatures = list(db[CANDIDATURES_COLLECTION].find({
            "offre_id": {"$in": offre_ids}
        }))

        # Organiser les candidatures par statut
        status_counts = {
            "En attente": 0,
            "En cours": 0,
            "Accepté": 0,
            "Refusé": 0
        }

        # Compter les candidatures par statut
        for candidature in candidatures:
            statut = candidature.get("statut", "En attente")
            if statut in status_counts:
                status_counts[statut] += 1
            else:
                status_counts["En attente"] += 1

        # Récupérer les dernières candidatures avec leurs détails
        recent_candidatures = []
        for candidature in candidatures:
            offre = next((o for o in offres if o["_id"] == candidature["offre_id"]), None)
            if offre:
                recent_candidatures.append({
                    "id": str(candidature["_id"]),
                    "offre_id": str(candidature["offre_id"]),
                    "offre_titre": offre.get("titre", "Sans titre"),
                    "statut": candidature.get("statut", "En attente"),
                    "created_at": candidature.get("created_at", datetime.utcnow()).isoformat(),
                    "user_email": candidature.get("user_email", "")
                })

        # Trier les candidatures récentes par date de création
        recent_candidatures.sort(key=lambda x: x["created_at"], reverse=True)
        recent_candidatures = recent_candidatures[:10]  # Limiter aux 10 plus récentes

        return jsonify({
            "status_counts": status_counts,
            "recent_candidatures": recent_candidatures,
            "total_candidatures": len(candidatures)
        }), 200

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB lors de la récupération des statuts: {str(e)}")
        return jsonify({"error": "Erreur de base de données"}), 500
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des statuts: {str(e)}")
        return jsonify({"error": f"Erreur serveur: {str(e)}"}), 500

@Dashboard_recruteur_bp.route("/accepted-interviews", methods=["GET"])
@require_auth("recruteur")
def get_accepted_interviews(auth_payload):
    try:
        user_id = auth_payload["sub"]
        recruteur_id = auth_payload["recruteur_id"]
        
        db = current_app.mongo
        
        # Récupérer les offres du recruteur
        offres = list(db[OFFRES_COLLECTION].find(
            {"recruteur_id": ObjectId(recruteur_id)},
            {"_id": 1, "titre": 1}
        ))
        offre_ids = [offre["_id"] for offre in offres]
        
        # Récupérer les candidatures acceptées
        candidatures_acceptees = list(db[CANDIDATURES_COLLECTION].find({
            "offre_id": {"$in": offre_ids},
            "statut": "Accepté"
        }))
        
        # Récupérer les entretiens associés aux candidatures acceptées
        entretiens = []
        for candidature in candidatures_acceptees:
            entretien = db[ENTRETIENS_COLLECTION].find_one({
                "candidature_id": candidature["_id"]
            })
            
            if entretien:
                # Récupérer les informations du candidat
                candidat = db[USERS_COLLECTION].find_one({"_id": candidature["candidat_id"]})
                
                # Récupérer les informations de l'offre
                offre = next((o for o in offres if o["_id"] == candidature["offre_id"]), None)
                
                entretiens.append({
                    "id": str(entretien["_id"]),
                    "candidature_id": str(candidature["_id"]),
                    "offre_id": str(candidature["offre_id"]),
                    "offre_titre": offre["titre"] if offre else "Offre inconnue",
                    "candidat_nom": f"{candidat.get('nom', '')} {candidat.get('prenom', '')}".strip() if candidat else "Candidat inconnu",
                    "candidat_email": candidat.get("email", "") if candidat else "",
                    "date": entretien.get("date", datetime.utcnow()).isoformat() + "Z",
                    "statut": entretien.get("statut", "En attente"),
                    "notes": entretien.get("notes", ""),
                    "feedback": entretien.get("feedback", ""),
                    "rating": entretien.get("rating", 0)
                })
        
        logger.info(f"Retour de {len(entretiens)} entretiens acceptés pour le recruteur {recruteur_id}")
        return jsonify({
            "interviews": entretiens,
            "total": len(entretiens)
        }), 200
        
    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans /accepted-interviews: {str(e)}")
        return jsonify({"error": "Erreur de base de données"}), 500
    except Exception as e:
        logger.error(f"Erreur dans /accepted-interviews: {str(e)}")
        return jsonify({"error": f"Erreur serveur: {str(e)}"}), 500