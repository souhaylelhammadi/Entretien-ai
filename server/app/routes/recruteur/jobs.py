from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from datetime import datetime
from pydantic import BaseModel, Field
from typing import List, Optional
import logging
from flask_cors import cross_origin

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

jobs_bp = Blueprint("jobs", __name__, url_prefix="/api/jobs")

class JobOffer(BaseModel):
    titre: str
    departement: Optional[str] = None
    localisation: Optional[str] = None
    description: Optional[str] = None
    competences_requises: List[str] = Field(default_factory=list, min_items=1)
    salaire_min: Optional[float] = None
    status: str = "open"
    recruteur_id: str
    entreprise_id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

@jobs_bp.route("/offres-emploi", methods=["POST"])

@cross_origin()
def create_offre_emploi():
    """Create a new job offer."""
    try:
        data = request.get_json()
        if not data:
            logger.warning(f"No data provided via {request.method} {request.path}")
            return jsonify({"error": "Aucune donnée fournie"}), 400

        if data.get("recruteur_id") != request.user["id"]:
            logger.warning(f"Unauthorized job creation attempt by user {request.user['id']}")
            return jsonify({"error": "Non autorisé"}), 403

        try:
            entreprise_id = ObjectId(data["entreprise_id"])
            if not current_app.mongo.db.entreprises.find_one({"_id": entreprise_id}):
                logger.warning(f"Entreprise ID {data['entreprise_id']} not found")
                return jsonify({"error": "Entreprise non trouvée"}), 404
        except ValueError:
            logger.warning(f"Invalid entreprise_id format: {data.get('entreprise_id')}")
            return jsonify({"error": "Format d'ID d'entreprise invalide"}), 400

        job_data = JobOffer(
            titre=data["titre"].strip(),
            departement=data.get("departement", "").strip(),
            localisation=data.get("localisation", "").strip(),
            description=data.get("description", "").strip(),
            competences_requises=[
                skill.strip() for skill in data.get("competences_requises", [])
                if isinstance(skill, str) and skill.strip()
            ],
            salaire_min=max(0, float(data.get("salaire_min", 0))),
            status=data.get("status", "open").lower(),
            recruteur_id=data["recruteur_id"],
            entreprise_id=str(entreprise_id),
            created_at=datetime.utcnow().isoformat(),
        ).dict(exclude_none=True)

        if job_data["status"] not in ["open", "closed"]:
            logger.warning(f"Invalid status: {job_data['status']}")
            return jsonify({"error": "Statut invalide. Doit être 'open' ou 'closed'"}), 400

        result = current_app.mongo.db.offres.insert_one(job_data)
        job_data["_id"] = str(result.inserted_id)
        logger.info(f"Created job offer with ID {job_data['_id']} by user {request.user['id']}")
        return jsonify({"message": "Offre créée avec succès", "offre": job_data}), 201
    except ValueError as e:
        logger.error(f"Invalid data format: {str(e)}")
        return jsonify({"error": "Données invalides", "details": str(e)}), 400
    except Exception as e:
        logger.error(f"Error creating job offer: {str(e)}", exc_info=True)
        return jsonify({"error": "Erreur serveur lors de la création de l'offre"}), 500

@jobs_bp.route("/offres-emploi/<job_id>", methods=["PUT"])

