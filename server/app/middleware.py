from flask import request, jsonify, current_app, redirect, url_for
from jwt_manager import jwt_manager
import logging
from bson import ObjectId

logger = logging.getLogger(__name__)

def require_auth(roles):
    """
    Middleware d'authentification qui vérifie si l'utilisateur est authentifié et a le rôle requis
    
    Args:
        roles: Peut être une chaîne pour un seul rôle ou une liste/tuple pour plusieurs rôles autorisés
    """
    if isinstance(roles, str):
        roles = [roles]  # Convertir un seul rôle en liste
        
    def decorator(f):
        def wrapped_function(*args, **kwargs):
            # Vérifier le token d'authentification
            token = request.headers.get("Authorization")
            if not token:
                logger.warning("Jeton manquant")
                return jsonify({"error": "Authentification requise", "code": "AUTH_REQUIRED"}), 401

            try:
                user_id = jwt_manager.verify_token(token)
                # Récupérer l'utilisateur depuis la base de données
                user = current_app.mongo.utilisateurs.find_one({"_id": ObjectId(user_id)})
                if not user:
                    logger.warning(f"Utilisateur non trouvé pour l'ID: {user_id}")
                    return jsonify({"error": "Utilisateur non trouvé", "code": "USER_NOT_FOUND"}), 401
                
                user_role = user.get("role")
                
                # Vérifier si le rôle de l'utilisateur est autorisé
                if user_role not in roles:
                    logger.warning(f"Accès non autorisé - Rôle requis: {roles}, rôle actuel: {user_role}")
                    return jsonify({
                        "error": f"Accès refusé. Cette fonctionnalité est réservée aux {', '.join(roles)}.", 
                        "code": "ACCESS_DENIED",
                        "requiredRoles": roles,
                        "currentRole": user_role
                    }), 403
                
                # Construire le payload d'authentification avec les informations utilisateur
                auth_payload = {
                    "user_id": user_id,
                    "role": user_role,
                    "email": user.get("email"),
                    "nom": user.get("nom", ""),
                    "entreprise": user.get("entreprise", user.get("nomEntreprise", ""))
                }
                
                # Ajouter les informations d'authentification aux arguments de la fonction
                kwargs['auth_payload'] = auth_payload
                return f(*args, **kwargs)
            
            except Exception as e:
                logger.warning(f"Erreur de vérification du jeton: {str(e)}")
                return jsonify({"error": "Session expirée ou invalide", "code": "INVALID_TOKEN"}), 401

        wrapped_function.__name__ = f.__name__
        return wrapped_function
    return decorator
    
def role_redirect(default_routes):
    """
    Middleware qui redirige l'utilisateur vers la route appropriée en fonction de son rôle
    
    Args:
        default_routes: Dictionnaire associant chaque rôle à sa route par défaut
    """
    def decorator(f):
        def wrapped_function(*args, **kwargs):
            token = request.headers.get("Authorization")
            if not token:
                return f(*args, **kwargs)
                
            try:
                user_id = jwt_manager.verify_token(token)
                user = current_app.mongo.utilisateurs.find_one({"_id": ObjectId(user_id)})
                if not user:
                    return f(*args, **kwargs)
                    
                user_role = user.get("role")
                if user_role in default_routes:
                    return redirect(url_for(default_routes[user_role]))
                    
            except Exception:
                pass
                
            return f(*args, **kwargs)

        wrapped_function.__name__ = f.__name__
        return wrapped_function
    return decorator