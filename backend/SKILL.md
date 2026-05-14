# SKILL.md: MathSprint Backend — Single Source of Truth
**Version:** 2.0.0 | **Stack:** Python 3.11 + FastAPI + Firebase
**Status:** Stateless/Mock (in-memory stores, Firebase optional)

> Baca file ini **SEPENUHNYA** sebelum menyentuh kode apapun di backend.
> Ini adalah SSoT untuk semua keputusan arsitektur, konvensi kode,
> dan aturan pengembangan MathSprint backend.

---

## 1. Peta Arsitektur Direktori

```
mathsprint/
└── backend/
    ├── main.py                      # FastAPI app entry point
    ├── requirements.txt             # Python dependencies
    ├── Dockerfile                   # Cloud Run container (port 8080)
    ├── cloudbuild.yaml              # CI/CD pipeline
    ├── .env.example                 # Environment variables template
    ├── SKILL.md                     # << FILE INI (SSoT)
    │
    ├── models/                      # 📦 Pydantic Schemas (WAJIB dirujuk)
    │   ├── __init__.py
    │   ├── player.py                # PlayerProfile, PlayerCreate, AccountType
    │   ├── question.py              # MathQuestion, MathOperation, Difficulty
    │   ├── room.py                  # Room, RoomConfig, RoomPlayer, RoomStatus
    │   ├── match.py                 # MatchResult, EloCalculation, LeaderboardEntry
    │   ├── friend.py                # FriendRequest, FriendList, RoomInvite
    │   └── auth.py                  # TeacherToken, TokenCreate, LoginRequest
    │
    ├── core/                        # ⚙️ Business Logic Engines
    │   ├── __init__.py
    │   ├── math_engine.py           # Module B: Question generator
    │   ├── room_engine.py           # Module C: Room lifecycle & state
    │   ├── rank_engine.py           # Module D: Elo Rating calculator
    │   └── auth_engine.py           # Auth logic & token management
    │
    ├── api/                         # 🌐 API Route Handlers
    │   ├── __init__.py
    │   ├── routes_auth.py           # /auth/* endpoints
    │   ├── routes_game.py           # /game/* endpoints
    │   ├── routes_match.py          # /match/* endpoints
    │   ├── routes_friend.py         # /friend/* endpoints
    │   └── routes_admin.py          # /admin/* endpoints (dev only)
    │
    └── services/                    # 🔌 External Service Layer
        ├── __init__.py
        ├── firebase_client.py       # Firebase Admin SDK init
        ├── firestore_service.py     # Firestore CRUD (Pydantic I/O)
        └── auth_service.py          # Firebase Auth + RBAC middleware
```

---

## 2. Penjelasan Fungsi Tiap Module Core

### 2.1 math_engine.py — Module B: Math Core Engine (Black Box)

**Tanggung jawab:** Generate soal matematika berdasarkan operasi dan difficulty.

**Fungsi utama:**
| Fungsi | Input | Output |
|--------|-------|--------|
| `generate_math_question(op, diff)` | `MathOperation`, `Difficulty` | `MathQuestion` |
| `generate_question_stack(op, diff, count)` | `MathOperation`, `Difficulty`, `int` | `QuestionStack` |

**Guardrails (WAJIB dipertahankan):**
- **Pengurangan (sub):** Jika `num1 < num2`, tukar posisi → hasil TIDAK BOLEH negatif
- **Pembagian (div):** Reverse Multiplication — tentukan answer dulu, kalikan dengan pembagi → integer division TANPA SISA

**Range Table:**

| Operasi | Diff | Range 1 | Range 2 |
|---------|------|---------|---------|
| add | easy | 1-10 | 1-10 |
| add | medium | 10-50 | 10-50 |
| add | hard | 50-100 | 50-100 |
| sub | easy | 5-20 | 1-num1 |
| sub | medium | 20-99 | 10-num1 |
| sub | hard | 100-500 | 50-200 |
| mul | easy | 1-9 | 1-5 |
| mul | medium | 6-15 | 6-10 |
| mul | hard | 11-20 | 2-20 |
| div | easy | a×b | a (a:1-9, b:1-5) |
| div | medium | a×b | a (a:6-15, b:6-10) |
| div | hard | a×b | a (a:11-20, b:2-20) |

---

### 2.2 room_engine.py — Module C: Room & Multiplayer State

