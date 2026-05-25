"""
MathSprint — Game API Routes
==============================
Endpoints for math questions, room management, and game flow.

GET  /game/question            — Generate single question
POST /game/room/create         — Create new room
POST /game/room/join/{room_id} — Join existing room
GET  /game/room/{room_id}      — Get room state
POST /game/room/{room_id}/start — Start game in room
POST /game/room/{room_id}/answer — Submit answer
GET  /game/rooms               — List waiting rooms
POST /game/room/{room_id}/leave — Leave room
"""

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth_engine import get_player
from core.math_engine import generate_math_question, generate_question_stack
from core.room_engine import (
    get_room,
    get_room_summary,
    initialize_room,
    join_room,
    leave_room,
    list_waiting_rooms,
    start_game,
    submit_answer,
)
from models.player import PlayerProfile
from models.question import (
    Difficulty,
    MathOperation,
    MathQuestion,
    QuestionStack,
    QuestionStackRequest,
)
from models.room import (
    AnswerSubmission,
    Room,
    RoomCreate,
    RoomPlayer,
    RoomSummary,
)
from services.auth_service import get_current_uid

router = APIRouter(prefix="/game", tags=["Game"])


# ============================================================
# QUESTION ENDPOINTS
# ============================================================

@router.get(
    "/question",
    response_model=MathQuestion,
    summary="Generate satu soal",
    description=(
        "Generate satu soal matematika berdasarkan operasi dan difficulty. "
        "Operasi: add, sub, mul, div. Difficulty: easy, medium, hard."
    ),
)
async def get_question(
    op: MathOperation,
    diff: Difficulty,
):
    """
    Generate satu soal matematika.

    Guardrails yang diterapkan:
    - Pengurangan: hasil selalu >= 0
    - Pembagian: selalu integer division (tanpa sisa)
    """
    try:
        question = generate_math_question(op, diff)
        return question
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post(
    "/questions",
    response_model=QuestionStack,
    summary="Generate sekumpulan soal",
    description="Generate sekumpulan soal unik untuk latihan atau testing.",
)
async def get_question_stack(
    request: QuestionStackRequest,
):
    """Generate batch soal. Semua soal dijamin unik (tidak ada duplikat)."""
    try:
        stack = generate_question_stack(
            op=request.op,
            diff=request.diff,
            count=request.count,
        )
        return stack
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# ============================================================
# ROOM ENDPOINTS
# ============================================================

@router.post(
    "/room/create",
    response_model=RoomSummary,
    status_code=status.HTTP_201_CREATED,
    summary="Buat room baru",
    description=(
        "Buat room multiplayer baru. Host otomatis menjadi pemain pertama. "
        "Konfigurasi room termasuk operasi, difficulty, elo_wager, dan time_limit."
    ),
)
async def create_room(
    data: RoomCreate,
    uid: str = Depends(get_current_uid),
):
    """Buat room baru. Memerlukan autentikasi."""
    host = get_player(uid)
    if host is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profil pemain tidak ditemukan. Pastikan sudah registrasi.",
        )

    try:
        room = initialize_room(host=host, config=data.config)
        return get_room_summary(room)
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )


@router.post(
    "/room/join/{room_id}",
    response_model=RoomSummary,
    summary="Join room",
    description="Bergabung ke room yang sudah ada menggunakan kode room.",
)
async def join_existing_room(
    room_id: str,
    role: str = "player",
    uid: str = Depends(get_current_uid),
):
    """Bergabung ke room. Memerlukan autentikasi."""
    player = get_player(uid)
    if player is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profil pemain tidak ditemukan.",
        )

    try:
        room = join_room(room_id.upper(), player, role=role)
        return get_room_summary(room)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get(
    "/room/{room_id}",
    response_model=RoomSummary,
    summary="Info room",
    description="Ambil informasi room tanpa bocoran soal.",
)
async def get_room_info(
    room_id: str,
    _uid: str = Depends(get_current_uid),
):
    """Ambil info room (tanpa question_stack untuk keamanan)."""
    room = get_room(room_id.upper())
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Room '{room_id}' tidak ditemukan.",
        )
    return get_room_summary(room)


