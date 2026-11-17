# LabBook — Master Build Plan

> **One-prompt kickoff** (paste in a new Claude Code session opened in this `Repo` folder):
>
> ```
> Read CLAUDE.md and PLAN.md. Execute PLAN.md phase by phase, from Phase 0 to Phase 10.
> Stop only at the ⏸ checkpoints, and tick the Progress Tracker as you go.
> ```

---

## 1. Product brief

**Problem.** In many universities, lab and equipment booking runs on paper logbooks, WhatsApp messages or emails to the lab instructor. That leads to double bookings, nobody can see what's free, and there's no record of who used what.

**Solution.** LabBook is a web app where students see live availability of labs and equipment and request a time slot. Lab admins approve or reject requests from one queue. The database makes double bookings impossible, and a scheduled job closes out old bookings automatically.

**Roles**

| Role | Who | Can do |
|---|---|---|
| `student` | Any signed-in user | Browse labs and equipment, see availability, request bookings, cancel own bookings |
| `admin` | Emails listed in the `adminEmails` config | Everything a student can, plus approve/reject, manage labs and equipment, and view stats. Admin bookings are auto-approved |

**MVP user stories** (each one is an acceptance criterion)

1. As a visitor, I can sign in with my Asgardeo account and am taken to the labs page.
2. As a student, I can list active labs and see each one's building, room, capacity and opening hours.
3. As a student, I can open a lab and see its equipment and a day timeline of busy slots for any date in the next 30 days.
4. As a student, I can list equipment and filter it by category and status.
5. As a student, I can request a booking for a lab or a piece of equipment with a time slot, a purpose and the number of attendees. I see clear errors for every broken rule (section 8).
6. As a student, I can see my upcoming and past bookings with their status, and cancel an upcoming one.
7. As an admin, I can see all pending requests, oldest first, and approve or reject them. Rejecting requires a note.
8. As an admin, I can create, edit and deactivate labs, and create, edit and change the status of equipment.
9. As an admin, I can see a dashboard: bookings today, pending count, utilisation per lab over the last 7 days, and top equipment.
10. As the system, pending bookings whose start time has passed become `expired`, and approved bookings whose end time has passed become `completed`, within 15 minutes.

**Out of scope (v1):** email notifications, recurring bookings, a calendar sync, multiple campuses, a mobile app, payments.

## 2. Choreo Labs products used

| Product | How LabBook uses it |
|---|---|
| **Choreo** | Service component (API), Web Application component with **Managed Authentication**, Scheduled Task component, **Connections** (web app → API), configurables & secrets, Development → Production **promotion**, API gateway security, **Observability** (logs, metrics, latency) |
| **Asgardeo** | Identity provider behind Choreo Managed Authentication: sign-in and user accounts |
| **Ballerina** | Language for the REST API and the scheduler. Its `configurable` variables appear directly as Choreo deployment configs |

## 3. Architecture

```
Browser ──► labbook-web (Choreo Web App, React SPA)
              │  /auth/login, /auth/logout ──► Asgardeo (OIDC)
              │  /choreo-apis/... (session cookie → access token, via Managed Auth)
              ▼
         Choreo API Gateway  (validates token, adds x-jwt-assertion backend JWT)
              ▼
         labbook-api (Choreo Service, Ballerina, :8080) ──► PostgreSQL 16
                                                              ▲
         labbook-scheduler (Choreo Scheduled Task, Ballerina, every 15 min) ─┘
```

- **Environments:** Development and Production, with the same image promoted between them. Each environment has its own configs and database (or schema).
- **Database:** a Choreo-managed PostgreSQL if the account's tier offers one. Otherwise use **Neon** free PostgreSQL. Record which one in `docs/decisions.md`.
- **Local dev:** `docker compose` PostgreSQL, the API with `devMode=true`, and the Vite dev server proxying `/api` to `:8080`.

## 4. Repository

| Field | Value |
|---|---|
| Name | `labbook` |
| Visibility | public |
| Description | `Book university labs and equipment without double bookings. Ballerina API + React web app on Choreo, secured with Asgardeo.` |
| Topics | `choreo`, `asgardeo`, `ballerina`, `react`, `typescript`, `postgresql`, `lab-booking`, `university`, `internal-developer-platform` |
| License | Apache-2.0 |
| Default branch | `main` |

**Why a monorepo:** Choreo builds each component from a sub-directory of one repo. A single repo also gives reviewers one link that holds the whole solution.

