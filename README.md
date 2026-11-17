# LabBook

[![CI](https://github.com/PulithThewmika/labbook/actions/workflows/ci.yml/badge.svg)](https://github.com/PulithThewmika/labbook/actions/workflows/ci.yml)

Book university labs and equipment without double bookings.

**Live demo:** TODO(phase-8)

![LabBook screenshot](docs/screenshots/labs.png)

## The problem

In many universities, lab and equipment booking runs on paper logbooks, WhatsApp messages or emails to the instructor. That leads to double bookings, nobody can see what is free, and there is no record of who used what.

## The solution

Students see live availability of labs and equipment and request a time slot. Lab admins approve or reject requests from one queue. The database makes double bookings impossible, and a scheduled job closes out old bookings automatically.

## Features

- Live availability timeline for every lab and piece of equipment
- Booking requests with clear errors for every rule (hours, duration, capacity, limits)
- Admin approval queue with rejection notes
- Admin management of labs and equipment, plus a utilisation dashboard
- Overlap protection enforced by PostgreSQL exclusion constraints
- Scheduler that expires stale requests and completes finished bookings

## Architecture

![System context](docs/diagrams/system-context.png)

More in [docs/architecture.md](docs/architecture.md).

## Choreo Labs products used

| Product | How LabBook uses it |
|---|---|
| **Choreo** | Service, Web Application (Managed Authentication) and Scheduled Task components; Connections; configurables and secrets; Development to Production promotion; API gateway security; Observability |
| **Asgardeo** | Identity provider behind Choreo Managed Authentication |
| **Ballerina** | Language for the REST API and the scheduler; `configurable` variables map to Choreo configs |

## Tech stack

Ballerina Swan Lake, PostgreSQL 16, React 18 + Vite + TypeScript + Tailwind CSS, Vitest, GitHub Actions.

## Quick start (local)

```bash
cp .env.example .env
docker compose up -d db
export DATABASE_URL=postgresql://labbook:labbook_local@localhost:5432/labbook
bash scripts/migrate.sh
```

Then follow [docs/local-development.md](docs/local-development.md) to run the API and web app.

## Deployment

See [docs/deployment-choreo.md](docs/deployment-choreo.md).

## Project structure

```
backend/     Ballerina REST API        (Choreo Service "labbook-api")
scheduler/   Ballerina scheduled job   (Choreo Scheduled Task "labbook-scheduler")
frontend/    React + Vite SPA          (Choreo Web Application "labbook-web")
db/          SQL migrations and seed data
docs/        Documentation and diagrams
```

## Documentation

[Architecture](docs/architecture.md) · [Database schema](docs/database-schema.md) · [API](docs/api.md) · [Security](docs/security.md) · [Local development](docs/local-development.md) · [Deployment](docs/deployment-choreo.md) · [User guide](docs/user-guide.md) · [Decisions](docs/decisions.md)

## Roadmap

Email notifications, recurring bookings, calendar sync, multiple campuses.

## License

Apache-2.0. See [LICENSE](LICENSE).
