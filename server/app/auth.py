from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import check_password_hash, generate_password_hash
from pymongo.errors import DuplicateKeyError, PyMongoError
import datetime
import logging
from bson.objectid import ObjectId

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)

# Standardized collection names
USERS_COLLECTION = 'utilisateurs'
RECRUITERS_COLLECTION = 'recruteurs'
CANDIDATES_COLLECTION = 'candidats'

# Helper function to get JWT manager
def get_jwt_manager():
    from jwt_manager import jwt_manager
    return jwt_manager

# Route for user registration
@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        if not isinstance(data, dict):
            logger.error(f"Données non-JSON reçues: {request.data}")
            return jsonify({'message': 'Données JSON invalides'}), 400

        # Extraction des données
        email = data.get('email')
        mot_de_passe = data.get('mot_de_passe')
        nom = data.get('nom')
        telephone = data.get('telephone')
        role = data.get('role')
        nomEntreprise = data.get('nomEntreprise')
        

        # Validation des champs requis
        required_fields = ['email', 'mot_de_passe', 'nom', 'telephone', 'role']
        missing_fields = [f for f in required_fields if not data.get(f)]
        if missing_fields:
            logger.error(f"Champs manquants: {missing_fields}")
            return jsonify({'message': f'Champs requis manquants: {", ".join(missing_fields)}'}), 400

        # Validation du rôle
        if role not in ['candidat', 'recruteur']:
            logger.error(f"Rôle invalide: {role}")
            return jsonify({'message': "Rôle invalide. Doit être 'candidat' ou 'recruteur'"}), 400

        # Pour les recruteurs, validation du nom de l'entreprise
        if role == 'recruteur':
            if not nomEntreprise:
                logger.error("Nom de l'entreprise manquant")
                return jsonify({'message': "Le nom de l'entreprise est requis pour les recruteurs"}), 400

        # Validation du mot de passe
        if len(mot_de_passe) < 8 or not any(c.isupper() for c in mot_de_passe) or not any(c.isdigit() for c in mot_de_passe):
            logger.error("Mot de passe ne respecte pas les critères")
            return jsonify({'message': 'Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre'}), 400

        # Validation de l'email
        if not email or '@' not in email:
            logger.error("Format d'email invalide")
            return jsonify({'message': 'Format d\'email invalide'}), 400

        # Hash du mot de passe
        hashed_password = generate_password_hash(mot_de_passe, method='pbkdf2:sha256')

        # Date de création
        now = datetime.datetime.utcnow()

        # Création du document utilisateur
        user = {
            'nom': nom,
            'email': email,
            'mot_de_passe': hashed_password,
            'telephone': telephone,
            'role': role,
            'created_at': now
        }

        if role == 'recruteur':
            user['nomEntreprise'] = nomEntreprise

        # Insertion de l'utilisateur
        db = current_app.mongo
        try:
            result = db[USERS_COLLECTION].insert_one(user)
        except DuplicateKeyError:
            logger.error(f"Email déjà utilisé: {email}")
            return jsonify({'message': 'Cet email est déjà utilisé'}), 400

        user_id = result.inserted_id

        # Si c'est un recruteur, créer un document dans la collection recruteurs
        if role == 'recruteur':
            recruteur = {
                'utilisateur_id': user_id,
                'status': 'active',
                'nomEntreprise': nomEntreprise,
                'created_at': now
            }
            recruteur_result = db[RECRUITERS_COLLECTION].insert_one(recruteur)
            recruteur_id = recruteur_result.inserted_id
        # Si c'est un candidat, créer un document dans la collection candidats
        elif role == 'candidat':
            candidat = {
                'date_creation': now,
                'statut': 'en recherche',
                'utilisateur_id': user_id
                
            }
            candidat_result = db[CANDIDATES_COLLECTION].insert_one(candidat)
            candidat_id = candidat_result.inserted_id

        # Génération du token
        token_payload = {
            'sub': str(user_id),
            'role': role,
            'exp': (now + datetime.timedelta(hours=24)).timestamp(),
            'iat': now.timestamp()
        }

        token = get_jwt_manager().create_token(token_payload)

        logger.info(f"Utilisateur créé avec succès: {email}")
        return jsonify({
            'message': 'Inscription réussie',
            'token': token,
            'user': {
                '_id': str(user_id),
                'nom': nom,
                'email': email,
                'telephone': telephone,
                'role': role,
                'nomEntreprise': nomEntreprise
            }
        }), 201

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans /register: {str(e)}")
        return jsonify({'message': 'Erreur de base de données'}), 500
    except Exception as e:
        logger.error(f"Erreur dans /register: {str(e)}")
        return jsonify({'message': f'Erreur serveur: {str(e)}'}), 500

