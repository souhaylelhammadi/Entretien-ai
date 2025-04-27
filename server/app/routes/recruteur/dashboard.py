from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from auth_middleware import require_auth, recruiter_only
from pydantic import BaseModel
from typing import List, Optional
import logging
from flask_cors import cross_origin
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")

# Pydantic models for data validation
class JobOffer(BaseModel):
    _id: str
    titre: str
    departement: Optional[str] = None
    localisation: Optional[str] = None
    description: Optional[str] = None
    competences_requises: List[str] = []
    salaire_min: Optional[float] = None
    status: str = "open"
    recruteur_id: str
    entreprise_id: Optional[str] = None
    created_at: Optional[str] = None

class Candidate(BaseModel):
    _id: str
    offreEmploi: Optional[dict] = None
    recruteur_id: str
    nom: Optional[str] = None
    email: Optional[str] = None
    telephone: Optional[str] = None
    cv: Optional[str] = None
    lettre_motivation: Optional[str] = None
    statut: str = "en_attente"
    date_postulation: Optional[str] = None

class Interview(BaseModel):
    _id: str
    candidate_id: str
    job_id: str
    recruteur_id: str
    candidateName: Optional[str] = None
    position: Optional[str] = None
    date: Optional[str] = None
    status: str = "Planifié"

@dashboard_bp.route("/offres-emploi", methods=["GET"])
@recruiter_only
@cross_origin()
def get_offres_emploi(*args):
    """Retrieve job offers for the authenticated recruiter with pagination."""
    try:
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 10))
        skip = (page - 1) * limit

        if "offres" not in current_app.mongo.db.list_collection_names():
            logger.warning(f"Collection 'offres' not found for user {request.user['id']}")
            return jsonify({"offres": [], "page": page, "limit": limit, "total": 0}), 200

        query = {"recruteur_id": request.user["id"]}
        total = current_app.mongo.db.offres.count_documents(query)
        offres = current_app.mongo.db.offres.find(query).skip(skip).limit(limit)

        offres_list = [
            JobOffer(
                **{
                    **offre,
                    "_id": str(offre["_id"]),
                    "created_at": offre["created_at"].isoformat() if offre.get("created_at") else None,
                }
            ).dict()
            for offre in offres
        ]
        logger.info(f"Fetched {len(offres_list)} job offers for user {request.user['id']} via {request.method} {request.path}")
        return jsonify({"offres": offres_list, "page": page, "limit": limit, "total": total}), 200
    except Exception as e:
        logger.error(f"Error fetching job offers for user {request.user['id']}: {str(e)}")
        return jsonify({"error": "Erreur serveur lors de la récupération des offres"}), 500

@dashboard_bp.route("/candidates", methods=["GET"])
@recruiter_only
@cross_origin()
def get_candidates(*args):
    """Retrieve candidates for the authenticated recruiter with pagination."""
    try:
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 10))
        skip = (page - 1) * limit

        if "candidates" not in current_app.mongo.db.list_collection_names():
            logger.warning(f"Collection 'candidates' not found for user {request.user['id']}")
            return jsonify({"candidates": [], "page": page, "limit": limit, "total": 0}), 200

        query = {"recruteur_id": request.user["id"]}
        total = current_app.mongo.db.candidates.count_documents(query)
        candidates = current_app.mongo.db.candidates.find(query).skip(skip).limit(limit)
        candidates_list = [
            Candidate(
                **{
                    **candidate,
                    "_id": str(candidate["_id"]),
                    "offreEmploi": (
                        {
                            **candidate["offreEmploi"],
                            "_id": str(candidate["offreEmploi"]["_id"]) if "_id" in candidate["offreEmploi"] else None,
                        }
                        if candidate.get("offreEmploi")
                        else None
                    ),
                    "date_postulation": candidate["date_postulation"].isoformat() if candidate.get("date_postulation") else None,
                }
            ).dict()
            for candidate in candidates
        ]
        logger.info(f"Fetched {len(candidates_list)} candidates for user {request.user['id']} via {request.method} {request.path}")
        return jsonify({"candidates": candidates_list, "page": page, "limit": limit, "total": total}), 200
    except Exception as e:
        logger.error(f"Error fetching candidates for user {request.user['id']}: {str(e)}")
        return jsonify({"error": "Erreur serveur lors de la récupération des candidats"}), 500

