from flask import Blueprint, jsonify, request, current_app, send_file, Response
import os
import sys
import base64
from bson import ObjectId
from datetime import datetime, timezone
from jwt_manager import jwt_manager
from pydantic import BaseModel, validator, Field
from typing import List, Optional, Dict
import logging
from flask_cors import cross_origin
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

candidates_bp = Blueprint('candidates', __name__, url_prefix="/api/candidates")

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

def get_user_from_token(token):
    """Extract user information from token."""
    if not token:
        return None
    if isinstance(token, str) and token.startswith("Bearer "):
        token = token.split(" ")[1]
    data = jwt_manager.verify_token(token)
    if not data:
        return None
    return {"id": data["sub"], "role": data["role"]}

@candidates_bp.route("/candidates", methods=["GET"])
def get_candidates():
    """Retrieve all candidatures with associated candidate and job offer details."""
    try:
        # Obtenir le token d'authentification
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            print("Aucun token d'authentification fourni", file=sys.stderr)
            return jsonify({"error": "Authentification requise"}), 401
            
        # Extraire et valider l'utilisateur
        user = get_user_from_token(auth_header)
        
        if not user:
            print("Token invalide ou expiré", file=sys.stderr)
            return jsonify({"error": "Token invalide ou expiré"}), 401
            
        if user.get('role') != 'recruteur':
            print(f"Accès non autorisé pour le rôle: {user.get('role')}", file=sys.stderr)
            return jsonify({"error": "Accès réservé aux recruteurs"}), 403
            
        # Obtenir l'ID du recruteur
        recruteur_id = user.get('id')
        if not recruteur_id:
            print("ID recruteur non trouvé dans les données utilisateur", file=sys.stderr)
            return jsonify({"error": "Impossible d'identifier le recruteur"}), 400
            
        print(f"Récupération des candidatures pour le recruteur: {recruteur_id}", file=sys.stderr)
        
        # Obtenir les offres du recruteur
        db = current_app.mongo.db
        offres_du_recruteur = list(db.offres.find({"recruteur_id": recruteur_id}))
        offre_ids = [offre.get('_id') for offre in offres_du_recruteur if offre.get('_id')]
        
        if not offre_ids:
            print(f"Aucune offre trouvée pour le recruteur {recruteur_id}", file=sys.stderr)
            return jsonify([]), 200
            
        print(f"Offres trouvées pour le recruteur: {len(offre_ids)}", file=sys.stderr)
        
        # Récupérer uniquement les candidatures liées aux offres du recruteur
        candidatures = list(db.candidatures.find({"offre_id": {"$in": offre_ids}}))
        print(f"Trouvé {len(candidatures)} candidatures pour les offres du recruteur", file=sys.stderr)
        
        result = []
        for candidature in candidatures:
            try:
                print(f"Traitement candidature: {str(candidature.get('_id'))}", file=sys.stderr)
                
                # Validate candidate_id
                if "candidate_id" not in candidature:
                    print(f"ID candidat manquant dans la candidature: {str(candidature.get('_id'))}", file=sys.stderr)
                    continue
                    
                if not ObjectId.is_valid(candidature["candidate_id"]):
                    print(f"Format d'ID candidat invalide: {candidature['candidate_id']}", file=sys.stderr)
                    continue
                
                # Get candidate
                candidate = db.candidates.find_one({"_id": ObjectId(candidature["candidate_id"])})
                if not candidate:
                    print(f"Candidat non trouvé pour l'ID: {candidature['candidate_id']}", file=sys.stderr)
                    continue
                
                # Get job offer
                if "offre_id" not in candidature:
                    print(f"ID offre manquant dans la candidature: {str(candidature.get('_id'))}", file=sys.stderr)
                    continue
                    
                offre = db.offres.find_one({"_id": candidature["offre_id"]})
                if not offre:
                    print(f"Offre non trouvée pour l'ID: {candidature['offre_id']}", file=sys.stderr)
                    continue
                
                # Vérification que l'offre appartient bien au recruteur
                if offre.get('recruteur_id') != recruteur_id:
                    print(f"Offre {offre.get('_id')} n'appartient pas au recruteur {recruteur_id}", file=sys.stderr)
                    continue
                
                # Build CV URL
                cv_url = ""
                # Dans tous les cas, fournir une URL - même si le CV n'existe pas
                # La route servira un PDF "CV non disponible" si nécessaire
                cv_url = f"/api/candidates/cv/{str(candidate['_id'])}"
                
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
                print(f"Candidature traitée avec succès: {candidature_data['id']}", file=sys.stderr)
                
            except Exception as e:
                print(f"Erreur lors du traitement de la candidature {str(candidature.get('_id'))}: {str(e)}", file=sys.stderr)
                continue
                
        print(f"Retour de {len(result)} candidatures traitées", file=sys.stderr)
        return jsonify(result), 200
        
    except Exception as e:
        print(f"Erreur dans get_candidates: {str(e)}", file=sys.stderr)
        return jsonify({"error": f"Échec de la récupération des candidatures : {str(e)}"}), 500

