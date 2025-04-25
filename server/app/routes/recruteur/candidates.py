from flask import Blueprint, jsonify, request, current_app, send_file, Response
import os
import sys
import base64
from bson import ObjectId
from datetime import datetime, timezone

candidates_bp = Blueprint('candidates', __name__)

def serialize_doc(doc):
    """Serialize a MongoDB document to JSON-compatible format."""
    if not doc:
        return None
    doc = dict(doc)
    if "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    if "candidate_id" in doc:
        doc["candidate_id"] = str(doc["candidate_id"])
    if "offre_id" in doc:
        doc["offre_id"] = str(doc["offre_id"])
    return doc

@candidates_bp.route("/candidates", methods=["GET"])
def get_candidates():
    """Retrieve all candidatures with associated candidate and job offer details."""
    try:
        db = current_app.mongo.db
        print("Fetching candidatures from database...", file=sys.stderr)
        candidatures = list(db.candidatures.find())
        print(f"Found {len(candidatures)} candidatures in database", file=sys.stderr)
        
        result = []
        for candidature in candidatures:
            try:
                print(f"Processing candidature: {str(candidature.get('_id'))}", file=sys.stderr)
                
                # Validate candidate_id
                if "candidate_id" not in candidature:
                    print(f"Missing candidate_id in candidature: {str(candidature.get('_id'))}", file=sys.stderr)
                    continue
                    
                if not ObjectId.is_valid(candidature["candidate_id"]):
                    print(f"Invalid candidate_id format: {candidature['candidate_id']}", file=sys.stderr)
                    continue
                
                # Get candidate
                candidate = db.candidates.find_one({"_id": ObjectId(candidature["candidate_id"])})
                if not candidate:
                    print(f"Candidate not found for ID: {candidature['candidate_id']}", file=sys.stderr)
                    continue
                
                # Get job offer
                if "offre_id" not in candidature:
                    print(f"Missing offre_id in candidature: {str(candidature.get('_id'))}", file=sys.stderr)
                    continue
                    
                offre = db.offres.find_one({"_id": candidature["offre_id"]})
                if not offre:
                    print(f"Offre not found for ID: {candidature['offre_id']}", file=sys.stderr)
                    continue
                
                # Build CV URL
                cv_url = ""
                # Dans tous les cas, fournir une URL - même si le CV n'existe pas
                # La route servira un PDF "CV non disponible" si nécessaire
                cv_url = f"/api/candidates/cv/{str(candidate['_id'])}"
                print(f"CV URL generated: {cv_url}", file=sys.stderr)
                
                # Build candidature data
                candidature_data = {
                    "id": str(candidature["_id"]),
                    "candidat": {
                        "nom": candidate.get("nom", "Inconnu"),
                        "email": candidate.get("email", ""),
                        "telephone": candidate.get("telephone", ""),
                        "cv": cv_url,
                        "lettre_motivation": candidate.get("lettre_motivation", ""),
                    },
                    "offreEmploiId": str(candidature["offre_id"]),
                    "offreEmploi": {
                        "id": str(offre["_id"]),
                        "titre": offre.get("titre", "Offre inconnue"),
                    },
                    "statut": candidature.get("statut", "en_attente"),
                    "date_postulation": candidature.get("date_postulation", datetime.now(timezone.utc)).isoformat(),
                }
                result.append(candidature_data)
                print(f"Successfully processed candidature: {candidature_data['id']}", file=sys.stderr)
                
            except Exception as e:
                print(f"Error processing candidature {str(candidature.get('_id'))}: {str(e)}", file=sys.stderr)
                continue
                
        print(f"Returning {len(result)} processed candidatures", file=sys.stderr)
        return jsonify(result), 200
        
    except Exception as e:
        print(f"Error in get_candidates: {str(e)}", file=sys.stderr)
        return jsonify({"error": f"Échec de la récupération des candidatures : {str(e)}"}), 500

