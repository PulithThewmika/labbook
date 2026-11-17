# Decisions

Lightweight architecture decision log.

## ADR-001: Monorepo

Choreo builds each component from a sub-directory, so one repo can hold the backend, scheduler and frontend. Reviewers also get a single link to the whole solution.

## ADR-002: Ballerina for the API and scheduler

Ballerina is a Choreo-native language. Its `configurable` variables appear directly as Choreo deployment configuration, and the Choreo Ballerina buildpack needs no Dockerfile.

## ADR-003: No double booking enforced by the database

Application checks alone race under concurrent requests. A PostgreSQL `EXCLUDE USING gist` constraint on `(resource, tstzrange)` makes overlap impossible regardless of timing. The API maps SQLSTATE `23P01` to `409 BOOKING_CONFLICT`.

## ADR-004: Managed authentication and config-based admins

Choreo Managed Authentication with Asgardeo avoids handling tokens in the SPA. Admins are the emails in the `adminEmails` configuration, which avoids building a role-management UI for v1.

## ADR-005: Database provider

Pending. Decided in Phase 8: a Choreo-managed PostgreSQL if the account offers one, otherwise Neon free tier. TODO(phase-8)

## Deviations from PLAN.md

- **Node version:** the development machine has Node 22.14. CI and the Choreo build target Node 20 as the plan requires; the app must work on both.
- **Ballerina install:** installed 2201.14.2 from the official GitHub release MSI (checksum verified) because `winget` hung. Not a project change.

## Phase 4 notes (backend)

- **Package name:** `labbook/labbook_api` (org `labbook`). Libraries resolved from Ballerina Central: `ballerinax/postgresql` 1.19.1, `ballerinax/postgresql.driver` 1.7.0, Ballerina 2201.14.2.
- **Interceptors:** the request log and error mapping use `http:InterceptableService` with a tuple return type from `createInterceptors()`, which this `ballerina/http` version requires for a complete OpenAPI file. Payload-binding errors (malformed JSON) are converted to the standard `BAD_REQUEST` shape by a `ResponseErrorInterceptor`.
- **Timestamps as strings:** SQL formats timestamps (`to_char`, UTC) and times (`HH24:MI`), and Ballerina passes ISO strings cast with `::timestamptz` / `::time`. This avoids driver-specific time mappings.
- **Campus time zone:** `time:Zone` is looked up per call. A module-level `time:Zone` makes `bal test` fail (its anonymous readonly type cannot be resolved).
- **BR-4 for equipment without a home lab:** uses the default hours 08:00-17:00 (the DB default for labs).
- **"Upcoming":** a booking is upcoming while `end_at > now()`. BR-7 counts pending/approved bookings that are upcoming.
- **JWT audience** is not validated yet; issuer and signature are. Revisit in Phase 8 once the Choreo backend JWT is inspected.
- **Unit tests still start the module,** so they need the database to be reachable (the Postgres client connects at start-up). CI provides one.
- **Integration test client** is pinned to HTTP/1.1: the default h2c upgrade stalls the first POST on a fresh connection.
- **Stats:** `labUtilisation7d` counts approved and completed bookings only.
