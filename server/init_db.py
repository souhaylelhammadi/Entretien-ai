from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timedelta
import logging
from werkzeug.security import generate_password_hash

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_database():
    try:
        # Connexion à MongoDB
        client = MongoClient('mongodb://localhost:27017/')
        db = client['Entretien_ai']
        logger.info("Connexion à MongoDB établie")

        # Création des collections selon le modèle UML
        collections = [
            'utilisateurs',    # Stocke tous les utilisateurs (recruteurs et candidats)
            'recruteurs',      # Stocke les profils spécifiques aux recruteurs
            'candidats',       # Stocke les profils spécifiques aux candidats
            'offres',          # Stocke les offres d'emploi
            'candidatures',    # Stocke les candidatures aux offres
            'entretiens',      # Stocke les entretiens programmés
            'activities'       # Stocke les activités des utilisateurs
        ]
        
        for collection in collections:
            if collection not in db.list_collection_names():
                db.create_collection(collection)
                logger.info(f"Collection {collection} créée")

        # Nettoyage des collections existantes
        for collection in collections:
            db[collection].delete_many({})
            logger.info(f"Collection {collection} nettoyée")

        # Date de référence
        now = datetime.utcnow()

        # Création d'un utilisateur recruteur
        recruteur_user_id = ObjectId("681757a959664a841e91dd4b")
        recruteur_user = {
            "_id": recruteur_user_id,
            "nom": "John Doe",
            "email": "recruteur@example.com",
            "mot_de_passe": generate_password_hash("Recruteur123", method='pbkdf2:sha256'),
            "telephone": "0123456789",
            "role": "recruteur",
            "created_at": now,
            "entreprise": {
                "nom": "TechCorp",
                "description": "Entreprise spécialisée dans les solutions innovantes",
                "secteurActivite": "Technologie",
                "taille": "50-250 employés"
            }
        }
        db.utilisateurs.insert_one(recruteur_user)
        logger.info("Utilisateur recruteur créé")

        # Création d'un profil recruteur
        recruteur_id = ObjectId("681757a959664a841e91dd4c")
        recruteur = {
            "_id": recruteur_id,
            "utilisateur_id": recruteur_user_id,
            "status": "active",
            "created_at": now
        }
        db.recruteurs.insert_one(recruteur)
        logger.info("Profil recruteur créé")

        # Création d'un utilisateur candidat
        candidat_user_id = ObjectId("681757a959664a841e91dd4d")
        candidat_user = {
            "_id": candidat_user_id,
            "nom": "Jane Smith",
            "email": "candidat@example.com",
            "mot_de_passe": generate_password_hash("Candidat123", method='pbkdf2:sha256'),
            "telephone": "0987654321",
            "role": "candidat",
            "created_at": now
        }
        db.utilisateurs.insert_one(candidat_user)
        logger.info("Utilisateur candidat créé")

        # Création d'un profil candidat
        candidat_id = ObjectId("681757a959664a841e91dd4e")
        candidat = {
            "_id": candidat_id,
            "date_creation": now,
            "statut": "en recherche",
            "competences": ["JavaScript", "Python", "React"]
        }
        db.candidats.insert_one(candidat)
        logger.info("Profil candidat créé")

        # Création d'offres d'emploi
        offres = [
            {
                "_id": ObjectId("681757a959664a841e91dd4f"),
                "titre": "Développeur Full Stack",
                "description": "Nous recherchons un développeur full stack expérimenté pour rejoindre notre équipe.",
                "localisation": "Paris",
                "departement": "Développement",
                "entreprise": "TechCorp",
                "recruteur_id": recruteur_id,
                "date_creation": now,
                "date_maj": now,
                "statut": "ouverte",
                "competences_requises": ["JavaScript", "Node.js", "React", "MongoDB"],
                "questions_ids": [],
                "candidature_ids": []
            },
            {
                "_id": ObjectId("681757a959664a841e91dd50"),
                "titre": "DevOps Engineer",
                "description": "Nous recherchons un ingénieur DevOps pour notre infrastructure cloud.",
                "localisation": "Lyon",
                "departement": "Opérations",
                "entreprise": "TechCorp",
                "recruteur_id": recruteur_id,
                "date_creation": now - timedelta(days=15),
                "date_maj": now - timedelta(days=10),
                "statut": "ouverte",
                "competences_requises": ["Docker", "Kubernetes", "AWS", "CI/CD"],
                "questions_ids": [],
                "candidature_ids": []
            },
            {
                "_id": ObjectId("681757a959664a841e91dd51"),
                "titre": "Data Scientist",
                "description": "Nous recherchons un data scientist pour analyser nos données.",
                "localisation": "Marseille",
                "departement": "Data",
                "entreprise": "TechCorp",
                "recruteur_id": recruteur_id,
                "date_creation": now - timedelta(days=30),
                "date_maj": now - timedelta(days=5),
                "statut": "ouverte",
                "competences_requises": ["Python", "Machine Learning", "SQL", "Data Analysis"],
                "questions_ids": [],
                "candidature_ids": []
            }
        ]
        
        db.offres.insert_many(offres)
        logger.info("Offres d'emploi créées")

        # Création d'une candidature
        candidature_id = ObjectId("681757a959664a841e91dd52")
        candidature = {
            "_id": candidature_id,
            "user_email": candidat_user["email"],
            "offre_id": offres[0]["_id"],
            "lettre_motivation": "Je suis très intéressé par ce poste car...",
            "cv_path": "/uploads/cv_jane_smith.pdf",
            "created_at": now - timedelta(days=5)
        }
        db.candidatures.insert_one(candidature)
        logger.info("Candidature créée")

        # Mise à jour de l'offre avec l'ID de la candidature
        db.offres.update_one(
            {"_id": offres[0]["_id"]},
            {"$push": {"candidature_ids": candidature_id}}
        )

        # Création d'un entretien
        entretien = {
            "_id": ObjectId("681757a959664a841e91dd53"),
            "recruteur_id": recruteur_id,
            "candidate_name": candidat_user["nom"],
            "job_title": offres[0]["titre"],
            "date": now + timedelta(days=3),
            "statut": "planifié"
        }
        db.entretiens.insert_one(entretien)
        logger.info("Entretien créé")

        # Création d'activités
        activities = [
            {
                "_id": ObjectId("681757a959664a841e91dd54"),
                "user_id": str(recruteur_user_id),
                "date": now - timedelta(days=2),
                "description": "A créé une nouvelle offre d'emploi: Développeur Full Stack"
            },
            {
                "_id": ObjectId("681757a959664a841e91dd55"),
                "user_id": str(candidat_user_id),
                "date": now - timedelta(days=5),
                "description": "A postulé à l'offre: Développeur Full Stack"
            },
            {
                "_id": ObjectId("681757a959664a841e91dd56"),
                "user_id": str(recruteur_user_id),
                "date": now - timedelta(days=1),
                "description": "A planifié un entretien avec Jane Smith"
            }
        ]
        db.activities.insert_many(activities)
        logger.info("Activités créées")

        logger.info("Initialisation de la base de données terminée avec succès")
        return True

    except Exception as e:
        logger.error(f"Erreur lors de l'initialisation de la base de données: {str(e)}")
        return False

if __name__ == "__main__":
    init_database() 