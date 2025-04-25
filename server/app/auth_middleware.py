from flask import request, jsonify, current_app
from functools import wraps
from auth import verify_token
import logging
from datetime import datetime, timedelta
from bson import ObjectId

logger = logging.getLogger(__name__)

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if "Authorization" in request.headers:
            try:
                token = request.headers["Authorization"].split(" ")[1]
            except IndexError:
                logger.warning(f"Format d'en-tête Authorization invalide: {request.headers.get('Authorization')}")
                return jsonify({"error": "Format de jeton invalide"}), 401

        if not token:
            logger.warning("Aucun jeton fourni")
            return jsonify({"error": "Jeton requis"}), 401

        try:
            data = verify_token(token)
            if not data:
                logger.warning("Jeton invalide ou expiré")
                return jsonify({"error": "Jeton invalide ou expiré"}), 401
                
            # Add user information to the request
            request.user = {"id": data["id"], "role": data["role"]}
            
            # For recruiters, add additional security checks
            if data["role"] == "recruteur":
                # Get user from database to verify it still exists and is active
                user = current_app.mongo.db.users.find_one({"_id": ObjectId(data["id"])})
                if not user:
                    logger.warning(f"Utilisateur non trouvé: {data['id']}")
                    return jsonify({"error": "Compte utilisateur non trouvé"}), 401
                    
                if user.get("status") != "active":
                    logger.warning(f"Compte utilisateur non actif: {data['id']}")
                    return jsonify({"error": "Compte utilisateur inactif ou suspendu"}), 403
                    
                # Check for IP change if IP tracking is enabled
                if current_app.config.get("TRACK_IP_CHANGES", False):
                    current_ip = request.remote_addr
                    user_sessions = current_app.mongo.db.user_sessions.find_one({
                        "user_id": ObjectId(data["id"]),
                        "token": token
                    })
                    
                    if user_sessions and user_sessions.get("ip") != current_ip:
                        # Log potential security issue
                        logger.warning(f"Changement d'IP détecté pour l'utilisateur {data['id']}: {user_sessions.get('ip')} -> {current_ip}")
                        
                        # Update session with new IP
                        current_app.mongo.db.user_sessions.update_one(
                            {"user_id": ObjectId(data["id"]), "token": token},
                            {"$set": {"ip": current_ip, "ip_changed_at": datetime.utcnow()}}
                        )
                        
                # Check for blocked actions
                if current_app.config.get("MAINTENANCE_MODE", False):
                    logger.info(f"Accès restreint pendant la maintenance pour l'utilisateur {data['id']}")
                    
                    # Skip maintenance restriction for these endpoints
                    maintenance_bypass_endpoints = [
                        "/api/auth/logout",
                        "/api/recruiter/profile",
                        "/api/dashboard/data-graph"
                    ]
                    
                    if not any(request.path.startswith(endpoint) for endpoint in maintenance_bypass_endpoints):
                        return jsonify({
                            "error": "Maintenance en cours",
                            "message": "Le système est actuellement en maintenance. Certaines fonctionnalités sont temporairement indisponibles."
                        }), 503
                        
                # Add the full user data to the request for easy access
                request.user["data"] = user
                
                # Record the activity
                try:
                    current_app.mongo.db.activities.insert_one({
                        "user_id": ObjectId(data["id"]),
                        "action": request.path,
                        "method": request.method,
                        "timestamp": datetime.utcnow(),
                        "ip": request.remote_addr,
                        "user_agent": request.headers.get("User-Agent", "")
                    })
                except Exception as e:
                    logger.error(f"Erreur lors de l'enregistrement de l'activité: {str(e)}")
                
            logger.info(f"Utilisateur authentifié: {request.user['id']} avec rôle {request.user['role']}")
        except ValueError as e:
            logger.warning(f"Échec de l'authentification: {str(e)}")
            return jsonify({"error": str(e)}), 401
        except Exception as e:
            logger.error(f"Erreur lors de la vérification du jeton: {str(e)}")
            return jsonify({"error": "Erreur serveur lors de l'authentification", "details": str(e)}), 500

        return f(*args, **kwargs)
    return decorated

