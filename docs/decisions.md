# Decisions

Lightweight architecture decision log.

## ADR-001: Monorepo

OpenChoreo builds each component from a sub-directory of a repository (`appPath`), so one repo can hold the backend, scheduler and frontend. Reviewers also get a single link to the whole solution.

## ADR-002: Ballerina for the API and scheduler

Ballerina is a good fit for typed REST services and runs well on the platform. Its `configurable` variables can be set from environment variables (`BAL_CONFIG_VAR_*`, `BAL_CONFIG_DATA`), which maps directly onto a workload descriptor.

## ADR-003: No double booking enforced by the database

Application checks alone race under concurrent requests. A PostgreSQL `EXCLUDE USING gist` constraint on `(resource, tstzrange)` makes overlap impossible regardless of timing. The API maps SQLSTATE `23P01` to `409 BOOKING_CONFLICT`.

## ADR-004: ThunderID sign-in and config-based admins

Users sign in with ThunderID, OpenChoreo's identity provider, using the OIDC authorization code flow with PKCE. The API verifies the access token (signature and issuer). Admins are the emails in the `adminEmails` configuration, which avoids building a role-management UI for v1. See ADR-006 for why this replaced the original Choreo cloud and Asgardeo design.

## ADR-005: Database provider

OpenChoreo's `postgres` Resource type: an in-cluster PostgreSQL 16 StatefulSet with a generated app user and password. The migration SQL files are its `initSQL`, so there is no separate migration job. Storage is persistent for the development environment.

## Deviations from PLAN.md

- **Node version:** the development machine has Node 22.14. CI and the frontend image build on Node 20 as the plan requires; the app must work on both.
- **Ballerina install:** installed 2201.14.2 from the official GitHub release MSI (checksum verified) because `winget` hung. Not a project change.

## Phase 4 notes (backend)

- **Package name:** `labbook/labbook_api` (org `labbook`). Libraries resolved from Ballerina Central: `ballerinax/postgresql` 1.19.1, `ballerinax/postgresql.driver` 1.7.0, Ballerina 2201.14.2.
- **Interceptors:** the request log and error mapping use `http:InterceptableService` with a tuple return type from `createInterceptors()`, which this `ballerina/http` version requires for a complete OpenAPI file. Payload-binding errors (malformed JSON) are converted to the standard `BAD_REQUEST` shape by a `ResponseErrorInterceptor`.
- **Timestamps as strings:** SQL formats timestamps (`to_char`, UTC) and times (`HH24:MI`), and Ballerina passes ISO strings cast with `::timestamptz` / `::time`. This avoids driver-specific time mappings.
- **Campus time zone:** `time:Zone` is looked up per call. A module-level `time:Zone` makes `bal test` fail (its anonymous readonly type cannot be resolved).
- **BR-4 for equipment without a home lab:** uses the default hours 08:00-17:00 (the DB default for labs).
- **"Upcoming":** a booking is upcoming while `end_at > now()`. BR-7 counts pending/approved bookings that are upcoming.
- **JWT audience** is not validated yet; issuer and signature are.
- **Unit tests still start the module,** so they need the database to be reachable (the Postgres client connects at start-up). CI provides one.
- **Integration test client** is pinned to HTTP/1.1: the default h2c upgrade stalls the first POST on a fresh connection.
- **Stats:** `labUtilisation7d` counts approved and completed bookings only.

## Phase 6 notes (frontend)

- **React 18** is pinned as the plan says, although the Vite template ships React 19. Vite 8, TypeScript 7 and oxlint come from the template.
- **`timeZone` in `config.js`:** the runtime config has a `timeZone` key (default `Asia/Colombo`), so dates are entered and shown in campus time.
- **Extra dev dependency:** `@testing-library/dom`, a required peer of `@testing-library/react`.
- **My bookings tabs:** Upcoming holds live (pending/approved, not yet ended) bookings; Past holds everything else, including cancelled and rejected. The list is fetched once (limit 100) and split in the browser.
- **Dev auth:** in `authMode = "dev"` the SPA sends `X-Dev-User` from a small picker. In `authMode = "oidc"` it signs in with ThunderID (see ADR-004).

## ADR-006: OpenChoreo and ThunderID instead of Choreo cloud and Asgardeo

The plan targeted Choreo cloud with Asgardeo. Creating an organisation on the Choreo cloud console was restricted for this project's account, so that deployment could not be run or verified. Rather than keep an untested design, the project targets what runs today: OpenChoreo (the open-source Kubernetes platform) with its identity provider ThunderID. The application code is not tied to either: sign-in is a small OIDC client, and the API reads a JWT from a configurable header and checks a configurable issuer and key URL. The Choreo-cloud-specific parts (a `component.yaml`, managed-authentication sign-in and the gateway-JWT runbook) were removed because they had never been run.

## OpenChoreo deployment notes

- **Platform:** OpenChoreo v1.3.3 on a local k3d cluster; see [deployment-openchoreo.md](deployment-openchoreo.md) and ADR-006.
- **Dockerfile builds for the Ballerina components:** the OpenChoreo `ballerina-buildpack-builder` installs a Java 21 runtime, but Ballerina 2201.14.x needs Java 25. `BP_JVM_VERSION` has no effect. `backend/Dockerfile` and `scheduler/Dockerfile` build on `ballerina/ballerina:2201.14.2` so the version matches local development and CI.
- **Same-origin API access:** `frontend/nginx.conf.template` proxies `/api/` to the API component, so the SPA keeps `apiUrl = "/api"` and the API needs no CORS settings.
- **Database wiring:** the Postgres Resource outputs are mapped to Ballerina's `BAL_CONFIG_VAR_*` environment variables in `workload.yaml`; `adminEmails` (an array, which environment variables cannot carry) goes in `BAL_CONFIG_DATA`.
- **Auth in this setup:** ThunderID sign-in (OIDC authorization code with PKCE). The SPA stores the access token in `sessionStorage`; the token exchange is proxied by nginx because ThunderID sends no CORS headers on its token endpoint. The API reads the JWT from a configurable header (`jwtHeader`, `x-jwt-assertion` for Choreo, `Authorization` for OpenChoreo) and verifies it with ThunderID's JWKS. The first OpenChoreo version ran in dev mode.
