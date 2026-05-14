"""
MathSprint — Auth Service
===========================
Firebase Authentication integration layer.

Handles:
  - User creation in Firebase Auth
  - Custom claims for account_type (user/teacher/developer)
  - ID token verification middleware
  - Current user extraction from request
"""

from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from models.player import AccountType, PlayerProfile
from services.firebase_client import (
    create_firebase_user,
    set_custom_claims,
    verify_id_token,
)

# HTTP Bearer token scheme for Swagger docs
_bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> dict:
    """
    Extract and verify Firebase ID token from Authorization header.

    Args:
        credentials: Bearer token from Authorization header

    Returns:
        Decoded token claims dict with uid, email, custom claims, etc.

    Raises:
        HTTPException 401: If token is missing or invalid
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token autentikasi tidak ditemukan. Sertakan header Authorization: Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        decoded_token = verify_id_token(credentials.credentials)
        return decoded_token
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token tidak valid atau sudah expired: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_uid(
    token: dict = Depends(get_current_user_token),
) -> str:
    """Extract UID from verified token. Shorthand dependency."""
    return token.get("uid", "")


async def require_account_type(
    required_type: AccountType,
    token: dict = Depends(get_current_user_token),
) -> dict:
    """
    Require specific account type for endpoint access.

    Args:
        required_type: Required AccountType (user/teacher/developer)
        token: Verified token claims

    Returns:
        Token claims if authorized

    Raises:
        HTTPException 403: If account type doesn't match
    """
    user_type = token.get("account_type", AccountType.USER.value)

    # Developer has access to everything
    if user_type == AccountType.DEVELOPER.value:
        return token

    # Teacher has access to teacher and user endpoints
    if user_type == AccountType.TEACHER.value and required_type in (
        AccountType.TEACHER, AccountType.USER
    ):
        return token

    # Check exact match
    if user_type != required_type.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Akses ditolak. Endpoint ini memerlukan akun tipe '{required_type.value}'. "
                   f"Akun kamu bertipe '{user_type}'.",
        )

    return token


def require_developer(token: dict = Depends(get_current_user_token)) -> dict:
    """Dependency: require developer account type."""
    user_type = token.get("account_type", AccountType.USER.value)
    if user_type != AccountType.DEVELOPER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak. Hanya akun Developer yang boleh mengakses endpoint ini.",
        )
    return token


def require_teacher_or_above(token: dict = Depends(get_current_user_token)) -> dict:
    """Dependency: require teacher or developer account type."""
    user_type = token.get("account_type", AccountType.USER.value)
    if user_type not in (AccountType.TEACHER.value, AccountType.DEVELOPER.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak. Endpoint ini memerlukan akun Guru atau Developer.",
        )
    return token


async def register_firebase_user(
    email: str,
    password: str,
    display_name: str,
    account_type: AccountType,
) -> str:
    """
    Register a new user in Firebase Auth and set custom claims.

    Args:
        email: User email
        password: User password
        display_name: Display name
        account_type: Account type to set as custom claim

    Returns:
        Firebase UID of created user
    """
    uid = create_firebase_user(email, password, display_name)

    # Set custom claims for role-based access
    set_custom_claims(uid, {
        "account_type": account_type.value,
    })

    return uid
