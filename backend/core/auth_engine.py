"""
MathSprint — Auth Engine
=========================
Handles teacher token generation/validation and account creation logic.

Account Hierarchy:
  Developer → Creates TeacherTokens
  Teacher   → Registers with TeacherToken (one-time-use)
  User      → Standard registration (no token required)
"""

import secrets
import uuid
from datetime import datetime, timedelta
from typing import Dict, Optional

from models.auth import TeacherToken, TokenCreate
from models.player import AccountType, PlayerCreate, PlayerProfile


from services.firebase_client import get_firestore_client


def get_db():
    return get_firestore_client()


def generate_teacher_token(
    developer_uid: str,
    developer_name: str,
    token_request: TokenCreate,
) -> TeacherToken:
    """
    Generate token registrasi guru. Hanya Developer yang boleh memanggil ini.
    Token bersifat ONE-TIME-USE: setelah dipakai oleh satu guru, hangus.
    """
    token_id = str(uuid.uuid4())
    token_value = secrets.token_urlsafe(16)

    expires_at = None
    if token_request.expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=token_request.expires_in_days)

    token = TeacherToken(
        token_id=token_id,
        token_value=token_value,
        created_by=developer_uid,
        created_by_name=developer_name,
        label=token_request.label,
        expires_at=expires_at,
        created_at=datetime.utcnow(),
    )

    db = get_db()
    db.collection("teacher_tokens").document(token_id).set(token.dict())
    return token


def validate_teacher_token(token_value: str) -> Optional[TeacherToken]:
    """
    Validasi token guru saat registrasi.
    """
    db = get_db()
    # Query for the token value
    docs = db.collection("teacher_tokens").where("token_value", "==", token_value).limit(1).stream()
    
    for doc in docs:
        token = TeacherToken(**doc.to_dict())
        if token.is_used or token.is_revoked:
            return None
        # Check expiry
        if token.expires_at and datetime.utcnow().replace(tzinfo=None) > token.expires_at.replace(tzinfo=None):
            return None
        return token
    return None


def use_teacher_token(token_value: str, teacher_uid: str, teacher_name: str) -> bool:
    """
    Tandai token sebagai sudah dipakai oleh guru.
    """
    token = validate_teacher_token(token_value)
    if token is None:
        return False

    token.is_used = True
    token.used_by = teacher_uid
    token.used_by_name = teacher_name
    token.used_at = datetime.utcnow()

    db = get_db()
    db.collection("teacher_tokens").document(token.token_id).set(token.dict())
    return True


def revoke_teacher_token(token_id: str, developer_uid: str) -> bool:
    """
    Cabut token guru (developer only).
    """
    db = get_db()
    doc_ref = db.collection("teacher_tokens").document(token_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        return False
        
    token = TeacherToken(**doc.to_dict())
    if token.created_by != developer_uid:
        return False

    token.is_revoked = True
    doc_ref.set(token.dict())
    return True


def list_tokens(developer_uid: str) -> list[TeacherToken]:
    """
    Daftar semua token yang dibuat oleh developer tertentu.
    """
    db = get_db()
    docs = db.collection("teacher_tokens").where("created_by", "==", developer_uid).stream()
    return [TeacherToken(**doc.to_dict()) for doc in docs]


def create_player_profile(
    uid: str,
    data: PlayerCreate,
) -> PlayerProfile:
    """
    Buat profil pemain baru di Firestore.
    """
    if data.account_type == AccountType.TEACHER:
        if not data.teacher_token:
            raise ValueError("Token guru wajib diisi untuk akun teacher")
        token = validate_teacher_token(data.teacher_token)
        if token is None:
            raise ValueError(
                "Token guru tidak valid, sudah dipakai, atau sudah expired"
            )
        use_teacher_token(data.teacher_token, uid, data.display_name)

    if data.account_type == AccountType.DEVELOPER:
        raise ValueError("Akun developer tidak bisa dibuat melalui registrasi biasa")

    profile = PlayerProfile(
        uid=uid,
        display_name=data.display_name,
        email=data.email,
        account_type=data.account_type,
    )

    db = get_db()
    db.collection("players").document(uid).set(profile.dict())
    return profile


def get_player(uid: str) -> Optional[PlayerProfile]:
    """Ambil profil pemain berdasarkan UID dari Firestore."""
    db = get_db()
    doc = db.collection("players").document(uid).get()
    if doc.exists:
        data = doc.to_dict()
        # Handle datetime parsing from Firestore DatetimeWithNanoseconds if needed
        return PlayerProfile(**data)
    return None


def update_player(uid: str, **kwargs) -> Optional[PlayerProfile]:
    """Update field tertentu di profil pemain di Firestore."""
    db = get_db()
    doc_ref = db.collection("players").document(uid)
    doc = doc_ref.get()
    
    if not doc.exists:
        return None

    # Filter out None values and update last_active
    update_data = {k: v for k, v in kwargs.items() if v is not None}
    update_data["last_active"] = datetime.utcnow()
    
    doc_ref.update(update_data)
    
    # Return updated profile
    updated_doc = doc_ref.get()
    return PlayerProfile(**updated_doc.to_dict())

