# LeetCode Tracker — Full-Stack Build Prompt

> **Stack:** Python · FastAPI · React (Vite + TypeScript) · MongoDB Atlas (cloud) · JWT auth
> **Goal:** Rebuild the existing client-side LeetCode Tracker as a multi-user full-stack app. Users register/login, own their own sheets, upload CSVs, and track solved progress per sheet — all persisted server-side.
> **Tone:** Production-ready, deployable to Render/Railway (backend) + Vercel (frontend). Not a toy.

---

## 0. Project Context

The current app is a single-user, 100% client-side Next.js prototype. Data lives in `localStorage`. You are rebuilding it as a **proper multi-user SaaS-style app** with:

- A **FastAPI** backend exposing a REST API
- A **MongoDB Atlas** cloud database (free M0 tier is fine)
- **JWT**-based authentication (access + refresh tokens)
- A **React + Vite + TypeScript** frontend (single-page app, dark-themed, GitHub × Linear × Vercel aesthetic)
- Per-user ownership: every sheet belongs to exactly one user; users cannot see or mutate each other's data

### Functional parity with the existing prototype

The new app MUST preserve every feature of the current prototype:

1. CSV upload with header validation (`ID, URL, Title, Difficulty, Acceptance %, Frequency %`)
2. Multi-sheet support — each upload becomes a named sheet (e.g. `DP`, `Arrays`, `Graphs`)
3. Per-sheet question list + per-sheet solved state
4. Filter sidebar: title search, multi-select difficulty, dual-handle frequency range + preset chips (100/75/50/25%), dual-handle acceptance range, solved toggle
5. Sortable, paginated table (25/50/100 rows per page)
6. Active-filters chip row + "Clear all"
7. Stats bar (overall + per-difficulty solved %)
8. Dark/light theme toggle (default dark)
9. Empty state, loading states, error toasts
10. Replace-existing-sheet flow (preserves solved IDs that still exist in the new CSV)

### New functionality the full-stack version adds

1. **User accounts** — register, login, logout
2. **Server-side persistence** — sheets and solved state live in MongoDB, not localStorage
3. **Multi-device sync** — same user logs in from anywhere, sees their data
4. **Protected routes** — frontend auth gates; backend 401s unauthenticated requests
5. **Token refresh** — short-lived access token (15 min) + long-lived refresh token (7 days), httpOnly cookie for refresh
6. **Password security** — bcrypt hashing, never store plaintext
7. **Rate limiting** — login/register endpoints limited to prevent brute force
8. **CSV size limit** — enforce max ~5 MB per upload server-side

---

## 1. Repository Structure

Use a monorepo-style layout. Two independent deployable apps.

```
leetcode-tracker/
├── backend/                         # FastAPI service
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI app factory + route registration
│   │   ├── config.py                # pydantic-settings: env vars
│   │   ├── database.py              # MongoDB async client (motor)
│   │   ├── deps.py                  # shared deps: get_db, get_current_user
│   │   ├── security.py              # JWT encode/decode, password hashing
│   │   ├── models.py                # pydantic models (request/response schemas)
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py              # /api/auth/register, /login, /refresh, /me, /logout
│   │   │   ├── sheets.py            # /api/sheets CRUD + question listing
│   │   │   ├── questions.py         # /api/sheets/{id}/questions filter/sort/paginate
│   │   │   └── upload.py            # /api/sheets/{id}/upload (CSV replace) + /api/sheets (create)
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── csv_parser.py        # streaming CSV parse + validation
│   │   │   └── sheet_service.py     # business logic for sheet CRUD
│   │   └── middleware/
│   │       ├── __init__.py
│   │       └── rate_limit.py        # slowapi rate limiter
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_auth.py
│   │   ├── test_sheets.py
│   │   └── test_upload.py
│   ├── .env.example
│   ├── .gitignore
│   ├── requirements.txt
│   ├── README.md
│   └── Dockerfile
├── frontend/                        # React + Vite SPA
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx                  # Router + auth gate
│   │   ├── api/
│   │   │   ├── client.ts            # axios instance with interceptor (refresh on 401)
│   │   │   ├── auth.ts              # register/login/refresh/me
│   │   │   └── sheets.ts            # sheets + questions API
│   │   ├── context/
│   │   │   ├── AuthContext.tsx      # current user, login/logout
│   │   │   └── ThemeContext.tsx     # dark/light
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useSheets.ts
│   │   │   └── useDebounce.ts
│   │   ├── components/
│   │   │   ├── ui/                  # button, input, dialog, slider, etc. (shadcn-style)
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── ThemeToggle.tsx
│   │   │   ├── SheetTabs.tsx
│   │   │   ├── UploadDialog.tsx
│   │   │   ├── FiltersSidebar.tsx
│   │   │   ├── ActiveFilters.tsx
│   │   │   ├── QuestionTable.tsx
│   │   │   ├── StatsBar.tsx
│   │   │   ├── DifficultyBadge.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   └── DashboardPage.tsx
│   │   ├── lib/
│   │   │   ├── types.ts             # Question, Sheet, Filters, SortState
│   │   │   ├── csv.ts               # client-side parse for preview
│   │   │   ├── utils.ts             # cn(), formatting helpers
│   │   │   └── constants.ts         # API_URL, FREQ_PRESETS, PAGE_SIZES
│   │   ├── styles/
│   │   │   └── globals.css          # CSS variables, theme tokens
│   │   └── router.tsx
│   ├── public/
│   ├── .env.example
│   ├── .gitignore
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── README.md
│   └── Dockerfile
├── .gitignore
├── README.md                        # top-level: architecture diagram + setup
└── docker-compose.yml               # local dev: backend + frontend + mongo (optional local mongo)
```

