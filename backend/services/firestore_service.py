"""
MathSprint — Firestore Service
================================
CRUD operations for Firestore collections.

Collections:
  users/{uid}                    — PlayerProfile documents
  users/{uid}/friend_requests/   — FriendRequest subcollection
  rooms/{room_id}                — Room documents
  matches/{match_id}             — Match history documents
  teacher_tokens/{token_id}      — Teacher registration tokens

ATURAN:
  - Semua fungsi WAJIB menggunakan Pydantic model sebagai I/O
  - Dilarang return dictionary mentah
  - Gunakan model_dump() untuk serialize, model_validate() untuk deserialize
"""

from datetime import datetime
from typing import List, Optional

from services.firebase_client import get_firestore_client
from models.player import PlayerProfile, PlayerPublic
from models.room import Room, RoomSummary
from models.match import MatchResult, MatchHistory, LeaderboardEntry
from models.friend import FriendRequest, FriendInfo
from models.auth import TeacherToken


# ============================================================
# COLLECTION NAMES — Single Source of Truth
# ============================================================
USERS_COLLECTION = "players"
ROOMS_COLLECTION = "rooms"
MATCHES_COLLECTION = "matches"
TEACHER_TOKENS_COLLECTION = "teacher_tokens"
FRIEND_REQUESTS_SUBCOLLECTION = "friend_requests"


# ============================================================
# PLAYER OPERATIONS
# ============================================================

async def create_player(profile: PlayerProfile) -> PlayerProfile:
    """Create a new player document in Firestore."""
    db = get_firestore_client()
    doc_ref = db.collection(USERS_COLLECTION).document(profile.uid)
    doc_ref.set(profile.model_dump())
    return profile


async def get_player(uid: str) -> Optional[PlayerProfile]:
    """Get a player by UID."""
    db = get_firestore_client()
    doc = db.collection(USERS_COLLECTION).document(uid).get()
    if not doc.exists:
        return None
    return PlayerProfile.model_validate(doc.to_dict())


async def update_player(uid: str, data: dict) -> Optional[PlayerProfile]:
    """Update specific fields of a player document."""
    db = get_firestore_client()
    doc_ref = db.collection(USERS_COLLECTION).document(uid)
    doc_ref.update(data)
    return await get_player(uid)


async def get_all_players(limit: int = 100) -> List[PlayerProfile]:
    """Get all players (for admin dashboard)."""
    db = get_firestore_client()
    query = db.collection(USERS_COLLECTION).order_by("created_at", direction="DESCENDING").limit(limit)
    return [PlayerProfile.model_validate(doc.to_dict()) for doc in query.stream()]


# ============================================================
# SYSTEM CONFIG OPERATIONS
# ============================================================

import time
_config_cache = {"data": None, "timestamp": 0}

async def get_system_config() -> dict:
    """Get global system configuration with 60-second caching."""
    current_time = time.time()
    if _config_cache["data"] is not None and (current_time - _config_cache["timestamp"] < 60):
        return _config_cache["data"]

    db = get_firestore_client()
    doc = db.collection("system").document("config").get()
    
    if not doc.exists:
        config = {
            "maintenance_mode": False, 
            "solo_mode_enabled": True, 
            "teacher_registration_enabled": True,
            "matchmaking_enabled": False,
            "matchmaking_allow_custom_config": False,
            "matchmaking_fixed_op": "add",
            "matchmaking_fixed_diff": "medium"
        }
    else:
        config = doc.to_dict()
        
    _config_cache["data"] = config
    _config_cache["timestamp"] = current_time
    return config


async def save_system_config(config_data: dict) -> dict:
    """Save system config and clear cache."""
    db = get_firestore_client()
    db.collection("system").document("config").set(config_data)
    _config_cache["data"] = config_data
    _config_cache["timestamp"] = time.time()
    return config_data