# Route for user login
@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if not isinstance(data, dict):
            logger.error(f"Données non-JSON reçues: {request.data}")
            return jsonify({'message': 'Données JSON invalides'}), 400

        email = data.get('email')
        mot_de_passe = data.get('mot_de_passe')
        if not email or not mot_de_passe:
            logger.error("Email ou mot de passe manquant")
            return jsonify({'message': 'Email et mot de passe requis'}), 400

        # Get MongoDB connection
        db = current_app.mongo
        user = db[USERS_COLLECTION].find_one({'email': email})
        if not user:
            logger.error(f"Utilisateur avec email {email} non trouvé")
            return jsonify({'message': 'Email ou mot de passe incorrect'}), 401

        # Vérifier le mot de passe
        if not check_password_hash(user['mot_de_passe'], mot_de_passe):
            logger.error(f"Mot de passe incorrect pour {email}")
            return jsonify({'message': 'Email ou mot de passe incorrect'}), 401

        user_id = user['_id']

        # Créer un token JWT
        token_payload = {
            'sub': str(user_id),
            'role': user['role'],
            'exp': (datetime.datetime.utcnow() + datetime.timedelta(hours=24)).timestamp(),
            'iat': datetime.datetime.utcnow().timestamp()
        }

        token = get_jwt_manager().create_token(token_payload)

        # Crée la réponse utilisateur
        user_response = {
            '_id': str(user_id),
            'nom': user['nom'],
            'email': user['email'],
            'telephone': user['telephone'],
            'role': user['role'],
            'nomEntreprise': user.get('nomEntreprise')
        }

        logger.info(f"Connexion réussie pour: {email}")
        return jsonify({
            'message': 'Connexion réussie',
            'user': user_response,
            'token': token
        }), 200

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans /login: {str(e)}")
        return jsonify({'message': 'Erreur de base de données'}), 500
    except Exception as e:
        logger.error(f"Erreur dans /login: {str(e)}")
        return jsonify({'message': f'Erreur serveur: {str(e)}'}), 500

# Route to check authentication status
@auth_bp.route('/me', methods=['GET'])
def me():
    try:
        token = request.headers.get('Authorization')
        if not token:
            logger.warning("Jeton manquant")
            return jsonify({'message': 'Jeton manquant'}), 401

        try:
            user_id = get_jwt_manager().verify_token(token)
        except Exception as e:
            logger.warning(f"Erreur de vérification du jeton: {str(e)}")
            return jsonify({'message': str(e)}), 401

        db = current_app.mongo
        user = db[USERS_COLLECTION].find_one({'_id': ObjectId(user_id)})
        if not user:
            logger.error(f"Utilisateur non trouvé pour l'ID: {user_id}")
            return jsonify({'message': 'Utilisateur non trouvé'}), 404

        user_data = {
            '_id': str(user['_id']),
            'nom': user['nom'],
            'email': user['email'],
            'telephone': user['telephone'],
            'role': user['role'],
            'nomEntreprise': user.get('nomEntreprise')
        }

        logger.info(f"Données utilisateur retournées pour: {user_data['email']}")
        return jsonify({'user': user_data}), 200
    except Exception as e:
        logger.error(f"Erreur dans /me: {str(e)}")
        return jsonify({'message': f'Erreur serveur: {str(e)}'}), 500

