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


@router.post(
    "/submit",
    response_model=MatchResult,
    summary="Submit hasil match",
    description=(
        "Selesaikan match dan hitung Elo Rating. "
        "Dipanggil setelah kedua pemain selesai menjawab semua soal di room. "
        "Endpoint ini akan menghitung RP change untuk kedua pemain."
    ),
)
async def submit_match(
    data: MatchSubmission,
    uid: str = Depends(get_current_uid),
):
    """
    Proses hasil match dan hitung Elo.

    Flow:
    1. Ambil room data
    2. Validasi room sudah FINISHED
    3. Hitung Elo untuk kedua pemain
    4. Update RP di profil masing-masing
    5. Return detail kalkulasi
    """
    room = get_room(data.room_id.upper())
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Room '{data.room_id}' tidak ditemukan.",
        )

    if room.status != RoomStatus.FINISHED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Game belum selesai (status: {room.status}). "
                   "Tunggu semua pemain selesai menjawab.",
        )

    if uid not in room.players:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kamu bukan peserta room ini.",
        )

    try:
        result = process_match_result(room)

        # Update player profiles with new RP
        for calc in [result.winner_calculation, result.loser_calculation]:
            player = get_player(calc.player_uid)
            if player is not None:
                updates = {
                    "current_rank_point": calc.new_rp,
                    "total_matches": player.total_matches + 1,
                }
                if result.winner_uid == calc.player_uid:
                    updates["wins"] = player.wins + 1
                elif result.loser_uid == calc.player_uid:
                    updates["losses"] = player.losses + 1
                else:
                    updates["draws"] = player.draws + 1

                update_player(calc.player_uid, **updates)

        return result

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


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
    
    # Update player profile
    updates = {
        "current_rank_point": result.new_rp,
        "total_matches": player.total_matches + 1,
    }
    
    # Calculate win/loss based on passing grade (e.g., > 50% correct is a win)
    is_win = result.correct > (result.total / 2)
    if is_win:
        updates["wins"] = player.wins + 1
    else:
        updates["losses"] = player.losses + 1
        
    update_player(uid, **updates)
    
    # Save match history (mock array for now)
    # _match_history.append(...)
    
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
