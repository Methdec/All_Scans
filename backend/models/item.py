from pydantic import BaseModel, Field
from typing import Optional, Literal, List
from datetime import datetime

class Item(BaseModel):
    id: Optional[str] = None
    user_id: str
    # Suppression de "list", on garde folder et deck
    type: Literal["folder", "deck"] = "folder"
    nom: str
    
    # Format obligatoire si type="deck" (par défaut "standard")
    format: Optional[str] = "standard" 
    
    parent_id: Optional[str] = None
    image: Optional[str] = None
    
    # Liste d'IDs de cartes
    cards: List[str] = [] 
    
    created_at: datetime = Field(default_factory=datetime.utcnow)