---

## 2. Backend — FastAPI

### 2.1 Tech stack

| Concern | Choice | Version |
| --- | --- | --- |
| Runtime | Python | 3.11+ |
| Framework | FastAPI | 0.115+ |
| ASGI server | Uvicorn | 0.32+ |
| MongoDB driver | Motor (async) | 3.6+ |
| Settings | pydantic-settings | 2.6+ |
| Validation | Pydantic v2 | 2.10+ |
| CSV parsing | Python stdlib `csv` (DictReader) | — |
| Auth | `python-jose[cryptography]` for JWT, `passlib[bcrypt]` for hashing | latest |
| Rate limiting | `slowapi` | latest |
| CORS | `starlette.middleware.cors` | bundled |
| Testing | `pytest` + `pytest-asyncio` + `httpx` | latest |

### 2.2 `requirements.txt`

```
fastapi==0.115.6
uvicorn[standard]==0.32.1
motor==3.6.0
pydantic==2.10.4
pydantic-settings==2.7.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
slowapi==0.1.9
python-multipart==0.0.20
httpx==0.28.1
pytest==8.3.4
pytest-asyncio==0.25.0
```

### 2.3 Environment variables (`backend/.env.example`)

```bash
# MongoDB Atlas connection string (from Atlas dashboard → Connect → Drivers)
MONGODB_URL="mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority"
MONGODB_DB_NAME="leetcode_tracker"

# JWT — generate with: openssl rand -hex 32
JWT_SECRET_KEY="change-me-to-a-64-char-hex-string"
JWT_ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS — frontend origin(s), comma-separated
CORS_ORIGINS="http://localhost:5173,https://your-frontend.vercel.app"

# Cookie settings
COOKIE_SECURE=false   # true in production (HTTPS only)
COOKIE_SAMESITE="lax"

# Upload limit
MAX_CSV_SIZE_BYTES=5242880   # 5 MB
```

### 2.4 Database schema (MongoDB collections)

