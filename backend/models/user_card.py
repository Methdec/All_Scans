from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class UserCard(BaseModel):
    user_id: str
    card_id: str              # ID Scryfall
    count: int = Field(default=1, ge=1)
    added_at: datetime = Field(default_factory=datetime.utcnow)
