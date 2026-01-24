# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.user_routes import router as user_router
from routes.card_routes import router as card_router
from routes.auth_routes import router as auth_router
from routes.user_card_routes import router as user_card_router
from routes.item_routes import router as item_router

app = FastAPI(title="All Scans API")

# ✅ Middleware CORS complet
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Inclusion des routes (ordre important pour éviter conflits)
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(user_router)
app.include_router(user_card_router)
app.include_router(card_router)
app.include_router(item_router)

@app.get("/")
def home():
    return {"message": "✅ Backend All Scans opérationnel"}
