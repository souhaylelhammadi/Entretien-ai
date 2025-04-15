from flask import request, jsonify
from bson import ObjectId
from datetime import datetime, timezone
import os

def init_routes(app):
    # Routes pour jobs
    @app.route('/api/jobs', methods=['GET'])
    def get_jobs():
        try:
            jobs = list(app.db.jobs.find())
            return jsonify([{**job, '_id': str(job['_id'])} for job in jobs]), 200
        except Exception as e:
            app.logger.error(f"Error retrieving jobs: {str(e)}")
            return jsonify({'error': 'Failed to retrieve jobs'}), 500

    @app.route('/api/jobs', methods=['POST'])
    def create_job():
        try:
            job_data = request.json
            required_fields = ['title', 'department', 'location', 'requirements']
            if not job_data or not all(field in job_data for field in required_fields):
                return jsonify({'error': f'Missing required fields: {required_fields}'}), 400
            
            job_data['created_at'] = datetime.now(timezone.utc)
            result = app.db.jobs.insert_one(job_data)
            return jsonify({'message': 'Job created successfully', 'id': str(result.inserted_id)}), 201
        except Exception as e:
            app.logger.error(f"Error creating job: {str(e)}")
            return jsonify({'error': 'Failed to create job'}), 500

    @app.route('/api/jobs/<job_id>', methods=['GET'])
    def get_job(job_id):
        try:
            if not ObjectId.is_valid(job_id):
                return jsonify({'error': 'Invalid job ID format'}), 400
            job = app.db.jobs.find_one({'_id': ObjectId(job_id)})
            if not job:
                return jsonify({'error': 'Job not found'}), 404
            return jsonify({**job, '_id': str(job['_id'])}), 200
        except Exception as e:
            app.logger.error(f"Error retrieving job: {str(e)}")
            return jsonify({'error': 'Failed to retrieve job'}), 500

    @app.route('/api/jobs/<job_id>', methods=['PUT'])
    def update_job(job_id):
        try:
            if not ObjectId.is_valid(job_id):
                return jsonify({'error': 'Invalid job ID format'}), 400
            job_data = request.json
            if not job_data:
                return jsonify({'error': 'No data provided'}), 400
            result = app.db.jobs.update_one(
                {'_id': ObjectId(job_id)},
                {'$set': {**job_data, 'updated_at': datetime.now(timezone.utc)}}
            )
            if result.modified_count == 0:
                return jsonify({'error': 'Job not found or no changes made'}), 404
            return jsonify({'message': 'Job updated successfully'}), 200
        except Exception as e:
            app.logger.error(f"Error updating job: {str(e)}")
            return jsonify({'error': 'Failed to update job'}), 500

    @app.route('/api/jobs/<job_id>', methods=['DELETE'])
    def delete_job(job_id):
        try:
            if not ObjectId.is_valid(job_id):
                return jsonify({'error': 'Invalid job ID format'}), 400
            result = app.db.jobs.delete_one({'_id': ObjectId(job_id)})
            if result.deleted_count == 0:
                return jsonify({'error': 'Job not found'}), 404
            return jsonify({'message': 'Job deleted successfully'}), 200
        except Exception as e:
            app.logger.error(f"Error deleting job: {str(e)}")
            return jsonify({'error': 'Failed to delete job'}), 500

    # Routes pour candidates
    @app.route('/api/candidates', methods=['GET'])
    def get_candidates():
        try:
            job_id = request.args.get('jobId')
            query = {}
            if job_id:
                if not ObjectId.is_valid(job_id):
                    return jsonify({'error': 'Invalid job ID format'}), 400
                query['jobId'] = ObjectId(job_id)
            
            candidates = list(app.db.candidates.find(query))
            return jsonify([{**c, '_id': str(c['_id']), 'jobId': str(c['jobId'])} for c in candidates]), 200
        except Exception as e:
            app.logger.error(f"Error retrieving candidates: {str(e)}")
            return jsonify({'error': 'Failed to retrieve candidates'}), 500

    @app.route('/api/candidates', methods=['POST'])
    def create_candidate():
        try:
            data = request.form
            files = request.files
            app.logger.info(f"Received form data: {dict(data)}")
            app.logger.info(f"Received files: {list(files.keys())}")

            required_fields = ["name", "email", "jobId"]
            if not all(field in data for field in required_fields):
                missing = [field for field in required_fields if field not in data]
                app.logger.error(f"Missing fields: {missing}")
                return jsonify({"error": f"Missing required fields: {missing}"}), 400

            job_id = data["jobId"]
            if not ObjectId.is_valid(job_id):
                app.logger.error(f"Invalid jobId format: {job_id}")
                return jsonify({"error": "Invalid job ID format"}), 400
            
            if not app.db.jobs.find_one({"_id": ObjectId(job_id)}):
                app.logger.error(f"Job not found for jobId: {job_id}")
                return jsonify({"error": "Job not found"}), 404

            if "resume" not in files:
                app.logger.error("Resume file missing")
                return jsonify({"error": "Resume is required"}), 400
            
            resume = files["resume"]
            allowed_mimetypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
            if resume.mimetype not in allowed_mimetypes:
                app.logger.error(f"Invalid resume mimetype: {resume.mimetype}")
                return jsonify({"error": "Resume must be PDF, DOC, or DOCX"}), 400
            
            resume_filename = f"resumes/{job_id}/{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{resume.filename}"
            app.logger.info(f"Uploading resume to Azure: {resume_filename}")
            resume_url = app.upload_to_azure(resume.read(), resume_filename)
            app.logger.info(f"Resume uploaded successfully: {resume_url}")

            cover_letter_url = ""
            if "coverLetter" in files:
                cover_letter = files["coverLetter"]
                allowed_mimetypes += ["text/plain"]
                if cover_letter.mimetype not in allowed_mimetypes:
                    app.logger.error(f"Invalid cover letter mimetype: {cover_letter.mimetype}")
                    return jsonify({"error": "Cover letter must be PDF, DOC, DOCX, or TXT"}), 400
                cover_letter_filename = f"letters/{job_id}/{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{cover_letter.filename}"
                app.logger.info(f"Uploading cover letter to Azure: {cover_letter_filename}")
                cover_letter_url = app.upload_to_azure(cover_letter.read(), cover_letter_filename)
            elif "coverLetter" in data and data["coverLetter"].strip():
                cover_letter_content = data["coverLetter"].encode('utf-8')
                cover_letter_filename = f"letters/{job_id}/{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_cover_letter.txt"
                app.logger.info(f"Uploading cover letter text to Azure: {cover_letter_filename}")
                cover_letter_url = app.upload_to_azure(cover_letter_content, cover_letter_filename)
            app.logger.info(f"Cover letter uploaded successfully: {cover_letter_url}")

            candidate_data = {
                "name": data["name"],
                "email": data["email"],
                "phone": data.get("phone", ""),
                "jobId": ObjectId(job_id),
                "status": data.get("status", "applied"),
                "resumeUrl": resume_url,
                "coverLetterUrl": cover_letter_url,
                "appliedDate": datetime.now(timezone.utc)
            }
            app.logger.info(f"Inserting candidate data: {candidate_data}")

            result = app.db.candidates.insert_one(candidate_data)
            app.logger.info(f"Candidate created with ID: {result.inserted_id}")

            return jsonify({
                'message': 'Candidate created successfully',
                'candidate': {**candidate_data, '_id': str(result.inserted_id), 'jobId': str(job_id)}
            }), 201
        except Exception as e:
            app.logger.error(f"Error creating candidate: {str(e)}", exc_info=True)
            return jsonify({'error': f"Failed to create candidate: {str(e)}"}), 500

    @app.route('/api/candidates/<candidate_id>', methods=['PUT'])
    def update_candidate(candidate_id):
        try:
            if not ObjectId.is_valid(candidate_id):
                return jsonify({'error': 'Invalid candidate ID format'}), 400
            
            data = request.json
            if not data:
                return jsonify({'error': 'No data provided'}), 400

            valid_statuses = ["applied", "invited", "interviewed", "accepted", "rejected"]
            if "status" in data and data["status"] not in valid_statuses:
                return jsonify({"error": f"Invalid status. Accepted values: {valid_statuses}"}), 400

            if "status" in data and data["status"] == "accepted":
                candidate = app.db.candidates.find_one({'_id': ObjectId(candidate_id)})
                if not candidate:
                    return jsonify({'error': 'Candidate not found'}), 404
                job = app.db.jobs.find_one({'_id': candidate['jobId']})
                if not job:
                    return jsonify({'error': 'Associated job not found'}), 404
                
                existing_offer = app.db.accepted_offers.find_one({'candidateId': ObjectId(candidate_id)})
                if not existing_offer:
                    accepted_offer = {
                        'candidateId': ObjectId(candidate_id),
                        'jobId': candidate['jobId'],
                        'candidateName': candidate['name'],
                        'candidateEmail': candidate['email'],
                        'jobTitle': job['title'],
                        'department': job['department'],
                        'company': job.get('company', ''),
                        'location': job['location'],
                        'requirements': job['requirements'],
                        'acceptedAt': datetime.now(timezone.utc),
                        'status': 'pending_interview'
                    }
                    app.db.accepted_offers.insert_one(accepted_offer)

            update_data = {field: data[field] for field in ["name", "email", "phone", "status", "resumeUrl", "coverLetterUrl", "feedback"] if field in data}
            if not update_data:
                return jsonify({'error': 'No updates specified'}), 400

            result = app.db.candidates.update_one(
                {'_id': ObjectId(candidate_id)},
                {'$set': {**update_data, 'updatedAt': datetime.now(timezone.utc)}}
            )
            if result.modified_count == 0:
                return jsonify({'error': 'Candidate not found or no changes made'}), 404

            updated_candidate = app.db.candidates.find_one({'_id': ObjectId(candidate_id)})
            return jsonify({'message': 'Candidate updated successfully', 'candidate': {**updated_candidate, '_id': str(updated_candidate['_id']), 'jobId': str(updated_candidate['jobId'])}}), 200
        except Exception as e:
            app.logger.error(f"Error updating candidate: {str(e)}")
            return jsonify({'error': 'Failed to update candidate'}), 500

    @app.route('/api/candidates/<candidate_id>', methods=['DELETE'])
    def delete_candidate(candidate_id):
        try:
            if not ObjectId.is_valid(candidate_id):
                return jsonify({'error': 'Invalid candidate ID format'}), 400
            
            result = app.db.candidates.delete_one({'_id': ObjectId(candidate_id)})
            if result.deleted_count == 0:
                return jsonify({'error': 'Candidate not found'}), 404
            return jsonify({'message': 'Candidate deleted successfully'}), 200
        except Exception as e:
            app.logger.error(f"Error deleting candidate: {str(e)}")
            return jsonify({'error': 'Failed to delete candidate'}), 500

    # Routes pour accepted offers
    @app.route('/api/accepted-offers', methods=['GET'])
    def get_accepted_offers():
        try:
            candidate_email = request.args.get('email')
            if not candidate_email:
                return jsonify({'error': 'Candidate email is required'}), 400

            candidate = app.db.candidates.find_one({'email': candidate_email})
            if not candidate:
                return jsonify({'error': 'Candidate not found'}), 404

            offers = list(app.db.accepted_offers.find({
                'candidateId': candidate['_id'],
                'status': {'$in': ['pending_interview', 'completed', 'cancelled']}
            }))

            for offer in offers:
                job = app.db.jobs.find_one({'_id': offer['jobId']})
                offer.update({
                    '_id': str(offer['_id']),
                    'candidateId': str(offer['candidateId']),
                    'jobId': str(offer['jobId']),
                    'jobDetails': {
                        'title': job['title'],
                        'department': job['department'],
                        'description': job.get('description', ''),
                        'requirements': job['requirements']
                    } if job else {}
                })

            return jsonify(offers), 200
        except Exception as e:
            app.logger.error(f"Error retrieving accepted offers: {str(e)}")
            return jsonify({'error': 'Failed to retrieve accepted offers'}), 500

    @app.route('/api/accepted-offers/<offer_id>', methods=['PUT'])
    def update_accepted_offer(offer_id):
        try:
            if not ObjectId.is_valid(offer_id):
                return jsonify({'error': 'Invalid offer ID format'}), 400
            
            data = request.json
            if not data:
                return jsonify({'error': 'No data provided'}), 400

            valid_statuses = ["pending_interview", "completed", "cancelled"]
            if "status" in data and data["status"] not in valid_statuses:
                return jsonify({"error": f"Invalid status. Accepted values: {valid_statuses}"}), 400

            if "interviewDate" in data:
                try:
                    data["interviewDate"] = datetime.fromisoformat(data["interviewDate"].replace('Z', '+00:00'))
                except ValueError:
                    return jsonify({"error": "Invalid interview date format (ISO 8601 expected)"}), 400

            update_data = {field: data[field] for field in ["status", "interviewDate", "feedback"] if field in data}
            if not update_data:
                return jsonify({'error': 'No updates specified'}), 400

            result = app.db.accepted_offers.update_one(
                {'_id': ObjectId(offer_id)},
                {'$set': {**update_data, 'updatedAt': datetime.now(timezone.utc)}}
            )
            if result.modified_count == 0:
                return jsonify({'error': 'Offer not found or no changes made'}), 404

            updated_offer = app.db.accepted_offers.find_one({'_id': ObjectId(offer_id)})
            return jsonify({
                'message': 'Offer updated successfully',
                'offer': {**updated_offer, '_id': str(updated_offer['_id']), 'candidateId': str(updated_offer['candidateId']), 'jobId': str(updated_offer['jobId'])}
            }), 200
        except Exception as e:
            app.logger.error(f"Error updating accepted offer: {str(e)}")
            return jsonify({'error': 'Failed to update offer'}), 500

    # Routes pour interviews
    @app.route('/api/interviews', methods=['GET'])
    def get_interviews():
        try:
            interviews = list(app.db.interviews.find())
            return jsonify([{**i, '_id': str(i['_id']), 'candidateId': str(i['candidateId']), 'jobId': str(i['jobId'])} for i in interviews]), 200
        except Exception as e:
            app.logger.error(f"Error retrieving interviews: {str(e)}")
            return jsonify({'error': 'Failed to retrieve interviews'}), 500

    @app.route('/api/interviews', methods=['POST'])
    def create_interview():
        try:
            interview_data = request.json
            required_fields = ['candidateId', 'jobId', 'interviewDate']
            if not interview_data or not all(field in interview_data for field in required_fields):
                return jsonify({'error': f'Missing required fields: {required_fields}'}), 400

            if not ObjectId.is_valid(interview_data['candidateId']) or not ObjectId.is_valid(interview_data['jobId']):
                return jsonify({'error': 'Invalid candidateId or jobId format'}), 400

            try:
                interview_data['interviewDate'] = datetime.fromisoformat(interview_data['interviewDate'].replace('Z', '+00:00'))
            except ValueError:
                return jsonify({'error': 'Invalid interview date format (ISO 8601 expected)'}), 400

            interview_data['created_at'] = datetime.now(timezone.utc)
            result = app.db.interviews.insert_one(interview_data)
            return jsonify({'message': 'Interview created successfully', 'id': str(result.inserted_id)}), 201
        except Exception as e:
            app.logger.error(f"Error creating interview: {str(e)}")
            return jsonify({'error': 'Failed to create interview'}), 500

    @app.route('/api/interviews/<interview_id>', methods=['PUT'])
    def update_interview(interview_id):
        try:
            if not ObjectId.is_valid(interview_id):
                return jsonify({'error': 'Invalid interview ID format'}), 400
            
            interview_data = request.json
            if not interview_data:
                return jsonify({'error': 'No data provided'}), 400

            if 'interviewDate' in interview_data:
                try:
                    interview_data['interviewDate'] = datetime.fromisoformat(interview_data['interviewDate'].replace('Z', '+00:00'))
                except ValueError:
                    return jsonify({'error': 'Invalid interview date format (ISO 8601 expected)'}), 400

            result = app.db.interviews.update_one(
                {'_id': ObjectId(interview_id)},
                {'$set': {**interview_data, 'updated_at': datetime.now(timezone.utc)}}
            )
            if result.modified_count == 0:
                return jsonify({'error': 'Interview not found or no changes made'}), 404
            return jsonify({'message': 'Interview updated successfully'}), 200
        except Exception as e:
            app.logger.error(f"Error updating interview: {str(e)}")
            return jsonify({'error': 'Failed to update interview'}), 500

    # Route pour file uploads
    @app.route('/api/upload', methods=['POST'])
    def upload_file():
        try:
            if 'file' not in request.files or not request.form.get('type') or not request.form.get('candidateId'):
                return jsonify({'error': 'Missing required fields: file, type, and candidateId'}), 400
            
            file = request.files['file']
            file_type = request.form['type']
            candidate_id = request.form['candidateId']
            
            if file_type not in ['video', 'report']:
                return jsonify({'error': 'Invalid file type. Must be "video" or "report"'}), 400
                
            if not ObjectId.is_valid(candidate_id) or not app.db.candidates.find_one({'_id': ObjectId(candidate_id)}):
                return jsonify({'error': 'Invalid or non-existent candidate ID'}), 404

            timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
            file_extension = os.path.splitext(file.filename)[1]
            blob_name = f"{candidate_id}/{file_type}/{timestamp}{file_extension}"
            url = app.upload_to_azure(file.read(), blob_name)
            
            update_field = 'videoUrl' if file_type == 'video' else 'reportUrl'
            result = app.db.candidates.update_one(
                {'_id': ObjectId(candidate_id)},
                {'$set': {update_field: url, 'updatedAt': datetime.now(timezone.utc)}}
            )
            
            if result.modified_count == 0:
                return jsonify({'error': 'Failed to update candidate'}), 500
                
            return jsonify({'message': 'File uploaded successfully', 'url': url}), 200
        except Exception as e:
            app.logger.error(f"Error uploading file: {str(e)}")
            return jsonify({'error': 'Failed to upload file'}), 500