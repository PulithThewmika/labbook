# Database schema

PostgreSQL 16 with the `btree_gist` extension. Source of truth: [`db/migrations/001_init.sql`](../db/migrations/001_init.sql).

![ER diagram](diagrams/er-diagram.png) · [source](diagrams/er-diagram.puml)

Status fields are `text` with a `CHECK`, not enum types. That keeps the partial exclusion constraints simple and maps directly to Ballerina strings.

## Tables

### `users`

| Column | Type | Null | Default | Constraint | Meaning |
|---|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK | Internal id |
| subject | text | no | | UNIQUE | `sub` claim from the identity provider |
| email | text | yes | | UNIQUE | Email claim, used to resolve the admin role |
| display_name | text | no | | | Name shown in the UI |
| role | text | no | `'student'` | `student` or `admin` | Role, re-resolved from `adminEmails` on every sign-in |
| created_at | timestamptz | no | `now()` | | First seen |
| last_seen_at | timestamptz | no | `now()` | | Last API call |

### `labs`

| Column | Type | Null | Default | Constraint | Meaning |
|---|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK | |
| code | text | no | | UNIQUE, `^[A-Z0-9-]{2,16}$` | Short code, e.g. `CSL-A` |
| name | text | no | | 2 to 100 chars | |
| building, room | text | no | | | Location |
| capacity | int | no | | 1 to 500 | Maximum attendees |
| description | text | no | `''` | | |
| open_time, close_time | time | no | `08:00`, `17:00` | `open_time < close_time` | Daily opening hours in the campus time zone |
| is_active | boolean | no | `true` | | Inactive labs cannot be booked |
| created_at, updated_at | timestamptz | no | `now()` | | `updated_at` kept by trigger |

### `equipment`

| Column | Type | Null | Default | Constraint | Meaning |
|---|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK | |
| lab_id | uuid | yes | | FK `labs`, `ON DELETE SET NULL` | Home lab; its hours apply to bookings |
| asset_tag | text | no | | UNIQUE | Inventory tag |
| name, category | text | no | | | |
| description | text | no | `''` | | |
| status | text | no | `'available'` | `available`, `maintenance`, `retired` | Only `available` can be booked |
| created_at, updated_at | timestamptz | no | `now()` | | |

### `bookings`

| Column | Type | Null | Default | Constraint | Meaning |
|---|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK | |
| user_id | uuid | no | | FK `users` | Requester |
| resource_type | text | no | | `lab` or `equipment` | Which kind of resource is booked |
| lab_id | uuid | yes | | FK `labs` | Set for lab bookings |
| equipment_id | uuid | yes | | FK `equipment` | Set for equipment bookings |
| start_at, end_at | timestamptz | no | | `end_at > start_at` | Half-open interval `[start, end)` |
| purpose | text | no | | 5 to 500 chars | |
| attendees | int | no | `1` | `>= 1` | |
| status | text | no | `'pending'` | see lifecycle | |
| admin_note | text | yes | | required when rejected | Reason from the admin |
| decided_by | uuid | yes | | FK `users` | Admin who approved or rejected |
| decided_at | timestamptz | yes | | | |
| created_at, updated_at | timestamptz | no | `now()` | | |

## Constraints in plain words

- **Resource shape (CHECK):** a lab booking has a `lab_id` and no `equipment_id`; an equipment booking is the reverse. A booking can never point at both or neither.
- **Rejection needs a note (CHECK):** `status <> 'rejected' OR admin_note IS NOT NULL`.
- **`no_lab_overlap` (EXCLUDE):** two bookings for the same lab cannot have overlapping time ranges while both are `pending` or `approved`. Cancelled, rejected, expired and completed bookings free the slot.
- **`no_equipment_overlap` (EXCLUDE):** the same rule per piece of equipment.
- Ranges are half-open (`'[)'`), so a booking that starts exactly when another ends is allowed.
- A violated exclusion constraint raises SQLSTATE `23P01`, which the API maps to `409 BOOKING_CONFLICT`. Because the database enforces it, concurrent requests cannot create a double booking.

## Indexes

| Index | Serves |
|---|---|
| `bookings_user_start_idx (user_id, start_at DESC)` | "My bookings" list |
| `bookings_status_start_idx (status, start_at)` | Approval queue, scheduler updates, stats |
| `equipment_lab_idx (lab_id)` | Lab detail page equipment list |
| GiST indexes behind the two EXCLUDE constraints | Overlap checks and availability range queries |

## Booking status lifecycle

![Lifecycle](diagrams/booking-lifecycle.png) · [source](diagrams/booking-lifecycle.puml)

`pending` becomes `approved`, `rejected`, `cancelled` or `expired`. `approved` becomes `completed` or `cancelled`. The scheduler produces `expired` and `completed`.

## Running migrations

Local (see [local-development.md](local-development.md)):

```bash
export DATABASE_URL=postgresql://labbook:labbook_local@localhost:5432/labbook
bash scripts/migrate.sh
```

On OpenChoreo, the same SQL files are the `initSQL` of the Postgres resource and run once when the database first starts. See [deployment-openchoreo.md](deployment-openchoreo.md).

## Seed data

`002_seed.sql` adds 4 labs (`CSL-A` 40 seats, `ELEC-1` 24, `NET-1` 30, `IOT-1` 20) and 10 equipment items, including oscilloscopes, two Raspberry Pi 5 kits, an Arduino kit, a 3D printer, two projectors, a logic analyser and a Cisco switch kit. One oscilloscope is in `maintenance` so the demo shows that status.
