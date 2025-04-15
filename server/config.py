import os
from azure.storage.blob import BlobServiceClient
from dotenv import load_dotenv
from pymongo import MongoClient
import logging

load_dotenv()
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def get_mongo_connection():
    mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017/recruitment_db')
    try:
        client = MongoClient(mongo_uri)
        db = client['recruitment_db']
        logger.info("✅ Connecté à MongoDB avec succès")
        return db
    except Exception as e:
        logger.error(f"❌ Erreur de connexion MongoDB: {str(e)}")
        raise

def init_azure_storage():
    AZURE_STORAGE_CONNECTION_STRING = os.getenv(
        'AZURE_STORAGE_CONNECTION_STRING',
        "BlobEndpoint=https://blobbyy.blob.core.windows.net/;QueueEndpoint=https://blobbyy.queue.core.windows.net/;FileEndpoint=https://blobbyy.file.core.windows.net/;TableEndpoint=https://blobbyy.table.core.windows.net/;SharedAccessSignature=sv=2024-11-04&ss=bfqt&srt=c&sp=rwdlacupiytfx&se=2025-04-29T11:59:29Z&st=2025-03-29T04:59:29Z&spr=https&sig=%2BMjO7IonOGmk8KaYf8vsZlt8VNP13ZvG5DhzlPeWqlI%3D"
    )
    AZURE_CONTAINER_NAME = os.getenv('AZURE_CONTAINER_NAME', 'blobbyy1')
    try:
        blob_service_client = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
        container_client = blob_service_client.get_container_client(AZURE_CONTAINER_NAME)
        try:
            container_client.get_container_properties()
            logger.info(f"Connecté au conteneur existant '{AZURE_CONTAINER_NAME}'")
        except Exception as e:
            if "ContainerNotFound" in str(e):
                logger.info(f"Conteneur '{AZURE_CONTAINER_NAME}' non trouvé, création en cours...")
                container_client.create_container()
                logger.info(f"Conteneur '{AZURE_CONTAINER_NAME}' créé avec succès")
            else:
                raise Exception(f"Échec de l'accès au conteneur : {str(e)}")
        return container_client
    except Exception as e:
        logger.error(f"Erreur de connexion à Azure Blob Storage : {str(e)}")
        raise

def upload_to_azure(container_client, file_content, file_name):
    try:
        blob_client = container_client.get_blob_client(file_name)
        blob_client.upload_blob(file_content, overwrite=True)
        logger.info(f"Fichier '{file_name}' téléversé avec succès vers Azure")
        return blob_client.url
    except Exception as e:
        logger.error(f"Erreur lors du téléversement vers Azure : {str(e)}")
        raise