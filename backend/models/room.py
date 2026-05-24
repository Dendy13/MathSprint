"""
MathSprint — Room & Multiplayer Models
========================================
Skema data untuk Room system, termasuk konfigurasi,
status pemain di room, dan state permainan.

Room lifecycle: waiting → playing → finished
"""

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from models.question import Difficulty, MathOperation, MathQuestion


class RoomStatus(str, Enum):
    """Status lifecycle room."""
    WAITING = "waiting"
    PLAYING = "playing"
    FINISHED = "finished"


class RoomConfig(BaseModel):
    """
    Konfigurasi room yang ditentukan oleh host.
    Termasuk pengaturan Elo wager yang bisa disesuaikan.
    """
    op: MathOperation = Field(..., description="Operasi soal dalam room")
    diff: Difficulty = Field(..., description="Tingkat kesulitan soal")
    question_limit: int = Field(
        default=10,
        ge=5,
        le=50,
        description="Jumlah soal per sesi"
    )
    elo_wager: int = Field(
        default=25,
        ge=5,
        le=100,
        description=(
            "Jumlah base Elo/Rank Point yang dipertaruhkan. "
            "Digunakan sebagai multiplier dalam kalkulasi Elo."
        )
    )
    time_limit_seconds: int = Field(
        default=60,
        ge=30,
        le=300,
        description="Batas waktu per sesi dalam detik"
    )

    model_config = {"use_enum_values": True}


class RoomPlayer(BaseModel):
    """
    State seorang pemain di dalam room.
    Menyimpan skor, RP awal, dan progress jawaban.
    """
    uid: str = Field(..., description="Firebase UID pemain")
    display_name: str = Field(..., description="Nama tampilan")
    score: int = Field(default=0, ge=0, description="Skor saat ini di room")
    correct_answers: int = Field(default=0, ge=0, description="Jumlah jawaban benar")
    wrong_answers: int = Field(default=0, ge=0, description="Jumlah jawaban salah")
    current_question_index: int = Field(
        default=0,
        ge=0,
        description="Index soal yang sedang dikerjakan"
    )
    rp_before: int = Field(
        default=1200,
        description="Rank Point sebelum match (untuk kalkulasi Elo)"
    )
    is_finished: bool = Field(
        default=False,
        description="Apakah pemain sudah selesai menjawab semua soal"
    )
    finished_at: Optional[datetime] = Field(
        default=None,
        description="Waktu selesai menjawab"
    )


class Room(BaseModel):
    """
    Model lengkap satu room multiplayer.
    Menyimpan semua state yang diperlukan untuk sinkronisasi game.
    """
    room_id: str = Field(
        ...,
        min_length=6,
        max_length=6,
        description="Kode room 6 karakter (uppercase alphanumeric, exclude 0OI1L)"
    )
    host_uid: str = Field(..., description="UID pemain yang membuat room")
    status: RoomStatus = Field(
        default=RoomStatus.WAITING,
        description="Status room saat ini"
    )
    config: RoomConfig = Field(..., description="Konfigurasi permainan")
    players: Dict[str, RoomPlayer] = Field(
        default_factory=dict,
        description="Map UID → RoomPlayer untuk setiap pemain di room"
    )
    question_stack: List[MathQuestion] = Field(
        default_factory=list,
        description=(
            "Array soal yang identik untuk semua pemain. "
            "Di-generate saat game dimulai oleh math_engine."
        )
    )
    max_players: int = Field(
        default=2,
        ge=2,
        le=4,
        description="Jumlah maksimal pemain di room"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Waktu pembuatan room"
    )
    started_at: Optional[datetime] = Field(
        default=None,
        description="Waktu game dimulai"
    )
    finished_at: Optional[datetime] = Field(
        default=None,
        description="Waktu game selesai"
    )
    match_result: Optional[dict] = Field(
        default=None,
        description="Hasil kalkulasi Elo rating (MatchResult dump) setelah game selesai"
    )
    is_matchmaking: bool = Field(
        default=False,
        description="Menandakan apakah room ini adalah room matchmaking publik"
    )
    
    model_config = {"use_enum_values": True}


class RoomCreate(BaseModel):
    """Request body untuk membuat room baru."""
    config: RoomConfig = Field(..., description="Konfigurasi room")
    max_players: int = Field(default=2, ge=2, le=4)


class RoomJoin(BaseModel):
    """Request body untuk bergabung ke room."""
    room_id: str = Field(
        ...,
        min_length=6,
        max_length=6,
        description="Kode room yang ingin dimasuki"
    )


class RoomSummary(BaseModel):
    """
    Ringkasan room untuk list view — tanpa question_stack
    agar tidak bocor soal ke client sebelum game dimulai.
    """
    room_id: str
    host_uid: str
    status: RoomStatus
    config: RoomConfig
    player_count: int
    max_players: int
    created_at: datetime
    players: Dict[str, RoomPlayer] = Field(default_factory=dict)
    
    model_config = {"use_enum_values": True}


class AnswerSubmission(BaseModel):
    """Submission jawaban dari pemain di dalam room."""
    room_id: str = Field(..., description="Kode room")
    question_index: int = Field(..., ge=0, description="Index soal yang dijawab")
    answer: int = Field(..., description="Jawaban pemain")