async def get_leaderboard(limit: int = 100) -> List[LeaderboardEntry]:
    """Get top players sorted by rank point."""
    db = get_firestore_client()
    query = (
        db.collection(USERS_COLLECTION)
        .order_by("current_rank_point", direction="DESCENDING")
        .limit(limit)
    )
    docs = query.stream()

    entries = []
    for rank, doc in enumerate(docs, start=1):
        data = doc.to_dict()
        total = data.get("total_matches", 0)
        wins = data.get("wins", 0)
        win_rate = (wins / total * 100) if total > 0 else 0.0

        entries.append(LeaderboardEntry(
            rank=rank,
            uid=data["uid"],
            display_name=data["display_name"],
            current_rank_point=data.get("current_rank_point", 1200),
            total_matches=total,
            wins=wins,
            losses=data.get("losses", 0),
            win_rate=round(win_rate, 1),
        ))

    return entries


# ============================================================
# ROOM OPERATIONS (ADMIN)
# ============================================================

async def get_all_rooms(limit: int = 50) -> List[RoomSummary]:
    """Get latest rooms for admin dashboard."""
    db = get_firestore_client()
    query = db.collection(ROOMS_COLLECTION).order_by("created_at", direction="DESCENDING").limit(limit)
    
    rooms = []
    for doc in query.stream():
        data = doc.to_dict()
        players = data.get("players", {})
        rooms.append(RoomSummary(
            room_id=data["room_id"],
            host_uid=data["host_uid"],
            status=data["status"],
            config=data["config"],
            player_count=len(players),
            max_players=data.get("max_players", 2),
            created_at=data["created_at"],
            players=players
        ))
    return rooms

async def delete_room(room_id: str) -> bool:
    """Forcibly delete a room."""
    db = get_firestore_client()
    doc_ref = db.collection(ROOMS_COLLECTION).document(room_id)
    if not doc_ref.get().exists:
        return False
    doc_ref.delete()
    return True


# ============================================================
# ROOM OPERATIONS
# ============================================================

async def save_room(room: Room) -> Room:
    """Save room document to Firestore."""
    db = get_firestore_client()
    doc_ref = db.collection(ROOMS_COLLECTION).document(room.room_id)
    doc_ref.set(room.model_dump())
    return room


async def get_room(room_id: str) -> Optional[Room]:
    """Get room by ID."""
    db = get_firestore_client()
    doc = db.collection(ROOMS_COLLECTION).document(room_id).get()
    if not doc.exists:
        return None
    return Room.model_validate(doc.to_dict())


async def update_room(room_id: str, data: dict) -> None:
    """Update specific fields of a room document."""
    db = get_firestore_client()
    db.collection(ROOMS_COLLECTION).document(room_id).update(data)


# ============================================================
# MATCH OPERATIONS
# ============================================================

async def save_match_result(result: MatchResult) -> MatchResult:
    """Save match result to Firestore."""
    db = get_firestore_client()
    doc_ref = db.collection(MATCHES_COLLECTION).document(result.match_id)
    doc_ref.set(result.model_dump())
    return result


async def get_match_history(uid: str, limit: int = 50) -> List[MatchHistory]:
    """Get match history for a player."""
    db = get_firestore_client()

    # Query matches where player is winner or loser
    entries = []

    # Winner matches
    winner_query = (
        db.collection(MATCHES_COLLECTION)
        .where("winner_uid", "==", uid)
        .order_by("created_at", direction="DESCENDING")
        .limit(limit)
    )
    for doc in winner_query.stream():
        data = doc.to_dict()
        calc = data.get("winner_calculation", {})
        loser_calc = data.get("loser_calculation", {})
        entries.append(MatchHistory(
            match_id=data["match_id"],
            opponent_uid=loser_calc.get("player_uid", ""),
            opponent_name=loser_calc.get("display_name", "Unknown"),
            result="win",
            rp_change=calc.get("rp_change", 0),
            old_rp=calc.get("old_rp", 1200),
            new_rp=calc.get("new_rp", 1200),
            op=data.get("op", "add"),
            diff=data.get("diff", "easy"),
            my_score=0,
            opponent_score=0,
            created_at=data.get("created_at", datetime.utcnow()),
        ))

    # Loser matches
    loser_query = (
        db.collection(MATCHES_COLLECTION)
        .where("loser_uid", "==", uid)
        .order_by("created_at", direction="DESCENDING")
        .limit(limit)
    )
    for doc in loser_query.stream():
        data = doc.to_dict()
        calc = data.get("loser_calculation", {})
        winner_calc = data.get("winner_calculation", {})
        entries.append(MatchHistory(
            match_id=data["match_id"],
            opponent_uid=winner_calc.get("player_uid", ""),
            opponent_name=winner_calc.get("display_name", "Unknown"),
            result="loss",
            rp_change=calc.get("rp_change", 0),
            old_rp=calc.get("old_rp", 1200),
            new_rp=calc.get("new_rp", 1200),
            op=data.get("op", "add"),
            diff=data.get("diff", "easy"),
            my_score=0,
            opponent_score=0,
            created_at=data.get("created_at", datetime.utcnow()),
        ))

    # Sort by created_at descending
    entries.sort(key=lambda x: x.created_at, reverse=True)
    return entries[:limit]


