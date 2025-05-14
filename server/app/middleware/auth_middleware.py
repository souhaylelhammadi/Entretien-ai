from functools import wraps
from flask import request, jsonify
import jwt
from datetime import datetime, timedelta
from bson import ObjectId
from config.config import JWT_SECRET_KEY, JWT_ACCESS_TOKEN_EXPIRES
from config.database import db

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')

        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

        if not token:
            return jsonify({'message': 'Token manquant'}), 401

        try:
            # Décoder le token
            data = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
            
            # Vérifier si le token est expiré
            if datetime.fromtimestamp(data['exp']) < datetime.now():
                return jsonify({'message': 'Token expiré'}), 401

            # Récupérer l'utilisateur depuis la base de données
            user = db.users.find_one({'_id': ObjectId(data['user_id'])})
            if not user:
                return jsonify({'message': 'Utilisateur non trouvé'}), 401

            # Ajouter l'utilisateur à la requête
            request.user = user
            return f(*args, **kwargs)

        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token expiré'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token invalide'}), 401
        except Exception as e:
            return jsonify({'message': f'Erreur d\'authentification: {str(e)}'}), 401

    return decorated

def generate_token(user_id):
    """Génère un nouveau token JWT"""
    payload = {
        'user_id': str(user_id),
        'exp': datetime.utcnow() + timedelta(hours=JWT_ACCESS_TOKEN_EXPIRES)
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm="HS256")

def refresh_token(token):
    """Rafraîchit un token existant"""
    try:
        # Décoder le token existant
        data = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
        
        # Vérifier si le token est presque expiré (moins de 1 heure)
        exp_time = datetime.fromtimestamp(data['exp'])
        if exp_time - datetime.now() < timedelta(hours=1):
            # Générer un nouveau token
            return generate_token(data['user_id'])
        
        return token
    except:
        return None 