from flask import Blueprint, request, jsonify
from werkzeug.security import check_password_hash
from bson import ObjectId
from datetime import datetime, timedelta
import jwt
from config.config import JWT_SECRET_KEY, JWT_ACCESS_TOKEN_EXPIRES
from config.database import db
from middleware.auth_middleware import generate_token, refresh_token

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'message': 'Email et mot de passe requis'}), 400

    user = db.users.find_one({'email': email})
    if not user or not check_password_hash(user['password'], password):
        return jsonify({'message': 'Email ou mot de passe incorrect'}), 401

    # Générer le token JWT
    token = generate_token(user['_id'])

    # Retourner le token et les informations utilisateur (sans le mot de passe)
    user_data = {
        'id': str(user['_id']),
        'email': user['email'],
        'nom': user.get('nom', ''),
        'prenom': user.get('prenom', ''),
        'role': user.get('role', 'user')
    }

    return jsonify({
        'token': token,
        'user': user_data
    }), 200

@auth_bp.route('/refresh', methods=['POST'])
def refresh():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'message': 'Token manquant'}), 401

    token = auth_header.split(' ')[1]
    new_token = refresh_token(token)

    if not new_token:
        return jsonify({'message': 'Token invalide ou expiré'}), 401

    return jsonify({'token': new_token}), 200

@auth_bp.route('/me', methods=['GET'])
def get_current_user():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'message': 'Token manquant'}), 401

    token = auth_header.split(' ')[1]
    try:
        data = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
        user = db.users.find_one({'_id': ObjectId(data['user_id'])})
        
        if not user:
            return jsonify({'message': 'Utilisateur non trouvé'}), 404

        user_data = {
            'id': str(user['_id']),
            'email': user['email'],
            'nom': user.get('nom', ''),
            'prenom': user.get('prenom', ''),
            'role': user.get('role', 'user')
        }

        return jsonify({'user': user_data}), 200
    except jwt.ExpiredSignatureError:
        return jsonify({'message': 'Token expiré'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'message': 'Token invalide'}), 401 