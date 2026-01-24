from pydantic import BaseModel

class User(BaseModel):
    id: str | None = None
    nom: str
    email: str
    password: str
