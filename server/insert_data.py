from pymongo import MongoClient
from datetime import datetime, timedelta
from bson import ObjectId
import os
from faker import Faker

class InitialisateurDonnees:
    def __init__(self, db_name='DB_entretien_ai', mongo_uri='mongodb://localhost:27017/'):
        """Initialise la connexion MongoDB et les paramètres."""
        self.fake = Faker('fr_FR')
        self.client = MongoClient(mongo_uri)
        self.db_name = db_name
        self.db = None
        self.maintenant = datetime.now()

        self.ids = {
            'utilisateurs': [], 'entreprises': [], 'recruteurs': [], 'candidats': [],
            'offres': [], 'questions': [], 'candidatures': [], 'entretiens': [],
            'transcriptions': [], 'rapports': []
        }

    def initialiser_donnees(self):
        """Méthode principale pour initialiser la base de données."""
        try:
            self._preparer_base()
            self._creer_entreprises()
            self._creer_utilisateurs()
            self._creer_recruteurs()
            self._creer_candidats()
            self._creer_questions()
            self._creer_offres()
            self._creer_candidatures()
            self._creer_entretiens()
            self._creer_transcriptions()
            self._creer_rapports()
            self._afficher_resume()
        except Exception as e:
            print(f"Erreur lors de l'initialisation : {str(e)}")
            raise
        finally:
            self.client.close()

    def _preparer_base(self):
        if self.db_name in self.client.list_database_names():
            self.client.drop_database(self.db_name)
            print(f"Base de données '{self.db_name}' supprimée.")
        self.db = self.client[self.db_name]
        print(f"Nouvelle base de données '{self.db_name}' créée.")

    def _creer_entreprises(self):
        entreprises = [
            {
                "nom": "TechCorp", "secteur": "Technologie", "localisation": "Paris",
                "description": "Entreprise spécialisée dans les solutions innovantes",
                "date_creation": self.maintenant, "date_maj": self.maintenant
            },
            {
                "nom": "SoftInc", "secteur": "Informatique", "localisation": "Lyon",
                "description": "Éditeur de logiciels pour entreprises",
                "date_creation": self.maintenant, "date_maj": self.maintenant
            }
        ]
        resultat = self.db.entreprises.insert_many(entreprises)
        self.ids['entreprises'] = resultat.inserted_ids
        print(f"{len(self.ids['entreprises'])} entreprises créées.")

    def _creer_utilisateurs(self):
        utilisateurs = [
            {"nom": "Alice Dupont", "email": "alice@mail.com", "mot_de_passe": "pass123", "role": "candidat", "telephone": "0123456789", "date_creation": self.maintenant, "date_maj": self.maintenant},
            {"nom": "Bob Martin", "email": "bob@mail.com", "mot_de_passe": "pass123", "role": "candidat", "telephone": "0987654321", "date_creation": self.maintenant, "date_maj": self.maintenant},
            {"nom": "Charlie Legrand", "email": "charlie@mail.com", "mot_de_passe": "pass123", "role": "recruteur", "telephone": "0654321987", "entreprise_id": self.ids['entreprises'][0], "date_creation": self.maintenant, "date_maj": self.maintenant},
            {"nom": "Diana Lambert", "email": "diana@mail.com", "mot_de_passe": "pass123", "role": "recruteur", "telephone": "0678912345", "entreprise_id": self.ids['entreprises'][1], "date_creation": self.maintenant, "date_maj": self.maintenant}
        ]
        resultat = self.db.utilisateurs.insert_many(utilisateurs)
        self.ids['utilisateurs'] = resultat.inserted_ids
        print(f"{len(self.ids['utilisateurs'])} utilisateurs créés.")

    def _creer_recruteurs(self):
        recruteurs = [
            {"utilisateur_id": self.ids['utilisateurs'][2], "entreprise_id": self.ids['entreprises'][0], "poste": "Responsable RH", "offres_ids": [], "date_creation": self.maintenant, "date_maj": self.maintenant},
            {"utilisateur_id": self.ids['utilisateurs'][3], "entreprise_id": self.ids['entreprises'][1], "poste": "Responsable recrutement", "offres_ids": [], "date_creation": self.maintenant, "date_maj": self.maintenant}
        ]
        resultat = self.db.recruteurs.insert_many(recruteurs)
        self.ids['recruteurs'] = resultat.inserted_ids
        print(f"{len(self.ids['recruteurs'])} recruteurs créés.")

    def _creer_candidats(self):
        dossier_cv = os.path.join(os.getcwd(), "Uploads", "cv")
        os.makedirs(dossier_cv, exist_ok=True)
        candidats = [
            {"utilisateur_id": self.ids['utilisateurs'][0], "cv_path": os.path.join(dossier_cv, "cv_alice.pdf"), "competences": ["Python", "Django", "SQL"], "experience": 5, "date_creation": self.maintenant, "date_maj": self.maintenant},
            {"utilisateur_id": self.ids['utilisateurs'][1], "cv_path": os.path.join(dossier_cv, "cv_bob.pdf"), "competences": ["Java", "Spring", "Angular"], "experience": 3, "date_creation": self.maintenant, "date_maj": self.maintenant}
        ]
        resultat = self.db.candidats.insert_many(candidats)
        self.ids['candidats'] = resultat.inserted_ids
        print(f"{len(self.ids['candidats'])} candidats créés.")

    def _creer_questions(self):
        questions = [
            {"texte": "Parlez-nous de votre expérience professionnelle.", "date_creation": self.maintenant, "date_maj": self.maintenant},
            {"texte": "Comment gérez-vous les conflits en équipe?", "date_creation": self.maintenant, "date_maj": self.maintenant},
            {"texte": "Décrivez votre approche pour optimiser une requête SQL.", "date_creation": self.maintenant, "date_maj": self.maintenant},
            {"texte": "Expliquez le principe de l'injection de dépendances.", "date_creation": self.maintenant, "date_maj": self.maintenant}
        ]
        resultat = self.db.questions.insert_many(questions)
        self.ids['questions'] = resultat.inserted_ids
        print(f"{len(self.ids['questions'])} questions créées.")

    def _creer_offres(self):
        offres = [
            {"titre": "Développeur Python Senior", "description": "Nous recherchons un développeur Python expérimenté.", "entreprise_id": self.ids['entreprises'][0], "recruteur_id": self.ids['recruteurs'][0], "localisation": "Paris", "departement": "Développement", "questions_ids": [self.ids['questions'][2], self.ids['questions'][0]], "candidature_ids": [], "date_creation": self.maintenant, "date_maj": self.maintenant},
            {"titre": "Chef de Projet IT", "description": "Poste de chef de projet pour applications web.", "entreprise_id": self.ids['entreprises'][1], "recruteur_id": self.ids['recruteurs'][1], "localisation": "Lyon", "departement": "IT", "questions_ids": [self.ids['questions'][1]], "candidature_ids": [], "date_creation": self.maintenant, "date_maj": self.maintenant}
        ]
        resultat = self.db.offres.insert_many(offres)
        self.ids['offres'] = resultat.inserted_ids
        for i, offre_id in enumerate(self.ids['offres']):
            self.db.recruteurs.update_one({"_id": self.ids['recruteurs'][i]}, {"$push": {"offres_ids": offre_id}})
        print(f"{len(self.ids['offres'])} offres créées.")

    def _creer_candidatures(self):
        dossier_cv = os.path.join(os.getcwd(), "Uploads", "cv")
        os.makedirs(dossier_cv, exist_ok=True)
        candidatures = [
            {"offre_id": self.ids['offres'][0], "candidat_id": self.ids['candidats'][0], "lettre_motivation": "Je suis très intéressé par ce poste...", "cv_path": os.path.join(dossier_cv, "cv_alice.pdf"), "statut": "en_attente", "date_postulation": self.maintenant, "entretien_id": None, "date_creation": self.maintenant, "date_maj": self.maintenant},
            {"offre_id": self.ids['offres'][1], "candidat_id": self.ids['candidats'][1], "lettre_motivation": "Mon expérience correspond parfaitement...", "cv_path": os.path.join(dossier_cv, "cv_bob.pdf"), "statut": "en_attente", "date_postulation": self.maintenant, "entretien_id": None, "date_creation": self.maintenant, "date_maj": self.maintenant}
        ]
        resultat = self.db.candidatures.insert_many(candidatures)
        self.ids['candidatures'] = resultat.inserted_ids
        for i, candidature_id in enumerate(self.ids['candidatures']):
            self.db.offres.update_one({"_id": self.ids['offres'][i]}, {"$push": {"candidature_ids": candidature_id}})
        print(f"{len(self.ids['candidatures'])} candidatures créées.")

    def _creer_entretiens(self):
        entretiens = [
            {"candidature_id": self.ids['candidatures'][0], "offre_id": self.ids['offres'][0], "candidat_id": self.ids['candidats'][0], "recruteur_id": self.ids['recruteurs'][0], "date_prevue": self.maintenant + timedelta(days=7), "statut": "planifie", "transcription_ids": [], "rapport_id": None, "date_creation": self.maintenant, "date_maj": self.maintenant}
        ]
        resultat = self.db.entretiens.insert_many(entretiens)
        self.ids['entretiens'] = resultat.inserted_ids
        self.db.candidatures.update_one({"_id": self.ids['candidatures'][0]}, {"$set": {"entretien_id": self.ids['entretiens'][0]}})
        print(f"{len(self.ids['entretiens'])} entretiens créés.")

    def _creer_transcriptions(self):
        if not self.ids['entretiens']:
            print("Aucun entretien pour créer des transcriptions.")
            return
        transcriptions = [
            {"entretien_id": self.ids['entretiens'][0], "question_id": self.ids['questions'][2], "texte": "J'ai optimisé plusieurs requêtes SQL en utilisant des index...", "horodatage": self.maintenant + timedelta(minutes=10), "date_creation": self.maintenant},
            {"entretien_id": self.ids['entretiens'][0], "question_id": self.ids['questions'][0], "texte": "J'ai travaillé 5 ans chez XYZ comme développeur...", "horodatage": self.maintenant + timedelta(minutes=5), "date_creation": self.maintenant}
        ]
        resultat = self.db.transcriptions.insert_many(transcriptions)
        self.ids['transcriptions'] = resultat.inserted_ids
        self.db.entretiens.update_one({"_id": self.ids['entretiens'][0]}, {"$set": {"transcription_ids": self.ids['transcriptions']}})
        print(f"{len(self.ids['transcriptions'])} transcriptions créées.")

    def _creer_rapports(self):
        if not self.ids['entretiens']:
            print("Aucun entretien pour créer des rapports.")
            return
        rapports = [
            {"entretien_id": self.ids['entretiens'][0], "transcription_ids": self.ids['transcriptions'], "score_global": 85, "commentaires": "Excellent candidat avec une solide expérience.", "recommandation": "A embaucher", "date_creation": self.maintenant, "date_maj": self.maintenant}
        ]
        resultat = self.db.rapports.insert_many(rapports)
        self.ids['rapports'] = resultat.inserted_ids
        self.db.entretiens.update_one({"_id": self.ids['entretiens'][0]}, {"$set": {"rapport_id": self.ids['rapports'][0]}})
        print(f"{len(self.ids['rapports'])} rapports créés.")

    def _afficher_resume(self):
        print("\nRésumé de l'initialisation :")
        for categorie, ids in self.ids.items():
            print(f"{categorie.capitalize()} : {len(ids)} documents créés.")

# Pour l'exécuter
if __name__ == "__main__":
    initialiseur = InitialisateurDonnees()
    initialiseur.initialiser_donnees()
