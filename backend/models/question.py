"""
MathSprint — Math Question Models
===================================
Skema data untuk soal matematika dan question stack.

Operasi yang diizinkan: add, sub, mul, div
Difficulty: easy, medium, hard
"""

from enum import Enum
from typing import List

from pydantic import BaseModel, Field


class MathOperation(str, Enum):
    """Operasi matematika yang tersedia."""
    ADD = "add"
    SUB = "sub"
    MUL = "mul"
    DIV = "div"


class Difficulty(str, Enum):
    """Tingkat kesulitan soal."""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class MathQuestion(BaseModel):
    """
    Satu soal matematika — output dari math_engine.generate_math_question().

    Contoh:
        {"num1": 42, "num2": 15, "op": "add", "answer": 57}

    Guardrails yang ditegakkan oleh engine:
      - sub: answer >= 0 (num1 >= num2, tukar jika perlu)
      - div: answer adalah integer (reverse multiplication)
    """
    num1: int = Field(..., description="Angka pertama")
    num2: int = Field(..., description="Angka kedua")
    op: MathOperation = Field(..., description="Operasi: add, sub, mul, div")
    answer: int = Field(..., description="Jawaban yang benar")


class QuestionRequest(BaseModel):
    """Request untuk generate satu soal."""
    op: MathOperation = Field(..., description="Operasi yang diminta")
    diff: Difficulty = Field(..., description="Tingkat kesulitan")


class QuestionStackRequest(BaseModel):
    """Request untuk generate sekumpulan soal (untuk room)."""
    op: MathOperation = Field(..., description="Operasi yang diminta")
    diff: Difficulty = Field(..., description="Tingkat kesulitan")
    count: int = Field(
        default=10,
        ge=1,
        le=50,
        description="Jumlah soal yang akan digenerate"
    )


class QuestionStack(BaseModel):
    """
    Kumpulan soal yang digenerate untuk satu sesi permainan.
    Digunakan di Room agar kedua pemain mendapat soal 100% identik.
    """
    questions: List[MathQuestion] = Field(
        ...,
        description="Array soal dalam urutan yang sama untuk semua pemain"
    )
    op: MathOperation = Field(..., description="Operasi yang digunakan")
    diff: Difficulty = Field(..., description="Difficulty yang digunakan")
    count: int = Field(..., description="Jumlah soal dalam stack")
