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

## Phase 6 notes (frontend)

- **React 18** is pinned as the plan says, although the Vite template ships React 19. Vite 8, TypeScript 7 and oxlint come from the template.
- **`timeZone` in `config.js`:** the runtime config has a third key, `timeZone` (default `Asia/Colombo`), so dates are entered and shown in campus time. The Choreo file mount may omit it.
- **Extra dev dependency:** `@testing-library/dom`, a required peer of `@testing-library/react`.
- **My bookings tabs:** Upcoming holds live (pending/approved, not yet ended) bookings; Past holds everything else, including cancelled and rejected. The list is fetched once (limit 100) and split in the browser.
- **Dev auth:** in `authMode = "dev"` the SPA sends `X-Dev-User` from a small picker. The Choreo sign-in/sign-out endpoints (`/auth/login`, `/auth/logout`) are used as written in the plan and are verified in Phase 8.

## Phase 8 notes: verified against the current Choreo docs

Checked on 2026-11-18 against the Choreo Labs developer docs (now served from choreolabs.com; wso2.com/choreo/docs redirects there).

- **`component.yaml` schemaVersion:** 1.2 is the current version (1.0, 1.1 and 1.2 exist). `backend/.choreo/component.yaml` was changed from 1.1 to 1.2. Endpoint fields (`name`, `displayName`, `service.basePath`, `service.port`, `type`, `networkVisibilities`, `schemaFilePath`) match the plan. For the Ballerina preset `schemaFilePath` is relative to the component root.
- **Managed Authentication:** enabled with the "Managed Authentication with WSO2 Developer Platform" toggle in Deploy > Set Up > Configure & Deploy (on by default for React). Login is `/auth/login`. **Logout is `/auth/logout?session_hint=<value of the session_hint cookie>`**, so the plan's bare `/auth/logout` was incomplete; `frontend/src/lib/auth.tsx` now sends the hint. `GET /auth/userinfo` returns 200 JSON when signed in and 401 otherwise. IdP redirect URIs are `<app-url>/auth/login/callback` and `<app-url>/auth/logout/callback`.
- **Calling the API:** the SPA calls the connection's `/choreo-apis/<api-suffix>` path (the docs write the prefix with the product name; the exact prefix is read from the console and used in the `config.js` file mount). The suffix includes a version segment such as `1.0.0`. A 401 means the session expired; the SPA redirects to `/auth/login`.
- **Backend JWT:** header `X-JWT-Assertion` (header names are case-insensitive). `iss` is `wso2.org/products/am`. The JWKS URL depends on the data-plane region: `https://gateway.e1-us-east-azure.choreoapis.dev/.wellknown/jwks` (US East) or `https://gateway.e1-eu-north-azure.choreoapis.dev/.wellknown/jwks` (EU North). RSA keys only. There is no `aud` unless "End User Token Audiences" is set. `email` is present only when the Asgardeo app releases the email claim; no `name` claim is documented, so display names fall back to the email local part.
- **New required step:** the service endpoint must have **"Pass Security Context To Backend"** enabled (Deploy > Set Up > Endpoint Configurations), then be redeployed, or the gateway does not send the JWT.
- **Still to confirm in the console (Phase 8):** database offering, exact `/choreo-apis` prefix, the served path for the `config.js` file mount, and the Ballerina buildpack and Node version labels.

## OpenChoreo deployment notes

- **Why OpenChoreo:** creating an organisation on Choreo cloud was restricted for this project's account, so the project is also deployed to OpenChoreo v1.3.3 (open-source Choreo platform) on a local k3d cluster. The Choreo cloud runbook is kept; see [deployment-openchoreo.md](deployment-openchoreo.md).
- **Dockerfile builds for the Ballerina components:** the OpenChoreo `ballerina-buildpack-builder` installs a Java 21 runtime, but Ballerina 2201.14.x needs Java 25. `BP_JVM_VERSION` has no effect. `backend/Dockerfile` and `scheduler/Dockerfile` build on `ballerina/ballerina:2201.14.2` so the version matches local development and CI.
- **Same-origin API access:** `frontend/nginx.conf.template` proxies `/api/` to the API component, so the SPA keeps `apiUrl = "/api"` and the API needs no CORS settings.
- **Database wiring:** the Postgres Resource outputs are mapped to Ballerina's `BAL_CONFIG_VAR_*` environment variables in `workload.yaml`; `adminEmails` (an array, which environment variables cannot carry) goes in `BAL_CONFIG_DATA`.
- **Auth in this setup:** dev mode (`BAL_CONFIG_VAR_DEVMODE=true`), for local demo only. ThunderID sign-in is future work.
