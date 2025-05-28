from pymongo import MongoClient
from bson.binary import Binary

def migrate_binary_fields_to_strings():
    client = MongoClient('mongodb+srv://user1:souhayl2005@cluster0.e1muy.mongodb.net/')
    db = client['Entretien_ai']  
    collection = db['utilisateurs']

    for user in collection.find():
        update_needed = False
        update_fields = {}

        if isinstance(user.get('email'), Binary):
            update_fields['email'] = user['email'].decode('utf-8')
            update_needed = True
        if isinstance(user.get('mot_de_passe'), Binary):
            update_fields['mot_de_passe'] = user['mot_de_passe'].decode('utf-8')
            update_needed = True

        if update_needed:
            collection.update_one(
                {'_id': user['_id']},
                {'$set': update_fields}
            )

if __name__ == "__main__":
    migrate_binary_fields_to_strings()
    print("Migration des champs Binary vers string terminée.")