Use **three collections**. Use `_id: ObjectId` as the primary key, and store `owner_id` as a string (the user's `_id` hex) on every owned document.

#### `users`

```json
{
  "_id": ObjectId,
  "email": "alice@example.com",         // unique, lowercased, indexed
  "name": "Alice",
  "hashed_password": "$2b$12$...",      // bcrypt
  "created_at": ISODate,
  "updated_at": ISODate
}
```

Indexes:
- `unique` on `email` (case-insensitive — store lowercased)

#### `sheets`

```json
{
  "_id": ObjectId,
  "owner_id": "65f...",                 // user._id hex string
  "name": "DP",                          // user-facing alias
  "created_at": ISODate,
  "updated_at": ISODate
}
```

Indexes:
- `owner_id` (regular)
- compound `(owner_id, name)` unique — prevent duplicate sheet names per user

#### `questions`

Denormalized: one document per question, **per sheet**. This avoids the 16 MB document-size limit you'd hit with 700+ embedded questions per sheet, and lets the DB do filtering/sorting/pagination natively.

```json
{
  "_id": ObjectId,
  "sheet_id": "65f...",
  "owner_id": "65f...",                 // denormalized for auth checks
  "leetcode_id": 1,                      // the CSV "ID" column
  "url": "https://leetcode.com/problems/two-sum",
  "title": "Two Sum",
  "difficulty": "Easy",                  // "Easy" | "Medium" | "Hard"
  "acceptance": 57.5,                    // float, 0-100
  "frequency": 100.0,                    // float, 0-100
  "solved": false,                       // bool
  "solved_at": null,                     // ISODate or null
  "created_at": ISODate
}
```

Indexes:
- `owner_id`
- `sheet_id`
- compound `(sheet_id, leetcode_id)` unique — prevents duplicates within a sheet
- compound `(sheet_id, difficulty)` — for filter queries
- compound `(sheet_id, frequency)` — for range + sort
- compound `(sheet_id, acceptance)` — for range + sort
- text index on `title` (or use regex substring match — see §2.7)

### 2.5 Auth — JWT flow

**Two tokens, refresh in httpOnly cookie:**

| Token | Lifetime | Storage | Purpose |
| --- | --- | --- | --- |
| Access token | 15 minutes | Frontend memory (or localStorage) | Sent as `Authorization: Bearer <token>` on every API call |
| Refresh token | 7 days | httpOnly cookie named `lt_refresh` | Used by frontend interceptor to silently obtain new access tokens |

**Refresh token rotation:** every time `/api/auth/refresh` is called, issue a new refresh token and invalidate the old one (store a `token_id` in the user doc and a `revoked` set — or simpler v1: just rotate without revocation, accept the small risk).

#### Endpoints

```
POST   /api/auth/register
       body: { email, password, name }
       201: { user: { id, email, name }, access_token }
       sets: lt_refresh cookie
       409: email already taken
       422: invalid input

POST   /api/auth/login
       body: { email, password }
       200: { user, access_token }
       sets: lt_refresh cookie
       401: invalid credentials
       429: rate limited (5/minute per IP)

POST   /api/auth/refresh
       reads: lt_refresh cookie
       200: { access_token }
       sets: new lt_refresh cookie (rotated)
       401: invalid/expired refresh token → frontend must redirect to /login

POST   /api/auth/logout
       clears: lt_refresh cookie
       200: { ok: true }

GET    /api/auth/me
       header: Authorization: Bearer <access_token>
       200: { id, email, name, created_at }
       401: missing/invalid token
```

#### `app/security.py` (reference implementation)

```python
from datetime import datetime, timedelta, timezone
from typing import Any
from jose import jwt, JWTError
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(p: str) -> str:
    return pwd_context.hash(p)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(subject: str, expires_minutes: int, secret: str, algo: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    return jwt.encode({"sub": subject, "exp": expire, "type": "access"}, secret, algorithm=algo)

def create_refresh_token(subject: str, expires_days: int, secret: str, algo: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=expires_days)
    return jwt.encode({"sub": subject, "exp": expire, "type": "refresh"}, secret, algorithm=algo)

def decode_token(token: str, secret: str, algo: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, secret, algorithms=[algo])
    except JWTError:
        return None
```

#### `app/deps.py` — `get_current_user`

```python
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

bearer = HTTPBearer(auto_error=False)

async def get_current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db = Depends(get_db),
):
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    payload = decode_token(creds.credentials, settings.JWT_SECRET_KEY, settings.JWT_ALGORITHM)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user
```

### 2.6 Routes — sheets & questions

All routes below require `Authorization: Bearer <access_token>`. Every query MUST filter by `owner_id == current_user._id` — never trust a sheet_id from the URL without ownership check.

```
GET    /api/sheets
       200: { sheets: [{ id, name, question_count, solved_count, created_at, updated_at }] }

POST   /api/sheets
       body: { name: string }
       201: { sheet: { id, name, question_count: 0, ... } }
       409: sheet with that name already exists for this user
       422: name empty or > 60 chars

GET    /api/sheets/{sheet_id}
       200: { sheet: { id, name, ... }, stats: { total, solved, by_difficulty: { easy, medium, hard } } }
       404: not found or not owned by current user

PATCH  /api/sheets/{sheet_id}
       body: { name?: string }
       200: { sheet: {...} }
       404 / 409 (duplicate name)

DELETE /api/sheets/{sheet_id}
       200: { ok: true }
       also deletes all child question documents (cascade)
       404

POST   /api/sheets/{sheet_id}/upload
       multipart/form-data: file=<csv file>
       Behavior: replaces all questions in this sheet with the CSV contents.
                 For each question_id in the CSV that already exists & is solved,
                 preserve the solved flag.
       200: { sheet: {...}, imported: number, skipped: number, preserved_solved: number }
       400: invalid CSV (header mismatch, no valid rows)
       413: file too large

POST   /api/sheets/{sheet_id}/questions
       body: { leetcode_id, url, title, difficulty, acceptance, frequency }
       201: { question: {...} }
       409: leetcode_id already exists in this sheet

PATCH  /api/sheets/{sheet_id}/questions/{question_id}
       body: { solved?: bool }
       200: { question: {...} }
       404

DELETE /api/sheets/{sheet_id}/questions/{question_id}
       200: { ok: true }
       404
```

#### Query endpoint — `GET /api/sheets/{sheet_id}/questions`

This is the workhorse. Supports filtering, sorting, pagination.

```
Query params:
  search        string    case-insensitive substring on title (regex)
  difficulty    string    comma-separated: "Easy,Medium" (OR within this filter)
  freq_min      number    0-100
  freq_max      number    0-100
  acc_min       number    0-100
  acc_max       number    0-100
  freq_presets  string    comma-separated ints: "100,75,50,25" (OR — overrides freq_min/freq_max if non-empty)
  solved        string    "all" | "solved" | "unsolved" (default: all)
  sort_by       string    "id" | "title" | "difficulty" | "acceptance" | "frequency" (default: frequency)
  sort_dir      string    "asc" | "desc" (default: desc)
  page          int       1-indexed (default: 1)
  page_size     int       25 | 50 | 100 (default: 50)

Response 200:
{
  questions: [{ id, leetcode_id, url, title, difficulty, acceptance, frequency, solved }],
  total: number,         // total matching (after filter, before pagination)
  page: number,
  page_size: number,
  total_pages: number,
  stats: {               // stats are ALWAYS for the full sheet, not the filtered subset
    total: number,
    solved: number,
    by_difficulty: { easy: {total, solved}, medium: {...}, hard: {...} }
  }
}
```

### 2.7 Reference: building the MongoDB query

```python
# app/routes/questions.py
async def list_questions(sheet_id: str, params: QuestionQueryParams, user, db):
    # Ownership check
    sheet = await db.sheets.find_one({"_id": ObjectId(sheet_id), "owner_id": str(user["_id"])})
    if not sheet:
        raise HTTPException(404, "Sheet not found")

    query: dict = {"sheet_id": sheet_id, "owner_id": str(user["_id"])}

    if params.search:
        # Case-insensitive substring — use regex. For larger datasets, switch to
        # Atlas Search ($search) with an autocomplete index on `title`.
        query["title"] = {"$regex": re.escape(params.search), "$options": "i"}

    if params.difficulty:
        diffs = [d.strip() for d in params.difficulty.split(",") if d.strip()]
        if diffs:
            query["difficulty"] = {"$in": diffs}

    # Frequency: presets override range
    if params.freq_presets:
        presets = [int(x) for x in params.freq_presets.split(",") if x.strip().isdigit()]
        if presets:
            # Match rounded frequency to any preset
            query["$or"] = [{"frequency": {"$gte": p - 0.5, "$lt": p + 0.5}} for p in presets]
    else:
        query["frequency"] = {"$gte": params.freq_min, "$lte": params.freq_max}

    if params.acc_min != 0 or params.acc_max != 100:
        query["acceptance"] = {"$gte": params.acc_min, "$lte": params.acc_max}

    if params.solved == "solved":
        query["solved"] = True
    elif params.solved == "unsolved":
        query["solved"] = False

    sort_field = {
        "id": "leetcode_id",
        "title": "title",
        "difficulty": "difficulty",  # store as 0/1/2 in DB or use a sort map
        "acceptance": "acceptance",
        "frequency": "frequency",
    }[params.sort_by]
    sort_dir = 1 if params.sort_dir == "asc" else -1

    skip = (params.page - 1) * params.page_size

    cursor = db.questions.find(query).sort(sort_field, sort_dir).skip(skip).limit(params.page_size)
    questions = await cursor.to_list(length=params.page_size)
    total = await db.questions.count_documents(query)

    # Sheet-level stats (not filtered)
    stats = await compute_sheet_stats(sheet_id, db)

    return {
        "questions": [serialize_question(q) for q in questions],
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
        "total_pages": (total + params.page_size - 1) // params.page_size,
        "stats": stats,
    }
```

> **Tip:** For difficulty sorting, either (a) store a `difficulty_order` int field (`Easy=0`, `Medium=1`, `Hard=2`) updated on insert, or (b) add a `$addFields` stage in an aggregation pipeline that maps the string to a number. Option (a) is simpler and faster.

### 2.8 CSV parsing — server-side

Use Python's stdlib `csv` module with `io.StringIO`. Stream-parse to handle 5 MB files comfortably.

```python
# app/services/csv_parser.py
import csv, io
from typing import Iterable

EXPECTED_HEADERS = ["ID", "URL", "Title", "Difficulty", "Acceptance %", "Frequency %"]
VALID_DIFFICULTIES = {"Easy", "Medium", "Hard"}

class CsvValidationError(Exception):
    pass

def parse_leetcode_csv(content: str) -> tuple[list[dict], int]:
    """Returns (questions, skipped_count)."""
    reader = csv.DictReader(io.StringIO(content))
    headers = [h.strip() for h in (reader.fieldnames or [])]
    missing = [h for h in EXPECTED_HEADERS if h not in headers]
    if missing:
        raise CsvValidationError(f"Missing required columns: {', '.join(missing)}")

    questions, skipped = [], 0
    for row in reader:
        try:
            q = {
                "leetcode_id": int(row["ID"]),
                "url": row["URL"].strip(),
                "title": row["Title"].strip(),
                "difficulty": row["Difficulty"].strip(),
                "acceptance": float(row["Acceptance %"].strip().rstrip("%")),
                "frequency": float(row["Frequency %"].strip().rstrip("%")),
            }
            if q["difficulty"] not in VALID_DIFFICULTIES:
                raise ValueError("bad difficulty")
            if not q["url"] or not q["title"]:
                raise ValueError("empty required field")
            questions.append(q)
        except (ValueError, KeyError, TypeError):
            skipped += 1

    return questions, skipped
```

#### Replace-existing flow (preserves solved state)

```python
# app/routes/upload.py
async def upload_csv(sheet_id: str, file: UploadFile, user, db):
    # ... ownership check ...
    content = (await file.read()).decode("utf-8", errors="replace")
    if len(content) > settings.MAX_CSV_SIZE_BYTES:
        raise HTTPException(413, "File too large")

    try:
        new_questions, skipped = parse_leetcode_csv(content)
    except CsvValidationError as e:
        raise HTTPException(400, str(e))

    if not new_questions:
        raise HTTPException(400, "No valid rows in CSV")

    # Fetch currently-solved leetcode_ids in this sheet
    existing_solved = await db.questions.find(
        {"sheet_id": sheet_id, "solved": True},
        {"leetcode_id": 1, "_id": 0}
    ).to_list(length=None)
    solved_set = {q["leetcode_id"] for q in existing_solved}

    # Atomic-ish replace: delete all, insert all (use a transaction for safety)
    async with await db.client.start_session() as session:
        async with session.start_transaction():
            await db.questions.delete_many({"sheet_id": sheet_id}, session=session)
            docs = [
                {
                    **q,
                    "sheet_id": sheet_id,
                    "owner_id": str(user["_id"]),
                    "solved": q["leetcode_id"] in solved_set,
                    "solved_at": None,
                    "difficulty_order": {"Easy": 0, "Medium": 1, "Hard": 2}[q["difficulty"]],
                    "created_at": datetime.now(timezone.utc),
                }
                for q in new_questions
            ]
            if docs:
                await db.questions.insert_many(docs, session=session)
            await db.sheets.update_one(
                {"_id": ObjectId(sheet_id)},
                {"$set": {"updated_at": datetime.now(timezone.utc)}},
                session=session,
            )

    preserved = sum(1 for q in new_questions if q["leetcode_id"] in solved_set)
    return {"imported": len(new_questions), "skipped": skipped, "preserved_solved": preserved}
```

### 2.9 `app/main.py`

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.database import db_client
from app.routes import auth, sheets, questions, upload

limiter = Limiter(key_func=get_remote_address)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Open MongoDB client
    yield
    db_client.close()

app = FastAPI(title="LeetCode Tracker API", version="1.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",")],
    allow_credentials=True,  # required for cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc):
    return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"})

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(sheets.router, prefix="/api/sheets", tags=["sheets"])
app.include_router(questions.router, prefix="/api/sheets", tags=["questions"])
app.include_router(upload.router, prefix="/api/sheets", tags=["upload"])

@app.get("/health")
async def health():
    return {"status": "ok"}
```

### 2.10 Rate limiting

Apply to auth routes specifically:

```python
# app/routes/auth.py
from fastapi import APIRouter, Request, Response
from slowapi import Limiter

router = APIRouter()

@router.post("/register")
@limiter.limit("5/minute")
async def register(request: Request, body: RegisterIn, response: Response, db=Depends(get_db)):
    ...

@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, body: LoginIn, response: Response, db=Depends(get_db)):
    ...
```

> **Note:** `slowapi` requires the `request: Request` parameter on rate-limited endpoints.

### 2.11 Testing

Use `pytest` + `pytest-asyncio` + `httpx.AsyncClient`. Use a separate test database (e.g. `leetcode_tracker_test`) — drop it between test runs.

```python
# tests/conftest.py
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import get_db

@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

@pytest.fixture(autouse=True)
async def clean_db():
    db = await anext(get_db())
    await db.client.drop_database("leetcode_tracker_test")
    yield
```

Minimum test coverage:
- Auth: register → login → me → refresh → logout
- Auth: 401 on bad token, expired token, wrong password
- Sheets: create → list → rename → delete; cannot access another user's sheet
- Upload: valid CSV, header mismatch, oversized file, replace preserves solved

---

## 3. Frontend — React + Vite + TypeScript

### 3.1 Tech stack

| Concern | Choice | Version |
| --- | --- | --- |
| Build tool | Vite | 6+ |
| Framework | React | 19+ |
| Language | TypeScript | 5.6+ |
| Routing | React Router | 7+ |
| Data fetching | TanStack Query | 5+ |
| HTTP | axios | 1.7+ |
| Styling | Tailwind CSS | 4+ |
| UI primitives | shadcn/ui (Radix UI) | latest |
| Font | Geist | 1.3+ |
| Icons | lucide-react | latest |
| Toasts | sonner | latest |
| Forms | react-hook-form + zod | latest |

### 3.2 `package.json` (key deps)

```json
{
  "name": "leetcode-tracker-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint ."
  },
  "dependencies": {
    "@tanstack/react-query": "^5.62.0",
    "axios": "^1.7.9",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "geist": "^1.3.1",
    "lucide-react": "^0.468.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-hook-form": "^7.54.0",
    "react-router-dom": "^7.1.0",
    "sonner": "^1.7.1",
    "tailwind-merge": "^2.5.5",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.0",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^4.3.0",
    "eslint": "^9",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.6",
    "vite": "^6.0.0"
  }
}
```

### 3.3 Environment variables (`frontend/.env.example`)

```bash
# Backend API URL
VITE_API_URL="http://localhost:8000"