def require_role(role):
    """Decorator to require a specific role"""
    def decorator(f):
        @wraps(f)
        @require_auth
        def decorated_function(*args, **kwargs):
            if request.user["role"] != role:
                logger.warning(f"Accès refusé: {request.user['id']} avec rôle {request.user['role']} a tenté d'accéder à une ressource réservée au rôle {role}")
                return jsonify({"error": f"Accès réservé aux {role}s"}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def recruiter_only(f):
    """Decorator specifically for recruiter-only endpoints with additional security checks"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Autoriser les requêtes OPTIONS pour CORS
        if request.method == "OPTIONS":
            return f(*args, **kwargs)
            
        # Le reste du code ne s'exécute que pour les requêtes non-OPTIONS
        token = None
        auth_header = request.headers.get("Authorization")
        
        if auth_header:
            try:
                # Accepter les deux formats: "Bearer <token>" ou juste "<token>"
                if auth_header.startswith("Bearer "):
                    token = auth_header.split(" ")[1]
                else:
                    token = auth_header
            except (IndexError, Exception) as e:
                logger.warning(f"Format d'en-tête Authorization invalide: {auth_header}, erreur: {str(e)}")
                return jsonify({"error": "Format de jeton invalide"}), 401

        if not token:
            logger.warning("Aucun jeton fourni")
            return jsonify({"error": "Jeton requis"}), 401
            
        try:
            # Ajoutons des logs pour le débogage
            logger.info(f"Tentative de vérification du jeton: {token[:10]}...")
            
            data = verify_token(token)
            if not data:
                logger.warning("Jeton invalide ou expiré")
                return jsonify({"error": "Jeton invalide ou expiré"}), 401
                
            # Add user information to the request
            request.user = {"id": data["id"], "role": data["role"]}
            logger.info(f"Jeton validé pour l'utilisateur ID: {data['id']}, rôle: {data['role']}")
            
            if request.user["role"] != "recruteur":
                logger.warning(f"Accès refusé: {request.user['id']} avec rôle {request.user['role']} a tenté d'accéder à une ressource réservée aux recruteurs")
                return jsonify({"error": "Accès réservé aux recruteurs"}), 403
                
            # Get user from database to verify it still exists and is active
            user = current_app.mongo.db.users.find_one({"_id": ObjectId(data["id"])})
            if not user:
                logger.warning(f"Utilisateur non trouvé: {data['id']}")
                return jsonify({"error": "Compte utilisateur non trouvé"}), 401
                
            if user.get("status") and user.get("status") != "active":
                logger.warning(f"Compte utilisateur non actif: {data['id']}, statut: {user.get('status')}")
                return jsonify({"error": "Compte utilisateur inactif ou suspendu"}), 403
                
            # Add the full user data to the request for easy access
            request.user["data"] = user
                
            # Additional checks specific to recruiters
            user_id = request.user["id"]
            
            # Check if user has completed their profile
            # Temporairement désactivé pour le débogage
            # profile = current_app.mongo.db.recruiter_profiles.find_one({"user_id": ObjectId(user_id)})
            # if not profile and not request.path.startswith("/api/recruiter/profile"):
            #     logger.warning(f"Profil incomplet pour le recruteur {user_id}")
            #     return jsonify({
            #         "error": "Profil incomplet",
            #         "message": "Veuillez compléter votre profil avant d'accéder à cette fonctionnalité",
            #         "redirect": "/profile/edit"
            #     }), 403
                
            # Check permissions for this specific endpoint
            # Temporairement désactivé pour le débogage
            # endpoint_permissions = {
            #     "/api/jobs/offres-emploi": "can_manage_jobs",
            #     "/api/dashboard": "can_view_dashboard",
            #     "/api/candidates": "can_manage_candidates",
            #     "/api/interviews": "can_manage_interviews"
            # }
            # 
            # for endpoint, permission in endpoint_permissions.items():
            #     if request.path.startswith(endpoint):
            #         user_permissions = request.user.get("data", {}).get("permissions", {})
            #         if not user_permissions.get(permission, False):
            #             logger.warning(f"Permission manquante {permission} pour le recruteur {user_id}")
            #             return jsonify({
            #                 "error": "Permission manquante",
            #                 "message": "Vous n'avez pas les droits nécessaires pour accéder à cette fonctionnalité"
            #             }), 403
                
            # Record the activity
            try:
                current_app.mongo.db.activities.insert_one({
                    "user_id": ObjectId(data["id"]),
                    "action": request.path,
                    "method": request.method,
                    "timestamp": datetime.utcnow(),
                    "ip": request.remote_addr,
                    "user_agent": request.headers.get("User-Agent", "")
                })
            except Exception as e:
                logger.error(f"Erreur lors de l'enregistrement de l'activité: {str(e)}")
                
            logger.info(f"Utilisateur authentifié avec succès: {request.user['id']} avec rôle {request.user['role']}")
            
        except ValueError as e:
            logger.warning(f"Échec de l'authentification (ValueError): {str(e)}")
            return jsonify({"error": str(e)}), 401
        except Exception as e:
            logger.error(f"Erreur lors de la vérification du jeton: {str(e)}", exc_info=True)
            return jsonify({"error": "Erreur serveur lors de l'authentification", "details": str(e)}), 500
        
        return f(*args, **kwargs)
    return decorated_function