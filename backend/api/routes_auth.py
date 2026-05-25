"""
MathSprint — Auth API Routes
==============================
Endpoints for user registration, login, and profile management.

POST /auth/register  — Create new account (user/teacher)
POST /auth/login     — Login (returns Firebase ID token info)
GET  /auth/profile   — Get current user profile
PUT  /auth/profile   — Update display name
"""

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth_engine import create_player_profile, get_player
from models.auth import AuthError, LoginRequest
from models.player import (
    AccountType,
    PlayerCreate,
    PlayerProfile,
    PlayerPublic,
    PlayerUpdate,
)
from services.auth_service import (
    get_current_uid,
    get_current_user_token,
    register_firebase_user,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=PlayerProfile,
    status_code=status.HTTP_201_CREATED,
    summary="Registrasi akun baru",
    description=(
        "Buat akun baru. Untuk akun tipe 'teacher', "
        "field teacher_token WAJIB diisi dengan token yang valid dari Developer."
    ),
    responses={
        400: {"model": AuthError, "description": "Data registrasi tidak valid"},
        409: {"model": AuthError, "description": "Email sudah terdaftar"},
    },
)
async def register(data: PlayerCreate):
    """
    Registrasi akun baru.

    - **user**: Registrasi biasa tanpa token
    - **teacher**: Wajib menyertakan teacher_token yang valid
    - **developer**: Tidak bisa dibuat melalui endpoint ini
    """
    try:
        from services.firestore_service import get_system_config
        config = await get_system_config()
        if data.account_type.value == "teacher" and not config.get("teacher_registration_enabled", True):
            raise ValueError("Pendaftaran akun Guru sedang dinonaktifkan.")
            
        # Create Firebase Auth user
        uid = await register_firebase_user(
            email=data.email,
            password=data.password,
            display_name=data.display_name,
            account_type=data.account_type,
        )

        # Create player profile in engine (validates teacher token, etc.)
        profile = create_player_profile(uid=uid, data=data)

        return profile

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        error_msg = str(e)
        if "EMAIL_EXISTS" in error_msg.upper():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email sudah terdaftar. Gunakan email lain atau login.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal membuat akun: {error_msg}",
        )


@router.post(
    "/login",
    summary="Login (info saja)",
    description=(
        "Endpoint ini hanya sebagai referensi. "
        "Login sebenarnya dilakukan di client-side menggunakan Firebase Auth SDK. "
        "Client mengirim email+password ke Firebase Auth, mendapat ID token, "
        "lalu gunakan token tersebut di header Authorization untuk endpoint lain."
    ),
)
async def login(data: LoginRequest):
    """
    Login dilakukan di client-side via Firebase Auth SDK.
    Endpoint ini hanya mengembalikan instruksi.
    """
    return {
        "message": "Login dilakukan di client-side menggunakan Firebase Auth SDK.",
        "instructions": {
            "step_1": "Gunakan Firebase Auth SDK di client untuk sign in dengan email & password",
            "step_2": "Dapatkan ID token dari Firebase Auth",
            "step_3": "Sertakan ID token di header: Authorization: Bearer <id_token>",
            "step_4": "Gunakan header tersebut untuk semua request ke API yang membutuhkan autentikasi",
        },
        "docs": "https://firebase.google.com/docs/auth/web/password-auth",
    }


@router.get(
    "/profile",
    response_model=PlayerProfile,
    summary="Profil user saat ini",
    description="Ambil profil lengkap user yang sedang login.",
)
async def get_profile(uid: str = Depends(get_current_uid)):
    """Ambil profil user berdasarkan token autentikasi."""
    profile = get_player(uid)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profil tidak ditemukan. Pastikan akun sudah terdaftar.",
        )
        
    # Auto-generate teacher code for existing teacher accounts that don't have one
    if profile.account_type == AccountType.TEACHER and not profile.my_teacher_code:
        import uuid
        from services.firebase_client import get_firestore_client
        db = get_firestore_client()
        
        short_id = str(uuid.uuid4()).upper()[:6]
        code = f"TEACH-{short_id}"
        
        profile.my_teacher_code = code
        db.collection("players").document(uid).update({"my_teacher_code": code})
        
    return profile