# App name (shown in header)
VITE_APP_NAME="LeetCode Tracker"
```

### 3.4 `vite.config.ts`

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 5173,
    // Proxy API calls in dev to avoid CORS issues — backend must still allow the origin
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
```

### 3.5 API client — axios with refresh-on-401 interceptor

This is the most important piece of frontend auth logic. Single-flight refresh (don't fire 10 refresh calls when 10 parallel requests all 401).

```ts
// src/api/client.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const API_URL = import.meta.env.VITE_API_URL;

let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;

export function setAccessToken(t: string | null) {
  accessToken = t;
}

export const api = axios.create({ baseURL: `${API_URL}/api`, withCredentials: true });

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry && !original.url?.includes("/auth/")) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = api.post("/auth/refresh").then((r) => r.data.access_token);
        }
        const newToken = await refreshPromise;
        refreshPromise = null;
        setAccessToken(newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        refreshPromise = null;
        setAccessToken(null);
        window.location.href = "/login";
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);
```

### 3.6 Auth context

```tsx
// src/context/AuthContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, setAccessToken } from "@/api/client";

interface User { id: string; email: string; name: string; }
interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: try to get a fresh access token via refresh cookie
  useEffect(() => {
    (async () => {
      try {
        const r = await api.post("/auth/refresh");
        setAccessToken(r.data.access_token);
        const me = await api.get("/auth/me");
        setUser(me.data);
      } catch {
        setAccessToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const r = await api.post("/auth/login", { email, password });
    setAccessToken(r.data.access_token);
    setUser(r.data.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const r = await api.post("/auth/register", { email, password, name });
    setAccessToken(r.data.access_token);
    setUser(r.data.user);
  };

  const logout = async () => {
    await api.post("/auth/logout");
    setAccessToken(null);
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>;
}
```

### 3.7 Routing & protected routes

```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";

function Router() {
  const { loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-muted">Loading…</div>;
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Router />
      </BrowserRouter>
    </AuthProvider>
  );
}
```

```tsx
// src/components/ProtectedRoute.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ReactNode } from "react";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
```

### 3.8 TanStack Query hooks for sheets

```ts
// src/hooks/useSheets.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { Sheet, Question, QuestionQuery } from "@/lib/types";

export function useSheets() {
  return useQuery({
    queryKey: ["sheets"],
    queryFn: async () => (await api.get("/sheets")).data.sheets as Sheet[],
  });
}

export function useCreateSheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => (await api.post("/sheets", { name })).data.sheet,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sheets"] }),
  });
}

export function useDeleteSheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/sheets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sheets"] }),
  });
}

export function useQuestions(sheetId: string | null, query: QuestionQuery) {
  return useQuery({
    queryKey: ["questions", sheetId, query],
    queryFn: async () => {
      if (!sheetId) return null;
      const params = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => params.append(k, String(v)));
      return (await api.get(`/sheets/${sheetId}/questions?${params}`)).data;
    },
    enabled: !!sheetId,
  });
}

export function useToggleSolved(sheetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ questionId, solved }: { questionId: string; solved: boolean }) =>
      (await api.patch(`/sheets/${sheetId}/questions/${questionId}`, { solved })).data.question,
    // Optimistic update: see TanStack Query docs
  });
}

export function useUploadCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sheetId, file, mode, alias }: {
      sheetId?: string; file: File; mode: "create" | "replace"; alias: string;
    }) => {
      // If create mode: first create the sheet, then upload
      let id = sheetId;
      if (mode === "create") {
        const created = (await api.post("/sheets", { name: alias })).data.sheet;
        id = created.id;
      }
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post(`/sheets/${id}/upload`, fd);
      qc.invalidateQueries({ queryKey: ["sheets"] });
      qc.invalidateQueries({ queryKey: ["questions"] });
      return r.data;
    },
  });
}
```

### 3.9 Visual style — port the existing design

The frontend MUST replicate the existing prototype's visual language exactly. Use the same CSS variables:

```css
/* src/styles/globals.css */
:root, .dark {
  --background: #09090B;
  --foreground: #FAFAFA;
  --card: #111113;
  --border: #27272A;
  --accent: #2563EB;
  --muted: #A1A1AA;
  --easy: #22C55E;
  --medium: #FACC15;
  --hard: #EF4444;
  --radius: 6px;
  color-scheme: dark;
}

.light {
  --background: #FFFFFF;
  --foreground: #09090B;
  --card: #F4F4F5;
  --border: #E4E4E7;
  --accent: #2563EB;
  --muted: #71717A;
  --easy: #22C55E;
  --medium: #CA8A04;
  --hard: #EF4444;
  color-scheme: light;
}
```

Use the Geist font. Default to dark theme. Linear-style density: 1px borders, no shadows, tight spacing, tabular nums on numeric columns.

**Component parity checklist** — port these from the existing prototype (file names match so you can copy-paste most of the JSX, only swap the data layer from `localStorage` to TanStack Query):

- `Header.tsx` — adds "Logout" button + user avatar/initial
- `SheetTabs.tsx` — same UX (switch / rename / delete with confirm)
- `UploadDialog.tsx` — same two-step flow; on confirm calls `useUploadCsv`
- `FiltersSidebar.tsx` — same controls; debounce the title search (300 ms) before refetching
- `ActiveFilters.tsx` — same chip row
- `QuestionTable.tsx` — same columns, sortable, paginated; calls `useToggleSolved` on checkbox click
- `StatsBar.tsx` — same per-difficulty progress; reads `stats` from the questions query response
- `DifficultyBadge.tsx` — same pill
- `ThemeToggle.tsx` — same sun/moon toggle, persists to `localStorage` (theme is client-only, no need for server)
- `EmptyState.tsx` — same CTA when user has zero sheets

### 3.10 Auth pages

`LoginPage` and `RegisterPage` should be minimal — centered card with email/password/name fields, Geist font, dark theme. Use `react-hook-form` + `zod` for validation. On success, navigate to `/`.

```tsx
// src/pages/LoginPage.tsx (sketch)
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    try {
      await login(data.email, data.password);
      nav("/");
    } catch {
      // show toast
    }
  };

  return (/* centered card with form */);
}
```

---

## 4. CORS & Cookie Configuration

The trickiest part of JWT-in-cookie. Get this right or auth will silently fail.

### Backend CORS

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",")],  # NO wildcards if allow_credentials=True
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Cookie settings (backend, when setting refresh token)

