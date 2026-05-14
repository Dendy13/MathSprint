"""
MathSprint — Admin API Routes (Developer Only)
================================================
Endpoints for developer account management and teacher token system.

POST   /admin/token/create     — Create teacher token
GET    /admin/token/list       — List all tokens
DELETE /admin/token/{token_id} — Revoke token
GET    /admin/stats            — System statistics
"""

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth_engine import (
    generate_teacher_token,
    get_player,
    list_tokens,
    revoke_teacher_token,
)
from models.auth import (
    TeacherToken,
    TokenCreate,
    TokenInfo,
    TokenListResponse,
)
from services.auth_service import get_current_uid, require_developer

router = APIRouter(prefix="/admin", tags=["Admin (Developer Only)"])


@router.post(
    "/token/create",
    response_model=TeacherToken,
    status_code=status.HTTP_201_CREATED,
    summary="Buat token guru",
    description=(
        "Buat token registrasi guru baru. "
        "Token bersifat ONE-TIME-USE dan akan hangus setelah dipakai satu guru. "
        "Hanya akun Developer yang boleh mengakses endpoint ini."
    ),
)
async def create_teacher_token(
    data: TokenCreate,
    token: dict = Depends(require_developer),
):
    """
    Buat token guru baru.

    Token value yang dihasilkan harus diberikan ke guru
    untuk registrasi akun teacher.
    """
    developer_uid = token.get("uid", "")
    developer = get_player(developer_uid)
    developer_name = developer.display_name if developer else "Developer"

    teacher_token = generate_teacher_token(
        developer_uid=developer_uid,
        developer_name=developer_name,
        token_request=data,
    )

    return teacher_token


@router.get(
    "/token/list",
    response_model=TokenListResponse,
    summary="Daftar semua token",
    description="Daftar semua token guru yang dibuat oleh developer ini.",
)
async def list_teacher_tokens(
    token: dict = Depends(require_developer),
):
    """List semua token guru yang dibuat developer ini."""
    developer_uid = token.get("uid", "")
    tokens = list_tokens(developer_uid)

    token_infos = [
        TokenInfo(
            token_id=t.token_id,
            token_value=t.token_value,
            label=t.label,
            is_used=t.is_used,
            is_revoked=t.is_revoked,
            used_by_name=t.used_by_name,
            created_at=t.created_at,
            expires_at=t.expires_at,
        )
        for t in tokens
    ]

    used_count = sum(1 for t in tokens if t.is_used)
    available_count = sum(
        1 for t in tokens
        if not t.is_used and not t.is_revoked
    )

    return TokenListResponse(
        tokens=token_infos,
        total=len(tokens),
        used_count=used_count,
        available_count=available_count,
    )


@router.delete(
    "/token/{token_id}",
    summary="Cabut token",
    description="Cabut token guru. Token yang sudah dicabut tidak bisa digunakan.",
)
async def revoke_token(
    token_id: str,
    token: dict = Depends(require_developer),
):
    """Cabut/revoke token guru."""
    developer_uid = token.get("uid", "")
    success = revoke_teacher_token(token_id, developer_uid)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token tidak ditemukan atau bukan milik developer ini.",
        )

    return {"message": "Token berhasil dicabut.", "token_id": token_id}


@router.get(
    "/stats",
    summary="Statistik sistem",
    description="Statistik umum sistem MathSprint (developer only).",
)
async def get_system_stats(
    token: dict = Depends(require_developer),
):
    """Ambil statistik sistem: jumlah user, room aktif, match, dll."""
    from core.auth_engine import _players, _teacher_tokens
    from core.room_engine import _rooms

    total_players = len(_players)
    total_rooms = len(_rooms)
    active_rooms = sum(
        1 for r in _rooms.values()
        if r.status.value in ("waiting", "playing")
    )
    total_tokens = len(_teacher_tokens)
    used_tokens = sum(1 for t in _teacher_tokens.values() if t.is_used)

    account_types = {}
    for p in _players.values():
        at = p.account_type.value
        account_types[at] = account_types.get(at, 0) + 1

    return {
        "total_players": total_players,
        "account_types": account_types,
        "total_rooms": total_rooms,
        "active_rooms": active_rooms,
        "total_teacher_tokens": total_tokens,
        "used_teacher_tokens": used_tokens,
        "available_teacher_tokens": total_tokens - used_tokens,
    }
