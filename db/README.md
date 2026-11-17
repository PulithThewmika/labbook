# Database

PostgreSQL 16. Migrations are plain SQL in `migrations/`, applied in name order by `scripts/migrate.sh`. Every file is idempotent.

| File | Purpose |
|---|---|
| `001_init.sql` | Schema: users, labs, equipment, bookings, and the no-overlap exclusion constraints |
| `002_seed.sql` | Demo data: 4 labs and 10 equipment items (one in `maintenance`) |

## Local

```bash
cp .env.example .env
docker compose up -d db
export DATABASE_URL=postgresql://labbook:labbook_local@localhost:5432/labbook
bash scripts/migrate.sh
```

If `psql` is not installed, the script runs it inside the `db` container instead.
See `docs/database-schema.md` for the full schema description.
