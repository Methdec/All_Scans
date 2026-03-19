from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class HistoryCard(BaseModel):
    id: Optional[str] = None
    name: str
    found: bool

class HistoryEntry(BaseModel):
    user_id: str
    type: str  # "IMPORT" ou "EXPORT"
    status: str  # "success", "warning", "error"
    details: str
    date: datetime = Field(default_factory=datetime.utcnow)
    cards: List[HistoryCard] = []