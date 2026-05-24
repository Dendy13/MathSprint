import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from firebase_admin import credentials, initialize_app, firestore

try:
    cred = credentials.Certificate("firebase-credentials.json")
    initialize_app(cred)
    db = firestore.client()
    
    # Try count
    print("Testing count...")
    query = db.collection("players").count()
    result = query.get()
    print("Result:", result[0][0].value)
    
except Exception as e:
    print("ERROR:", str(e))