```python
response.set_cookie(
    key="lt_refresh",
    value=refresh_token,
    httponly=True,
    secure=settings.COOKIE_SECURE,        # False in dev, True in prod
    samesite=settings.COOKIE_SAMESITE,    # "lax" for same-site; "none" for cross-site (requires secure=True)
    max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    path="/api/auth",
)
```

> **Cross-origin note:** If frontend on `vercel.app` and backend on `railway.app`, you need `samesite="none"` and `secure=true`. Vercel and Railway both serve HTTPS by default so this works in prod. In local dev (both on localhost, different ports), `samesite="lax"` works fine.

### Frontend axios

```ts
axios.create({ baseURL: API_URL, withCredentials: true });
```

`withCredentials: true` is mandatory — without it, the browser won't send the refresh cookie.

---

## 5. Deployment

### 5.1 MongoDB Atlas setup

1. Create free cluster at mongodb.com/atlas
2. Database user: read/write to `leetcode_tracker` DB
3. Network access: allow `0.0.0.0/0` (or restrict to your backend host IPs)
4. Get connection string: `mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
5. Plug into backend `MONGODB_URL`

### 5.2 Backend deploy (Render or Railway)

`backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Set env vars on Render/Railway:
- `MONGODB_URL`, `MONGODB_DB_NAME`, `JWT_SECRET_KEY`, `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`, `CORS_ORIGINS`, `COOKIE_SECURE=true`, `COOKIE_SAMESITE=none`, `MAX_CSV_SIZE_BYTES`