```
Repo/                                   (= GitHub repo "labbook")
├── CLAUDE.md
├── PLAN.md
├── README.md
├── CHANGELOG.md
├── LICENSE                             Apache-2.0
├── .gitignore
├── .gitattributes                      * text=auto eol=lf
├── docker-compose.yml                  postgres:16 + healthcheck, volume
├── scripts/
│   └── migrate.sh                      applies db/migrations/*.sql in order to $DATABASE_URL
├── db/
│   ├── migrations/
│   │   ├── 001_init.sql                schema (section 6)
│   │   └── 002_seed.sql                demo labs + equipment
│   └── README.md
├── backend/                            Ballerina package labbook_api
│   ├── Ballerina.toml
│   ├── Config.toml.example
│   ├── service.bal                     HTTP resources
│   ├── auth.bal                        JWT / dev-user → caller
│   ├── db.bal                          client + queries
│   ├── rules.bal                       pure booking-rule checks
│   ├── types.bal                       records (API + DB)
│   ├── errors.bal                      error → HTTP response mapping
│   ├── openapi.yaml                    generated, then committed
│   ├── .choreo/component.yaml
│   └── tests/
│       ├── Config.toml
│       ├── rules_test.bal              group "unit"
│       └── api_test.bal                group "integration"
├── scheduler/                          Ballerina package labbook_scheduler
│   ├── Ballerina.toml
│   ├── Config.toml.example
│   ├── main.bal
│   └── tests/main_test.bal             group "integration"
├── frontend/                           React + Vite + TypeScript
│   ├── package.json
│   ├── index.html                      loads /config.js before the app
│   ├── vite.config.ts                  proxy /api -> http://localhost:8080
│   ├── public/config.js                window.configs = { apiUrl: "/api", authMode: "dev" }
│   └── src/
│       ├── main.tsx, App.tsx, router.tsx
│       ├── lib/api.ts                  fetch wrapper, error mapping
│       ├── lib/auth.tsx                AuthProvider (choreo | dev modes)
│       ├── lib/format.ts               date/time helpers (Intl)
│       ├── components/                 NavBar, StatusBadge, AvailabilityTimeline,
│       │                               ConfirmDialog, Toast, EmptyState, Spinner
│       ├── pages/                      Landing, Labs, LabDetail, Equipment, Book,
│       │                               MyBookings, admin/{Dashboard,Approvals,Labs,Equipment}
│       └── test/                       Vitest + Testing Library tests
├── docs/
│   ├── architecture.md
│   ├── database-schema.md
│   ├── api.md
│   ├── security.md
│   ├── local-development.md
│   ├── deployment-choreo.md
│   ├── user-guide.md
│   ├── decisions.md                    lightweight ADR log
│   ├── diagrams/                       *.puml (Claude) + *.png (rendered by the user)
│   └── screenshots/                    captured by the user
└── .github/
    ├── workflows/ci.yml
    └── pull_request_template.md
```

## 5. Tech stack

| Area | Choice | Notes |
|---|---|---|
| API and scheduler | Ballerina Swan Lake (latest `2201.x` on the machine) | Modules `ballerina/http`, `ballerina/sql`, `ballerina/jwt`, `ballerina/log`, `ballerina/time`, `ballerinax/postgresql`, `ballerinax/postgresql.driver`. Set `observabilityIncluded = true` |
| DB | PostgreSQL 16 | Uses the `btree_gist` extension for exclusion constraints |
| Web | React 18, Vite, TypeScript, React Router, Tailwind CSS | Plain `fetch`, no state library |
| Web tests | Vitest + @testing-library/react + jsdom | |
| CI | GitHub Actions | |
| Node | 20 LTS | Must match a Choreo React buildpack option |

## 6. Database schema — `db/migrations/001_init.sql`

Status fields are `text` + `CHECK`, not enums. That keeps the partial exclusion constraints immutable-safe and maps trivially to Ballerina strings.

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject       text NOT NULL UNIQUE,                 -- IdP "sub"
  email         text UNIQUE,
  display_name  text NOT NULL,
  role          text NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS labs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9-]{2,16}$'),
  name         text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  building     text NOT NULL,
  room         text NOT NULL,
  capacity     int  NOT NULL CHECK (capacity BETWEEN 1 AND 500),
  description  text NOT NULL DEFAULT '',
  open_time    time NOT NULL DEFAULT '08:00',
  close_time   time NOT NULL DEFAULT '17:00',
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (open_time < close_time)
);

