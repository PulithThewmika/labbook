# Local development

## Prerequisites

Git, Docker Desktop, Node.js 20 or newer, Ballerina Swan Lake 2201.x (`bal version`). `psql` is optional.

## 1. Database

```bash
cp .env.example .env
docker compose up -d db
export DATABASE_URL=postgresql://labbook:labbook_local@localhost:5432/labbook
bash scripts/migrate.sh
```

## 2. API

```bash
cd backend
cp Config.toml.example Config.toml    # devMode = true, adminEmails = ["admin@labbook.dev"]
bal run                               # http://localhost:8080
curl -H "X-Dev-User: student@labbook.dev" http://localhost:8080/labs
```

## 3. Web app

```bash
cd frontend
npm ci
npm run dev                           # http://localhost:5173, proxies /api to :8080
```

Use the picker in the nav bar to switch between `student@labbook.dev` and `admin@labbook.dev`.

## 4. Scheduler

```bash
cd scheduler
cp Config.toml.example Config.toml
bal run
```

## Tests

```bash
cd backend   && bal test --groups unit          # no database
cd backend   && bal test --groups integration   # needs the local database
cd scheduler && bal test
cd frontend  && npm run lint && npm test && npm run build
```

## Troubleshooting

- **`bal` not found:** open a new terminal after installing Ballerina so PATH refreshes.
- **Port 5432 busy:** stop the other Postgres or change the port mapping in `docker-compose.yml`.
- **`docker compose` asks for `POSTGRES_PASSWORD`:** you skipped `cp .env.example .env`.
- **401 from the API locally:** `devMode` is off in `Config.toml`, or the `X-Dev-User` header is missing.
