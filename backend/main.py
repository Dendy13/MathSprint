"""
MathSprint — FastAPI Application Entry Point
==============================================

Backend server untuk MathSprint, platform aritmatika kompetitif real-time.

Features:
  - Math question generation (add, sub, mul, div)
  - Room-based multiplayer with synchronized questions
  - Elo Rating system with Learning Protection
  - 3-tier account system (User / Teacher / Developer)
  - Friend system with room invitations
  - Teacher token management

Stack:
  - Python 3.11 + FastAPI
  - Firebase (Auth + Firestore)
  - Pydantic v2 for all schemas
  - Deployment: Google Cloud Run

Docs: http://localhost:8080/docs (Swagger UI)
"""

import logging
import os

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env file for local development
load_dotenv()

# ============================================================
# APP INITIALIZATION
# ============================================================

app = FastAPI(
    title="MathSprint API",
    description=(
        "Backend API untuk MathSprint — platform aritmatika kompetitif real-time "
        "dengan sistem Rank (Elo Rating), Room multiplayer, Friend System, "
        "dan 3-tier account management."
    ),
    version="2.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=[
        {
            "name": "Health",
            "description": "Server health check",
        },
        {
            "name": "Authentication",
            "description": "Registrasi, login, dan manajemen profil",
        },
        {
            "name": "Game",
            "description": "Generate soal, buat/join room, dan gameplay",
        },
        {
            "name": "Match & Ranking",
            "description": "Submit hasil match, kalkulasi Elo, dan leaderboard",
        },
        {
            "name": "Friends",
            "description": "Sistem pertemanan dan undangan room",
        },
        {
            "name": "Admin (Developer Only)",
            "description": "Manajemen token guru dan statistik sistem",
        },
    ],
)


cors_origins_raw = os.getenv(
    "CORS_ORIGINS", 
    "https://mathsprint-frontend-447876034135.asia-southeast2.run.app,https://mathsprint-447876034135.asia-southeast2.run.app,http://localhost:5173,http://localhost:3000"
)
# Bersihkan trailing slash (/) karena CORS mencocokkan string secara eksak
cors_origins = [origin.strip().rstrip("/") for origin in cors_origins_raw.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# ROUTER REGISTRATION
# ============================================================

from api.routes_auth import router as auth_router
from api.routes_game import router as game_router
from api.routes_match import router as match_router
from api.routes_friend import router as friend_router
from api.routes_admin import router as admin_router

app.include_router(auth_router)
app.include_router(game_router)
app.include_router(match_router)
app.include_router(friend_router)
app.include_router(admin_router)


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get(
    "/",
    tags=["Health"],
    summary="Health check",
    description="Cek apakah server berjalan dengan benar.",
)
async def health_check():
    """Root endpoint — health check sederhana."""
    return {
        "status": "healthy",
        "service": "mathsprint-backend",
        "version": "2.1.0",
        "environment": os.getenv("ENVIRONMENT", "development"),
    }


@app.get(
    "/health",
    tags=["Health"],
    summary="Detailed health check",
)
async def detailed_health():
    """Detailed health check dengan info Firebase."""
    firebase_status = "not_initialized"
    try:
        from services.firebase_client import _app
        if _app is not None:
            firebase_status = "connected"
    except Exception:
        firebase_status = "error"

    return {
        "status": "healthy",
        "service": "mathsprint-backend",
        "version": "2.1.0",
        "environment": os.getenv("ENVIRONMENT", "development"),
        "firebase": firebase_status,
        "cors_origins": cors_origins,
    }


# ============================================================
# STARTUP EVENT
# ============================================================

@app.on_event("startup")
async def startup_event():
    """
    Initialize Firebase on startup.
    Di production (Cloud Run), ini menggunakan Application Default Credentials.
    Di local dev, ini membaca serviceAccountKey.json dari path di .env.
    """
    environment = os.getenv("ENVIRONMENT", "development")
    logging.info("🚀 MathSprint Backend v2.1.0 starting in %s mode...", environment)

    # Initialize Firebase (optional — will fail gracefully if no credentials)
    try:
        from services.firebase_client import initialize_firebase
        initialize_firebase()
        logging.info("✅ Firebase initialized successfully")
    except Exception as e:
        logging.warning("⚠️  Firebase initialization skipped: %s", e)
        logging.warning("   Running in stateless/mock mode (in-memory stores)")

    logging.info("📚 API docs: http://localhost:%s/docs", os.getenv('PORT', '8080'))
    logging.info("🌐 CORS origins: %s", cors_origins)