**Tanggung jawab:** Manage room lifecycle dan sinkronisasi game state.

**Lifecycle:** `WAITING → PLAYING → FINISHED`

**Fungsi utama:**
| Fungsi | Deskripsi |
|--------|-----------|
| `initialize_room(host, config)` | Buat room baru, host jadi pemain pertama |
| `join_room(room_id, player)` | Pemain masuk room |
| `start_game(room_id, requester_uid)` | Mulai game (host only), generate question_stack |
| `submit_answer(room_id, uid, index, answer)` | Submit jawaban per soal |
| `leave_room(room_id, uid)` | Keluar room |
| `list_waiting_rooms()` | List room yang menunggu pemain |

**Invariant:** `question_stack` di-generate SEKALI saat `start_game()`, sehingga SEMUA pemain mendapat soal yang 100% IDENTIK.

---

### 2.3 rank_engine.py — Module D: Elo Rating System

**Tanggung jawab:** Hitung perubahan Rank Point setelah match.

**Algoritma Elo:**
```
expected = 1 / (1 + 10^((Ro - Rp) / 400))
diff_mult = {easy: 0.8, medium: 1.0, hard: 1.2}
score_factor = (score_diff / max_score) × diff_mult
wager_mult = elo_wager / 25
rp_change = round(K × (actual - expected) × score_factor × wager_mult)
```

**Konstanta:**
- K-Factor: **32** (fixed)
- Learning Protection Threshold: **3 hari streak**
- Learning Protection Discount: **30%** (kalikan loss × 0.7)
- RP minimum: **0** (tidak bisa negatif)

**Learning Protection:** Jika pemain KALAH dan punya `learning_streak_days > 3`, pengurangan RP didiskon 30%.

---

### 2.4 auth_engine.py — Auth & Token System

**Tanggung jawab:** Manage akun, teacher token, dan profil pemain.

**Account Hierarchy:**
```
Developer (level tertinggi)
  └── Bisa: buat TeacherToken, lihat stats, manage system
       │
Teacher (level menengah)
  └── Bisa: buat room, lihat dashboard murid
       │  Dibuat: dengan TeacherToken dari Developer
       │
User (level dasar)
  └── Bisa: main game, join room, tambah teman
       Dibuat: registrasi biasa tanpa token
```

**Teacher Token:** ONE-TIME-USE — setelah dipakai oleh satu guru, token hangus.

---

## 3. Firestore Schema

```
users/{uid}                          # PlayerProfile
  ├── uid: string
  ├── display_name: string
  ├── email: string
  ├── account_type: "user" | "teacher" | "developer"
  ├── current_rank_point: number (default: 1200)
  ├── total_matches: number
  ├── wins: number
  ├── losses: number
  ├── draws: number
  ├── learning_streak_days: number
  ├── friends_list: string[]
  ├── created_at: timestamp
  └── last_active: timestamp
  │
  └── friend_requests/{request_id}   # FriendRequest subcollection
      ├── from_uid, to_uid: string
      ├── status: "pending" | "accepted" | "rejected"
      └── created_at, responded_at: timestamp

rooms/{room_id}                      # Room
  ├── room_id: string (6-char)
  ├── host_uid: string
  ├── status: "waiting" | "playing" | "finished"
  ├── config: { op, diff, question_limit, elo_wager, time_limit_seconds }
  ├── players: { [uid]: RoomPlayer }
  ├── question_stack: MathQuestion[]
  └── created_at, started_at, finished_at: timestamp

matches/{match_id}                   # MatchResult
  ├── match_id: string (UUID)
  ├── room_id: string
  ├── winner_uid, loser_uid: string | null
  ├── is_draw: boolean
  ├── winner_calculation: EloCalculation
  ├── loser_calculation: EloCalculation
  └── created_at: timestamp

teacher_tokens/{token_id}            # TeacherToken
  ├── token_value: string (URL-safe)
  ├── created_by: string (developer UID)
  ├── used_by: string | null
  ├── is_used, is_revoked: boolean
  └── created_at, used_at, expires_at: timestamp
```

---

## 4. API Endpoint Reference

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | ❌ | Register akun baru |
| POST | `/auth/login` | ❌ | Login info |
| GET | `/auth/profile` | ✅ | Profil sendiri |
| PUT | `/auth/profile` | ✅ | Update profil |
| GET | `/auth/profile/{uid}` | ✅ | Profil publik pemain lain |

