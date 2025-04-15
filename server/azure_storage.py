from azure.storage.blob import BlobServiceClient
import os
import uuid
from datetime import datetime, timedelta

# Updated connection string with container permissions
AZURE_STORAGE_CONNECTION_STRING = "BlobEndpoint=https://blobbyy.blob.core.windows.net/;QueueEndpoint=https://blobbyy.queue.core.windows.net/;FileEndpoint=https://blobbyy.file.core.windows.net/;TableEndpoint=https://blobbyy.table.core.windows.net/;SharedAccessSignature=sv=2024-11-04&ss=bfqt&srt=c&sp=rwdlacupiytfx&se=2025-04-29T11:59:29Z&st=2025-03-29T04:59:29Z&spr=https&sig=%2BMjO7IonOGmk8KaYf8vsZlt8VNP13ZvG5DhzlPeWqlI%3D"
AZURE_CONTAINER_NAME = 'blobbyy1'

try:
    # Initialize clients
    blob_service_client = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
    container_client = blob_service_client.get_container_client(AZURE_CONTAINER_NAME)
    
    # Check if container exists, create if not
    try:
        container_client.get_container_properties()
        print(f"Connected to existing container '{AZURE_CONTAINER_NAME}'")
    except Exception as e:
        if "ContainerNotFound" in str(e):
            print(f"Container '{AZURE_CONTAINER_NAME}' not found, creating...")
            container_client.create_container()
        else:
            raise

except Exception as e:
    raise Exception(f"Azure Blob Storage connection error: {e}")

