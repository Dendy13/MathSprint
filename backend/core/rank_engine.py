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
ELO_BASE: int = 100

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

    # Wager multiplier tidak ada lagi, diset tetap ke 1.0
    wager_mult = 1.0

    # RP change calculation
    rp_change_raw = K_FACTOR * (actual_score - expected) * score_factor * wager_mult
    rp_change = int(round(rp_change_raw))

    return rp_change, expected, diff_mult


def process_match_result(
    room: Room,
) -> MatchResult:
    """
    Proses hasil match setelah semua pemain selesai.

    Menghitung Elo Rating change untuk pertandingan <= 4 pemain (FFA Elo),
    dan sistem Positive Reinforcement (0 hukuman RP) untuk > 4 pemain (Classroom Mode).
    """
    players = list(room.players.values())
    
    # Sort players by score descending, then by finished_at timestamp ascending
    players.sort(key=lambda p: (-p.score, p.finished_at.timestamp() if p.finished_at else 0))

    max_score = len(room.question_stack) * 100
    num_players = len(players)
    
    if num_players < 10:
        winner_count = 3
    elif num_players < 20:
        winner_count = 5
    else:
        winner_count = 10
        
    winners = []
    calculations = []
    
    highest_score = players[0].score if players else 0
    
    for i, p in enumerate(players):
        # Determine if they are tied for 1st place
        if p.score == highest_score and highest_score > 0:
            winners.append(p.uid)
            
        rp_change = 0
        
        # Positive reinforcement for Classroom Mode
        if num_players > 4:
            if i == 0:
                rp_change = 50
            elif i == 1:
                rp_change = 30
            elif i == 2:
                rp_change = 20
            elif i < winner_count:
                rp_change = 10
            else:
                rp_change = 0
                
            expected_score_avg = 0.0
            actual_score_avg = 0.0
            diff_mult = DIFFICULTY_MULTIPLIER.get(room.config.diff, 1.0)
            
        else:
            # Traditional FFA Elo for <= 4 players
            total_rp_change = 0
            total_expected = 0.0
            total_actual = 0.0
            diff_mult = 1.0
            
            for j, opp in enumerate(players):
                if i == j: continue
                
                # 1v1 outcome
                if p.score > opp.score:
                    actual = 1.0
                elif p.score == opp.score:
                    actual = 0.5
                else:
                    actual = 0.0
                    
                score_diff = abs(p.score - opp.score)
                rp_c, exp, d_mult = _calculate_rp_change(
                    player_rp=p.rp_before,
                    opponent_rp=opp.rp_before,
                    actual_score=actual,
                    difficulty=room.config.diff,
                    score_diff=score_diff,
                    max_possible_score=max_score,
                )
                
                total_rp_change += rp_c
                total_expected += exp
                total_actual += actual
                diff_mult = d_mult
                
            if num_players > 1:
                rp_change = int(round(total_rp_change / (num_players - 1)))
                expected_score_avg = total_expected / (num_players - 1)
                actual_score_avg = total_actual / (num_players - 1)
            else:
                rp_change = 0
                expected_score_avg = 0.0
                actual_score_avg = 0.0
                
            # Learning protection for losers (not 1st place)
            if i > 0 and rp_change < 0:
                loser_streak = 0 # In production, fetch from profile
                if loser_streak > LEARNING_PROTECTION_STREAK_THRESHOLD:
                    rp_change = int(round(rp_change * LEARNING_PROTECTION_DISCOUNT))

        # Zero out RP changes if this is an unranked room (User hosted)
        if not room.is_ranked:
            rp_change = 0

        new_rp = max(0, p.rp_before + rp_change)
        
        calc = EloCalculation(
            player_uid=p.uid,
            display_name=p.display_name,
            old_rp=p.rp_before,
            new_rp=new_rp,
            rp_change=rp_change,
            expected_score=round(expected_score_avg, 4),
            actual_score=actual_score_avg,
            difficulty_multiplier=diff_mult,
            learning_protection_applied=False,
            learning_streak_days=0,
        )
        calculations.append(calc)

    is_draw = len(winners) > 1

    return MatchResult(
        match_id=str(uuid.uuid4()),
        room_id=room.room_id,
        winners=winners,
        is_draw=is_draw,
        calculations=calculations,
        op=room.config.op,
        diff=room.config.diff,
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
