# LabBook

[![CI](https://github.com/PulithThewmika/labbook/actions/workflows/ci.yml/badge.svg)](https://github.com/PulithThewmika/labbook/actions/workflows/ci.yml)

Book university labs and equipment without double bookings.

<p>Runs on &nbsp;<img src="docs/images/logos/openchoreo.png" alt="OpenChoreo" height="34">&nbsp;&nbsp; with sign-in by &nbsp;<img src="docs/images/logos/thunderid.svg" alt="ThunderID" height="30"></p>

![Computer Lab A availability timeline: booked slots in grey, a pending request striped](docs/screenshots/lab-detail.png)

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
- Sign-in with ThunderID (OIDC authorization code flow with PKCE)

## Screenshots

| | |
|---|---|
| ![Booking form refusing an overlapping slot](docs/screenshots/booking-conflict.png) | ![Admin approval queue](docs/screenshots/approvals.png) |
| A second request for a taken slot is refused (409), enforced by the database. | Admins review pending requests, oldest first. |
| ![Admin dashboard with lab utilisation](docs/screenshots/dashboard.png) | ![LabBook project in the OpenChoreo portal](docs/screenshots/openchoreo-project.png) |
| Utilisation per lab for the last 7 days and the most booked equipment. | The project in OpenChoreo: three components and a Postgres resource, with the development, staging and production pipeline. |

## Architecture

![System context](docs/diagrams/system-context.png)

More in [docs/architecture.md](docs/architecture.md).

## Runs on OpenChoreo

LabBook is deployed to [OpenChoreo](https://openchoreo.dev), the open-source internal developer platform (Apache-2.0), running on a local Kubernetes cluster. It was run end to end on OpenChoreo v1.3.3.

| Product | How LabBook uses it |
|---|---|
| <img src="docs/images/logos/openchoreo.png" alt="OpenChoreo" height="34">| One project with three components (service, web application, scheduled task), a PostgreSQL resource whose schema comes from `db/migrations`, builds from this repository with Dockerfile workflows, development, staging and production environments |
| <img src="docs/images/logos/thunderid.svg" alt="ThunderID" height="30">| OpenChoreo's OIDC identity provider; LabBook signs users in with the authorization code flow and PKCE |
| **Ballerina** | Language of the REST API and the scheduler |

Deployment steps: [docs/deployment-openchoreo.md](docs/deployment-openchoreo.md).

## Tech stack

Ballerina Swan Lake 2201.14, PostgreSQL 16, React 18 + Vite + TypeScript + Tailwind CSS, Vitest, GitHub Actions, OpenChoreo v1.3.

## Quick start (local, without Kubernetes)

```bash
cp .env.example .env
docker compose up -d db
export DATABASE_URL=postgresql://labbook:labbook_local@localhost:5432/labbook
bash scripts/migrate.sh
```

Then follow [docs/local-development.md](docs/local-development.md) to run the API and web app. Locally the app uses a dev sign-in picker instead of ThunderID.

## Container images

Ready-made images are published to GitHub Container Registry for each release:

| Image | Contents |
|---|---|
| `ghcr.io/puliththewmika/labbook-api` | Ballerina REST API (port 8080) |
| `ghcr.io/puliththewmika/labbook-scheduler` | Scheduled job (runs once per tick and exits) |
| `ghcr.io/puliththewmika/labbook-web` | React app behind nginx (port 80) |

Tags: the version (for example `1.0.0`) and `latest`.

```bash
docker pull ghcr.io/puliththewmika/labbook-web:1.0.0
docker run --rm -p 8081:80 ghcr.io/puliththewmika/labbook-web:1.0.0   # dev sign-in picker; point /api at a running API
```

The images take their settings from environment variables at run time (see [docs/architecture.md](docs/architecture.md#configuration-matrix)); no secrets are built into them. They are built by [`publish-images.yml`](.github/workflows/publish-images.yml) when a version tag is pushed.

## Project structure

```
backend/     Ballerina REST API        (OpenChoreo service "labbook-api")
scheduler/   Ballerina scheduled job   (OpenChoreo scheduled task "labbook-scheduler")
frontend/    React + Vite SPA          (OpenChoreo web application "labbook-web")
db/          SQL migrations and seed data
deploy/      OpenChoreo manifests and scripts
docs/        Documentation and diagrams
```

## Documentation

[Architecture](docs/architecture.md) · [Database schema](docs/database-schema.md) · [API](docs/api.md) · [Security](docs/security.md) · [Local development](docs/local-development.md) · [Deployment on OpenChoreo](docs/deployment-openchoreo.md) · [User guide](docs/user-guide.md) · [Decisions](docs/decisions.md)

## Roadmap

Email notifications, recurring bookings, calendar sync, multiple campuses.

## Credits

The OpenChoreo and ThunderID logos belong to their projects (both Apache-2.0) and are used here only to show what LabBook runs on.

## License

Apache-2.0. See [LICENSE](LICENSE).
