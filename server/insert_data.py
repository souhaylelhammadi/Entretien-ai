from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timezone
import random

# MongoDB connection
client = MongoClient("mongodb://localhost:27017/recruitment_platform_ia")
db = client.recruitment_platform_ia

# Clear collections
db.offres.drop()
db.candidates.drop()
db.candidatures.drop()

# Sample data
entreprises = [
    {"_id": ObjectId(), "nom": "TechCorp", "secteur": "Technologie"},
    {"_id": ObjectId(), "nom": "HealthInc", "secteur": "Santé"},
]
recruteurs = [
    {"_id": ObjectId(), "nom": "Alice Martin"},
    {"_id": ObjectId(), "nom": "Bob Dupont"},
]
offres = [
    {
        "_id": ObjectId(),
        "titre": "Développeur Full Stack",
        "description": "Développeur JS/React/Node",
        "localisation": "Paris",
        "salaire_min": 50000,
        "competences_requises": ["JavaScript", "React", "Node.js"],
        "entreprise": {"_id": entreprises[0]["_id"], "nom": "TechCorp", "secteur": "Technologie"},
        "recruteur": {"_id": recruteurs[0]["_id"], "nom": "Alice Martin"},
        "candidature_ids": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    },
    {
        "_id": ObjectId(),
        "titre": "Data Scientist",
        "description": "Analyse de données",
        "localisation": "Lyon",
        "salaire_min": 60000,
        "competences_requises": ["Python", "Pandas", "Machine Learning"],
        "entreprise": {"_id": entreprises[1]["_id"], "nom": "HealthInc", "secteur": "Santé"},
        "recruteur": {"_id": recruteurs[1]["_id"], "nom": "Bob Dupont"},
        "candidature_ids": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    },
    # Add 13 more offers
    *[
        {
            "_id": ObjectId(),
            "titre": f"Poste {i}",
            "description": f"Description du poste {i}",
            "localisation": random.choice(["Paris", "Lyon", "Marseille"]),
            "salaire_min": random.randint(40000, 80000),
            "competences_requises": random.sample(
                ["Python", "Java", "SQL", "React", "Docker"], 3
            ),
            "entreprise": random.choice(entreprises),
            "recruteur": random.choice(recruteurs),
            "candidature_ids": [],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        for i in range(3, 16)
    ],
]

candidates = [
    {
        "_id": ObjectId(),
        "nom": f"Candidat {i}",
        "email": f"candidat{i}@example.com",
        "telephone": f"01234567{i:02d}",
        "cv": f"Uploads/cv_{i}.pdf",
        "lettre_motivation": f"Lettre de motivation du candidat {i}",
        "created_at": datetime.now(timezone.utc),
    }
    for i in range(1, 31)
]

candidatures = []
for i, candidate in enumerate(candidates):
    offre = random.choice(offres)
    candidature = {
        "_id": ObjectId(),
        "candidate_id": candidate["_id"],
        "offre_id": offre["_id"],
        "statut": "en_attente",
        "date_postulation": datetime.now(timezone.utc),
        "cv_path": candidate["cv"],
        "lettre_motivation": candidate["lettre_motivation"],
    }
    candidatures.append(candidature)
    # Update offre
    for o in offres:
        if o["_id"] == offre["_id"]:
            o["candidature_ids"].append(candidature["_id"])

# Insert data
db.entreprises.insert_many(entreprises)
db.recruteurs.insert_many(recruteurs)
db.offres.insert_many(offres)
db.candidates.insert_many(candidates)
db.candidatures.insert_many(candidatures)

print(f"Inserted {len(offres)} offres, {len(candidates)} candidates, {len(candidatures)} candidatures")
client.close()