# Route to update user profile
@auth_bp.route('/update', methods=['PUT'])
def update():
    try:
        token = request.headers.get('Authorization')
        if not token:
            logger.warning("Jeton manquant")
            return jsonify({'message': 'Jeton manquant'}), 401

        try:
            user_email = get_jwt_manager().verify_token(token)
        except Exception as e:
            logger.warning(f"Erreur de vérification du jeton: {str(e)}")
            return jsonify({'message': str(e)}), 401

        data = request.get_json()
        if not data:
            logger.warning("Aucune donnée fournie pour la mise à jour")
            return jsonify({'message': 'Aucune donnée fournie'}), 400

        db = current_app.mongo
        user = db[USERS_COLLECTION].find_one({'email': user_email})
        if not user:
            logger.error(f"Utilisateur non trouvé pour l'email: {user_email}")
            return jsonify({'message': 'Utilisateur non trouvé'}), 404

        # Fields that can be updated
        updatable_fields = ['nom', 'telephone', 'nomEntreprise']
        
        # Prepare update data
        update_data = {}
        for field in updatable_fields:
            if field in data:
                update_data[field] = data[field]
        
        if not update_data:
            logger.warning("Aucun champ valide à mettre à jour")
            return jsonify({'message': 'Aucun champ valide à mettre à jour'}), 400
        
        # Update the user
        result = db[USERS_COLLECTION].update_one(
            {'_id': user['_id']},
            {'$set': update_data}
        )

        if result.modified_count == 0:
            logger.info("Aucune modification effectuée")
            return jsonify({'message': 'Aucune modification effectuée'}), 200

        # If it's a recruiter, update the recruiter document as well
        if user['role'] == 'recruteur':
            recruteur_update = {}
            if 'nom' in update_data:
                recruteur_update['nom'] = update_data['nom']
            if 'telephone' in update_data:
                recruteur_update['telephone'] = update_data['telephone']
            if 'nomEntreprise' in update_data:
                recruteur_update['nomEntreprise'] = update_data['nomEntreprise']
            
            if recruteur_update:
                db[RECRUITERS_COLLECTION].update_one(
                    {'utilisateur_id': user['_id']},
                    {'$set': recruteur_update}
                )
        
        # Fetch updated user
        updated_user = db[USERS_COLLECTION].find_one({'_id': user['_id']})
        user_data = {
                '_id': str(updated_user['_id']),
                'nom': updated_user['nom'],
                'email': updated_user['email'],
                'telephone': updated_user['telephone'],
                'role': updated_user['role'],
            'nomEntreprise': updated_user.get('nomEntreprise')
            }
        
        logger.info(f"Profil mis à jour pour: {user_data['email']}")
        return jsonify({
            'message': 'Profil mis à jour avec succès',
            'user': user_data
        }), 200

    except PyMongoError as e:
        logger.error(f"Erreur MongoDB dans /update: {str(e)}")
        return jsonify({'message': 'Erreur de base de données'}), 500
    except Exception as e:
        logger.error(f"Erreur dans /update: {str(e)}")
        return jsonify({'message': f'Erreur serveur: {str(e)}'}), 500

# Route for logout
@auth_bp.route('/logout', methods=['POST'])
def logout():
    try:
        token = request.headers.get('Authorization')
        if not token:
            logger.warning("Jeton manquant")
            return jsonify({'message': 'Jeton manquant'}), 401

        # On essaie de vérifier le token, mais on ne s'inquiète pas s'il est déjà invalidé
        try:
            get_jwt_manager().verify_token(token)
        except Exception as e:
            logger.warning(f"Erreur de vérification du jeton: {str(e)}")
            # On continue quand même car on veut blacklister le token de toute façon

        # Blacklist the token
        if get_jwt_manager().blacklist_token(token):
            logger.info("Jeton ajouté à la liste noire")
        else:
            logger.warning("Erreur lors de l'ajout du jeton à la liste noire")

        return jsonify({'message': 'Déconnexion réussie'}), 200

    except Exception as e:
        logger.error(f"Erreur dans /logout: {str(e)}")
        return jsonify({'message': f'Erreur serveur: {str(e)}'}), 500