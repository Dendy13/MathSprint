"""
MathSprint — Firebase Client
==============================
Firebase Admin SDK initialization singleton.

Handles:
  - Firebase App initialization
  - Firestore client
  - Firebase Auth

PENTING: File serviceAccountKey.json TIDAK BOLEH di-commit ke repo.
"""

import os
from typing import Optional

import firebase_admin
from firebase_admin import auth, credentials, firestore
from google.cloud.firestore_v1 import Client as FirestoreClient


_app: Optional[firebase_admin.App] = None
_db: Optional[FirestoreClient] = None


def initialize_firebase() -> firebase_admin.App:
    """
    Initialize Firebase Admin SDK. Idempotent — safe to call multiple times.

    Reads FIREBASE_CREDENTIALS_PATH from environment.
    Falls back to Application Default Credentials if not set.

    Returns:
        Firebase App instance
    """
    global _app

    if _app is not None:
        return _app

    cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH")

    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        _app = firebase_admin.initialize_app(cred)
    else:
        # Use Application Default Credentials (Cloud Run, etc.)
        _app = firebase_admin.initialize_app()

    return _app


def get_firestore_client() -> FirestoreClient:
    """
    Get Firestore client singleton.

    Returns:
        Firestore client instance

    Raises:
        RuntimeError: If Firebase has not been initialized
    """
    global _db

    if _db is not None:
        return _db

    if _app is None:
        initialize_firebase()

    _db = firestore.client()
    return _db


def get_auth():
    """
    Get Firebase Auth module.

    Returns:
        Firebase Auth module for user management
    """
    if _app is None:
        initialize_firebase()
    return auth


def verify_id_token(id_token: str) -> dict:
    """
    Verify a Firebase ID token and return decoded claims.

    Args:
        id_token: Firebase ID token from client

    Returns:
        Decoded token claims (uid, email, custom claims, etc.)

    Raises:
        firebase_admin.auth.InvalidIdTokenError: If token is invalid
        firebase_admin.auth.ExpiredIdTokenError: If token has expired
    """
    if _app is None:
        initialize_firebase()
    return auth.verify_id_token(id_token)


def set_custom_claims(uid: str, claims: dict) -> None:
    """
    Set custom claims on a Firebase user (e.g., account_type).

    Args:
        uid: Firebase Auth UID
        claims: Dict of custom claims to set

    Notes:
        Custom claims are used for role-based access control.
        Example: {"account_type": "teacher"}
    """
    if _app is None:
        initialize_firebase()
    auth.set_custom_user_claims(uid, claims)


def create_firebase_user(email: str, password: str, display_name: str) -> str:
    """
    Create a new Firebase Auth user.

    Args:
        email: User email
        password: User password
        display_name: Display name

    Returns:
        UID of the created user
    """
    if _app is None:
        initialize_firebase()

    user = auth.create_user(
        email=email,
        password=password,
        display_name=display_name,
    )
    return user.uid