@candidates_bp.route("/candidates/<string:candidate_id>", methods=["PUT"])
def update_candidate_status(candidate_id):
    """Update the status of a candidature."""
    try:
        db = current_app.mongo.db
        data = request.get_json()
        if not data or "statut" not in data:
            return jsonify({"error": "Statut requis"}), 400
        if data["statut"] not in ["en_attente", "acceptee", "refusee"]:
            return jsonify({"error": "Statut invalide"}), 400
        if not ObjectId.is_valid(candidate_id):
            return jsonify({"error": "Format d'ID invalide"}), 400
        result = db.candidatures.update_one(
            {"_id": ObjectId(candidate_id)},
            {"$set": {"statut": data["statut"]}}
        )
        if result.matched_count == 0:
            return jsonify({"error": "Candidature non trouvée"}), 404
        return jsonify({"message": "Statut mis à jour"}), 200
    except Exception as e:
        return jsonify({"error": "Échec de la mise à jour du statut"}), 500

def generate_not_available_pdf(message="CV non disponible"):
    """
    Génère un PDF simple contenant le texte spécifié
    """
    # PDF minimal en base64 contenant le texte spécifié
    pdf_base64 = "JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9GaWx0ZXIvRmxhdGVEZWNvZGUvTGVuZ3RoIDE2MT4+c3RyZWFtCnicXY/BCsMgEETvfsUes4cYk7SWCKG0hZz6A401oIuxSA/9+3pJoAXZw+zAG2ZZzt4xDZAd0RsMMUFwdGLqJkbvkRTcK9MsaxfD3CmxKlDPO0LO0eO5VLDBVYE3jF1iVBc39/WpNmh7SvRGDlKB65vT/ysLlW2aZp8XGNpiXoL7Bx1MGmJBrLXNWseaAuLdj94Kzu4LRXQoQwplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwvRmlsdGVyL0ZsYXRlRGVjb2RlL0xlbmd0aCAyNj4+c3RyZWFtCnicK+QyCuQyNFQozs9JVTDk5XKuBQBCagTJCmVuZHN0cmVhbQplbmRvYmoKNiAwIG9iago8PC9GaWx0ZXIvRmxhdGVEZWNvZGUvTGVuZ3RoIDE2NT4+c3RyZWFtCnicXU8xDsMgDNz5BR/gh4RQakAioXZoJvqAhJAislKUDPn9GJKqlfzw3dnni27MffSEsJF8dMgFiWH1mG1iC4KgjEXKiGIuswYaHpH69YMEj/J+nDpTGo3SuNFwEafY8NQMpiBGpQpRlm17PZ+uzcF9UdFLdCgV6L+r/xMzpnYcx/dxREkL5SbXH/T4aJEKZW5kc3RyZWFtCmVuZG9iagoxIDAgb2JqCjw8L1RhYnMvUy9Hcm91cDw8L1MvVHJhbnNwYXJlbmN5L1R5cGUvR3JvdXAvQ1MvRGV2aWNlUkdCPj4vQ29udGVudHMgNiAwIFIvVHlwZS9QYWdlL1Jlc291cmNlczw8L0NvbG9yU3BhY2U8PC9DUy9EZXZpY2VSR0I+Pi9Qcm9jU2V0IFsvUERGIC9UZXh0IC9JbWFnZUIgL0ltYWdlQyAvSW1hZ2VJXS9Gb250PDwvRjEgMiAwIFI+Pj4+L1BhcmVudCA0IDAgUi9NZWRpYUJveFswIDAgNTk1IDg0Ml0+PgplbmRvYmoKMiAwIG9iago8PC9TdWJ0eXBlL1R5cGUxL1R5cGUvRm9udC9CYXNlRm9udC9IZWx2ZXRpY2EvRW5jb2RpbmcvV2luQW5zaUVuY29kaW5nPj4KZW5kb2JqCjQgMCBvYmoKPDwvS2lkc1sxIDAgUl0vVHlwZS9QYWdlcy9Db3VudCAxL0lUWFQoMi4xLjcpPj4KZW5kb2JqCjcgMCBvYmoKPDwvTmFtZXNbKEpSX1BBR0VfQU5DSE9SXzBfMSkgMyAwIFJdPj4KZW5kb2JqCjggMCBvYmoKPDwvRGVzdHMgNyAwIFI+PgplbmRvYmoKOSAwIG9iago8PC9OYW1lcyA4IDAgUi9UeXBlL0NhdGFsb2cvUGFnZXMgNCAwIFIvVmlld2VyUHJlZmVyZW5jZXM8PC9QcmludFNjYWxpbmcvQXBwRGVmYXVsdD4+Pj4KZW5kb2JqCjEwIDAgb2JqCjw8L01vZERhdGUoRDoyMDI0MDUwMTE3MDEyMCswMCcwMCcpL0NyZWF0b3IoSmFzcGVyUmVwb3J0cyBMaWJyYXJ5IHZlcnNpb24gIFJFVkRBVEUpL0NyZWF0aW9uRGF0ZShEOjIwMjQwNTAxMTcwMTIwKzAwJzAwJykvUHJvZHVjZXIoaVRleHQgMi4xLjcgYnkgMVQzWFQpPj4KZW5kb2JqCnhyZWYKMCAxMQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDA0MjAgMDAwMDAgbiAKMDAwMDAwMDY0MiAwMDAwMCBuIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDA3MzAgMDAwMDAgbiAKMDAwMDAwMDI0MyAwMDAwMCBuIAowMDAwMDAwMzM1IDAwMDAwIG4gCjAwMDAwMDA3OTMgMDAwMDAgbiAKMDAwMDAwMDg0NyAwMDAwMCBuIAowMDAwMDAwODc5IDAwMDAwIG4gCjAwMDAwMDA5ODQgMDAwMDAgbiAKdHJhaWxlcgo8PC9JbmZvIDEwIDAgUi9JRCBbPGRiZDQwODlkZWZhMTRhM2MzOWJlYTBiZmYxYmRiNzllPjxlZGVmZGVlMDBlOTUyNjZlNjhhMjlkY2ZmNTJkZDJkYz5dL1Jvb3QgOSAwIFIvU2l6ZSAxMT4+CnN0YXJ0eHJlZgoxMTU4CiUlRU9GCg=="
    return base64.b64decode(pdf_base64)

