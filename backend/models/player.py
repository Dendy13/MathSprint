"""
MathSprint — Player Profile Models
===================================
Skema data untuk profil pemain, termasuk account type hierarchy.

Account Types:
  - user     : Akun umum, bisa main dan masuk room
  - teacher  : Akun guru, bisa buat room + lihat dashboard murid
  - developer: Akun admin, bisa generate token guru + manage system
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class AccountType(str, Enum):
    """Tipe akun dalam sistem MathSprint."""
    USER = "user"
    TEACHER = "teacher"
    DEVELOPER = "developer"


class PlayerProfile(BaseModel):
    """
    Profil lengkap pemain — representasi dokumen Firestore `users/{uid}`.
    Ini adalah model utama yang digunakan di seluruh sistem.
    """
    uid: str = Field(..., description="Firebase Auth UID")
    display_name: str = Field(
        ...,
        min_length=2,
        max_length=30,
        description="Nama tampilan pemain"
    )
    email: str = Field(..., description="Email pemain")
    account_type: AccountType = Field(
        default=AccountType.USER,
        description="Tipe akun: user, teacher, atau developer"
    )
    current_rank_point: int = Field(
        default=1200,
        ge=0,
        description="Rank Point (RP) saat ini, default 1200 (Elo baseline)"
    )
    total_matches: int = Field(
        default=0,
        ge=0,
        description="Total pertandingan yang telah dimainkan"
    )
    wins: int = Field(default=0, ge=0, description="Total kemenangan")
    losses: int = Field(default=0, ge=0, description="Total kekalahan")
    draws: int = Field(default=0, ge=0, description="Total seri")
    learning_streak_days: int = Field(
        default=0,
        ge=0,
        description="Jumlah hari berturut-turut bermain (untuk Learning Protection)"
    )
    friends_list: List[str] = Field(
        default_factory=list,
        description="Daftar UID teman yang sudah accepted"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Waktu pembuatan akun"
    )
    last_active: datetime = Field(
        default_factory=datetime.utcnow,
        description="Waktu terakhir aktif"
    )

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, v: str) -> str:
        """Nama hanya boleh berisi huruf, angka, spasi, dan underscore."""
        import re
        if not re.match(r"^[a-zA-Z0-9_ ]+$", v):
            raise ValueError(
                "Display name hanya boleh berisi huruf, angka, spasi, dan underscore"
            )
        return v.strip()


class PlayerCreate(BaseModel):
    """Skema untuk membuat akun baru."""
    display_name: str = Field(
        ...,
        min_length=2,
        max_length=30,
        description="Nama tampilan"
    )
    email: str = Field(..., description="Email untuk registrasi")
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Password minimal 8 karakter"
    )
    account_type: AccountType = Field(
        default=AccountType.USER,
        description="Tipe akun yang ingin dibuat"
    )
    teacher_token: Optional[str] = Field(
        default=None,
        description="Token registrasi guru (wajib jika account_type=teacher)"
    )

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, v: str) -> str:
        import re
        if not re.match(r"^[a-zA-Z0-9_ ]+$", v):
            raise ValueError(
                "Display name hanya boleh berisi huruf, angka, spasi, dan underscore"
            )
        return v.strip()


class PlayerUpdate(BaseModel):
    """Skema untuk update profil pemain. Hanya field yang diisi yang akan diupdate."""
    display_name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=30
    )

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            import re
            if not re.match(r"^[a-zA-Z0-9_ ]+$", v):
                raise ValueError(
                    "Display name hanya boleh berisi huruf, angka, spasi, dan underscore"
                )
            return v.strip()
        return v


class PlayerPublic(BaseModel):
    """
    Versi publik dari profil pemain — tanpa data sensitif.
    Digunakan untuk leaderboard, friend list, room display, dll.
    """
    uid: str
    display_name: str
    account_type: AccountType
    current_rank_point: int
    total_matches: int
    wins: int = 0
    losses: int = 0
    learning_streak_days: int = 0


class PlayerRankInfo(BaseModel):
    """Informasi rank singkat untuk display di room dan leaderboard."""
    uid: str
    display_name: str
    current_rank_point: int
    total_matches: int
