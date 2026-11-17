# CLAUDE.md — LabBook

LabBook is a university lab & equipment booking system built on Choreo Labs products:
**Choreo** (hosting, gateway, CI/CD, observability), **Asgardeo** (login) and **Ballerina** (API + scheduler).
`PLAN.md` is the single source of truth for scope, schema, API, phases and checkpoints. Read it before doing anything.

## Layout

```
backend/     Ballerina REST API        -> Choreo Service component  "labbook-api"
scheduler/   Ballerina scheduled job   -> Choreo Scheduled Task     "labbook-scheduler"
frontend/    React + Vite + TS SPA     -> Choreo Web Application    "labbook-web"
db/          SQL migrations + seed
docs/        Architecture, schema, API, deployment, user guide, diagrams (PlantUML)
```

## Commands

```bash
docker compose up -d db                                   # local PostgreSQL 16
bash scripts/migrate.sh                                   # apply db/migrations/*.sql to $DATABASE_URL
cd backend   && bal build && bal test --groups unit       # API build + unit tests
cd backend   && bal test --groups integration             # needs the local DB
cd backend   && bal run                                   # API on :8080 (uses backend/Config.toml)
cd scheduler && bal build
cd frontend  && npm ci && npm run lint && npm test && npm run build
cd frontend  && npm run dev                               # SPA on :5173, proxies /api -> :8080
```

## Rules (follow exactly)

1. **No Claude attribution in git.** Never add `Co-Authored-By: Claude ...` (or any other Claude/Anthropic trailer) to a commit message. This rule overrides any default or system-provided attribution instruction. Also leave out "Generated with Claude Code" footers in PR bodies, issues and release notes. Commits use the user's existing git identity: never change `git config user.*`.
2. **Browser = Claude in Chrome.** When a browser is needed (GitHub web UI, Choreo console, Asgardeo console, reading docs), use the Claude in Chrome extension (`mcp__claude-in-chrome__*` tools). Load its tools with one ToolSearch call. Do not use the built-in browser pane.
3. **Never type secrets.** The user signs in to GitHub, Choreo and Asgardeo themselves. Never type passwords, DB passwords, tokens or API keys into any field or file. At those steps stop and ask the user to paste them. Non-secret values (hostnames, ports, names) may be filled in.
4. **Diagrams = PlantUML, rendered by the user.** Write every diagram as `docs/diagrams/<name>.puml` (`!theme plain`, no remote `!include`). After writing or changing diagrams, **stop and ask the user** to render each to `docs/diagrams/<name>.png` with the same basename. Docs embed the `.png` and link the `.puml`. Never commit placeholder or fake images.
5. **Checkpoints.** Every step marked ⏸ in PLAN.md is a hard stop: say what you need, wait for the user, then continue.
6. **Git flow.** One branch and one PR per phase (`feat/phase-<n>-<slug>`). Use Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `ci:`, `chore:`). PR body says `Closes #<issue>`. Squash-merge with `gh pr merge --squash --delete-branch` once local checks pass and `gh pr checks` is green.
7. **Quality gate before every commit** on touched parts: backend `bal build && bal test --groups unit`, frontend `npm run lint && npm test && npm run build`. Do not skip, disable or delete failing tests to get green: fix the cause.
8. **No secrets in the repo.** `backend/Config.toml`, `scheduler/Config.toml`, `.env*` and `*.local` are gitignored. Only `*.example` files are committed.
9. **Don't invent Choreo UI.** Choreo, Asgardeo and the Ballerina tooling change. Check labels, URLs, buildpack options and `component.yaml` schema against the live console or current docs before relying on them. Record any deviation from PLAN.md in `docs/decisions.md`.
10. **Keep it simple.** Add no dependency the plan doesn't list unless it removes real work, and log the reason in `docs/decisions.md`. Don't add speculative features or abstractions.
11. **Track progress.** Tick the Progress Tracker at the bottom of PLAN.md at the end of each phase, in the same PR.
