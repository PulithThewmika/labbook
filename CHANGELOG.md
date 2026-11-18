# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.0.0] - 2026-11-18

First public release.

### Added
- Booking of labs and equipment with a 30-minute availability timeline for any day in the next 30 days.
- Booking rules BR-1 to BR-11 (future start, 30 minute to 4 hour slots, opening hours, capacity, upcoming-booking limit, bookable resources, admin auto-approval), each with a clear error.
- Database-enforced no-overlap rule: PostgreSQL exclusion constraints make double bookings impossible, including under concurrent requests.
- Student pages: labs, lab detail, equipment, booking form, and my bookings with cancel.
- Admin pages: approval queue with rejection notes, lab and equipment management, and a dashboard with seven-day utilisation and most-booked equipment.
- Scheduler that expires stale pending bookings and completes finished approved ones every 15 minutes.
- Sign-in with ThunderID using the OIDC authorization code flow with PKCE; the API verifies the access token (signature and issuer).
- Deployment to OpenChoreo v1.3.3: a project with three components, a PostgreSQL resource seeded from the migration files, and development, staging and production environments. Run end to end in development.
- REST API (17 endpoints) with an OpenAPI description, and a React single-page app.
- GitHub Actions CI (backend, scheduler, frontend) and documentation with diagrams and screenshots.

### Notes
- Local development uses a dev sign-in picker (`X-Dev-User`) that must never be enabled on a shared deployment.
- Example and test configuration files contain the throwaway local database password `labbook_local`. It is the default for the local Docker database, not a real secret.
- Known limits: the access token is kept in `sessionStorage`, the token audience is not checked, and the OpenChoreo deployment runs over plain HTTP on localhost.

[Unreleased]: https://github.com/PulithThewmika/labbook/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/PulithThewmika/labbook/releases/tag/v1.0.0