@dashboard_bp.route("/interviews", methods=["GET"])
@recruiter_only
@cross_origin()
def get_interviews(*args):
    """Retrieve interviews for the authenticated recruiter with pagination."""
    try:
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 10))
        skip = (page - 1) * limit

        if "interviews" not in current_app.mongo.db.list_collection_names():
            logger.warning(f"Collection 'interviews' not found for user {request.user['id']}")
            return jsonify({"interviews": [], "page": page, "limit": limit, "total": 0}), 200

        query = {"recruteur_id": request.user["id"]}
        total = current_app.mongo.db.interviews.count_documents(query)
        interviews = current_app.mongo.db.interviews.find(query).skip(skip).limit(limit)
        interviews_list = [
            Interview(
                **{
                    **interview,
                    "_id": str(interview["_id"]),
                    "candidate_id": str(interview["candidate_id"]) if interview.get("candidate_id") else "",
                    "job_id": str(interview["job_id"]) if interview.get("job_id") else "",
                    "date": interview["date"].isoformat() if interview.get("date") else None,
                }
            ).dict()
            for interview in interviews
        ]
        logger.info(f"Fetched {len(interviews_list)} interviews for user {request.user['id']} via {request.method} {request.path}")
        return jsonify({"interviews": interviews_list, "page": page, "limit": limit, "total": total}), 200
    except Exception as e:
        logger.error(f"Error fetching interviews for user {request.user['id']}: {str(e)}")
        return jsonify({"error": "Erreur serveur lors de la récupération des entretiens"}), 500

