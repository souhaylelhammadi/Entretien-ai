from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import check_password_hash, generate_password_hash
from pymongo.errors import DuplicateKeyError
import datetime
from config import database
from utils import verify_token

auth_bp = Blueprint('auth', __name__)

# Standardized collection names
USERS_COLLECTION = 'utilisateurs'
CANDIDATES_COLLECTION = 'candidates'
RECRUITERS_COLLECTION = 'recruteurs'

# Default secret key (for development only, change in production)
DEFAULT_SECRET_KEY = "default_secret_key_for_development"

def get_secret_key():
    """Retrieve the secret key or use a default"""
    return current_app.config.get('SECRET_KEY', DEFAULT_SECRET_KEY)

# Route for user registration
@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        # Parse JSON and index.html
        data = request.get_json()
        if not isinstance(data, dict):
            print(f"Données non-JSON reçues: {request.data}")
            return jsonify({'message': 'Données JSON invalides'}), 400
        print(f"Requête POST /register reçue: {data}")

        required_fields = ['nom', 'email', 'mot_de_passe', 'telephone', 'role']
        if not all(field in data for field in required_fields):
            return jsonify({'message': 'Tous les champs obligatoires doivent être remplis'}), 400

        if not isinstance(data.get('acceptTerms', False), bool) or not data['acceptTerms']:
            return jsonify({'message': 'Vous devez accepter les conditions'}), 400

        if data['role'] not in ['candidat', 'recruteur']:
            return jsonify({'message': "Rôle invalide. Doit être 'candidat' ou 'recruteur'"}), 400

        if data['role'] == 'recruteur' and not data.get('entreprise_id'):
            return jsonify({'message': "L'ID de l'entreprise est requis pour les recruteurs"}), 400

        # Convert all inputs to strings
        nom = str(data['nom'])
        email = str(data['email'])
        mot_de_passe = str(data['mot_de_passe'])
        telephone = str(data['telephone'])
        role = str(data['role'])
        entreprise_id = str(data.get('entreprise_id')) if data.get('entreprise_id') else None

        db = database.get_db()
        users_collection = db[USERS_COLLECTION]

        # Check if email already exists
        if users_collection.find_one({'email': email}):
            return jsonify({'message': 'Cet email est déjà utilisé'}), 400

        # Validate password
        if len(mot_de_passe) < 8:
            return jsonify({'message': 'Le mot de passe doit contenir au moins 8 caractères'}), 400
        if not any(c.isupper() for c in mot_de_passe) or not any(c.isdigit() for c in mot_de_passe):
            return jsonify({'message': 'Le mot de passe doit inclure une majuscule et un chiffre'}), 400

        # Hash the password using pbkdf2:sha256 method
        hashed_password = generate_password_hash(mot_de_passe, method='pbkdf2:sha256')

        # Create the user
        user = {
            'nom': nom,
            'email': email,
            'mot_de_passe': hashed_password,
            'telephone': telephone,
            'role': role,
            'entreprise_id': entreprise_id,
            'created_at': datetime.datetime.utcnow()
        }

        # Insert user into users collection
        result = users_collection.insert_one(user)
        user_id = str(result.inserted_id)
        print(f"Utilisateur créé dans la collection utilisateurs: {email}")

        # Insert user into appropriate collection based on role
        if role == 'candidat':
            candidate_data = {
                'user_id': user_id,
                'nom': nom,
                'email': email,
                'telephone': telephone,
                'created_at': datetime.datetime.utcnow(),
                'status': 'active',
                'candidatures': []
            }
            db[CANDIDATES_COLLECTION].insert_one(candidate_data)
            print(f"Candidat créé dans la collection candidates: {email}")
        else:  # recruteur
            recruiter_data = {
                'user_id': user_id,
                'nom': nom,
                'email': email,
                'telephone': telephone,
                'entreprise_id': entreprise_id,
                'created_at': datetime.datetime.utcnow(),
                'status': 'active',
                'offres_crees': []
            }
            db[RECRUITERS_COLLECTION].insert_one(recruiter_data)
            print(f"Recruteur créé dans la collection recruteurs: {email}")

        # Create a simple token containing the user's email
        simple_token = f"EMAIL:{email}"

        return jsonify({
            'message': 'Inscription réussie',
            'user': {
                'nom': nom,
                'email': email,
                'telephone': telephone,
                'role': role
            },
            'token': simple_token
        }), 201

    except DuplicateKeyError:
        return jsonify({'message': 'Cet email est déjà utilisé'}), 400
    except Exception as e:
        print(f"Erreur dans /register: {str(e)}")
        return jsonify({'message': f'Erreur serveur: {str(e)}'}), 500

