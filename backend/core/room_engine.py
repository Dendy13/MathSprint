"""
MathSprint — Room & Multiplayer State Engine
==============================================
Module C: Manages room lifecycle, player state, and game synchronization.

Room Lifecycle: WAITING → PLAYING → FINISHED
"""

import random
from datetime import datetime
from typing import Dict, Optional

from core.math_engine import generate_question_stack
from models.player import PlayerProfile
from models.room import (
    Room, RoomConfig, RoomPlayer, RoomStatus, RoomSummary,
)
from services.firebase_client import get_firestore_client

# Room code chars — exclude confusing: 0, O, I, 1, L
_ROOM_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _generate_room_code() -> str:
    """Generate 6-char room code from safe character set."""
    return "".join(random.choices(_ROOM_CODE_CHARS, k=6))


def _get_unique_room_code(max_retries: int = 10) -> str:
    """Generate a room code that doesn't collide with existing rooms."""
    db = get_firestore_client()
    for _ in range(max_retries):
        code = _generate_room_code()
        if not db.collection("rooms").document(code).get().exists:
            return code
    raise RuntimeError(f"Gagal generate kode room unik setelah {max_retries} percobaan.")


def get_room(room_id: str) -> Optional[Room]:
    """Ambil data room berdasarkan ID dari Firestore."""
    db = get_firestore_client()
    doc = db.collection("rooms").document(room_id).get()
    if doc.exists:
        return Room(**doc.to_dict())
    return None


def initialize_room(host: PlayerProfile, config: RoomConfig) -> Room:
    """
    Buat room baru. Host otomatis menjadi pemain pertama.
    question_stack BELUM di-generate (di-generate saat start_game).
    """
    db = get_firestore_client()
    room_id = _get_unique_room_code()
    host_player = RoomPlayer(
        uid=host.uid,
        display_name=host.display_name,
        rp_before=host.current_rank_point,
    )
    room = Room(
        room_id=room_id,
        host_uid=host.uid,
        status=RoomStatus.WAITING,
        config=config,
        players={host.uid: host_player},
        question_stack=[],
        max_players=2,
        created_at=datetime.utcnow(),
    )
    db.collection("rooms").document(room_id).set(room.model_dump())
    return room


def join_room(room_id: str, player: PlayerProfile) -> Room:
    """Pemain bergabung ke room yang sudah ada."""
    db = get_firestore_client()
    room = get_room(room_id)
    if room is None:
        raise ValueError(f"Room '{room_id}' tidak ditemukan")
    if room.status != RoomStatus.WAITING:
        raise ValueError(f"Room '{room_id}' sudah dimulai atau selesai (status: {room.status})")
    if len(room.players) >= room.max_players:
        raise ValueError(f"Room '{room_id}' sudah penuh ({room.max_players} pemain)")
    if player.uid in room.players:
        raise ValueError(f"Pemain '{player.display_name}' sudah ada di room")

    new_player = RoomPlayer(
        uid=player.uid,
        display_name=player.display_name,
        rp_before=player.current_rank_point,
    )
    room.players[player.uid] = new_player
    db.collection("rooms").document(room_id).set(room.model_dump())
    return room


def start_game(room_id: str, requester_uid: str) -> Room:
    """
    Mulai game di room. HANYA host yang boleh memulai.
    question_stack di-generate di sini agar kedua pemain dapat soal identik.
    """
    db = get_firestore_client()
    room = get_room(room_id)
    if room is None:
        raise ValueError(f"Room '{room_id}' tidak ditemukan")
    if room.host_uid != requester_uid:
        raise ValueError("Hanya host yang boleh memulai game")
    if room.status != RoomStatus.WAITING:
        raise ValueError(f"Room tidak bisa dimulai (status: {room.status})")
    if len(room.players) < 2:
        raise ValueError(f"Minimal 2 pemain. Saat ini: {len(room.players)}")

    stack = generate_question_stack(
        op=room.config.op,
        diff=room.config.diff,
        count=room.config.question_limit,
    )
    room.question_stack = stack.questions
    room.status = RoomStatus.PLAYING
    room.started_at = datetime.utcnow()
    db.collection("rooms").document(room_id).set(room.model_dump())
    return room


def submit_answer(
    room_id: str, player_uid: str, question_index: int, answer: int,
) -> RoomPlayer:
    """Submit jawaban pemain untuk satu soal di room."""
    db = get_firestore_client()
    room = get_room(room_id)
    if room is None:
        raise ValueError(f"Room '{room_id}' tidak ditemukan")
    if room.status != RoomStatus.PLAYING:
        raise ValueError(f"Game belum dimulai (status: {room.status})")
    if player_uid not in room.players:
        raise ValueError(f"Pemain tidak ada di room '{room_id}'")

    player = room.players[player_uid]
    if player.is_finished:
        raise ValueError("Pemain sudah selesai menjawab semua soal")
    if question_index < 0 or question_index >= len(room.question_stack):
        raise ValueError(f"Index soal tidak valid: {question_index}")

    correct_answer = room.question_stack[question_index].answer
    if answer == correct_answer:
        player.correct_answers += 1
        player.score += 100
    else:
        player.wrong_answers += 1

    player.current_question_index = question_index + 1
    if player.current_question_index >= len(room.question_stack):
        player.is_finished = True
        player.finished_at = datetime.utcnow()

    room.players[player_uid] = player

    # Check if all players finished → finish room
    if all(p.is_finished for p in room.players.values()):
        room.status = RoomStatus.FINISHED
        room.finished_at = datetime.utcnow()

    db.collection("rooms").document(room_id).set(room.model_dump())
    return player


def get_room_summary(room: Room) -> RoomSummary:
    """Buat ringkasan room tanpa question_stack (aman untuk client)."""
    return RoomSummary(
        room_id=room.room_id,
        host_uid=room.host_uid,
        status=room.status,
        config=room.config,
        player_count=len(room.players),
        max_players=room.max_players,
        created_at=room.created_at,
        players=room.players,
    )


def leave_room(room_id: str, player_uid: str) -> Optional[Room]:
    """Pemain keluar dari room. Room dihapus jika kosong."""
    db = get_firestore_client()
    room = get_room(room_id)
    if room is None:
        raise ValueError(f"Room '{room_id}' tidak ditemukan")
    if player_uid not in room.players:
        raise ValueError(f"Pemain tidak ada di room '{room_id}'")
    if room.status == RoomStatus.PLAYING:
        raise ValueError("Tidak bisa keluar saat game berlangsung")

    del room.players[player_uid]
    if len(room.players) == 0:
        db.collection("rooms").document(room_id).delete()
        return None

    if player_uid == room.host_uid:
        room.host_uid = next(iter(room.players))

    db.collection("rooms").document(room_id).set(room.model_dump())
    return room


def list_waiting_rooms() -> list[RoomSummary]:
    """Daftar semua room yang menunggu pemain."""
    db = get_firestore_client()
    docs = db.collection("rooms").where("status", "==", RoomStatus.WAITING.value).stream()
    rooms = []
    for doc in docs:
        try:
            r = Room(**doc.to_dict())
            rooms.append(get_room_summary(r))
        except Exception:
            pass
    return rooms
