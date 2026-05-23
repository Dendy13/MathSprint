"""
MathSprint — Match API Routes
================================
Endpoints for match resolution, history, and leaderboard.

POST /match/submit            — Submit match results (resolve Elo)
GET  /match/history/{uid}     — Get match history for a player
GET  /match/leaderboard       — Get leaderboard
"""

from fastapi import APIRouter, Depends, HTTPException, status

from core.rank_engine import process_match_result
from core.room_engine import get_room
from models.match import LeaderboardEntry, MatchHistory, MatchResult, MatchSubmission, SoloMatchSubmission, SoloMatchResult
from models.room import RoomStatus
from services.auth_service import get_current_uid
from core.auth_engine import get_player, update_player

router = APIRouter(prefix="/match", tags=["Match & Ranking"])


@router.get(
    "/result/{room_id}",
    response_model=MatchResult,
    summary="Ambil hasil match",
    description="Ambil hasil perhitungan Elo untuk sebuah room yang sudah selesai.",
)
async def get_match_result(
    room_id: str,
    uid: str = Depends(get_current_uid),
):
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

    if room.status != RoomStatus.FINISHED or not room.match_result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hasil match belum tersedia. Game mungkin belum selesai.",
        )

    return room.match_result


@router.post(
    "/submit-solo",
    response_model=SoloMatchResult,
    summary="Submit hasil match Solo",
    description="Simpan hasil mode Solo dan update profil statistik pemain secara permanen.",
)
async def submit_solo_match(
    data: SoloMatchSubmission,
    uid: str = Depends(get_current_uid),
):
    from core.rank_engine import process_solo_match
    
    player = get_player(uid)
    if player is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profil tidak ditemukan.",
        )

    result = process_solo_match(player, data)
    
    # Update player profile (only add small RP change, and update matches)
    updates = {
        "current_rank_point": result.new_rp,
        "total_matches": player.total_matches + 1,
    }
    update_player(uid, **updates)
    
    # Save to solo_scores for leaderboard
    from services.firebase_client import get_firestore_client
    db = get_firestore_client()
    
    # Check if there's an existing score, if new score is higher, overwrite
    doc_ref = db.collection("solo_scores").document(uid)
    doc = doc_ref.get()
    
    if not doc.exists or doc.to_dict().get("score", 0) < result.score:
        doc_ref.set(result.model_dump(mode='json'))
        
    return result


@router.get(
    "/history/{player_uid}",
    response_model=list[MatchHistory],
    summary="Riwayat pertandingan",
    description="Ambil riwayat pertandingan seorang pemain.",
)
async def get_match_history(
    player_uid: str,
    limit: int = 50,
    _uid: str = Depends(get_current_uid),
):
    """
    Ambil riwayat pertandingan.
    Saat ini menggunakan in-memory store (akan dipindah ke Firestore).
    """
    # TODO: Implement with Firestore in production
    return []


@router.get(
    "/leaderboard",
    response_model=list[LeaderboardEntry],
    summary="Leaderboard ranking",
    description="Ambil leaderboard pemain berdasarkan Rank Point.",
)
async def get_leaderboard(
    limit: int = 100,
    _uid: str = Depends(get_current_uid),
):
    from services.firebase_client import get_firestore_client
    from google.cloud import firestore
    from models.player import PlayerProfile

    db = get_firestore_client()
    docs = db.collection("players").order_by("current_rank_point", direction=firestore.Query.DESCENDING).limit(limit).stream()
    
    players = [PlayerProfile(**doc.to_dict()) for doc in docs]

    entries = []
    for rank, player in enumerate(players, start=1):
        total = player.total_matches
        win_rate = (player.wins / total * 100) if total > 0 else 0.0
        entries.append(LeaderboardEntry(
            rank=rank,
            uid=player.uid,
            display_name=player.display_name,
            current_rank_point=player.current_rank_point,
            total_matches=total,
            wins=player.wins,
            losses=player.losses,
            win_rate=round(win_rate, 1),
        ))

    return entries


@router.get(
    "/leaderboard/solo",
    response_model=list[SoloMatchResult],
    summary="Solo Leaderboard ranking",
    description="Ambil top 100 skor tertinggi di mode Solo.",
)
async def get_solo_leaderboard(
    limit: int = 100,
    _uid: str = Depends(get_current_uid),
):
    from services.firebase_client import get_firestore_client
    from google.cloud import firestore

    db = get_firestore_client()
    docs = db.collection("solo_scores").order_by("score", direction=firestore.Query.DESCENDING).limit(limit).stream()
    
    return [SoloMatchResult(**doc.to_dict()) for doc in docs]
