from jwt_manager import jwt_manager
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def verify_token(token):
    """
    Verify a JWT token and return the user information if valid.
    Returns a dictionary containing user information including email and role.
    """
    try:
        # The verify_token function returns user_id directly, not a tuple
        user_id = jwt_manager.verify_token(token)
        if not user_id:
            logger.error("ID utilisateur non trouvé dans le jeton")
            return None

        user = jwt_manager.get_user_from_token(token)
        if not user:
            logger.error("Utilisateur non trouvé pour le jeton fourni")
            return None

        logger.info(f"Jeton vérifié pour l'utilisateur: {user['email']}")
        return {
            'sub': user_id,
            'email': user['email'],
            'role': user.get('role'),
            'user': user
        }
    except Exception as e:
        logger.error(f"Erreur dans verify_token: {str(e)}")
        return None