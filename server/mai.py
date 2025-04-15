from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .main import offers_collection, candidates_collection
from .models.offer import Offer
from .models.candidate import Candidate
from bson import ObjectId
from typing import List
import datetime

app = FastAPI()

# Enable CORS to allow requests from React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper function to convert MongoDB document to dict
def document_to_dict(doc):
    doc["_id"] = str(doc["_id"])  # Convert ObjectId to string
    return doc

# Offers Endpoints
@app.get("/api/offers", response_model=List[dict])
async def get_offers():
    offers = [document_to_dict(offer) for offer in offers_collection.find()]
    return offers

@app.post("/api/offers", response_model=dict)
async def create_offer(offer: Offer):    
    offer_dict = offer.dict()
    result = offers_collection.insert_one(offer_dict)
    offer_dict["_id"] = str(result.inserted_id)
    return offer_dict

# Candidates Endpoints
@app.get("/api/candidates", response_model=List[dict])
async def get_candidates():
    candidates = []
    for candidate in candidates_collection.find():
        candidate_dict = document_to_dict(candidate)
        # Populate offresPostulees with full offer details
        candidate_dict["offresPostulees"] = [
            document_to_dict(offers_collection.find_one({"_id": ObjectId(offer_id)}))
            for offer_id in candidate["offresPostulees"]
            if offers_collection.find_one({"_id": ObjectId(offer_id)})
        ]
        candidates.append(candidate_dict)
    return candidates

@app.post("/api/candidates", response_model=dict)
async def create_candidate(candidate: Candidate):
    candidate_dict = candidate.dict()
    candidate_dict["offresPostulees"] = [ObjectId(oid) for oid in candidate_dict["offresPostulees"]]
    result = candidates_collection.insert_one(candidate_dict)
    candidate_dict["_id"] = str(result.inserted_id)
    candidate_dict["offresPostulees"] = [
        document_to_dict(offers_collection.find_one({"_id": ObjectId(oid)}))
        for oid in candidate.offresPostulees
    ]
    return candidate_dict

@app.patch("/api/candidates/{candidate_id}", response_model=dict)
async def update_candidate(candidate_id: str, update_data: dict):
    if not ObjectId.is_valid(candidate_id):
        raise HTTPException(status_code=400, detail="Invalid candidate ID")
    existing_candidate = candidates_collection.find_one({"_id": ObjectId(candidate_id)})
    if not existing_candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Update only provided fields
    update_dict = {k: v for k, v in update_data.items() if v is not None}
    if "offresPostulees" in update_dict:
        update_dict["offresPostulees"] = [ObjectId(oid) for oid in update_dict["offresPostulees"]]
    
    candidates_collection.update_one({"_id": ObjectId(candidate_id)}, {"$set": update_dict})
    updated_candidate = candidates_collection.find_one({"_id": ObjectId(candidate_id)})
    candidate_dict = document_to_dict(updated_candidate)
    candidate_dict["offresPostulees"] = [
        document_to_dict(offers_collection.find_one({"_id": oid}))
        for oid in updated_candidate["offresPostulees"]
    ]
    return candidate_dict