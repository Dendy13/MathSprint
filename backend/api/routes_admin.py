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
from models.system import SystemConfig
from models.player import PlayerProfile
from services.auth_service import get_current_uid, require_developer
from services.firestore_service import (
    get_system_config,
    save_system_config,
    get_all_players,
    update_player,
)

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
    from services.firebase_client import get_firestore_client
    from core.room_engine import _rooms
    
    active_rooms = sum(
        1 for r in _rooms.values()
        if r.status.value in ("waiting", "playing")
    )

    db = get_firestore_client()
    
    # In production with large data, counting documents requires an aggregation query
    # or maintaining a counter document. For now, we will query count.
    players_count_query = db.collection("players").count()
    players_count_result = players_count_query.get()
    total_players = players_count_result[0][0].value if players_count_result else 0
    
    tokens_count_query = db.collection("teacher_tokens").count()
    tokens_count_result = tokens_count_query.get()
    total_tokens = tokens_count_result[0][0].value if tokens_count_result else 0
    
    # We don't query every single document for daily active in this simple migration,
    # as it's inefficient. Instead, we do a basic query for active today.
    # Note: Requires composite index if complex, but simple where should work.
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    active_today_query = db.collection("players").where("last_active", ">=", today_start).count()
    active_today_result = active_today_query.get()
    active_today = active_today_result[0][0].value if active_today_result else 0
    
    # Used tokens
    used_tokens_query = db.collection("teacher_tokens").where("is_used", "==", True).count()
    used_tokens_result = used_tokens_query.get()
    used_tokens = used_tokens_result[0][0].value if used_tokens_result else 0

    return {
        "total_players": total_players,
        "active_players_today": active_today,
        "active_rooms": active_rooms,
        "total_teacher_tokens": total_tokens,
        "used_teacher_tokens": used_tokens,
        "available_teacher_tokens": total_tokens - used_tokens,
    }


@router.get("/config", response_model=SystemConfig, summary="Get system configuration")
async def get_config_endpoint(token: dict = Depends(require_developer)):
    config_dict = await get_system_config()
    return SystemConfig(**config_dict)


@router.post("/config", response_model=SystemConfig, summary="Update system configuration")
async def update_config_endpoint(
    data: SystemConfig,
    token: dict = Depends(require_developer)
):
    await save_system_config(data.model_dump())
    return data


@router.get("/users", summary="List all users")
async def list_users(
    limit: int = 100,
    token: dict = Depends(require_developer)
):
    players = await get_all_players(limit)
    return {"users": [p.model_dump() for p in players]}


@router.patch("/users/{uid}", summary="Modify a user")
async def modify_user(
    uid: str,
    data: dict,
    token: dict = Depends(require_developer)
):
    # Security: only allow modifying specific fields
    allowed_fields = {"display_name", "account_type", "current_rank_point"}
    filtered_data = {k: v for k, v in data.items() if k in allowed_fields}
    
    if not filtered_data:
        raise HTTPException(status_code=400, detail="Tidak ada field valid yang diubah.")
        
    updated = await update_player(uid, filtered_data)
    if not updated:
        raise HTTPException(status_code=404, detail="User tidak ditemukan.")
    
@router.post("/users/{uid}/reset-password", summary="Reset sandi pemain (Admin only)")
async def reset_user_password(
    uid: str,
    data: dict,
    token: dict = Depends(require_developer)
):
    new_password = data.get("new_password")
    if not new_password or len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Kata sandi baru minimal 8 karakter.")
        
    try:
        from firebase_admin import auth
        auth.update_user(uid, password=new_password)
        return {"message": "Kata sandi berhasil di-reset."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal reset sandi: {str(e)}")
