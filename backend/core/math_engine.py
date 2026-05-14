"""
MathSprint — Math Core Engine (Black Box)
==========================================
Module B: Generates math questions based on operation and difficulty.

FUNGSI UTAMA:
  generate_math_question(op, diff) → MathQuestion
  generate_question_stack(op, diff, count) → QuestionStack

GUARDRAILS:
  - Pengurangan (sub): hasil TIDAK BOLEH negatif — tukar num1/num2 jika num1 < num2
  - Pembagian (div): WAJIB integer division — gunakan reverse multiplication
    (tentukan answer dulu, lalu kalikan dengan pembagi untuk dapat num1)

RANGE TABLE (dari PRD):
  ┌──────────┬────────┬───────────────┬───────────────┬─────────────────────┐
  │ Operasi  │ Diff   │ Range Angka 1 │ Range Angka 2 │ Keterangan          │
  ├──────────┼────────┼───────────────┼───────────────┼─────────────────────┤
  │ Tambah   │ Easy   │ 1 - 10        │ 1 - 10        │ Dasar               │
  │          │ Medium │ 10 - 50       │ 10 - 50       │ Dua Digit           │
  │          │ Hard   │ 50 - 100      │ 50 - 100      │ Ratusan             │
  ├──────────┼────────┼───────────────┼───────────────┼─────────────────────┤
  │ Kurang   │ Easy   │ 5 - 20        │ 1 - num1      │ Hasil Positif       │
  │          │ Medium │ 20 - 99       │ 10 - num1     │ Hasil Positif       │
  │          │ Hard   │ 100 - 500     │ 50 - 200      │ Pengurangan Kompleks│
  ├──────────┼────────┼───────────────┼───────────────┼─────────────────────┤
  │ Kali     │ Easy   │ 1 - 9         │ 1 - 5         │ Tabel Perkalian     │
  │          │ Medium │ 6 - 15        │ 6 - 10        │ Perkalian Menengah  │
  │          │ Hard   │ 11 - 20       │ 2 - 20        │ Perkalian 20        │
  ├──────────┼────────┼───────────────┼───────────────┼─────────────────────┤
  │ Bagi     │ Easy   │ a*b           │ a (1-9, b 1-5)│ Pembagian Tanpa Sisa│
  │          │ Medium │ a*b           │ a (6-15,b 6-10│ Pembagian Tanpa Sisa│
  │          │ Hard   │ a*b           │ a (11-20,b2-20│ Pembagian Tanpa Sisa│
  └──────────┴────────┴───────────────┴───────────────┴─────────────────────┘
"""

import random
from typing import Set, Tuple

from models.question import (
    Difficulty,
    MathOperation,
    MathQuestion,
    QuestionStack,
)


def _get_random(min_val: int, max_val: int) -> int:
    """
    Helper untuk generate angka acak dalam range [min_val, max_val] (inclusive).

    Args:
        min_val: Batas bawah (inclusive)
        max_val: Batas atas (inclusive)

    Returns:
        Random integer dalam range yang ditentukan
    """
    return random.randint(min_val, max_val)


def _generate_add(diff: Difficulty) -> Tuple[int, int, int]:
    """
    Generate soal penjumlahan berdasarkan difficulty.

    Returns:
        Tuple (num1, num2, answer)
    """
    if diff == Difficulty.EASY:
        num1 = _get_random(1, 10)
        num2 = _get_random(1, 10)
    elif diff == Difficulty.MEDIUM:
        num1 = _get_random(10, 50)
        num2 = _get_random(10, 50)
    else:  # HARD
        num1 = _get_random(50, 100)
        num2 = _get_random(50, 100)

    answer = num1 + num2
    return num1, num2, answer


def _generate_sub(diff: Difficulty) -> Tuple[int, int, int]:
    """
    Generate soal pengurangan berdasarkan difficulty.

    GUARDRAIL: Jika num1 < num2, tukar posisi agar hasil tidak negatif.

    Returns:
        Tuple (num1, num2, answer) dimana answer >= 0
    """
    if diff == Difficulty.EASY:
        num1 = _get_random(5, 20)
        num2 = _get_random(1, num1)
    elif diff == Difficulty.MEDIUM:
        num1 = _get_random(20, 99)
        num2 = _get_random(10, num1)
    else:  # HARD
        num1 = _get_random(100, 500)
        num2 = _get_random(50, 200)

    # GUARDRAIL: Pastikan hasil tidak negatif
    if num1 < num2:
        num1, num2 = num2, num1

    answer = num1 - num2
    return num1, num2, answer