@dashboard_bp.route("/data-graph", methods=["GET"])
@recruiter_only
@cross_origin()
def get_graph_data(*args):
    """Retrieve data for graphs showing offers, candidates, and interviews."""
    try:
        # Get date range from query params or default to current month
        period = request.args.get("period", "month")
        recruteur_id = request.user["id"]
        
        # Calculate date range based on period
        now = datetime.now()
        
        if period == "week":
            start_date = now - timedelta(days=now.weekday())
            end_date = start_date + timedelta(days=7)
        elif period == "month":
            start_date = datetime(now.year, now.month, 1)
            if now.month == 12:
                end_date = datetime(now.year + 1, 1, 1)
            else:
                end_date = datetime(now.year, now.month + 1, 1)
        elif period == "year":
            start_date = datetime(now.year, 1, 1)
            end_date = datetime(now.year + 1, 1, 1)
        elif period == "all":
            # Get all data regardless of date
            start_date = datetime(2000, 1, 1)  # A date far in the past
            end_date = datetime(2100, 1, 1)    # A date far in the future
        else:  # Default to month
            start_date = datetime(now.year, now.month, 1)
            if now.month == 12:
                end_date = datetime(now.year + 1, 1, 1)
            else:
                end_date = datetime(now.year, now.month + 1, 1)
        
        logger.info(f"Fetching graph data for recruiter {recruteur_id} from {start_date} to {end_date}")
        
        # Safely check if collections exist
        collections = current_app.mongo.db.list_collection_names()
        
        # Initialize data structure
        graph_data = {
            "period": period,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "offers": 0,
            "candidates": 0,
            "interviews": 0,
            "status_distribution": {},
            "offers_by_date": {},
            "candidates_by_date": {},
            "interviews_by_date": {}
        }
        
        # Query with safe collection checks and handle date grouping
        try:
            if "offres" in collections:
                # Count total offers
                graph_data["offers"] = current_app.mongo.db.offres.count_documents({
                    "recruteur_id": recruteur_id,
                    "created_at": {"$gte": start_date, "$lt": end_date}
                })
                
                # Group offers by date
                if period != "all":
                    date_format = "%Y-%m-%d" if period in ["week", "month"] else "%Y-%m"
                    pipeline = [
                        {"$match": {
                            "recruteur_id": recruteur_id,
                            "created_at": {"$gte": start_date, "$lt": end_date}
                        }},
                        {"$group": {
                            "_id": {"$dateToString": {"format": date_format, "date": "$created_at"}},
                            "count": {"$sum": 1}
                        }},
                        {"$sort": {"_id": 1}}
                    ]
                    offers_by_date = list(current_app.mongo.db.offres.aggregate(pipeline))
                    for item in offers_by_date:
                        graph_data["offers_by_date"][item["_id"]] = item["count"]
        except Exception as e:
            logger.error(f"Error processing offers data: {str(e)}")
        
        try:
            if "candidates" in collections:
                # Count total candidates
                graph_data["candidates"] = current_app.mongo.db.candidates.count_documents({
                    "recruteur_id": recruteur_id,
                    "date_postulation": {"$gte": start_date, "$lt": end_date}
                })
                
                # Group candidates by date
                if period != "all":
                    date_format = "%Y-%m-%d" if period in ["week", "month"] else "%Y-%m"
                    pipeline = [
                        {"$match": {
                            "recruteur_id": recruteur_id,
                            "date_postulation": {"$gte": start_date, "$lt": end_date}
                        }},
                        {"$group": {
                            "_id": {"$dateToString": {"format": date_format, "date": "$date_postulation"}},
                            "count": {"$sum": 1}
                        }},
                        {"$sort": {"_id": 1}}
                    ]
                    candidates_by_date = list(current_app.mongo.db.candidates.aggregate(pipeline))
                    for item in candidates_by_date:
                        graph_data["candidates_by_date"][item["_id"]] = item["count"]
                
                # Get status distribution
                status_pipeline = [
                    {"$match": {
                        "recruteur_id": recruteur_id,
                        "date_postulation": {"$gte": start_date, "$lt": end_date}
                    }},
                    {"$group": {"_id": "$statut", "count": {"$sum": 1}}},
                    {"$sort": {"count": -1}}
                ]
                status_results = list(current_app.mongo.db.candidates.aggregate(status_pipeline))
                for status in status_results:
                    status_name = status["_id"] if status["_id"] else "undefined"
                    graph_data["status_distribution"][status_name] = status["count"]
        except Exception as e:
            logger.error(f"Error processing candidates data: {str(e)}")
        
        try:
            if "interviews" in collections:
                # Count total interviews
                graph_data["interviews"] = current_app.mongo.db.interviews.count_documents({
                    "recruteur_id": recruteur_id,
                    "date": {"$gte": start_date, "$lt": end_date}
                })
                
                # Group interviews by date
                if period != "all":
                    date_format = "%Y-%m-%d" if period in ["week", "month"] else "%Y-%m"
                    pipeline = [
                        {"$match": {
                            "recruteur_id": recruteur_id,
                            "date": {"$gte": start_date, "$lt": end_date}
                        }},
                        {"$group": {
                            "_id": {"$dateToString": {"format": date_format, "date": "$date"}},
                            "count": {"$sum": 1}
                        }},
                        {"$sort": {"_id": 1}}
                    ]
                    interviews_by_date = list(current_app.mongo.db.interviews.aggregate(pipeline))
                    for item in interviews_by_date:
                        graph_data["interviews_by_date"][item["_id"]] = item["count"]
                
                # Add interview status distribution
                interview_status_pipeline = [
                    {"$match": {
                        "recruteur_id": recruteur_id,
                        "date": {"$gte": start_date, "$lt": end_date}
                    }},
                    {"$group": {"_id": "$status", "count": {"$sum": 1}}},
                    {"$sort": {"count": -1}}
                ]
                try:
                    interview_status_results = list(current_app.mongo.db.interviews.aggregate(interview_status_pipeline))
                    graph_data["interview_status_distribution"] = {}
                    for status in interview_status_results:
                        status_name = status["_id"] if status["_id"] else "undefined"
                        graph_data["interview_status_distribution"][status_name] = status["count"]
                except Exception as e:
                    logger.error(f"Error aggregating interview status: {str(e)}")
        except Exception as e:
            logger.error(f"Error processing interviews data: {str(e)}")
        
        # Calculate additional metrics
        graph_data["conversion_rate"] = round((graph_data["interviews"] / graph_data["candidates"]) * 100, 2) if graph_data["candidates"] > 0 else 0
        
        logger.info(f"Successfully generated graph data for recruiter {recruteur_id}")
        return jsonify(graph_data), 200
    except Exception as e:
        logger.error(f"Error fetching graph data for user {request.user['id']}: {str(e)}")
        return jsonify({"error": "Erreur serveur lors de la récupération des données pour les graphiques"}), 500

# Create MongoDB indexes
def init_indexes():
    try:
        collections = current_app.mongo.db.list_collection_names()
        # Create collections if they don't exist
        required_collections = ['offres', 'candidates', 'interviews', 'utilisateurs']
        for collection in required_collections:
            if collection not in collections:
                current_app.mongo.db.create_collection(collection)
                logger.info(f"Created collection: {collection}")
        
        # Create indexes
        if "offres" in collections:
            current_app.mongo.db.offres.create_index("recruteur_id")
            current_app.mongo.db.offres.create_index("created_at")
        if "candidates" in collections:
            current_app.mongo.db.candidates.create_index("recruteur_id")
            current_app.mongo.db.candidates.create_index("date_postulation")
        if "interviews" in collections:
            current_app.mongo.db.interviews.create_index("recruteur_id")
            current_app.mongo.db.interviews.create_index("date")
        logger.info("MongoDB indexes created successfully")
    except Exception as e:
        logger.error(f"Error creating MongoDB indexes: {str(e)}")

# Register init_indexes to run when the app initializes
@dashboard_bp.record
def on_blueprint_registered(state):
    with state.app.app_context():
        init_indexes()