### 5.3 Frontend deploy (Vercel)

`frontend/vite.config.ts` — already shown.

Set env vars on Vercel:
- `VITE_API_URL` = backend URL (e.g. `https://leetcode-tracker-api.onrender.com`)

Add `vercel.json` for SPA routing:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

### 5.4 Local dev with docker-compose (optional)

```yaml
# docker-compose.yml
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    env_file: ./backend/.env
    environment:
      - MONGODB_URL=mongodb://mongo:27017
      - MONGODB_DB_NAME=leetcode_tracker_dev
      - COOKIE_SECURE=false
      - COOKIE_SAMESITE=lax
      - CORS_ORIGINS=http://localhost:5173
    depends_on: [mongo]

  frontend:
    build: ./frontend
    ports: ["5173:5173"]
    environment:
      - VITE_API_URL=http://localhost:8000
    depends_on: [backend]

  mongo:
    image: mongo:7
    ports: ["27017:27017"]
    volumes: ["mongo_data:/data/db"]

volumes:
  mongo_data:
```

> **Note:** For local dev, you can use a local MongoDB container instead of Atlas — just point `MONGODB_URL` at it. Atlas is for production.

---

## 6. Acceptance Criteria

The build is done when ALL of these pass:

### Backend
- [ ] `POST /api/auth/register` creates a user, returns access token, sets refresh cookie
- [ ] `POST /api/auth/login` validates credentials, returns access token, sets refresh cookie
- [ ] `POST /api/auth/refresh` rotates the refresh token, returns new access token
- [ ] `POST /api/auth/logout` clears the refresh cookie
- [ ] `GET /api/auth/me` returns current user from bearer token
- [ ] All `/api/sheets/*` routes return 401 without auth, 404 for sheets owned by other users
- [ ] `POST /api/sheets/{id}/upload` parses CSV, replaces questions, preserves solved state for matching leetcode_ids
- [ ] `GET /api/sheets/{id}/questions` correctly applies all filters (search, difficulty, freq range, freq presets, acc range, solved toggle), sorts, paginates, returns stats
- [ ] Login/register endpoints are rate-limited (5/min/IP)
- [ ] File size > 5 MB returns 413
- [ ] Invalid CSV header returns 400 with a helpful message
- [ ] `pytest` suite passes with ≥ 80% coverage on `app/`

