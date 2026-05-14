"""
MathSprint — Friend System Models
===================================
Skema data untuk sistem pertemanan.
Friend request lifecycle: pending → accepted / rejected
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class FriendRequestStatus(str, Enum):
    """Status friend request."""
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class FriendRequest(BaseModel):
    """
    Dokumen friend request — disimpan di Firestore subcollection:
    users/{to_uid}/friend_requests/{request_id}
    """
    request_id: str = Field(..., description="Unique request identifier")
    from_uid: str = Field(..., description="UID pengirim request")
    from_display_name: str = Field(..., description="Nama pengirim")
    to_uid: str = Field(..., description="UID penerima request")
    to_display_name: str = Field(..., description="Nama penerima")
    status: FriendRequestStatus = Field(
        default=FriendRequestStatus.PENDING,
        description="Status request saat ini"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Waktu request dikirim"
    )
    responded_at: Optional[datetime] = Field(
        default=None,
        description="Waktu request dijawab (accepted/rejected)"
    )


class FriendRequestCreate(BaseModel):
    """Request body untuk mengirim friend request."""
    to_uid: str = Field(..., description="UID yang ingin ditambahkan sebagai teman")


class FriendRequestRespond(BaseModel):
    """Request body untuk merespons friend request."""
    request_id: str = Field(..., description="ID friend request yang direspons")
    action: FriendRequestStatus = Field(
        ...,
        description="accepted atau rejected"
    )


class FriendInfo(BaseModel):
    """Informasi singkat satu teman untuk tampilan friend list."""
    uid: str
    display_name: str
    current_rank_point: int
    is_online: bool = Field(
        default=False,
        description="Apakah teman sedang online"
    )
    last_active: Optional[datetime] = None


class FriendList(BaseModel):
    """Daftar lengkap teman seorang pemain."""
    player_uid: str = Field(..., description="UID pemilik friend list")
    friends: List[FriendInfo] = Field(
        default_factory=list,
        description="Daftar teman yang sudah accepted"
    )
    total_friends: int = Field(default=0, description="Total jumlah teman")


class RoomInvite(BaseModel):
    """Undangan untuk bergabung ke room dari teman."""
    from_uid: str = Field(..., description="UID pengirim undangan")
    from_display_name: str = Field(..., description="Nama pengirim")
    to_uid: str = Field(..., description="UID penerima undangan")
    room_id: str = Field(
        ...,
        min_length=6,
        max_length=6,
        description="Kode room yang diundang"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Waktu undangan dikirim"
    )
