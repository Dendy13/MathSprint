"""
MathSprint — Auth & Token Models
==================================
Skema data untuk sistem autentikasi dan token guru.

Hierarchy:
  Developer → Bisa membuat TeacherToken
  Teacher   → Dibuat dengan TeacherToken (one-time-use)
  User      → Registrasi biasa tanpa token
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class TeacherToken(BaseModel):
    """
    Token registrasi guru — dibuat oleh Developer.
    Bersifat ONE-TIME-USE: setelah dipakai oleh satu guru, token hangus.

    Disimpan di Firestore collection: teacher_tokens/{token_id}
    """
    token_id: str = Field(..., description="Unique token identifier (UUID4)")
    token_value: str = Field(
        ...,
        description="Nilai token yang diberikan ke guru untuk registrasi"
    )
    created_by: str = Field(
        ...,
        description="UID developer yang membuat token ini"
    )
    created_by_name: str = Field(
        ...,
        description="Nama developer pembuat"
    )
    used_by: Optional[str] = Field(
        default=None,
        description="UID guru yang sudah menggunakan token ini (None jika belum dipakai)"
    )
    used_by_name: Optional[str] = Field(
        default=None,
        description="Nama guru yang menggunakan token"
    )
    is_used: bool = Field(
        default=False,
        description="Apakah token sudah dipakai"
    )
    is_revoked: bool = Field(
        default=False,
        description="Apakah token sudah dicabut oleh developer"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Waktu token dibuat"
    )
    used_at: Optional[datetime] = Field(
        default=None,
        description="Waktu token digunakan"
    )
    expires_at: Optional[datetime] = Field(
        default=None,
        description="Waktu token kadaluarsa (None = tidak ada expiry)"
    )
    label: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Label deskriptif untuk token (opsional, misal: 'Token untuk Bu Sari')"
    )


class TokenCreate(BaseModel):
    """Request body untuk membuat token guru baru (developer only)."""
    label: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Label deskriptif opsional"
    )
    expires_in_days: Optional[int] = Field(
        default=30,
        ge=1,
        le=365,
        description="Token akan expired dalam X hari (default: 30 hari)"
    )


class TokenValidate(BaseModel):
    """Request body untuk validasi token guru saat registrasi."""
    token_value: str = Field(
        ...,
        description="Nilai token yang ingin divalidasi"
    )


class TokenInfo(BaseModel):
    """Informasi token untuk ditampilkan ke developer (tanpa data sensitif berlebih)."""
    token_id: str
    token_value: str
    label: Optional[str]
    is_used: bool
    is_revoked: bool
    used_by_name: Optional[str]
    created_at: datetime
    expires_at: Optional[datetime]


class TokenListResponse(BaseModel):
    """Response berisi daftar semua token yang dibuat developer."""
    tokens: List[TokenInfo] = Field(
        default_factory=list,
        description="Daftar token"
    )
    total: int = Field(default=0, description="Total token")
    used_count: int = Field(default=0, description="Jumlah token yang sudah dipakai")
    available_count: int = Field(
        default=0,
        description="Jumlah token yang masih tersedia"
    )


class LoginRequest(BaseModel):
    """Request body untuk login."""
    email: str = Field(..., description="Email akun")
    password: str = Field(..., description="Password akun")


class LoginResponse(BaseModel):
    """Response setelah login berhasil."""
    uid: str
    display_name: str
    account_type: str
    id_token: str = Field(..., description="Firebase ID token untuk autentikasi API")
    refresh_token: str = Field(..., description="Token untuk refresh session")


class AuthError(BaseModel):
    """Error response dari auth endpoints."""
    detail: str = Field(..., description="Pesan error")
    error_code: str = Field(..., description="Kode error internal")