### Frontend
- [ ] `/login` and `/register` pages work; on success redirect to `/`
- [ ] `/` is protected — unauthenticated users redirect to `/login`
- [ ] On first app load, silently refreshes access token via cookie (no extra login if refresh valid)
- [ ] When access token expires mid-session, the axios interceptor silently refreshes and retries the failed request
- [ ] When refresh token is also expired, redirect to `/login`
- [ ] Sheet tabs work: switch, rename (inline), delete (two-click confirm), create (via upload dialog)
- [ ] Upload dialog: pick file → configure alias + create-new/replace → confirm → sheet appears
- [ ] Filters sidebar: all six controls work, AND-across-groups, OR-within-groups, debounced title search
- [ ] Active filters render as removable chips; "Clear all" resets everything
- [ ] Question table: sortable, paginated (25/50/100), solved checkbox toggles server-side
- [ ] Stats bar updates after solved toggle and after upload
- [ ] Dark/light theme toggle works, defaults to dark, persists to localStorage
- [ ] Empty state shown when user has zero sheets
- [ ] Loading skeletons during data fetches
- [ ] Toast notifications for errors and successes (sonner)
- [ ] Mobile responsive: filters collapse to slide-over drawer, table scrolls horizontally

### Integration
- [ ] Backend deployed to Render/Railway, frontend to Vercel
- [ ] CORS configured correctly — no console errors in browser
- [ ] Cookies sent cross-origin with `samesite=none; secure` in production
- [ ] Two different users cannot see or modify each other's sheets