@router.get(
    "/room/{room_id}/questions",
    response_model=list[MathQuestion],
    summary="Ambil soal room",
    description="Ambil seluruh soal untuk room ini (hanya jika game sudah dimulai).",
)
async def get_room_questions(
    room_id: str,
    uid: str = Depends(get_current_uid),
):
    from models.room import RoomStatus
    room = get_room(room_id.upper())
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Room '{room_id}' tidak ditemukan.",
        )
    
    if uid not in room.players:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kamu bukan peserta room ini.",
        )
        
    if room.status == RoomStatus.WAITING:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Game belum dimulai, soal masih dirahasiakan.",
        )
        
    return room.question_stack


@router.post(
    "/room/{room_id}/start",
    response_model=RoomSummary,
    summary="Mulai game",
    description="Mulai game di room. Hanya host yang boleh memulai. Minimal 2 pemain.",
)
async def start_room_game(
    room_id: str,
    uid: str = Depends(get_current_uid),
):
    """Mulai game di room. Question stack akan di-generate."""
    try:
        room = start_game(room_id.upper(), uid)
        return get_room_summary(room)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post(
    "/room/{room_id}/answer",
    response_model=RoomPlayer,
    summary="Submit jawaban",
    description="Submit jawaban untuk satu soal di room.",
)
async def submit_room_answer(
    room_id: str,
    data: AnswerSubmission,
    uid: str = Depends(get_current_uid),
):
    """Submit jawaban soal di room."""
    try:
        player = submit_answer(
            room_id=room_id.upper(),
            player_uid=uid,
            question_index=data.question_index,
            answer=data.answer,
        )
        return player
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get(
    "/rooms",
    response_model=list[RoomSummary],
    summary="Daftar room tersedia",
    description="Daftar semua room yang sedang menunggu pemain.",
)
async def get_available_rooms(
    _uid: str = Depends(get_current_uid),
):
    """List room yang bisa dimasuki."""
    return list_waiting_rooms()


@router.post(
    "/room/{room_id}/leave",
    summary="Keluar room",
    description="Keluar dari room. Tidak bisa keluar saat game berlangsung.",
)
async def leave_existing_room(
    room_id: str,
    uid: str = Depends(get_current_uid),
):
    """Keluar dari room."""
    try:
        result = leave_room(room_id.upper(), uid)
        if result is None:
            return {"message": f"Keluar dari room '{room_id}'. Room dihapus (kosong)."}
        return {"message": f"Berhasil keluar dari room '{room_id}'."}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.post(
    "/matchmake",
    response_model=Room,
    summary="Cari lawan Duel (Matchmaking)",
    description="Bergabung dengan room matchmaking yang sedang menunggu, atau buat room baru jika belum ada.",
)
async def matchmake_duel(
    req: RoomCreate,
    uid: str = Depends(get_current_uid),
):
    from services.firestore_service import get_system_config
    from services.firebase_client import get_firestore_client
    
    config = await get_system_config()
    if not config.get("matchmaking_enabled", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Fitur Duel (Matchmaking) sedang dinonaktifkan.")
        
    op = req.op
    diff = req.diff
    
    if not config.get("matchmaking_allow_custom_config", False):
        op = config.get("matchmaking_fixed_op", "add")
        diff = config.get("matchmaking_fixed_diff", "medium")
        
    db = get_firestore_client()
    docs = db.collection("rooms").where("is_matchmaking", "==", True).where("status", "==", "waiting").stream()
    
    room_to_join = None
    for doc in docs:
        r = Room(**doc.to_dict())
        if r.config.op == op and r.config.diff == diff and len(r.players) < r.max_players:
            if uid not in r.players:
                room_to_join = r
                break
                
    player = get_player(uid)
    if not player:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profil tidak ditemukan")
        
    if room_to_join:
        try:
            return join_room(room_to_join.room_id, player)
        except Exception:
            pass # Fallback to create new room if join failed
            
    # Create new room
    from models.room import RoomConfig
    room_config = RoomConfig(
        op=op, diff=diff, question_limit=req.question_limit, 
        elo_wager=req.elo_wager, time_limit_seconds=req.time_limit_seconds
    )
    return initialize_room(player, room_config, is_matchmaking=True)

