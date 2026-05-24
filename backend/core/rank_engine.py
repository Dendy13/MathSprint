"""
MathSprint — Match Resolution & Rank Calculation Engine
=========================================================
Module D: Elo Rating System with Learning Protection.

ALGORITHM:
  1. Expected Score:  E = 1 / (1 + 10^((opponent_rp - player_rp) / 400))
  2. Difficulty Mult:  easy=0.8, medium=1.0, hard=1.2
  3. Score Factor:     (score_diff / max_score) * diff_multiplier
  4. RP Change:        K * (actual - expected) * score_factor * wager_mult
  5. Learning Protection: if loser.streak > 3 → rp_loss * 0.7 (30% discount)
  6. Final RP:         int(round(rp_change))

K-Factor: 32 (fixed)
"""

import math
import uuid
from datetime import datetime

from models.match import EloCalculation, MatchResult
from models.player import PlayerProfile
from models.question import Difficulty, MathOperation
from models.room import Room, RoomPlayer

# Constants
K_FACTOR: int = 32
ELO_BASE: int = 1200

DIFFICULTY_MULTIPLIER: dict[str, float] = {
    Difficulty.EASY: 0.8,
    Difficulty.MEDIUM: 1.0,
    Difficulty.HARD: 1.2,
}

LEARNING_PROTECTION_STREAK_THRESHOLD: int = 3
LEARNING_PROTECTION_DISCOUNT: float = 0.7  # 30% discount → multiply by 0.7


def _calculate_expected_score(player_rp: int, opponent_rp: int) -> float:
    """
    Hitung expected score menggunakan formula Elo standar.

    E = 1 / (1 + 10^((Ro - Rp) / 400))

    Args:
        player_rp: Rank Point pemain
        opponent_rp: Rank Point lawan

    Returns:
        Expected score (float 0.0 - 1.0)
    """
    exponent = (opponent_rp - player_rp) / 400.0
    return 1.0 / (1.0 + math.pow(10, exponent))


def _calculate_rp_change(
    player_rp: int,
    opponent_rp: int,
    actual_score: float,
    difficulty: Difficulty,
    score_diff: int,
    max_possible_score: int,
    elo_wager: int,
) -> tuple[int, float, float]:
    """
    Hitung perubahan RP untuk satu pemain.

    Args:
        player_rp: RP pemain saat ini
        opponent_rp: RP lawan saat ini
        actual_score: 1.0 (menang), 0.5 (seri), 0.0 (kalah)
        difficulty: Tingkat kesulitan
        score_diff: Selisih skor (absolute)
        max_possible_score: Skor maksimal yang mungkin
        elo_wager: Base Elo yang dipertaruhkan

    Returns:
        Tuple (rp_change, expected_score, diff_multiplier)
    """
    expected = _calculate_expected_score(player_rp, opponent_rp)
    diff_mult = DIFFICULTY_MULTIPLIER.get(difficulty, 1.0)

    # Score factor: seberapa dominan kemenangannya
    if max_possible_score > 0:
        score_factor = (score_diff / max_possible_score) * diff_mult
    else:
        score_factor = diff_mult

    # Wager multiplier: berapa banyak RP yang dipertaruhkan
    wager_mult = elo_wager / 25.0  # Normalize to base 25

    # RP change calculation
    rp_change_raw = K_FACTOR * (actual_score - expected) * score_factor * wager_mult
    rp_change = int(round(rp_change_raw))

    return rp_change, expected, diff_mult