@candidates_bp.route("/candidates/<string:candidate_id>", methods=["PUT"])
def update_candidate_status(candidate_id):
    """Update the status of a candidature."""
    try:
        # Obtenir le token d'authentification
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            print("Aucun token d'authentification fourni", file=sys.stderr)
            return jsonify({"error": "Authentification requise"}), 401
            
        # Extraire et valider l'utilisateur
        user = get_user_from_token(auth_header)
        
        if not user:
            print("Token invalide ou expiré", file=sys.stderr)
            return jsonify({"error": "Token invalide ou expiré"}), 401
            
        if user.get('role') != 'recruteur':
            print(f"Accès non autorisé pour le rôle: {user.get('role')}", file=sys.stderr)
            return jsonify({"error": "Accès réservé aux recruteurs"}), 403
            
        # Obtenir l'ID du recruteur
        recruteur_id = user.get('id')
        if not recruteur_id:
            print("ID recruteur non trouvé dans les données utilisateur", file=sys.stderr)
            return jsonify({"error": "Impossible d'identifier le recruteur"}), 400
        
        db = current_app.mongo.db
        data = request.get_json()
        if not data or "statut" not in data:
            return jsonify({"error": "Statut requis"}), 400
        if data["statut"] not in ["en_attente", "acceptee", "refusee", "interviewing", "hired", "rejected"]:
            return jsonify({"error": "Statut invalide"}), 400
        if not ObjectId.is_valid(candidate_id):
            return jsonify({"error": "Format d'ID invalide"}), 400
            
        # Récupérer la candidature
        candidature = db.candidatures.find_one({"_id": ObjectId(candidate_id)})
        if not candidature:
            return jsonify({"error": "Candidature non trouvée"}), 404
            
        # Vérifier que l'offre appartient au recruteur
        offre_id = candidature.get("offre_id")
        if not offre_id:
            return jsonify({"error": "Offre non trouvée pour cette candidature"}), 404
            
        offre = db.offres.find_one({"_id": offre_id})
        if not offre:
            return jsonify({"error": "Offre non trouvée"}), 404
            
        if offre.get("recruteur_id") != recruteur_id:
            print(f"Tentative non autorisée de mise à jour - recruteur {recruteur_id} essaie de modifier une candidature pour l'offre de {offre.get('recruteur_id')}", file=sys.stderr)
            return jsonify({"error": "Vous n'êtes pas autorisé à modifier cette candidature"}), 403
            
        # Mettre à jour le statut
        result = db.candidatures.update_one(
            {"_id": ObjectId(candidate_id)},
            {"$set": {"statut": data["statut"]}}
        )
        
        print(f"Statut de la candidature {candidate_id} mis à jour vers {data['statut']} par le recruteur {recruteur_id}", file=sys.stderr)
        return jsonify({"message": "Statut mis à jour"}), 200
    except Exception as e:
        print(f"Erreur lors de la mise à jour du statut: {str(e)}", file=sys.stderr)
        return jsonify({"error": f"Échec de la mise à jour du statut: {str(e)}"}), 500

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
