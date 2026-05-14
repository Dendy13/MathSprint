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


# In-memory stores (will be replaced by Firestore)
_teacher_tokens: Dict[str, TeacherToken] = {}
_players: Dict[str, PlayerProfile] = {}


def generate_teacher_token(
    developer_uid: str,
    developer_name: str,
    token_request: TokenCreate,
) -> TeacherToken:
    """
    Generate token registrasi guru. Hanya Developer yang boleh memanggil ini.

    Token bersifat ONE-TIME-USE: setelah dipakai oleh satu guru, hangus.

    Args:
        developer_uid: UID developer yang membuat token
        developer_name: Nama developer pembuat
        token_request: Konfigurasi token (label, expires_in_days)

    Returns:
        TeacherToken yang siap diberikan ke guru
    """
    token_id = str(uuid.uuid4())
    # Generate secure random token value (16 chars, URL-safe)
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

    _teacher_tokens[token_id] = token
    return token


def validate_teacher_token(token_value: str) -> Optional[TeacherToken]:
    """
    Validasi token guru saat registrasi.

    Cek:
      1. Token ada di database
      2. Token belum digunakan (is_used = False)
      3. Token belum dicabut (is_revoked = False)
      4. Token belum expired

    Args:
        token_value: Nilai token yang diberikan guru

    Returns:
        TeacherToken jika valid, None jika tidak valid
    """
    for token in _teacher_tokens.values():
        if token.token_value == token_value:
            # Check if already used
            if token.is_used:
                return None
            # Check if revoked
            if token.is_revoked:
                return None
            # Check expiry
            if token.expires_at and datetime.utcnow() > token.expires_at:
                return None
            return token
    return None


def use_teacher_token(token_value: str, teacher_uid: str, teacher_name: str) -> bool:
    """
    Tandai token sebagai sudah dipakai oleh guru.

    Args:
        token_value: Nilai token
        teacher_uid: UID guru yang menggunakan token
        teacher_name: Nama guru

    Returns:
        True jika berhasil, False jika token invalid
    """
    token = validate_teacher_token(token_value)
    if token is None:
        return False

    token.is_used = True
    token.used_by = teacher_uid
    token.used_by_name = teacher_name
    token.used_at = datetime.utcnow()

    _teacher_tokens[token.token_id] = token
    return True


def revoke_teacher_token(token_id: str, developer_uid: str) -> bool:
    """
    Cabut token guru (developer only).

    Args:
        token_id: ID token yang dicabut
        developer_uid: UID developer yang mencabut

    Returns:
        True jika berhasil, False jika token tidak ditemukan
    """
    token = _teacher_tokens.get(token_id)
    if token is None:
        return False
    if token.created_by != developer_uid:
        return False

    token.is_revoked = True
    _teacher_tokens[token_id] = token
    return True


def list_tokens(developer_uid: str) -> list[TeacherToken]:
    """
    Daftar semua token yang dibuat oleh developer tertentu.

    Args:
        developer_uid: UID developer

    Returns:
        List TeacherToken
    """
    return [
        token for token in _teacher_tokens.values()
        if token.created_by == developer_uid
    ]


def create_player_profile(
    uid: str,
    data: PlayerCreate,
) -> PlayerProfile:
    """
    Buat profil pemain baru di in-memory store.

    Untuk akun teacher, teacher_token WAJIB sudah divalidasi sebelumnya.

    Args:
        uid: Firebase Auth UID
        data: Data registrasi

    Returns:
        PlayerProfile baru

    Raises:
        ValueError: Jika teacher token tidak valid atau sudah dipakai
    """
    # Validate teacher token if registering as teacher
    if data.account_type == AccountType.TEACHER:
        if not data.teacher_token:
            raise ValueError("Token guru wajib diisi untuk akun teacher")
        token = validate_teacher_token(data.teacher_token)
        if token is None:
            raise ValueError(
                "Token guru tidak valid, sudah dipakai, atau sudah expired"
            )
        # Mark token as used
        use_teacher_token(data.teacher_token, uid, data.display_name)

    # Developer accounts cannot be created via API
    if data.account_type == AccountType.DEVELOPER:
        raise ValueError("Akun developer tidak bisa dibuat melalui registrasi biasa")

    profile = PlayerProfile(
        uid=uid,
        display_name=data.display_name,
        email=data.email,
        account_type=data.account_type,
    )

    _players[uid] = profile
    return profile


def get_player(uid: str) -> Optional[PlayerProfile]:
    """Ambil profil pemain berdasarkan UID."""
    return _players.get(uid)


def update_player(uid: str, **kwargs) -> Optional[PlayerProfile]:
    """Update field tertentu di profil pemain."""
    player = _players.get(uid)
    if player is None:
        return None

    for key, value in kwargs.items():
        if hasattr(player, key) and value is not None:
            setattr(player, key, value)

    player.last_active = datetime.utcnow()
    _players[uid] = player
    return player
