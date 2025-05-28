
from flask import current_app
from pymongo import MongoClient
from bson.binary import Binary

client = MongoClient('mongodb+srv://user1:souhayl2005@cluster0.e1muy.mongodb.net/')
db = client['Entretien_ai']  
collection = db['utilisateurs']

for user in collection.find():
    if isinstance(user['email'], Binary):
        collection.update_one(
            {'_id': user['_id']},
            {'$set': {'email': user['email'].decode('utf-8')}}
        )
    if isinstance(user['mot_de_passe'], Binary):
        collection.update_one(
            {'_id': user['_id']},
            {'$set': {'mot_de_passe': user['mot_de_passe'].decode('utf-8')}}
        )
def get_db():
    """
    Retourne l'objet base de données MongoDB depuis l'application Flask courante.
    """
    client = MongoClient(current_app.config["MONGODB_URI"])
    db = client.get_database()  # Récupère le nom de la base depuis l'URI
    return db