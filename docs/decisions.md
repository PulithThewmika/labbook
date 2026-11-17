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