def process_match_result(
    room: Room,
) -> MatchResult:
    """
    Proses hasil match setelah kedua pemain selesai.

    Menghitung Elo Rating change untuk kedua pemain berdasarkan:
      - Skor masing-masing
      - RP saat ini
      - Difficulty soal
      - Elo wager yang dipertaruhkan
      - Learning Protection (jika applicable)

    Args:
        room: Room yang sudah FINISHED dengan semua pemain selesai

    Returns:
        MatchResult dengan detail Elo calculation untuk kedua pemain

    Raises:
        ValueError: Room belum selesai atau jumlah pemain != 2
    """
    if len(room.players) != 2:
        raise ValueError(f"Match resolution memerlukan 2 pemain, ada {len(room.players)}")

    players = list(room.players.values())
    p1, p2 = players[0], players[1]

    # Determine winner/loser
    is_draw = p1.score == p2.score
    if is_draw:
        winner, loser = p1, p2  # Arbitrary for draw
        winner_actual, loser_actual = 0.5, 0.5
    elif p1.score > p2.score:
        winner, loser = p1, p2
        winner_actual, loser_actual = 1.0, 0.0
    else:
        winner, loser = p2, p1
        winner_actual, loser_actual = 1.0, 0.0

    score_diff = abs(winner.score - loser.score)
    max_score = len(room.question_stack) * 100  # max possible score

    # Calculate RP changes
    winner_rp_change, winner_expected, diff_mult = _calculate_rp_change(
        player_rp=winner.rp_before,
        opponent_rp=loser.rp_before,
        actual_score=winner_actual,
        difficulty=room.config.diff,
        score_diff=score_diff,
        max_possible_score=max_score,
        elo_wager=room.config.elo_wager,
    )

    loser_rp_change, loser_expected, _ = _calculate_rp_change(
        player_rp=loser.rp_before,
        opponent_rp=winner.rp_before,
        actual_score=loser_actual,
        difficulty=room.config.diff,
        score_diff=score_diff,
        max_possible_score=max_score,
        elo_wager=room.config.elo_wager,
    )

    # Learning Protection check (placeholder — streak from profile)
    # In production, fetch player profile to get learning_streak_days
    loser_learning_protection = False
    loser_streak = 0  # Will be fetched from Firestore in production

    # Apply learning protection: if loser has streak > 3, discount loss by 30%
    if not is_draw and loser_streak > LEARNING_PROTECTION_STREAK_THRESHOLD:
        loser_rp_change = int(round(loser_rp_change * LEARNING_PROTECTION_DISCOUNT))
        loser_learning_protection = True

    # Ensure RP doesn't go below 0
    winner_new_rp = max(0, winner.rp_before + winner_rp_change)
    loser_new_rp = max(0, loser.rp_before + loser_rp_change)

    # Build Elo calculation details
    winner_calc = EloCalculation(
        player_uid=winner.uid,
        display_name=winner.display_name,
        old_rp=winner.rp_before,
        new_rp=winner_new_rp,
        rp_change=winner_rp_change,
        expected_score=round(winner_expected, 4),
        actual_score=winner_actual,
        difficulty_multiplier=diff_mult,
        learning_protection_applied=False,
        learning_streak_days=0,
    )

    loser_calc = EloCalculation(
        player_uid=loser.uid,
        display_name=loser.display_name,
        old_rp=loser.rp_before,
        new_rp=loser_new_rp,
        rp_change=loser_rp_change,
        expected_score=round(loser_expected, 4),
        actual_score=loser_actual,
        difficulty_multiplier=diff_mult,
        learning_protection_applied=loser_learning_protection,
        learning_streak_days=loser_streak,
    )

    match_id = str(uuid.uuid4())

    return MatchResult(
        match_id=match_id,
        room_id=room.room_id,
        winner_uid=winner.uid if not is_draw else None,
        loser_uid=loser.uid if not is_draw else None,
        is_draw=is_draw,
        winner_calculation=winner_calc,
        loser_calculation=loser_calc,
        op=room.config.op,
        diff=room.config.diff,
        score_diff=score_diff,
        elo_wager=room.config.elo_wager,
        created_at=datetime.utcnow(),
    )


def process_solo_match(player: PlayerProfile, submission: 'SoloMatchSubmission') -> 'SoloMatchResult':
    """
    Kalkulasi RP dan Skor untuk mode Solo Endless.
    Logika penilaian:
    - Base Skor = + (benar) dan - (salah) berdasarkan difficulty.
    - Combo Bonus = max_streak * multiplier
    - RP didapatkan sangat sedikit: 1 RP setiap 5 soal benar.
    """
    from models.match import SoloMatchResult
    
    # Base points based on difficulty
    if submission.diff == Difficulty.EASY:
        base_correct = 2
        base_wrong = 1
        combo_mult = 1
    elif submission.diff == Difficulty.MEDIUM:
        base_correct = 3
        base_wrong = 2
        combo_mult = 2
    else:  # HARD
        base_correct = 5
        base_wrong = 3
        combo_mult = 3

    points_gained = submission.correct * base_correct
    points_lost = submission.wrong * base_wrong
    combo_bonus = submission.max_streak * combo_mult
    
    score = max(0, points_gained - points_lost + combo_bonus)
    
    # RP change is minimal: 1 RP per 5 correct answers
    rp_change = submission.correct // 5
        
    old_rp = player.current_rank_point
    new_rp = old_rp + rp_change
    
    match_id = str(uuid.uuid4())
    
    return SoloMatchResult(
        match_id=match_id,
        player_uid=player.uid,
        display_name=player.display_name,
        old_rp=old_rp,
        new_rp=new_rp,
        rp_change=rp_change,
        op=submission.op,
        diff=submission.diff,
        score=score,
        correct=submission.correct,
        wrong=submission.wrong,
        total=submission.total,
        max_streak=submission.max_streak,
    )