### Game
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/game/question` | ❌ | Generate 1 soal |
| POST | `/game/questions` | ❌ | Generate batch soal |
| POST | `/game/room/create` | ✅ | Buat room |
| POST | `/game/room/join/{id}` | ✅ | Join room |
| GET | `/game/room/{id}` | ✅ | Info room |
| POST | `/game/room/{id}/start` | ✅ | Mulai game |
| POST | `/game/room/{id}/answer` | ✅ | Submit jawaban |
| GET | `/game/rooms` | ✅ | List room waiting |
| POST | `/game/room/{id}/leave` | ✅ | Keluar room |

### Match & Ranking
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/match/submit` | ✅ | Submit match results |
| GET | `/match/history/{uid}` | ✅ | Match history |
| GET | `/match/leaderboard` | ✅ | Leaderboard |

### Friends
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/friend/request` | ✅ | Kirim friend request |
| PUT | `/friend/respond` | ✅ | Accept/reject |
| GET | `/friend/list` | ✅ | Friend list |
| DELETE | `/friend/remove/{uid}` | ✅ | Hapus teman |
| POST | `/friend/invite-room` | ✅ | Invite ke room |
| GET | `/friend/requests` | ✅ | Pending requests |

### Admin (Developer Only)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/admin/token/create` | 🔑 Dev | Buat token guru |
| GET | `/admin/token/list` | 🔑 Dev | List tokens |
| DELETE | `/admin/token/{id}` | 🔑 Dev | Revoke token |
| GET | `/admin/stats` | 🔑 Dev | System stats |

---

## 5. Developer Rules (SANGAT PENTING)

### Rule 1: Mandatory Type Reference
```
❌ DILARANG: return {"num1": 5, "num2": 3, "op": "add", "answer": 8}
✅ WAJIB:    return MathQuestion(num1=5, num2=3, op=MathOperation.ADD, answer=8)
```
AI wajib merujuk pada skema Pydantic di `models/` setiap kali membuat
atau memodifikasi fungsi. **Dilarang menggunakan dictionary mentah.**

### Rule 2: Module Boundaries
- `api/` → Hanya validasi input + panggil `core/` + return response
- `core/` → Business logic murni, TIDAK BOLEH import dari `api/` atau `services/`
- `services/` → Firebase interaction only, WAJIB gunakan Pydantic model
- `models/` → Pure data schemas, TIDAK BOLEH import dari module lain

### Rule 3: Enum Usage
Selalu gunakan enum class, bukan string literal:
```python
❌ op = "add"
✅ op = MathOperation.ADD
```

### Rule 4: Firebase Collection Names
Gunakan konstanta dari `services/firestore_service.py`:
```python
❌ db.collection("users")
✅ db.collection(USERS_COLLECTION)
```

### Rule 5: Port 8080
Backend WAJIB expose port 8080. Ini adalah default Cloud Run.

### Rule 6: No Secrets in Code
`.env`, `serviceAccountKey.json`, dan semua credential DILARANG di-commit.

### Rule 7: Error Messages in Bahasa Indonesia
Semua error message yang dilihat user harus dalam Bahasa Indonesia.

### Rule 8: Math Engine Guardrails
JANGAN pernah memodifikasi guardrails di math_engine.py:
- Pengurangan: hasil >= 0
- Pembagian: integer division tanpa sisa

### Rule 9: Learning Protection
Jika pemain kalah DAN `learning_streak_days > 3`:
- RP loss didiskon 30% (dikalikan 0.7)
- Hasil akhir WAJIB integer (pembulatan)

### Rule 10: Scope File
AI hanya boleh mengedit file yang ada di tree structure di Section 1.
Dilarang membuat file baru di luar struktur yang sudah ditentukan
tanpa approval eksplisit.

---

## 6. Local Development

```bash
# Setup
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # edit dengan credential Firebase

# Run
uvicorn main:app --reload --port 8080

# API Docs
open http://localhost:8080/docs
```

**Tanpa Firebase:** Server tetap bisa jalan dalam mode mock (in-memory stores).
Semua core engine bekerja tanpa koneksi database.

---

## 7. Deployment (Cloud Run)

Lihat `SKILL_deployment.md` untuk SOP deployment lengkap.

```bash
cd backend
gcloud builds submit --config=cloudbuild.yaml .
```