@router.put(
    "/profile",
    response_model=PlayerProfile,
    summary="Update profil",
    description="Update display name user yang sedang login.",
)
async def update_profile(
    data: PlayerUpdate,
    uid: str = Depends(get_current_uid),
):
    """Update profil user. Saat ini hanya display_name yang bisa diubah."""
    from core.auth_engine import update_player

    profile = update_player(uid, display_name=data.display_name)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profil tidak ditemukan.",
        )
    return profile


@router.get(
    "/profile/{uid}",
    response_model=PlayerPublic,
    summary="Profil publik pemain lain",
    description="Ambil profil publik pemain berdasarkan UID (tanpa data sensitif).",
)
async def get_public_profile(
    uid: str,
    _current_uid: str = Depends(get_current_uid),
):
    """Ambil profil publik pemain lain."""
    profile = get_player(uid)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pemain tidak ditemukan.",
        )
    return PlayerPublic(
        uid=profile.uid,
        display_name=profile.display_name,
        account_type=profile.account_type,
        current_rank_point=profile.current_rank_point,
        total_matches=profile.total_matches,
        wins=profile.wins,
        losses=profile.losses,
        learning_streak_days=profile.learning_streak_days,
    )

@router.get(
    "/config",
    summary="Get public system config",
    description="Mengembalikan konfigurasi sistem untuk frontend (seperti status fitur).",
)
async def get_public_config():
    from services.firestore_service import get_system_config
    config = await get_system_config()
    return {
        "matchmaking_enabled": config.get("matchmaking_enabled", False),
        "matchmaking_allow_custom_config": config.get("matchmaking_allow_custom_config", False),
        "solo_mode_enabled": config.get("solo_mode_enabled", True)
    }

from pydantic import BaseModel

class LinkTeacherRequest(BaseModel):
    teacher_code: str

@router.post(
    "/link-teacher",
    summary="Tautkan akun ke Guru",
)
async def link_teacher(
    data: LinkTeacherRequest,
    uid: str = Depends(get_current_uid),
):
    from services.firebase_client import get_firestore_client
    db = get_firestore_client()
    
    # Verify teacher code exists
    teachers = db.collection("players").where("my_teacher_code", "==", data.teacher_code).limit(1).stream()
    teacher_doc = None
    for t in teachers:
        teacher_doc = t
    
    if not teacher_doc:
        raise HTTPException(status_code=404, detail="Kode Guru tidak ditemukan")
        
    profile = get_player(uid)
    if data.teacher_code in profile.linked_teacher_codes:
        raise HTTPException(status_code=400, detail="Kode Guru sudah ditautkan")
        
    profile.linked_teacher_codes.append(data.teacher_code)
    db.collection("players").document(uid).update({"linked_teacher_codes": profile.linked_teacher_codes})
    
    return {"status": "success", "message": "Berhasil menautkan Kode Guru", "linked_teacher_codes": profile.linked_teacher_codes}

@router.get(
    "/teacher/students",
    summary="Ambil daftar siswa yang menautkan kode guru ini",
)
async def get_teacher_students(
    uid: str = Depends(get_current_uid),
):
    profile = get_player(uid)
    if profile.account_type != AccountType.TEACHER:
        raise HTTPException(status_code=403, detail="Hanya guru yang dapat mengakses data ini")
        
    if not profile.my_teacher_code:
        return []
        
    from services.firebase_client import get_firestore_client
    db = get_firestore_client()
    students_docs = db.collection("players").where("linked_teacher_codes", "array_contains", profile.my_teacher_code).stream()
    
    students = []
    for doc in students_docs:
        d = doc.to_dict()
        students.append({
            "uid": d.get("uid"),
            "display_name": d.get("display_name"),
            "current_rank_point": d.get("current_rank_point", 100),
            "total_matches": d.get("total_matches", 0),
            "win_rate": round((d.get("wins", 0) / d.get("total_matches", 1)) * 100, 1) if d.get("total_matches", 0) > 0 else 0.0
        })
        
    return students
