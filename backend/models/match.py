"""
MathSprint — Match Result & Elo Calculation Models
====================================================
Skema data untuk hasil pertandingan dan kalkulasi Elo Rating.

Elo Algorithm:
  - K-Factor: 32 (fixed)
  - Learning Protection: streak > 3 hari → 30% diskon kerugian RP
  - Difficulty Multiplier: easy=0.8, medium=1.0, hard=1.2
  - Hasil akhir wajib integer (pembulatan)
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from models.question import Difficulty, MathOperation


class EloCalculation(BaseModel):
    """
    Detail kalkulasi Elo untuk satu pemain setelah match.
    Menyimpan semua intermediate values untuk transparansi.
    """
    player_uid: str = Field(..., description="UID pemain")
    display_name: str = Field(..., description="Nama pemain")
    old_rp: int = Field(..., description="Rank Point sebelum match")
    new_rp: int = Field(..., description="Rank Point setelah match")
    rp_change: int = Field(
        ...,
        description="Perubahan RP (positif = naik, negatif = turun)"
    )
    expected_score: float = Field(
        ...,
        description="Expected score dari formula Elo (0.0 - 1.0)"
    )
    actual_score: float = Field(
        ...,
        description="Actual score (1.0 = menang, 0.5 = seri, 0.0 = kalah)"
    )
    difficulty_multiplier: float = Field(
        ...,
        description="Multiplier berdasarkan difficulty (0.8 / 1.0 / 1.2)"
    )
    learning_protection_applied: bool = Field(
        default=False,
        description="Apakah Learning Protection aktif (streak > 3, kalah → diskon 30%)"
    )
    learning_streak_days: int = Field(
        default=0,
        description="Streak days pemain saat match"
    )


class MatchResult(BaseModel):
    """
    Hasil lengkap satu pertandingan antara dua pemain.
    Output dari rank_engine.process_match_result().
    """
    match_id: str = Field(..., description="Unique match identifier")
    room_id: str = Field(..., description="Room tempat match berlangsung")
    winner_uid: Optional[str] = Field(
        default=None,
        description="UID pemenang (None jika seri)"
    )
    loser_uid: Optional[str] = Field(
        default=None,
        description="UID yang kalah (None jika seri)"
    )
    is_draw: bool = Field(
        default=False,
        description="Apakah match berakhir seri"
    )
    winner_calculation: EloCalculation = Field(
        ...,
        description="Detail Elo pemenang"
    )
    loser_calculation: EloCalculation = Field(
        ...,
        description="Detail Elo yang kalah"
    )
    op: MathOperation = Field(..., description="Operasi yang dimainkan")
    diff: Difficulty = Field(..., description="Difficulty yang dimainkan")
    score_diff: int = Field(
        ...,
        description="Selisih skor (winner_score - loser_score)"
    )
    elo_wager: int = Field(
        ...,
        description="Base Elo yang dipertaruhkan"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Waktu match selesai"
    )


class MatchSubmission(BaseModel):
    """
    Request untuk menyelesaikan match dan menghitung hasil.
    Dikirim setelah kedua pemain selesai menjawab.
    """
    room_id: str = Field(..., description="Room ID yang matchnya selesai")


class SoloMatchSubmission(BaseModel):
    """Hasil akhir dari permainan mode Solo."""
    op: MathOperation = Field(..., description="Operasi matematika")
    diff: Difficulty = Field(..., description="Tingkat kesulitan")
    correct: int = Field(..., description="Jumlah jawaban benar")
    wrong: int = Field(..., description="Jumlah jawaban salah")
    total: int = Field(..., description="Total soal")
    max_streak: int = Field(..., description="Combo tertinggi")
    elapsed_seconds: int = Field(..., description="Waktu pengerjaan")


class SoloMatchResult(BaseModel):
    """Hasil dari kalkulasi rank point mode Solo."""
    match_id: str
    player_uid: str
    old_rp: int
    new_rp: int
    rp_change: int
    correct: int
    wrong: int
    total: int
    max_streak: int
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MatchHistory(BaseModel):
    """Satu entry di riwayat pertandingan pemain."""
    match_id: str
    opponent_uid: str
    opponent_name: str
    result: str = Field(..., description="win / loss / draw")
    rp_change: int
    old_rp: int
    new_rp: int
    op: MathOperation
    diff: Difficulty
    my_score: int
    opponent_score: int
    created_at: datetime


class LeaderboardEntry(BaseModel):
    """Satu entry di leaderboard ranking."""
    rank: int = Field(..., ge=1, description="Posisi di leaderboard")
    uid: str
    display_name: str
    current_rank_point: int
    total_matches: int
    wins: int
    losses: int
    win_rate: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Win rate dalam persen"
    )