CREATE TABLE IF NOT EXISTS equipment (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id       uuid REFERENCES labs(id) ON DELETE SET NULL,   -- home lab, optional
  asset_tag    text NOT NULL UNIQUE,
  name         text NOT NULL,
  category     text NOT NULL,
  description  text NOT NULL DEFAULT '',
  status       text NOT NULL DEFAULT 'available' CHECK (status IN ('available','maintenance','retired')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id),
  resource_type  text NOT NULL CHECK (resource_type IN ('lab','equipment')),
  lab_id         uuid REFERENCES labs(id),
  equipment_id   uuid REFERENCES equipment(id),
  start_at       timestamptz NOT NULL,
  end_at         timestamptz NOT NULL,
  purpose        text NOT NULL CHECK (char_length(purpose) BETWEEN 5 AND 500),
  attendees      int  NOT NULL DEFAULT 1 CHECK (attendees >= 1),
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected','cancelled','completed','expired')),
  admin_note     text,
  decided_by     uuid REFERENCES users(id),
  decided_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at),
  CHECK ((resource_type = 'lab'       AND lab_id IS NOT NULL AND equipment_id IS NULL)
      OR (resource_type = 'equipment' AND equipment_id IS NOT NULL AND lab_id IS NULL)),
  CHECK (status <> 'rejected' OR admin_note IS NOT NULL),
  CONSTRAINT no_lab_overlap EXCLUDE USING gist
    (lab_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
    WHERE (lab_id IS NOT NULL AND status IN ('pending','approved')),
  CONSTRAINT no_equipment_overlap EXCLUDE USING gist
    (equipment_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
    WHERE (equipment_id IS NOT NULL AND status IN ('pending','approved'))
);

CREATE INDEX IF NOT EXISTS bookings_user_start_idx   ON bookings (user_id, start_at DESC);
CREATE INDEX IF NOT EXISTS bookings_status_start_idx ON bookings (status, start_at);
CREATE INDEX IF NOT EXISTS equipment_lab_idx         ON equipment (lab_id);

-- updated_at triggers: drop + recreate so re-running the migration is safe
DROP TRIGGER IF EXISTS labs_updated_at ON labs;
CREATE TRIGGER labs_updated_at BEFORE UPDATE ON labs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS equipment_updated_at ON equipment;
CREATE TRIGGER equipment_updated_at BEFORE UPDATE ON equipment FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS bookings_updated_at ON bookings;
CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

**Seed data (`002_seed.sql`, idempotent with `ON CONFLICT DO NOTHING`):**
- 4 labs: `CSL-A` Computer Lab A (40 seats), `ELEC-1` Electronics Lab (24), `NET-1` Networking Lab (30), `IOT-1` IoT & Embedded Lab (20).
- 10 equipment items, e.g. oscilloscopes, a Raspberry Pi 5 kit ×2, an Arduino kit, a 3D printer, a projector ×2, a logic analyser and a Cisco switch kit. Put one in `maintenance` so the demo shows that status.

**`docs/database-schema.md` must contain:** the ER diagram image; one table per DB table (column, type, null, default, constraint, meaning); every CHECK and EXCLUDE constraint explained in plain words; indexes and which query each serves; the booking status lifecycle; how to run migrations locally and on Choreo; and the seed data summary.

## 7. API contract (`labbook-api`, JSON, camelCase)

Base path: `/` inside the component, exposed by Choreo as `.../labbook-api/v1`. Every route requires a caller (section 9), except `GET /health`.

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/health` | public | `{ "status": "ok" }` |
| GET | `/me` | any | Current user `{ id, email, displayName, role }` (upserts on first call) |
| GET | `/labs` | any | Active labs. Admins also get inactive ones with `?includeInactive=true` |
| GET | `/labs/{id}` | any | Lab + its equipment |
| POST | `/labs` | admin | Create a lab |
| PUT | `/labs/{id}` | admin | Update a lab (includes `isActive`) |
| GET | `/equipment` | any | `?category=&status=&labId=`. Students never see `retired` |
| POST | `/equipment` | admin | Create equipment |
| PUT | `/equipment/{id}` | admin | Update equipment (includes `status`) |
| GET | `/availability` | any | `?resourceType=lab\|equipment&resourceId=&date=YYYY-MM-DD` → `{ openTime, closeTime, busy: [{ startAt, endAt, status }] }` (no user details) |
| GET | `/bookings` | any | Students: their own bookings. Admins: all, with `?status=&scope=mine\|all`. `?when=upcoming\|past`, `limit` (≤100, default 20), `offset` |
| POST | `/bookings` | any | Create `{ resourceType, resourceId, startAt, endAt, purpose, attendees }` → 201 |
| GET | `/bookings/{id}` | owner/admin | One booking with resource name and user display name |
| POST | `/bookings/{id}/cancel` | owner/admin | Owner: before start only. Admin: any pending/approved booking |
| POST | `/bookings/{id}/approve` | admin | pending → approved |
| POST | `/bookings/{id}/reject` | admin | pending → rejected, body `{ note }` required |
| GET | `/stats` | admin | `{ bookingsToday, pendingCount, labUtilisation7d: [{ labId, code, hoursBooked, hoursOpen, ratio }], topEquipment30d: [{ id, name, count }] }` |

**Errors** use one JSON shape: `{ "code": "BOOKING_CONFLICT", "message": "human readable" }`.

| HTTP | `code` values |
|---|---|
| 400 | `BAD_REQUEST` (malformed JSON or params) |
| 401 | `UNAUTHENTICATED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `BOOKING_CONFLICT` (SQLSTATE `23P01` from an exclusion constraint), `INVALID_STATE` |
| 422 | `RULE_VIOLATION` with `rule` = `BR-n` (section 8) |
| 500 | `INTERNAL` (never leak SQL or stack traces) |

Generate `backend/openapi.yaml` with `bal openapi -i service.bal -o .`, review it, commit it, and point `component.yaml`'s `schemaFilePath` at it so the Choreo test console has the full contract.

## 8. Booking rules (checked in `rules.bal`, DB is the final guard)

| ID | Rule |
|---|---|
| BR-1 | `startAt` must be in the future |
| BR-2 | Duration between 30 min and 4 h, and both ends on a 30-minute boundary |
| BR-3 | Start date no more than 30 days ahead |
| BR-4 | A lab booking must fit inside the lab's `open_time`–`close_time` on a single day, in the `campusTimeZone` config (default `Asia/Colombo`). An equipment booking with a home lab follows that lab's hours |
| BR-5 | `attendees` ≤ lab capacity. Equipment bookings have `attendees = 1` |
| BR-6 | No overlap with another pending/approved booking of the same resource (DB `EXCLUDE` → 409) |
| BR-7 | A student may hold at most 3 upcoming pending/approved bookings. Admins are exempt |
| BR-8 | Inactive labs and equipment that is in `maintenance` or `retired` can't be booked |
| BR-9 | Only a `pending` booking can be approved or rejected. Rejecting needs a note of 3–300 characters |
| BR-10 | A student cancels only their own booking, and only before `startAt`. Already cancelled/finished bookings → 409 `INVALID_STATE` |
| BR-11 | Bookings created by an admin are `approved` immediately (`decided_by` = self) |
| BR-12 | Scheduler: `pending` and `start_at < now()` → `expired`. `approved` and `end_at < now()` → `completed` |

Keep the rule functions pure (input records in, `RuleViolation?` out), so the unit tests need no DB.

## 9. Authentication & authorisation

**Production (Choreo):**
1. The SPA uses Choreo **Managed Authentication** with Asgardeo as the IdP. "Sign in" goes to `/auth/login`, "Sign out" to `/auth/logout`, and the SPA reads the user profile from Choreo's userinfo mechanism. **Before implementing, read the current Choreo Managed Authentication docs (in Chrome) and use the exact endpoints and cookie names they give.**
2. API calls go to the connection's proxied path `/choreo-apis/...`. The managed-auth layer attaches the access token, and the gateway validates it and forwards the request to the service with header `x-jwt-assertion` (the backend JWT).
3. `auth.bal` validates that JWT with `ballerina/jwt` against configurables `jwtIssuer` and `jwtJwksUrl`, then reads `sub`, `email` and the name claims. It upserts the user row and sets `role = 'admin'` if the email is in the `adminEmails` configurable (`string[]`).
4. **Verify the claims once** in Phase 8: log only the claim *names* (never their values) on the first request. If `email` is missing, add `email` to the requested scopes in the Choreo/Asgardeo app settings. If it still can't be obtained, add the configurable `adminSubjects` and log the change in `decisions.md`.

**Local development:** if the configurable `devMode = true` (default **false**), the service accepts header `X-Dev-User: <email>` instead of a JWT and logs a loud warning at startup. In dev mode (`window.configs.authMode = "dev"`) the SPA shows a small picker with `student@labbook.dev` and `admin@labbook.dev` (local `adminEmails` contains the latter). `devMode` must never be true in Choreo. Note this in `security.md`.

**`docs/security.md` covers:** the trust chain from browser through gateway to service; why the service checks the JWT signature rather than just decoding it; role resolution; dev mode and its guard; secrets handling (Choreo secret configs, nothing in git); SQL injection (parameterised `sql:ParameterizedQuery` only); and rate limiting/quota as future work.

## 10. Frontend

| Route | Who | Content |
|---|---|---|
| `/` | all | Signed out: hero ("Book labs & equipment in seconds"), 3 feature points, Sign in button. Signed in: redirect to `/labs` |
| `/labs` | any | Card grid: name, code, building/room, capacity, hours |
| `/labs/:id` | any | Lab details, equipment list, date picker + `AvailabilityTimeline` (30-min grid, busy blocks greyed, pending striped), "Book this lab" |
| `/equipment` | any | Table with category/status filters and a Book button |
| `/book?type=lab\|equipment&id=` | any | Form: date, start, end (30-min selects), attendees (labs), purpose. Client-side checks mirror BR-1..5, and the server's 409/422 messages show inline |
| `/bookings` | any | Tabs Upcoming / Past, a `StatusBadge` per booking, Cancel with `ConfirmDialog` |
| `/admin` | admin | Stat cards and a utilisation bar per lab (plain CSS bars, no chart library) |
| `/admin/approvals` | admin | Pending queue, oldest first: Approve, Reject (note dialog) |
| `/admin/labs`, `/admin/equipment` | admin | Tables with create/edit dialogs and activate/status toggles |

- **Look:** clean and calm, one accent colour (indigo), system font stack, generous spacing, responsive down to 360 px, visible focus rings, `aria` labels on icon buttons, and loading/empty/error states on every page. It should look good on camera at 1080p, because the demo video is recorded from it.
- **Config:** `index.html` loads `/config.js` (`window.configs = { apiUrl, authMode }`) before the bundle. In Choreo, a **file mount** replaces `config.js` with `{ apiUrl: "<connection /choreo-apis path>", authMode: "choreo" }`.
- **API client:** `lib/api.ts` prefixes `apiUrl`, adds `X-Dev-User` in dev mode, sends cookies, and converts error JSON into a typed `ApiError { status, code, message, rule? }`. On a 401 in choreo mode it redirects to `/auth/login`.

## 11. Scheduler (`labbook-scheduler`)

`main()` runs the two BR-12 `UPDATE` statements in a single transaction, logs `expired=<n> completed=<n>` and exits 0. If anything fails it logs the error and exits non-zero. It uses the same DB configurables as the API. On Choreo it is a **Scheduled Task** with cron `*/15 * * * *`.

## 12. Diagrams (PlantUML) — ⏸ rendered by the user

Write these to `docs/diagrams/`, each with `!theme plain`, a title, and no remote includes:

| File | Type | Must show |
|---|---|---|
| `system-context.puml` | component/use-case | Student, Lab Admin, LabBook, Asgardeo, GitHub, Choreo |
| `deployment-choreo.puml` | deployment | Choreo project "LabBook" with Dev and Prod environments, each holding web app, gateway, API and scheduled task; PostgreSQL; Asgardeo; the GitHub repo as the build source |
| `er-diagram.puml` | entity (IE notation) | 4 tables, PK/FK, cardinalities, key constraints noted |
| `seq-create-booking.puml` | sequence | Login via managed auth, POST /bookings through gateway (x-jwt-assertion), rule check, insert; alt paths for 422 and for 409 (exclusion constraint) |
| `booking-lifecycle.puml` | state | pending → approved/rejected/cancelled/expired, approved → completed/cancelled, plus who or what triggers each transition |
| `ci-cd-flow.puml` | activity | PR → GitHub Actions checks → merge to main → Choreo build (with security scan) → Dev deploy → test → promote to Prod |

⏸ **Checkpoint D (diagrams):** after writing them, stop and ask the user:
> "Please render each `docs/diagrams/*.puml` to a PNG with the same name, e.g. `docs/diagrams/er-diagram.png`. You can use the VS Code PlantUML extension (export), plantuml.com/plantuml, or `java -jar plantuml.jar -tpng docs/diagrams/*.puml`. Tell me when they're in place."

When the user confirms, check that every PNG exists. Open each one to check it matches its intent, fix the `.puml` and ask again if needed, then commit.

## 13. Documentation set

| File | Content |
|---|---|
| `README.md` | Logo/title, one-line pitch, **live demo link**, a screenshot, "The problem" and "The solution", features, architecture diagram, **Choreo Labs products used** (table from section 2), tech stack, quick start (local), deployment link, project structure, docs index, roadmap, license, author |
| `docs/architecture.md` | Context + deployment diagrams, component responsibilities, request flow, environments, configuration matrix (every configurable: name, component, secret?, dev value, prod source) |
| `docs/database-schema.md` | As described in section 6 |
| `docs/api.md` | Endpoint table, request/response example per endpoint, error codes, auth header notes, link to `backend/openapi.yaml` |
| `docs/security.md` | As described in section 9 |
| `docs/local-development.md` | Prerequisites, `docker compose`, migrate, `Config.toml` from the example, run API/web, run tests, troubleshooting |
| `docs/deployment-choreo.md` | The step-by-step Phase 8 runbook, written from what was actually clicked, with screenshots |
| `docs/user-guide.md` | Student guide and admin guide, with screenshots |
| `docs/decisions.md` | ADR-001 monorepo, ADR-002 Ballerina, ADR-003 DB-enforced no-overlap, ADR-004 managed auth + config-based admins, ADR-005 DB provider, plus any deviations found |
| `CHANGELOG.md` | Keep a Changelog format, `1.0.0` entry |

## 14. Testing strategy

**Backend unit tests** (`bal test --groups unit`, no DB) — one test per rule, at minimum:
- BR-1 past start rejected; BR-2 29 min / 4.5 h / 10:15 start rejected, 30 min and 4 h accepted
- BR-3 31 days ahead rejected; BR-4 07:30 start and 16:30–17:30 rejected for a lab open 08–17, and a cross-midnight booking rejected
- BR-5 attendees over capacity rejected; BR-9 rejecting with an empty note rejected
- the error mapping turns SQLSTATE 23P01 into 409 `BOOKING_CONFLICT`

**Backend integration tests** (`bal test --groups integration`, local/CI Postgres, `devMode=true` via `tests/Config.toml`):
- the student happy path: create → appears in GET /bookings → cancel
- an overlapping booking → 409; a booking touching the previous end (`[)` range) → 201
- a 4th upcoming booking → 422 BR-7; a student approving → 403; a student cancelling someone else's → 403 or 404
- admin approve and reject (with a note); an admin booking is auto-approved
- equipment in maintenance → 422 BR-8; `/availability` returns busy slots without user data; `/stats` shape

**Scheduler integration test:** seed a past pending and a past approved booking (insert directly with an old timestamp, bypassing the API rules), run the job function, and assert `expired` and `completed`.

**Frontend** (`npm test`): BookingForm client validation messages; StatusBadge label/colour per status; that `api.ts` maps a 409 body to an `ApiError`; AvailabilityTimeline renders busy blocks in the right rows.

**Manual end-to-end** in Phase 8 on Dev, then on Prod: the full student + admin script in section 16, Phase 8.

## 15. CI — `.github/workflows/ci.yml`

Runs on `pull_request` and on `push` to `main`. It has three jobs:
- **backend:** a `postgres:16` service; apply migrations with `psql`; install Ballerina (check the current official setup action/installer and pin the version); `bal build`; `bal test` (all groups) in `backend/`.
- **scheduler:** `bal build` and `bal test` in `scheduler/` against the same service.
- **frontend:** Node 20 with npm cache; `npm ci`, `npm run lint`, `npm test -- --run`, `npm run build`.

Add the CI badge to the README.

## 16. Execution phases

Each phase: create its issue → branch → work → quality gate → commit(s) → PR `Closes #n` → squash-merge → tick the tracker. Phases 0–1 run on `main` directly, since there's no remote until 1.

### Phase 0 — Prerequisites
- Check that these are installed: `git --version`, `gh --version`, `gh auth status`, `node -v` (≥ 20), `npm -v`, `bal version`, `docker --version`, `docker compose version`, `git config user.name`, `git config user.email` (check they're set, don't print the email).
- ⏸ **Checkpoint P:** if anything is missing, list exactly what to install (e.g. `winget install --id GitHub.cli`, the Ballerina installer from ballerina.io, Docker Desktop, Node 20 LTS) and stop. If `gh` isn't logged in, ask the user to run `gh auth login` themselves.
- **Done when:** every tool reports a version and gh is authenticated.

### Phase 1 — Repo scaffold & GitHub
1. `git init -b main`. Write `.gitignore` (node_modules, dist, target, `Config.toml` except under `tests/`, `.env*` but not `!.env.example`, `*.local`, `.DS_Store`, `.vscode/*` except `extensions.json`), `.gitattributes`, `LICENSE` (Apache-2.0, copyright = the git user name), a stub `README.md`, and `CHANGELOG.md`. Commit `chore: initial scaffold`.
2. ⏸ **Checkpoint G:** show the repo name, visibility, description and topics from section 4, and ask the user to confirm creating the **public** GitHub repo.
3. Then run:
   ```bash
   gh repo create labbook --public --description "Book university labs and equipment without double bookings. Ballerina API + React web app on Choreo, secured with Asgardeo." --source . --remote origin --push
   gh repo edit --add-topic choreo --add-topic asgardeo --add-topic ballerina --add-topic react --add-topic typescript --add-topic postgresql --add-topic lab-booking --add-topic university --add-topic internal-developer-platform
   gh label create backend   --color 1D76DB --description "Ballerina API / scheduler"
   gh label create frontend  --color 5319E7 --description "React web app"
   gh label create database  --color 0E8A16 --description "Schema and migrations"
   gh label create docs      --color 0075CA --description "Documentation and diagrams"
   gh label create infra     --color FBCA04 --description "CI, Choreo, deployment"
   gh api repos/{owner}/{repo}/milestones -f title="v1.0.0" -f description="First public release"
   ```
4. Create one issue per remaining phase (2–10) with its checklist from this plan, the matching label and the `v1.0.0` milestone:
   ```bash
   gh issue create --title "Phase 2: Database schema & migrations" --label database --milestone v1.0.0 --body-file <tmp file with the phase checklist>
   ```
5. Add `.github/pull_request_template.md` (Summary / Changes / How tested / Screenshots) and commit and push it.
- **Done when:** the repo is on GitHub with topics, labels, a milestone and issues for Phases 2–10.

### Phase 2 — Database
- `docker-compose.yml` (postgres:16, db `labbook`, user `labbook`, password from the gitignored `.env`, with a committed `.env.example` holding a local-only default, port 5432, healthcheck).
- `db/migrations/001_init.sql` (section 6), `002_seed.sql`, `db/README.md`.
- `scripts/migrate.sh`: `set -euo pipefail`; requires `DATABASE_URL`; applies each `db/migrations/*.sql` in name order with `psql -v ON_ERROR_STOP=1`. If `psql` isn't installed it falls back to `docker compose exec -T db psql`.
- Verify: run it twice (idempotent); insert two overlapping pending bookings by hand → the second fails with `23P01`; then two touching ones → both succeed. Clean up.
- **Done when:** migrations apply cleanly twice and the constraints behave as stated.

### Phase 3 — Documentation & diagrams
- Write the 6 `.puml` files (section 12) and every doc in section 13 except the deployment runbook, user-guide screenshots and the live link (placeholders marked `TODO(phase-8)`).
- ⏸ **Checkpoint D** (section 12).
- **Done when:** all PNGs exist, docs embed them, and links are relative and resolve.

### Phase 4 — Backend API
- Create the Ballerina package (`bal new backend` style layout, package `labbook_api`) with the files in section 4. Configurables: `port = 8080`, `dbHost`, `dbPort = 5432`, `dbName`, `dbUser`, `dbPassword` (secret), `dbSslMode = "require"` (local `"disable"`), `campusTimeZone = "Asia/Colombo"`, `adminEmails`, `jwtIssuer`, `jwtJwksUrl`, `devMode = false`.
- Use parameterised queries only. Map Postgres errors centrally in `errors.bal`. Use a DB connection pool with a small max (5).
- Log one line per request (method, path, status, ms), with no PII and no tokens.
- `.choreo/component.yaml`:
  ```yaml
  schemaVersion: 1.1        # check the current schema version in the Choreo docs
  endpoints:
    - name: labbook-api
      displayName: LabBook API
      service:
        basePath: /
        port: 8080
      type: REST
      networkVisibilities:
        - Public
      schemaFilePath: openapi.yaml
  ```
- Generate and commit `openapi.yaml`. Write the unit and integration tests (section 14).
- **Done when:** `bal build` and `bal test` (both groups) pass locally, and curl with `X-Dev-User` exercises every endpoint.

### Phase 5 — Scheduler
- Package `labbook_scheduler`, `main.bal` (section 11), `Config.toml.example`, the integration test.
- **Done when:** `bal build` and `bal test` pass, and a manual run prints the counts.

### Phase 6 — Frontend
- `npm create vite@latest frontend -- --template react-ts`, then add `react-router-dom`, `tailwindcss` (+ its Vite plugin), `vitest`, `@testing-library/react`, `@testing-library/jest-dom` and `jsdom`. Nothing else.
- Build every route in section 10 against the local API in dev mode. Use the seed data to make it look real.
- Write the frontend tests (section 14).
- **Done when:** lint, test and build are all green, and you've clicked through every story in section 1 in dev mode as both student and admin.

### Phase 7 — CI
- Add `.github/workflows/ci.yml` (section 15) and the README badge. Open the PR and make CI green.
- **Done when:** all three jobs pass on the PR and on `main`.

### Phase 8 — Deploy on Choreo (Claude in Chrome)
> Use the Claude in Chrome extension for every console step. The user signs in. Never type secrets (CLAUDE.md rule 3). Write `docs/deployment-choreo.md` as you go, from what you actually see.

1. ⏸ **Checkpoint C1:** ask the user to sign in to the Choreo console (check the current URL after the Choreo Labs rebrand) in Chrome and to authorise the Choreo GitHub App on the `labbook` repo.
2. Create project **LabBook** from the `labbook` repo (monorepo) on branch `main`.
3. **Database:** look under the organisation's Dependencies/Databases for a free PostgreSQL. ⏸ **Checkpoint C2:** the user creates it (or a Neon project) and puts the connection string in `Repo/.env.choreo` (gitignored) as `DATABASE_URL=...`. Then run `DATABASE_URL=$(grep ...) bash scripts/migrate.sh` for Dev, and later for Prod, without echoing the URL.
4. **`labbook-api`:** a Service component from directory `backend`, Ballerina buildpack. Build, and confirm the security scan passes. Deploy to Development and fill in the non-secret configurables (`dbHost`, `dbPort`, `dbName`, `dbUser`, `dbSslMode`, `campusTimeZone`, `adminEmails`, `jwtIssuer`, `jwtJwksUrl`). Take `jwtIssuer` and `jwtJwksUrl` from the Choreo docs/console for the backend JWT. ⏸ The user pastes `dbPassword`. Then test `/health` and `/labs` in the Choreo test console.
5. **`labbook-web`:** a Web Application from directory `frontend`, React buildpack, Node 20, build command `npm run build`, output `dist`. Enable **Managed Authentication**, create a **Connection** to `labbook-api`, and add a **file mount** `config.js` with `apiUrl` = the connection's `/choreo-apis/...` path and `authMode: "choreo"`. Deploy to Development.
6. ⏸ **Checkpoint C3 (users):** the user creates two test users in the Asgardeo/Choreo user store and sets the passwords themselves: one student, and one admin whose email is in `adminEmails`.
7. Do the claim verification from section 9.4, then remove the claim-name log line.
8. **`labbook-scheduler`:** a Scheduled Task from directory `scheduler` with cron `*/15 * * * *`, same DB configs (⏸ the user pastes `dbPassword`). Trigger it manually once and check its logs.
9. **Dev smoke test** (via Chrome, signed in as the test users): student books CSL-A tomorrow 10:00–12:00 → pending; student tries 11:00–13:00 → conflict message; admin approves; student sees approved; student cancels a second booking; admin rejects one with a note; the admin dashboard shows numbers; the Observability page shows requests.
10. **Promote** all three components to Production. Set up Prod configs (separate DB or schema; ⏸ the user pastes secrets), run the migrations against the Prod DB, and repeat the smoke test on Prod.
11. ⏸ **Checkpoint C4 (screenshots):** ask the user to capture these into `docs/screenshots/`: landing, labs, lab detail with timeline, booking form with a conflict error, my bookings, admin approvals, admin dashboard, Choreo project overview, Choreo observability.
- **Done when:** Prod works end to end and `deployment-choreo.md` is complete.

### Phase 9 — Polish & docs completion
- Fill every `TODO(phase-8)`: the live URL, screenshots in the README and user guide, the configuration matrix with real sources.
- `gh repo edit --homepage <prod web app URL>`.
- Run the `avoid-ai-writing` skill over README and docs (professional voice), keeping the content.
- **Done when:** `grep -r "TODO" docs README.md` returns nothing and every link resolves.

### Phase 10 — Release
- ⏸ **Checkpoint R:** show the user the final README and ask before publishing the release.
- Update `CHANGELOG.md` to 1.0.0, merge, then:
  ```bash
  git tag -a v1.0.0 -m "LabBook v1.0.0"
  git push origin v1.0.0
  gh release create v1.0.0 --title "LabBook v1.0.0" --notes-file <changelog 1.0.0 section>
  gh api -X PATCH repos/{owner}/{repo}/milestones/1 -f state=closed
  ```
- **Done when:** the release is public, all issues are closed and the milestone is closed.

## 17. Final acceptance checklist

- [ ] All 10 user stories in section 1 work on the **Production** URL
- [ ] Double booking is impossible, even under concurrent requests (DB constraint)
- [ ] CI is green on `main`; backend unit + integration, scheduler and frontend tests all pass
- [ ] No secrets in git history (`git log -p | grep -iE "password|secret|token"` shows only names, no values)
- [ ] README has the live link, a screenshot, the architecture diagram and the Choreo Labs products table
- [ ] All 6 diagrams are rendered and embedded; the schema and API docs match the code
- [ ] No commit has a Claude co-author trailer: `git log --format=%B | grep -i "co-authored-by"` is empty
- [ ] Release v1.0.0 published

## 18. Progress tracker

- [x] Phase 0 — Prerequisites
- [x] Phase 1 — Repo scaffold & GitHub
- [x] Phase 2 — Database
- [ ] Phase 3 — Documentation & diagrams
- [ ] Phase 4 — Backend API
- [ ] Phase 5 — Scheduler
- [ ] Phase 6 — Frontend
- [ ] Phase 7 — CI
- [ ] Phase 8 — Deploy on Choreo
- [ ] Phase 9 — Polish & docs completion
- [ ] Phase 10 — Release
