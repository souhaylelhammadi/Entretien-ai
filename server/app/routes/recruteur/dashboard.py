from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from datetime import datetime, timedelta
from pymongo.errors import PyMongoError
from middleware import require_auth
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/recruteur/dashboard', methods=['GET'])
@require_auth(role="recruteur")
def get_dashboard_data(auth_payload):
    """
    Fetch dashboard data for the recruiter.
    Returns data needed for the dashboard: jobs, candidates, interviews, and stats.
    """
    try:
        user_id = auth_payload.get('sub')
        if not user_id:
            logger.warning("No user_id found in auth_payload")
            return jsonify({'error': 'Utilisateur non authentifié'}), 401

        # Get page and limit parameters for pagination
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        skip = (page - 1) * limit

        # Get period parameter for graph data
        period = request.args.get('period', 'month')

        # Log request info
        logger.info(f"Fetching dashboard data for user_id: {user_id}, page={page}, limit={limit}, period={period}")

        db = current_app.mongo

        # Get active job offers
        jobs_collection = db.offres_emploi
        jobs_query = {'recruteur_id': str(user_id)}

        jobs_total = jobs_collection.count_documents(jobs_query)
        jobs_cursor = jobs_collection.find(jobs_query).skip(skip).limit(limit)

        jobs = []
        for job in jobs_cursor:
            job['_id'] = str(job['_id'])
            jobs.append(job)

        # Get candidates
        candidates_collection = db.candidates
        candidates_query = {'recruteur_id': str(user_id)}

        candidates_total = candidates_collection.count_documents(candidates_query)
        candidates_cursor = candidates_collection.find(candidates_query).skip(skip).limit(limit)

        candidates = []
        for candidate in candidates_cursor:
            candidate['_id'] = str(candidate['_id'])
            if 'offre_emploi_id' in candidate:
                offer = jobs_collection.find_one({'_id': ObjectId(candidate['offre_emploi_id'])})
                if offer:
                    offer['_id'] = str(offer['_id'])
                    candidate['offreEmploi'] = offer
            candidates.append(candidate)

        # Get interviews
        interviews_collection = db.candidatures
        interviews_query = {'recruteur_id': str(user_id)}

        interviews_total = interviews_collection.count_documents(interviews_query)
        interviews_cursor = interviews_collection.find(interviews_query).skip(skip).limit(limit)

        interviews = []
        for interview in interviews_cursor:
            interview['_id'] = str(interview['_id'])
            if 'candidat_id' in interview:
                candidate = candidates_collection.find_one({'_id': ObjectId(interview['candidat_id'])})
                if candidate:
                    candidate['_id'] = str(candidate['_id'])
                    interview['candidat'] = candidate
            if 'offre_emploi_id' in interview:
                offer = jobs_collection.find_one({'_id': ObjectId(interview['offre_emploi_id'])})
                if offer:
                    offer['_id'] = str(offer['_id'])
                    interview['offreEmploi'] = offer
            interviews.append(interview)

        # Prepare graph data
        now = datetime.now()
        if period == 'week':
            start_date = now - timedelta(days=7)
            date_format = '%Y-%m-%d'
            group_id = {'$dateToString': {'format': '%Y-%m-%d', 'date': '$created_at'}}
        elif period == 'month':
            start_date = now - timedelta(days=30)
            date_format = '%Y-%m-%d'
            group_id = {'$dateToString': {'format': '%Y-%m-%d', 'date': '$created_at'}}
        elif period == 'year':
            start_date = now - timedelta(days=365)
            date_format = '%Y-%m'
            group_id = {'$dateToString': {'format': '%Y-%m', 'date': '$created_at'}}
        else:
            start_date = datetime(2000, 1, 1)
            date_format = '%Y-%m'
            group_id = {'$dateToString': {'format': '%Y-%m', 'date': '$created_at'}}

        date_range = {}
        if period in ['week', 'month']:
            delta = timedelta(days=1)
            current = start_date
            while current <= now:
                date_range[current.strftime(date_format)] = 0
                current += delta
        else:
            delta = timedelta(days=30)
            current = start_date
            while current <= now:
                date_range[current.strftime(date_format)] = 0
                current += delta

        # Get stats
        job_stats = list(jobs_collection.aggregate([
            {'$match': {'recruteur_id': str(user_id), 'created_at': {'$gte': start_date}}},
            {'$group': {'_id': group_id, 'count': {'$sum': 1}}}
        ]))
        candidate_stats = list(candidates_collection.aggregate([
            {'$match': {'recruteur_id': str(user_id), 'created_at': {'$gte': start_date}}},
            {'$group': {'_id': group_id, 'count': {'$sum': 1}}}
        ]))
        interview_stats = list(interviews_collection.aggregate([
            {'$match': {'recruteur_id': str(user_id), 'created_at': {'$gte': start_date}}},
            {'$group': {'_id': group_id, 'count': {'$sum': 1}}}
        ]))
        status_distribution = list(candidates_collection.aggregate([
            {'$match': {'recruteur_id': str(user_id)}},
            {'$group': {'_id': '$status', 'count': {'$sum': 1}}}
        ]))
        interview_status_distribution = list(interviews_collection.aggregate([
            {'$match': {'recruteur_id': str(user_id)}},
            {'$group': {'_id': '$status', 'count': {'$sum': 1}}}
        ]))

        offers_by_date = date_range.copy()
        candidates_by_date = date_range.copy()
        interviews_by_date = date_range.copy()

        for stat in job_stats:
            if stat['_id'] in offers_by_date:
                offers_by_date[stat['_id']] = stat['count']
        for stat in candidate_stats:
            if stat['_id'] in candidates_by_date:
                candidates_by_date[stat['_id']] = stat['count']
        for stat in interview_stats:
            if stat['_id'] in interviews_by_date:
                interviews_by_date[stat['_id']] = stat['count']

        status_dist_dict = {item['_id']: item['count'] for item in status_distribution}
        interview_status_dist_dict = {item['_id']: item['count'] for item in interview_status_distribution}

        total_offers = jobs_total
        total_candidates = candidates_total
        total_interviews = interviews_total

        response_data = {
            'offres': jobs,
            'total': jobs_total,
            'page': page,
            'limit': limit,
            'candidates': candidates,
            'interviews': interviews,
            'offers': total_offers,
            'candidates': total_candidates,
            'interviews': total_interviews,
            'offers_by_date': offers_by_date,
            'candidates_by_date': candidates_by_date,
            'interviews_by_date': interviews_by_date,
            'status_distribution': status_dist_dict,
            'interview_status_distribution': interview_status_dist_dict,
            'period': period
        }

        logger.info(f"Dashboard data retrieved successfully for user_id: {user_id}")
        return jsonify(response_data), 200

    except ValueError as e:
        logger.error(f"Invalid input: {str(e)}")
        return jsonify({'error': f"Données invalides: {str(e)}"}), 400
    except PyMongoError as e:
        logger.error(f"MongoDB error: {str(e)}")
        return jsonify({'error': f"Erreur de base de données: {str(e)}"}), 500
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return jsonify({'error': f"Erreur serveur: {str(e)}"}), 500