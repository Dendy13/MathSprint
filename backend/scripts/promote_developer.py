import os
import sys

# Ensure the script can import from the parent directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import firebase_admin
from firebase_admin import credentials, auth, firestore

def main():
    print("=======================================")
    print(" MathSprint - Promote Developer Account")
    print("=======================================\n")
    
    cred_path = os.environ.get("FIREBASE_CREDENTIALS_PATH", "firebase-credentials.json")
    if not os.path.exists(cred_path):
        print(f"ERROR: Kredensial Firebase tidak ditemukan di '{cred_path}'.")
        print("Silakan atur FIREBASE_CREDENTIALS_PATH atau letakkan firebase-credentials.json di folder backend.")
        sys.exit(1)
        
    try:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        print("✅ Terhubung ke Firebase.")
    except Exception as e:
        print(f"❌ Gagal inisialisasi Firebase: {e}")
        sys.exit(1)
        
    db = firestore.client()
    
    identifier = input("\nMasukkan Email atau UID dari akun yang ingin dijadikan Developer:\n> ").strip()
    
    if not identifier:
        print("Operasi dibatalkan.")
        sys.exit(0)
        
    user_record = None
    try:
        if "@" in identifier:
            user_record = auth.get_user_by_email(identifier)
        else:
            user_record = auth.get_user(identifier)
    except Exception as e:
        print(f"❌ Akun tidak ditemukan: {e}")
        sys.exit(1)
        
    uid = user_record.uid
    print(f"\nMenemukan pengguna: {user_record.display_name} ({user_record.email}) - UID: {uid}")
    
    confirm = input("Apakah kamu yakin ingin menaikkan akun ini menjadi Developer? (y/n): ").strip().lower()
    if confirm != 'y':
        print("Operasi dibatalkan.")
        sys.exit(0)
        
    try:
        # 1. Update Custom Claims
        current_claims = user_record.custom_claims or {}
        current_claims['account_type'] = 'developer'
        auth.set_custom_user_claims(uid, current_claims)
        print("✅ Berhasil mengatur Custom Claims di Firebase Auth.")
        
        # 2. Update Firestore Document
        doc_ref = db.collection("players").document(uid)
        doc = doc_ref.get()
        if doc.exists:
            doc_ref.update({"account_type": "developer"})
            print("✅ Berhasil memperbarui dokumen 'players' di Firestore.")
        else:
            print("⚠️ Dokumen pemain tidak ditemukan di Firestore, tetapi akses Auth telah diberikan.")
            
        print("\n🎉 AKUN BERHASIL DIUBAH MENJADI DEVELOPER!")
        print("Silakan login ulang di aplikasi MathSprint untuk memuat ulang izin akses.")
        
    except Exception as e:
        print(f"❌ Terjadi kesalahan saat memperbarui akun: {e}")

if __name__ == "__main__":
    main()