@cross_origin()
def update_offre_emploi(job_id):
    """Update an existing job offer."""
    try:
        try:
            job_id_obj = ObjectId(job_id)
        except ValueError:
            logger.warning(f"Invalid job_id format: {job_id}")
            return jsonify({"error": "Format d'ID d'offre invalide"}), 400

        data = request.get_json()
        if not data:
            logger.warning(f"No data provided for job update")
            return jsonify({"error": "Aucune donnée fournie"}), 400

        job = current_app.mongo.db.offres.find_one({"_id": job_id_obj})
        if not job:
            logger.warning(f"Job not found: {job_id}")
            return jsonify({"error": "Offre non trouvée"}), 404

        if job["recruteur_id"] != request.user["id"]:
            logger.warning(f"Unauthorized job update attempt by user {request.user['id']} on job {job_id}")
            return jsonify({"error": "Non autorisé"}), 403

        update_data = JobOffer(
            titre=data.get("titre", job["titre"]).strip(),
            departement=data.get("departement", job.get("departement", "")).strip(),
            localisation=data.get("localisation", job.get("localisation", "")).strip(),
            description=data.get("description", job.get("description", "")).strip(),
            competences_requises=[
                skill.strip() for skill in data.get("competences_requises", job.get("competences_requises", []))
                if isinstance(skill, str) and skill.strip()
            ],
            salaire_min=max(0, float(data.get("salaire_min", job.get("salaire_min", 0)))),
            status=data.get("status", job.get("status", "open")).lower(),
            recruteur_id=data.get("recruteur_id", job["recruteur_id"]),
            entreprise_id=data.get("entreprise_id", job["entreprise_id"]),
            updated_at=datetime.utcnow().isoformat(),
        ).dict(exclude_none=True)

        if update_data["status"] not in ["open", "closed"]:
            logger.warning(f"Invalid status: {update_data['status']}")
            return jsonify({"error": "Statut invalide. Doit être 'open' ou 'closed'"}), 400

        if "entreprise_id" in data:
            try:
                entreprise_id = ObjectId(data["entreprise_id"])
                if not current_app.mongo.db.entreprises.find_one({"_id": entreprise_id}):
                    logger.warning(f"Entreprise ID {data['entreprise_id']} not found")
                    return jsonify({"error": "Entreprise non trouvée"}), 404
                update_data["entreprise_id"] = str(entreprise_id)
            except ValueError:
                logger.warning(f"Invalid entreprise_id format: {data['entreprise_id']}")
                return jsonify({"error": "Format d'ID d'entreprise invalide"}), 400

        current_app.mongo.db.offres.update_one(
            {"_id": job_id_obj},
            {"$set": update_data}
        )
        update_data["_id"] = job_id
        update_data["created_at"] = job.get("created_at", datetime.utcnow()).isoformat()
        logger.info(f"Updated job offer with ID {job_id} by user {request.user['id']}")
        return jsonify({"message": "Offre mise à jour avec succès", "offre": update_data}), 200
    except ValueError as e:
        logger.error(f"Invalid data format: {str(e)}")
        return jsonify({"error": "Données invalides", "details": str(e)}), 400
    except Exception as e:
        logger.error(f"Error updating job offer {job_id}: {str(e)}", exc_info=True)
        return jsonify({"error": "Erreur serveur lors de la mise à jour de l'offre"}), 500

@jobs_bp.route("/offres-emploi/<job_id>", methods=["DELETE"])

@cross_origin()
def delete_offre_emploi(job_id):
    """Delete a job offer."""
    try:
        try:
            job_id_obj = ObjectId(job_id)
        except ValueError:
            logger.warning(f"Invalid job_id format: {job_id}")
            return jsonify({"error": "Format d'ID d'offre invalide"}), 400

        job = current_app.mongo.db.offres.find_one({"_id": job_id_obj})
        if not job:
            logger.warning(f"Job not found: {job_id}")
            return jsonify({"error": "Offre non trouvée"}), 404

        if job["recruteur_id"] != request.user["id"]:
            logger.warning(f"Unauthorized job deletion attempt by user {request.user['id']} on job {job_id}")
            return jsonify({"error": "Non autorisé"}), 403

        current_app.mongo.db.offres.delete_one({"_id": job_id_obj})
        logger.info(f"Deleted job offer with ID {job_id} by user {request.user['id']}")
        return jsonify({"message": "Offre supprimée avec succès"}), 200
    except ValueError as e:
        logger.error(f"Invalid data format: {str(e)}")
        return jsonify({"error": "Données invalides", "details": str(e)}), 400
    except Exception as e:
        logger.error(f"Error deleting job offer {job_id}: {str(e)}", exc_info=True)
        return jsonify({"error": "Erreur serveur lors de la suppression de l'offre"}), 500