def _generate_mul(diff: Difficulty) -> Tuple[int, int, int]:
    """
    Generate soal perkalian berdasarkan difficulty.

    Returns:
        Tuple (num1, num2, answer)
    """
    if diff == Difficulty.EASY:
        num1 = _get_random(1, 9)
        num2 = _get_random(1, 5)
    elif diff == Difficulty.MEDIUM:
        num1 = _get_random(6, 15)
        num2 = _get_random(6, 10)
    else:  # HARD
        num1 = _get_random(11, 20)
        num2 = _get_random(2, 20)

    answer = num1 * num2
    return num1, num2, answer


def _generate_div(diff: Difficulty) -> Tuple[int, int, int]:
    """
    Generate soal pembagian berdasarkan difficulty.

    GUARDRAIL: Menggunakan teknik Reverse Multiplication.
    Tentukan answer (b) dan pembagi (a) terlebih dahulu,
    lalu hitung num1 = a * b. Ini menjamin:
      - Pembagian selalu habis (integer division, tanpa sisa)
      - num1 ÷ a = b (jawaban)

    Returns:
        Tuple (num1, num2, answer) dimana num1 = num2 * answer
    """
    if diff == Difficulty.EASY:
        # a = pembagi (1-9), b = jawaban (1-5)
        a = _get_random(1, 9)
        b = _get_random(1, 5)
    elif diff == Difficulty.MEDIUM:
        # a = pembagi (6-15), b = jawaban (6-10)
        a = _get_random(6, 15)
        b = _get_random(6, 10)
    else:  # HARD
        # a = pembagi (11-20), b = jawaban (2-20)
        a = _get_random(11, 20)
        b = _get_random(2, 20)

    # Reverse Multiplication: num1 = a * b, sehingga num1 / a = b
    num1 = a * b
    num2 = a
    answer = b

    return num1, num2, answer


# Mapping operasi ke generator function
_GENERATORS = {
    MathOperation.ADD: _generate_add,
    MathOperation.SUB: _generate_sub,
    MathOperation.MUL: _generate_mul,
    MathOperation.DIV: _generate_div,
}


def generate_math_question(op: MathOperation, diff: Difficulty) -> MathQuestion:
    """
    Generate satu soal matematika berdasarkan operasi dan difficulty.

    Args:
        op: Operasi matematika (add, sub, mul, div)
        diff: Tingkat kesulitan (easy, medium, hard)

    Returns:
        MathQuestion dengan num1, num2, op, dan answer yang valid.

    Raises:
        ValueError: Jika operasi tidak dikenali

    Examples:
        >>> q = generate_math_question(MathOperation.ADD, Difficulty.EASY)
        >>> q.answer == q.num1 + q.num2
        True

        >>> q = generate_math_question(MathOperation.SUB, Difficulty.HARD)
        >>> q.answer >= 0
        True

        >>> q = generate_math_question(MathOperation.DIV, Difficulty.MEDIUM)
        >>> q.num1 % q.num2 == 0
        True
    """
    generator = _GENERATORS.get(op)
    if generator is None:
        raise ValueError(
            f"Operasi '{op}' tidak dikenali. "
            f"Gunakan salah satu: {list(MathOperation)}"
        )

    num1, num2, answer = generator(diff)

    return MathQuestion(
        num1=num1,
        num2=num2,
        op=op,
        answer=answer,
    )


def generate_question_stack(
    op: MathOperation,
    diff: Difficulty,
    count: int = 10,
) -> QuestionStack:
    """
    Generate sekumpulan soal unik untuk satu sesi permainan.

    Semua soal dalam stack dijamin unik (tidak ada kombinasi num1+num2
    yang sama). Jika jumlah kombinasi unik tidak cukup, fungsi akan
    mengembalikan sebanyak yang berhasil digenerate.

    Soal akan di-shuffle secara random setelah generate.

    Args:
        op: Operasi matematika
        diff: Tingkat kesulitan
        count: Jumlah soal yang diminta (1-50)

    Returns:
        QuestionStack berisi array soal dengan urutan acak

    Notes:
        Stack ini digunakan di Room agar kedua pemain mendapat
        urutan dan angka soal yang 100% IDENTIK.
    """
    questions: list[MathQuestion] = []
    seen_pairs: Set[Tuple[int, int, str]] = set()
    max_attempts = count * 10  # Batas percobaan untuk menghindari infinite loop
    attempts = 0

    while len(questions) < count and attempts < max_attempts:
        attempts += 1
        question = generate_math_question(op, diff)

        # Cek duplikasi berdasarkan kombinasi (num1, num2, op)
        pair_key = (question.num1, question.num2, question.op.value)
        if pair_key not in seen_pairs:
            seen_pairs.add(pair_key)
            questions.append(question)

    # Fisher-Yates shuffle
    random.shuffle(questions)

    return QuestionStack(
        questions=questions,
        op=op,
        diff=diff,
        count=len(questions),
    )