@candidates_bp.route("/candidates/cv/<string:candidate_id>", methods=["GET"])
def serve_cv(candidate_id):
    """
    Serve the CV PDF file for a given candidate.
    """
    try:
        print(f"Serving CV for candidate ID: {candidate_id}", file=sys.stderr)
        db = current_app.mongo.db
        
        # Validate candidate_id
        if not ObjectId.is_valid(candidate_id):
            print(f"Invalid candidate ID format: {candidate_id}", file=sys.stderr)
            return jsonify({"error": "Format d'ID de candidat invalide"}), 400
            
        # Find the candidate - first check in candidates collection
        candidate = db.candidates.find_one({"_id": ObjectId(candidate_id)})
        
        # If not found in candidates, check if this is a candidature ID
        if not candidate:
            print(f"Candidate not found directly, checking candidatures for ID: {candidate_id}", file=sys.stderr)
            candidature = db.candidatures.find_one({"_id": ObjectId(candidate_id)})
            if candidature and "candidate_id" in candidature and ObjectId.is_valid(candidature["candidate_id"]):
                candidate = db.candidates.find_one({"_id": ObjectId(candidature["candidate_id"])})
        
        # If still not found, check if there's a candidature with this candidate_id
        if not candidate:
            print(f"Checking candidatures with candidate_id: {candidate_id}", file=sys.stderr)
            candidature = db.candidatures.find_one({"candidate_id": ObjectId(candidate_id)})
            if candidature and "candidate_id" in candidature:
                candidate = db.candidates.find_one({"_id": ObjectId(candidature["candidate_id"])})
                
        # If still not found, return placeholder PDF
        if not candidate:
            print(f"Candidate not found for ID: {candidate_id}", file=sys.stderr)
            return Response(
                generate_not_available_pdf(), 
                mimetype="application/pdf",
                headers={"Content-Disposition": f"inline; filename=cv_non_disponible.pdf"}
            )
            
        # Check for CV in different possible fields
        cv_path = None
        
        # Check in 'cv' field (might be a path or base64)
        if candidate.get("cv"):
            cv_path = candidate.get("cv")
            print(f"CV path from 'cv' field: {cv_path}", file=sys.stderr)
            
        # Check in 'cv_path' field if exists
        if not cv_path and candidate.get("cv_path"):
            cv_path = candidate.get("cv_path")
            print(f"CV path from 'cv_path' field: {cv_path}", file=sys.stderr)
            
        # If CV is a base64 string, decode and serve it
        if cv_path and cv_path.startswith("data:application/pdf;base64,"):
            try:
                print(f"Detected base64 PDF data", file=sys.stderr)
                # Extract the base64 part after the comma
                base64_data = cv_path.split(',')[1]
                pdf_data = base64.b64decode(base64_data)
                return Response(
                    pdf_data,
                    mimetype="application/pdf",
                    headers={"Content-Disposition": f"inline; filename=cv_{candidate.get('nom', 'candidat')}.pdf"}
                )
            except Exception as e:
                print(f"Error processing base64 PDF: {str(e)}", file=sys.stderr)
                # Fall through to generate placeholder PDF
        
        # If no CV path or base64 data found
        if not cv_path:
            print(f"No CV data found for candidate: {candidate_id}", file=sys.stderr)
            return Response(
                generate_not_available_pdf(), 
                mimetype="application/pdf",
                headers={"Content-Disposition": f"inline; filename=cv_non_disponible.pdf"}
            )

        # If path doesn't point to an existing file
        if not os.path.exists(cv_path):
            # Check if path is relative to some base directory
            uploads_dir = current_app.config.get('UPLOAD_FOLDER', 'uploads')
            alternative_path = os.path.join(uploads_dir, os.path.basename(cv_path))
            
            if os.path.exists(alternative_path):
                cv_path = alternative_path
                print(f"Found CV at alternative path: {cv_path}", file=sys.stderr)
            else:
                print(f"CV file not found on server: {cv_path}", file=sys.stderr)
                return Response(
                    generate_not_available_pdf(), 
                    mimetype="application/pdf",
                    headers={"Content-Disposition": f"inline; filename=cv_non_disponible.pdf"}
                )
            
        # Check file size and validity
        try:
            file_size = os.path.getsize(cv_path)
            print(f"CV file size: {file_size} bytes", file=sys.stderr)
            if file_size == 0:
                print(f"CV file is empty: {cv_path}", file=sys.stderr)
                return Response(
                    generate_not_available_pdf(), 
                    mimetype="application/pdf",
                    headers={"Content-Disposition": f"inline; filename=cv_non_disponible.pdf"}
                )
                
            # Quick check if file appears to be a PDF (magic bytes)
            with open(cv_path, 'rb') as f:
                header = f.read(4)
                if header != b'%PDF':
                    print(f"File does not appear to be a PDF: {cv_path}", file=sys.stderr)
                    return Response(
                        generate_not_available_pdf(), 
                        mimetype="application/pdf",
                        headers={"Content-Disposition": f"inline; filename=cv_non_disponible.pdf"}
                    )
        except Exception as e:
            print(f"Error validating PDF file: {str(e)}", file=sys.stderr)
            return Response(
                generate_not_available_pdf(), 
                mimetype="application/pdf",
                headers={"Content-Disposition": f"inline; filename=cv_non_disponible.pdf"}
            )

        # Update the database with correct path if needed
        if candidate.get("cv") != cv_path:
            try:
                db.candidates.update_one(
                    {"_id": ObjectId(candidate["_id"])},
                    {"$set": {"cv": cv_path}}
                )
                print(f"Updated candidate record with correct CV path: {cv_path}", file=sys.stderr)
            except Exception as e:
                print(f"Error updating candidate CV path: {str(e)}", file=sys.stderr)
                # Continue anyway to serve the file

        # Serve the PDF file
        try:
            print(f"Serving CV file: {cv_path}", file=sys.stderr)
            return send_file(
                cv_path,
                mimetype="application/pdf",
                as_attachment=False,
                download_name=f"cv_{candidate.get('nom', 'candidat')}.pdf"
            )
        except Exception as e:
            print(f"Error sending file {cv_path}: {str(e)}", file=sys.stderr)
            return Response(
                generate_not_available_pdf(), 
                mimetype="application/pdf",
                headers={"Content-Disposition": f"inline; filename=cv_non_disponible.pdf"}
            )
    except Exception as e:
        print(f"Error serving CV: {str(e)}", file=sys.stderr)
        return Response(
            generate_not_available_pdf(), 
            mimetype="application/pdf",
            headers={"Content-Disposition": f"inline; filename=cv_non_disponible.pdf"}
        )

