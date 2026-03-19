from pydantic import BaseModel
from typing import Optional

class User(BaseModel):
    id: Optional[str] = None
    nom: str
    email: str
    password: str
    avatar: Optional[str] = None