---

## 7. Stretch Goals (only after the above is done)

1. **Atlas Search** — replace regex title search with Atlas `$search` for better relevance + typo tolerance
2. **CSV export** — `GET /api/sheets/{id}/export` returns the sheet as a CSV
3. **Share sheet read-only** — generate a public read-only URL for a sheet (read token with expiry)
4. **Spaced repetition** — add a `next_review_at` field to questions; surface "due today" filter
5. **Notes per question** — add an optional `notes` text field, with markdown rendering
6. **Activity streak** — track daily solve counts, show a 30-day heatmap
7. **OAuth** — Google login via `authlib`
8. **Webhooks** — notify a Discord/Slack webhook when a sheet's solved % crosses a threshold

---

## 8. Reference Material

- Current prototype (client-side): existing `leetcode-tracker.zip` — use its UI components as a starting point. Component files map 1:1 (just swap the data layer).
- Sample CSV: `public/sample-leetcode.csv` — 665 real LeetCode questions, use for testing uploads
- CSV format spec: see existing prototype's `lib/csv.ts` — exact same columns and validation rules
- Theme tokens: see existing prototype's `globals.css` — copy verbatim

---

## 9. Build Order (recommended sequence)

1. **Backend skeleton**: FastAPI app + MongoDB connection + `/health` endpoint. Verify Atlas connection.
2. **Auth**: register/login/refresh/me/logout. Test with `httpie` or Postman. Get cookies right.
3. **Sheets CRUD**: create/list/get/rename/delete. Add ownership checks.
4. **CSV upload + replace**: the trickiest backend logic. Test with the sample CSV.
5. **Questions list + filter + paginate**: build the query builder carefully, test all filter combinations.
6. **Solved toggle**: PATCH endpoint.
7. **Frontend skeleton**: Vite + React Router + AuthContext + axios client. Get login/register/dashboard flow working end-to-end.
8. **Port UI components**: copy from existing prototype, swap `localStorage` calls for TanStack Query hooks.
9. **Wire upload flow**: UploadDialog → `useUploadCsv` mutation.
10. **Polish**: loading states, error toasts, mobile drawer, theme toggle.
11. **Deploy**: Render (backend) → Vercel (frontend) → verify cross-origin cookies in production.
12. **Tests**: write the pytest suite last, against the working backend.

---

**End of spec.** Hand this entire document to your AI coding assistant (Cursor, Claude, etc.) or to a human developer. The build should take roughly 2-3 focused days for an experienced full-stack dev, or 1-2 weeks for a junior dev.
