# API reference

JSON over HTTP, camelCase fields. Machine-readable contract: [`backend/openapi.yaml`](../backend/openapi.yaml) (generated in Phase 4).

Choreo exposes the service at `.../labbook-api/v1`. Inside the component the base path is `/`.

## Authentication

- **On Choreo:** the gateway validates the access token and forwards the request with an `x-jwt-assertion` header. The API verifies that JWT's signature.
- **Local only:** with `devMode = true` the API accepts `X-Dev-User: <email>` instead. This must never be enabled on Choreo. See [security.md](security.md).

Every route needs a caller except `GET /health`.

## Endpoints

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/health` | public | `{ "status": "ok" }` |
| GET | `/me` | any | Current user; created on first call |
| GET | `/labs` | any | Active labs; admins can add `?includeInactive=true` |
| GET | `/labs/{id}` | any | Lab with its equipment |
| POST | `/labs` | admin | Create a lab |
| PUT | `/labs/{id}` | admin | Update a lab, including `isActive` |
| GET | `/equipment` | any | Filters `?category=&status=&labId=`; students never see `retired` |
| POST | `/equipment` | admin | Create equipment |
| PUT | `/equipment/{id}` | admin | Update equipment, including `status` |
| GET | `/availability` | any | `?resourceType=lab\|equipment&resourceId=&date=YYYY-MM-DD` |
| GET | `/bookings` | any | Own bookings (admins: all). `?status=&scope=mine\|all&when=upcoming\|past&limit=&offset=` |
| POST | `/bookings` | any | Create a booking, returns 201 |
| GET | `/bookings/{id}` | owner/admin | One booking |
| POST | `/bookings/{id}/cancel` | owner/admin | Cancel |
| POST | `/bookings/{id}/approve` | admin | pending to approved |
| POST | `/bookings/{id}/reject` | admin | pending to rejected, body `{ "note": "..." }` |
| GET | `/stats` | admin | Dashboard numbers |

`limit` is at most 100 (default 20).

## Examples

`GET /me`

```json
{ "id": "0b8f...", "email": "student@labbook.dev", "displayName": "Student", "role": "student" }
```

`GET /availability?resourceType=lab&resourceId=<id>&date=2030-01-01`

```json
{ "openTime": "08:00", "closeTime": "17:00",
  "busy": [ { "startAt": "2030-01-01T10:00:00Z", "endAt": "2030-01-01T12:00:00Z", "status": "approved" } ] }
```

`POST /bookings`

```json
{ "resourceType": "lab", "resourceId": "<lab id>",
  "startAt": "2030-01-01T10:00:00+05:30", "endAt": "2030-01-01T12:00:00+05:30",
  "purpose": "Group project demo", "attendees": 12 }
```

Response `201`: the booking with `status: "pending"` (`"approved"` when an admin creates it).

`POST /bookings/{id}/reject`

```json
{ "note": "Lab closed for maintenance that day" }
```

`GET /stats`

```json
{ "bookingsToday": 3, "pendingCount": 2,
  "labUtilisation7d": [ { "labId": "...", "code": "CSL-A", "hoursBooked": 14.5, "hoursOpen": 63, "ratio": 0.23 } ],
  "topEquipment30d": [ { "id": "...", "name": "3D Printer", "count": 7 } ] }
```

## Errors

One shape for every error: `{ "code": "BOOKING_CONFLICT", "message": "human readable" }`.

| HTTP | `code` |
|---|---|
| 400 | `BAD_REQUEST` |
| 401 | `UNAUTHENTICATED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `BOOKING_CONFLICT`, `INVALID_STATE` |
| 422 | `RULE_VIOLATION` with a `rule` field (`BR-1` to `BR-9`) |
| 500 | `INTERNAL` (no SQL or stack traces) |

## Booking rules

| ID | Rule |
|---|---|
| BR-1 | Start must be in the future |
| BR-2 | Duration 30 minutes to 4 hours, both ends on a 30-minute boundary |
| BR-3 | Start no more than 30 days ahead |
| BR-4 | Must fit inside the lab's opening hours on one day, in `campusTimeZone` (default `Asia/Colombo`). Equipment with a home lab follows that lab's hours |
| BR-5 | Attendees not above lab capacity; equipment bookings have 1 attendee |
| BR-6 | No overlap with another pending or approved booking of the same resource (database, 409) |
| BR-7 | A student holds at most 3 upcoming pending or approved bookings; admins are exempt |
| BR-8 | Inactive labs and equipment in `maintenance` or `retired` cannot be booked |
| BR-9 | Only `pending` bookings can be approved or rejected; a rejection note is 3 to 300 characters |
| BR-10 | Students cancel only their own booking, only before it starts |
| BR-11 | Admin-created bookings are approved immediately |
| BR-12 | Scheduler: past `pending` becomes `expired`, past `approved` becomes `completed` |
