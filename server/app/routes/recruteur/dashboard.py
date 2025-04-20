from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from auth_middleware import require_auth
from pydantic import BaseModel
from typing import List, Optional
import logging
from flask_cors import cross_origin
from datetime import datetime

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
@require_auth
@cross_origin()
def get_offres_emploi():
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
@require_auth
@cross_origin()
def get_candidates():
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
                            "_id": str(candidate["offreEmploi"]["_id"]),
                        }
                        if candidate.get("offreEmploi") and "_id" in candidate["offreEmploi"]
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
@require_auth
@cross_origin()
def get_interviews():
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
@require_auth
@cross_origin()
def get_graph_data():
    """Retrieve data for graphs showing offers, candidates, and interviews."""
    try:
        # Fetch data for the current month
        current_month = datetime.now().month
        current_year = datetime.now().year

        # Fetch job offers
        job_offers = list(current_app.mongo.db.offres.find({
            "recruteur_id": request.user["id"],
            "created_at": {
                "$gte": datetime(current_year, current_month, 1),
                "$lt": datetime(current_year, current_month + 1, 1)
            }
        }))

        # Fetch candidates
        candidates = list(current_app.mongo.db.candidates.find({
            "recruteur_id": request.user["id"],
            "date_postulation": {
                "$gte": datetime(current_year, current_month, 1),
                "$lt": datetime(current_year, current_month + 1, 1)
            }
        }))

        # Fetch interviews
        interviews = list(current_app.mongo.db.interviews.find({
            "recruteur_id": request.user["id"],
            "date": {
                "$gte": datetime(current_year, current_month, 1),
                "$lt": datetime(current_year, current_month + 1, 1)
            }
        }))

        # Prepare data for the graph
        graph_data = {
            "offers": len(job_offers),
            "candidates": len(candidates),
            "interviews": len(interviews),
        }

        return jsonify(graph_data), 200
    except Exception as e:
        logger.error(f"Error fetching graph data for user {request.user['id']}: {str(e)}")
        return jsonify({"error": "Erreur serveur lors de la récupération des données pour les graphiques"}), 500

# Create MongoDB indexes
def init_indexes():
    try:
        current_app.mongo.db.offres.create_index("recruteur_id")
        current_app.mongo.db.candidates.create_index("recruteur_id")
        current_app.mongo.db.interviews.create_index("recruteur_id")
        logger.info("MongoDB indexes created successfully")
    except Exception as e:
        logger.error(f"Error creating MongoDB indexes: {str(e)}")