# Route for user login
@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if not isinstance(data, dict):
            print(f"Données non-JSON reçues: {request.data}")
            return jsonify({'message': 'Données JSON invalides'}), 400
        print(f"Requête POST /login reçue: {data}")

        email = str(data.get('email', ''))
        mot_de_passe = str(data.get('mot_de_passe', ''))
        if not email or not mot_de_passe:
            return jsonify({'message': 'Email et mot de passe requis'}), 400

        db = database.get_db()
        user = db[USERS_COLLECTION].find_one({'email': email})
        
        if not user:
            print(f"Utilisateur avec email {email} non trouvé dans la collection {USERS_COLLECTION}")
            return jsonify({'message': 'Email ou mot de passe incorrect'}), 401

        try:
            # Vérifier le mot de passe
            stored_hash = user['mot_de_passe']
            
            # Si le hash est en bytes, le convertir en string
            if isinstance(stored_hash, bytes):
                stored_hash = stored_hash.decode('utf-8')
            
            # Si le hash ne commence pas par la méthode pbkdf2, le recréer
            if not stored_hash.startswith('pbkdf2:'):
                print(f"Hash invalide pour l'utilisateur {email}, recréation du hash")
                new_hash = generate_password_hash(mot_de_passe, method='pbkdf2:sha256')
                db[USERS_COLLECTION].update_one(
                    {'email': email},
                    {'$set': {'mot_de_passe': new_hash}}
                )
                stored_hash = new_hash
            
            # Vérifier le mot de passe
            password_match = check_password_hash(stored_hash, mot_de_passe)
            
            if not password_match:
                print(f"Mot de passe incorrect pour {email}")
                return jsonify({'message': 'Email ou mot de passe incorrect'}), 401
        except Exception as password_error:
            print(f"Erreur lors de la vérification du mot de passe: {str(password_error)}")
            return jsonify({'message': f'Erreur lors de la vérification: {str(password_error)}'}), 500

        simple_token = f"EMAIL:{user['email']}"
        print(f"Connexion réussie pour: {user['email']}")
        return jsonify({
            'message': 'Connexion réussie',
            'user': {
                'nom': user['nom'],
                'email': user['email'],
                'telephone': user['telephone'],
                'role': user['role']
            },
            'token': simple_token
        }), 200

    except Exception as e:
        print(f"Erreur dans /login: {str(e)}")
        return jsonify({'message': f'Erreur serveur: {str(e)}'}), 500

# Route to check authentication status
@auth_bp.route('/me', methods=['GET'])
def me():
    try:
        token = request.headers.get('Authorization')
        print(f"Requête GET /me reçue: Authorization={token}")
        if not token:
            return jsonify({'message': 'Jeton manquant'}), 401

        # Convert token to string if necessary
        if isinstance(token, bytes):
            token = token.decode('utf-8')

        # Extract email from simplified token
        if token.startswith('Bearer '):
            token = token[7:]
            
        if not token.startswith('EMAIL:'):
            return jsonify({'message': 'Format de jeton invalide'}), 401
            
        user_email = token[6:]
        print(f"Email extrait du token: {user_email}")
        
        db = database.get_db()
        user = db[USERS_COLLECTION].find_one({'email': user_email})
        if not user:
            return jsonify({'message': 'Utilisateur non trouvé'}), 404

        print(f"Utilisateur trouvé pour /me: {user_email}")
        return jsonify({
            'user': {
                'nom': user['nom'],
                'email': user['email'],
                'telephone': user['telephone'],
                'role': user['role']
            }
        }), 200

    except Exception as e:
        print(f"Erreur dans /me: {str(e)}")
        return jsonify({'message': f'Erreur serveur: {str(e)}'}), 500

# Route to update user profile
@auth_bp.route('/update', methods=['PUT'])
def update():
    try:
        token = request.headers.get('Authorization')
        print(f"Requête PUT /update reçue: {request.get_json()}")
        if not token:
            return jsonify({'message': 'Jeton manquant'}), 401

        # Convert token to string if necessary
        if isinstance(token, bytes):
            token = token.decode('utf-8')

        # Extract email from simplified token
        if token.startswith('Bearer '):
            token = token[7:]
            
        if not token.startswith('EMAIL:'):
            return jsonify({'message': 'Format de jeton invalide'}), 401
            
        user_email = token[6:]

        data = request.get_json()
        if not isinstance(data, dict):
            print(f"Données non-JSON reçues: {request.data}")
            return jsonify({'message': 'Données JSON invalides'}), 400

        required_fields = ['nom', 'email', 'telephone']
        if not all(field in data for field in required_fields):
            return jsonify({'message': 'Tous les champs obligatoires doivent être remplis'}), 400

        # Convert inputs to strings
        nom = str(data['nom'])
        email = str(data['email'])
        telephone = str(data['telephone'])

        db = database.get_db()
        users_collection = db[USERS_COLLECTION]

        # Check if new email is already used by another user
        if email != user_email and users_collection.find_one({'email': email}):
            return jsonify({'message': 'Cet email est déjà utilisé'}), 400

        # Update user
        update_data = {
            'nom': nom,
            'email': email,
            'telephone': telephone
        }

        result = users_collection.update_one(
            {'email': user_email},
            {'$set': update_data}
        )

        if result.modified_count == 0:
            return jsonify({'message': 'Aucune modification effectuée'}), 400

        updated_user = users_collection.find_one({'email': email})
        print(f"Profil mis à jour pour: {email}")
        return jsonify({
            'message': 'Profil mis à jour',
            'user': {
                'nom': updated_user['nom'],
                'email': updated_user['email'],
                'telephone': updated_user['telephone'],
                'role': updated_user['role']
            }
        }), 200

    except Exception as e:
        print(f"Erreur dans /update: {str(e)}")
        return jsonify({'message': f'Erreur serveur: {str(e)}'}), 500

# Route for logout
@auth_bp.route('/logout', methods=['POST'])
def logout():
    try:
        token = request.headers.get('Authorization')
        print(f"Requête POST /logout reçue: Authorization={token}")
        if not token:
            return jsonify({'message': 'Jeton manquant'}), 401

        # In a real scenario, you might invalidate the token server-side
        print("Déconnexion réussie")
        return jsonify({'message': 'Déconnexion réussie'}), 200

    except Exception as e:
        print(f"Erreur dans /logout: {str(e)}")
        return jsonify({'message': f'Erreur serveur: {str(e)}'}), 500