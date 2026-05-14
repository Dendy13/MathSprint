"""
MathSprint — Friend API Routes
================================
Endpoints for friend system: request, respond, list, remove, invite.

POST   /friend/request      — Send friend request
PUT    /friend/respond       — Accept/reject friend request
GET    /friend/list          — Get friend list
DELETE /friend/remove/{uid}  — Remove friend
POST   /friend/invite-room   — Invite friend to room
GET    /friend/requests      — Get pending friend requests
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth_engine import get_player, update_player
from models.friend import (
    FriendInfo,
    FriendList,
    FriendRequest,
    FriendRequestCreate,
    FriendRequestRespond,
    FriendRequestStatus,
    RoomInvite,
)
from services.auth_service import get_current_uid

router = APIRouter(prefix="/friend", tags=["Friends"])

# In-memory friend request store
_friend_requests: dict[str, FriendRequest] = {}


@router.post(
    "/request",
    response_model=FriendRequest,
    status_code=status.HTTP_201_CREATED,
    summary="Kirim friend request",
    description="Kirim permintaan pertemanan ke pemain lain.",
)
async def send_friend_request(
    data: FriendRequestCreate,
    uid: str = Depends(get_current_uid),
):
    """Kirim friend request. Tidak bisa mengirim ke diri sendiri."""
    if uid == data.to_uid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tidak bisa mengirim friend request ke diri sendiri.",
        )

    sender = get_player(uid)
    if sender is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profil pengirim tidak ditemukan.",
        )

    receiver = get_player(data.to_uid)
    if receiver is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pemain yang dituju tidak ditemukan.",
        )

    # Check if already friends
    if data.to_uid in sender.friends_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pemain ini sudah ada di daftar teman kamu.",
        )

    # Check for existing pending request
    for req in _friend_requests.values():
        if (
            req.from_uid == uid
            and req.to_uid == data.to_uid
            and req.status == FriendRequestStatus.PENDING
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sudah ada friend request yang menunggu ke pemain ini.",
            )

    request_id = str(uuid.uuid4())
    friend_req = FriendRequest(
        request_id=request_id,
        from_uid=uid,
        from_display_name=sender.display_name,
        to_uid=data.to_uid,
        to_display_name=receiver.display_name,
        status=FriendRequestStatus.PENDING,
        created_at=datetime.utcnow(),
    )

    _friend_requests[request_id] = friend_req
    return friend_req


@router.put(
    "/respond",
    response_model=FriendRequest,
    summary="Respons friend request",
    description="Terima atau tolak friend request yang masuk.",
)
async def respond_friend_request(
    data: FriendRequestRespond,
    uid: str = Depends(get_current_uid),
):
    """Accept atau reject friend request."""
    friend_req = _friend_requests.get(data.request_id)
    if friend_req is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friend request tidak ditemukan.",
        )

    if friend_req.to_uid != uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kamu tidak berhak merespons friend request ini.",
        )

    if friend_req.status != FriendRequestStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Friend request sudah direspons ({friend_req.status}).",
        )

    if data.action not in (FriendRequestStatus.ACCEPTED, FriendRequestStatus.REJECTED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Action harus 'accepted' atau 'rejected'.",
        )

    friend_req.status = data.action
    friend_req.responded_at = datetime.utcnow()
    _friend_requests[data.request_id] = friend_req

    # If accepted, add each other to friends list
    if data.action == FriendRequestStatus.ACCEPTED:
        sender = get_player(friend_req.from_uid)
        receiver = get_player(friend_req.to_uid)

        if sender and receiver:
            sender.friends_list.append(receiver.uid)
            receiver.friends_list.append(sender.uid)
            update_player(sender.uid, friends_list=sender.friends_list)
            update_player(receiver.uid, friends_list=receiver.friends_list)

    return friend_req


@router.get(
    "/list",
    response_model=FriendList,
    summary="Daftar teman",
    description="Ambil daftar teman yang sudah accepted.",
)
async def get_friend_list(
    uid: str = Depends(get_current_uid),
):
    """Ambil friend list user yang sedang login."""
    player = get_player(uid)
    if player is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profil tidak ditemukan.",
        )

    friends = []
    for friend_uid in player.friends_list:
        friend = get_player(friend_uid)
        if friend:
            friends.append(FriendInfo(
                uid=friend.uid,
                display_name=friend.display_name,
                current_rank_point=friend.current_rank_point,
                is_online=False,  # TODO: Implement online status
                last_active=friend.last_active,
            ))

    return FriendList(
        player_uid=uid,
        friends=friends,
        total_friends=len(friends),
    )


@router.delete(
    "/remove/{friend_uid}",
    summary="Hapus teman",
    description="Hapus pemain dari daftar teman (mutual).",
)
async def remove_friend(
    friend_uid: str,
    uid: str = Depends(get_current_uid),
):
    """Hapus teman. Kedua belah pihak akan dihapus dari friend list."""
    player = get_player(uid)
    friend = get_player(friend_uid)

    if player is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profil tidak ditemukan.",
        )

    if friend_uid not in player.friends_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pemain ini bukan teman kamu.",
        )

    # Remove mutual
    player.friends_list.remove(friend_uid)
    update_player(uid, friends_list=player.friends_list)

    if friend and uid in friend.friends_list:
        friend.friends_list.remove(uid)
        update_player(friend_uid, friends_list=friend.friends_list)

    return {"message": f"Berhasil menghapus teman."}


@router.post(
    "/invite-room",
    response_model=RoomInvite,
    status_code=status.HTTP_201_CREATED,
    summary="Undang teman ke room",
    description="Kirim undangan room ke teman.",
)
async def invite_friend_to_room(
    invite: RoomInvite,
    uid: str = Depends(get_current_uid),
):
    """Undang teman ke room. Teman harus ada di friend list."""
    player = get_player(uid)
    if player is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profil tidak ditemukan.",
        )

    if invite.to_uid not in player.friends_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pemain yang diundang bukan teman kamu. Tambahkan dulu sebagai teman.",
        )

    # Validate room exists
    from core.room_engine import get_room
    room = get_room(invite.room_id.upper())
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Room '{invite.room_id}' tidak ditemukan.",
        )

    return RoomInvite(
        from_uid=uid,
        from_display_name=player.display_name,
        to_uid=invite.to_uid,
        room_id=invite.room_id.upper(),
        created_at=datetime.utcnow(),
    )


@router.get(
    "/requests",
    response_model=list[FriendRequest],
    summary="Friend requests masuk",
    description="Daftar friend request yang menunggu respons.",
)
async def get_pending_requests(
    uid: str = Depends(get_current_uid),
):
    """Ambil semua friend request yang status-nya pending."""
    return [
        req for req in _friend_requests.values()
        if req.to_uid == uid and req.status == FriendRequestStatus.PENDING
    ]