# ============================================================
# TEACHER TOKEN OPERATIONS
# ============================================================

async def save_teacher_token(token: TeacherToken) -> TeacherToken:
    """Save teacher token to Firestore."""
    db = get_firestore_client()
    doc_ref = db.collection(TEACHER_TOKENS_COLLECTION).document(token.token_id)
    doc_ref.set(token.model_dump())
    return token


async def get_teacher_token_by_value(token_value: str) -> Optional[TeacherToken]:
    """Find teacher token by its value."""
    db = get_firestore_client()
    query = (
        db.collection(TEACHER_TOKENS_COLLECTION)
        .where("token_value", "==", token_value)
        .limit(1)
    )
    for doc in query.stream():
        return TeacherToken.model_validate(doc.to_dict())
    return None


async def get_tokens_by_developer(developer_uid: str) -> List[TeacherToken]:
    """Get all tokens created by a specific developer."""
    db = get_firestore_client()
    query = (
        db.collection(TEACHER_TOKENS_COLLECTION)
        .where("created_by", "==", developer_uid)
        .order_by("created_at", direction="DESCENDING")
    )
    return [
        TeacherToken.model_validate(doc.to_dict())
        for doc in query.stream()
    ]


# ============================================================
# FRIEND REQUEST OPERATIONS
# ============================================================

async def save_friend_request(request: FriendRequest) -> FriendRequest:
    """Save friend request to receiver's subcollection."""
    db = get_firestore_client()
    doc_ref = (
        db.collection(USERS_COLLECTION)
        .document(request.to_uid)
        .collection(FRIEND_REQUESTS_SUBCOLLECTION)
        .document(request.request_id)
    )
    doc_ref.set(request.model_dump())
    return request


async def get_pending_friend_requests(uid: str) -> List[FriendRequest]:
    """Get all pending friend requests for a user."""
    db = get_firestore_client()
    query = (
        db.collection(USERS_COLLECTION)
        .document(uid)
        .collection(FRIEND_REQUESTS_SUBCOLLECTION)
        .where("status", "==", "pending")
        .order_by("created_at", direction="DESCENDING")
    )
    return [
        FriendRequest.model_validate(doc.to_dict())
        for doc in query.stream()
    ]


async def update_friend_request(to_uid: str, request_id: str, data: dict) -> None:
    """Update a friend request document."""
    db = get_firestore_client()
    (
        db.collection(USERS_COLLECTION)
        .document(to_uid)
        .collection(FRIEND_REQUESTS_SUBCOLLECTION)
        .document(request_id)
        .update(data)
    )


async def add_friend_to_list(uid: str, friend_uid: str) -> None:
    """Add a friend UID to player's friends_list array."""
    db = get_firestore_client()
    from google.cloud.firestore_v1 import ArrayUnion
    db.collection(USERS_COLLECTION).document(uid).update({
        "friends_list": ArrayUnion([friend_uid])
    })


async def remove_friend_from_list(uid: str, friend_uid: str) -> None:
    """Remove a friend UID from player's friends_list array."""
    db = get_firestore_client()
    from google.cloud.firestore_v1 import ArrayRemove
    db.collection(USERS_COLLECTION).document(uid).update({
        "friends_list": ArrayRemove([friend_uid])
    })