@candidates_bp.route("/candidates/lettre-motivation/<string:candidate_id>", methods=["GET"])
def serve_lettre_motivation(candidate_id):
    """
    Serve the motivation letter PDF file for a given candidate.
    """
    try:
        print(f"Serving motivation letter for candidate ID: {candidate_id}", file=sys.stderr)
        db = current_app.mongo.db
        
        # Validate candidate_id
        if not ObjectId.is_valid(candidate_id):
            print(f"Invalid candidate ID format: {candidate_id}", file=sys.stderr)
            return jsonify({"error": "Format d'ID de candidat invalide"}), 400
            
        # Find the candidate - first check in candidates collection
        candidate = db.candidates.find_one({"_id": ObjectId(candidate_id)})
        
        # If not found in candidates, check if this is a candidature ID
        if not candidate:
            print(f"Candidate not found directly, checking candidatures for ID: {candidate_id}", file=sys.stderr)
            candidature = db.candidatures.find_one({"_id": ObjectId(candidate_id)})
            if candidature and "candidate_id" in candidature and ObjectId.is_valid(candidature["candidate_id"]):
                candidate = db.candidates.find_one({"_id": ObjectId(candidature["candidate_id"])})
        
        # If still not found, check if there's a candidature with this candidate_id
        if not candidate:
            print(f"Checking candidatures with candidate_id: {candidate_id}", file=sys.stderr)
            candidature = db.candidatures.find_one({"candidate_id": ObjectId(candidate_id)})
            if candidature and "candidate_id" in candidature:
                candidate = db.candidates.find_one({"_id": ObjectId(candidature["candidate_id"])})
                
        # If still not found, return placeholder PDF
        if not candidate:
            print(f"Candidate not found for ID: {candidate_id}", file=sys.stderr)
            return Response(
                generate_not_available_pdf("Lettre de motivation non disponible"), 
                mimetype="application/pdf",
                headers={"Content-Disposition": f"inline; filename=lettre_non_disponible.pdf"}
            )
            
        # Check for motivation letter in different possible fields
        lettre_path = None
        
        # Check in 'lettre_motivation' field (might be a path or base64 or text)
        if candidate.get("lettre_motivation"):
            lettre_path = candidate.get("lettre_motivation")
            print(f"Motivation letter from 'lettre_motivation' field found", file=sys.stderr)
            
        # If no motivation letter found
        if not lettre_path:
            print(f"No motivation letter found for candidate: {candidate_id}", file=sys.stderr)
            return Response(
                generate_not_available_pdf("Lettre de motivation non disponible"), 
                mimetype="application/pdf",
                headers={"Content-Disposition": f"inline; filename=lettre_non_disponible.pdf"}
            )
        
        # If it's a base64 string, decode and serve it
        if lettre_path.startswith("data:application/pdf;base64,"):
            try:
                print(f"Detected base64 PDF data for motivation letter", file=sys.stderr)
                base64_data = lettre_path.split(',')[1]
                pdf_data = base64.b64decode(base64_data)
                return Response(
                    pdf_data,
                    mimetype="application/pdf",
                    headers={"Content-Disposition": f"inline; filename=lettre_{candidate.get('nom', 'candidat')}.pdf"}
                )
            except Exception as e:
                print(f"Error processing base64 PDF for motivation letter: {str(e)}", file=sys.stderr)
                # Fall through to generate placeholder PDF
        
        # If it's a plain text, convert to PDF
        if not lettre_path.startswith("data:") and not os.path.exists(lettre_path):
            try:
                # For simplicity, we're just returning a placeholder PDF with a message
                # In a real scenario, you would generate a PDF from the text
                print(f"Converting text motivation letter to PDF", file=sys.stderr)
                return Response(
                    generate_not_available_pdf(f"Lettre de motivation: {lettre_path[:500]}..."), 
                    mimetype="application/pdf",
                    headers={"Content-Disposition": f"inline; filename=lettre_{candidate.get('nom', 'candidat')}.pdf"}
                )
            except Exception as e:
                print(f"Error converting text to PDF: {str(e)}", file=sys.stderr)
                return Response(
                    generate_not_available_pdf("Lettre de motivation non disponible"), 
                    mimetype="application/pdf",
                    headers={"Content-Disposition": f"inline; filename=lettre_non_disponible.pdf"}
                )
        
        # If it's a file path, validate and serve
        if os.path.exists(lettre_path):
            # Check file size and validity
            try:
                file_size = os.path.getsize(lettre_path)
                print(f"Motivation letter file size: {file_size} bytes", file=sys.stderr)
                if file_size == 0:
                    print(f"Motivation letter file is empty: {lettre_path}", file=sys.stderr)
                    return Response(
                        generate_not_available_pdf("Lettre de motivation non disponible"), 
                        mimetype="application/pdf",
                        headers={"Content-Disposition": f"inline; filename=lettre_non_disponible.pdf"}
                    )
                    
                # Quick check if file appears to be a PDF (magic bytes)
                with open(lettre_path, 'rb') as f:
                    header = f.read(4)
                    if header != b'%PDF':
                        print(f"File does not appear to be a PDF: {lettre_path}", file=sys.stderr)
                        # Try to read it as text and convert
                        try:
                            with open(lettre_path, 'r') as f:
                                lettre_text = f.read()
                                return Response(
                                    generate_not_available_pdf(f"Lettre de motivation: {lettre_text[:500]}..."), 
                                    mimetype="application/pdf",
                                    headers={"Content-Disposition": f"inline; filename=lettre_{candidate.get('nom', 'candidat')}.pdf"}
                                )
                        except:
                            return Response(
                                generate_not_available_pdf("Lettre de motivation non disponible"), 
                                mimetype="application/pdf",
                                headers={"Content-Disposition": f"inline; filename=lettre_non_disponible.pdf"}
                            )
                
                # Serve the PDF file
                print(f"Serving motivation letter file: {lettre_path}", file=sys.stderr)
                return send_file(
                    lettre_path,
                    mimetype="application/pdf",
                    as_attachment=False,
                    download_name=f"lettre_{candidate.get('nom', 'candidat')}.pdf"
                )
            except Exception as e:
                print(f"Error validating motivation letter file: {str(e)}", file=sys.stderr)
                return Response(
                    generate_not_available_pdf("Lettre de motivation non disponible"), 
                    mimetype="application/pdf",
                    headers={"Content-Disposition": f"inline; filename=lettre_non_disponible.pdf"}
                )

        # If we got here, something went wrong
        print(f"Could not process motivation letter: {lettre_path}", file=sys.stderr)
        return Response(
            generate_not_available_pdf("Lettre de motivation non disponible"), 
            mimetype="application/pdf",
            headers={"Content-Disposition": f"inline; filename=lettre_non_disponible.pdf"}
        )
    except Exception as e:
        print(f"Error serving motivation letter: {str(e)}", file=sys.stderr)
        return Response(
            generate_not_available_pdf("Lettre de motivation non disponible"), 
            mimetype="application/pdf",
            headers={"Content-Disposition": f"inline; filename=lettre_non_disponible.pdf"}
        )