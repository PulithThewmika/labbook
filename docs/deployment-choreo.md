# Deploying LabBook on Choreo

This runbook deploys the three components of LabBook to Choreo (Development, then Production). It is written from the current Choreo Labs documentation, checked on 2026-11-18. Items marked **Verify in the console** could not be confirmed without console access and are listed in [decisions.md](decisions.md).

> **Status:** the Choreo organisation for this project could not be created (the console reported that creating organisations is restricted), so these steps have not yet been run end to end. Update the screenshots and the **Verify** items after the first real deployment.

## What gets deployed

| Component | Choreo type | Source directory | Notes |
|---|---|---|---|
| `labbook-api` | Service | `backend` | Ballerina, port 8080, `.choreo/component.yaml` (schema 1.2) |
| `labbook-web` | Web Application | `frontend` | React preset, Node 20, Managed Authentication |
| `labbook-scheduler` | Scheduled Task | `scheduler` | Ballerina, cron `*/15 * * * *` |

Repository: `https://github.com/PulithThewmika/labbook`, branch `main`. All three live in one Choreo project named **LabBook**.

## 0. Before you start

- A Choreo organisation you can create projects in (free tier is enough). Console: <https://console.choreo.dev>.
- The Choreo GitHub App authorised on the `labbook` repository.
- A PostgreSQL 16 database for Development and one for Production. Use a Choreo-managed database if your plan offers one, otherwise a free [Neon](https://neon.tech) project (two databases or two branches). Keep each connection string private. **Never paste a password into the repository, an issue or a chat.**
- `psql` or Docker on your machine to run the migrations.

## 1. Create the project

1. Console, **Create Project**: name `LabBook`, description "University lab and equipment booking".
2. Choose the public GitHub repository `labbook` and branch `main`.

## 2. Prepare the databases and apply migrations

For each environment (Development first, Production later):

```bash
# put the connection string in Repo/.env.choreo (gitignored) as DATABASE_URL=...
export $(grep DATABASE_URL .env.choreo)
bash scripts/migrate.sh
```

`scripts/migrate.sh` is idempotent, so it is safe to re-run. It creates the schema and the demo seed data (4 labs, 10 equipment items). Use `?sslmode=require` in the connection string for hosted databases.

## 3. `labbook-api` (Service)

1. **Create Component** > **Service**. Name `labbook-api`.
2. Repository `labbook`, branch `main`, build preset **Ballerina**, component directory `backend` (**Verify in the console:** exact preset label).
3. Choreo reads `backend/.choreo/component.yaml`:

   ```yaml
   schemaVersion: 1.2
   endpoints:
     - name: labbook-api
       displayName: LabBook API
       service:
         basePath: /
         port: 8080
       type: REST
       networkVisibilities:
         - Public
       schemaFilePath: openapi.yaml
   ```

4. **Build** and wait for the image build and the security scan to pass.
5. **Deploy** to Development. In **Configs & Secrets** (Ballerina `configurable` values appear on the Deploy page) set:

   | Configurable | Value | Secret |
   |---|---|---|
   | `dbHost`, `dbPort`, `dbName`, `dbUser` | from your Development database | no |
   | `dbPassword` | from your Development database | **yes** (paste it into the console yourself) |
   | `dbSslMode` | `require` | no |
   | `campusTimeZone` | `Asia/Colombo` | no |
   | `adminEmails` | `["<admin email>"]` | no |
   | `jwtIssuer` | `wso2.org/products/am` | no |
   | `jwtJwksUrl` | `https://gateway.e1-us-east-azure.choreoapis.dev/.wellknown/jwks` (US East) or `https://gateway.e1-eu-north-azure.choreoapis.dev/.wellknown/jwks` (EU North), matching your data plane | no |
   | `devMode` | **leave unset (`false`)** | no |

6. **Deploy** > **Set Up** > **Endpoint Configurations**: enable **Pass Security Context To Backend**, apply, and redeploy. Without this the gateway does not send the `x-jwt-assertion` header and every request returns 401.
7. Test `GET /health` and `GET /labs` from **Test > Console**.

## 4. `labbook-web` (Web Application)

1. **Create Component** > **Web Application**. Name `labbook-web`, directory `frontend`, preset **React**, Node.js `20`, build command `npm run build`, build path / output `dist` (**Verify in the console:** field labels).
2. **Connections**: add a connection to the `labbook-api` service (Project visibility is enough). Note the proxied path it shows; it has the form `/choreo-apis/<api-suffix>` and ends with a version segment such as `1.0.0`.
3. **Managed Authentication**: open **Deploy** > **Set Up** > **Configure & Deploy**, then **Next**, and make sure **Managed Authentication with WSO2 Developer Platform** is on (it is on by default for React). Leave the post-login and post-logout paths as `/`.
4. **Config file mount**: add a file mount for `config.js` so it replaces `frontend/public/config.js` in the served app. Content:

   ```js
   window.configs = { apiUrl: "/choreo-apis/<api-suffix>", authMode: "choreo", timeZone: "Asia/Colombo" };
   ```

   Use the exact connection path from step 2. **Verify in the console:** the mount path that matches the served `config.js` (older docs mention `/app/public`).
5. **Build** and **Deploy** to Development, then open the web app URL.

## 5. Users and the admin role (Asgardeo)

1. In the Asgardeo/Choreo user store create two test users, a student and an admin. **Set their passwords yourself; never share them.**
2. Put the admin's email in the API's `adminEmails` configurable (step 3) and redeploy the API.
3. Make sure the Asgardeo application releases the **email** claim. The backend JWT contains `email` only when it does. If it is missing, add the `email` scope in the application settings. If it still cannot be obtained, the fallback is an `adminSubjects` configurable (log it in `decisions.md`).
4. First request check: the API logs only the claim names it receives, never their values. Remove that log line once confirmed.

## 6. `labbook-scheduler` (Scheduled Task)

1. **Create Component** > **Scheduled Task**. Name `labbook-scheduler`, directory `scheduler`, build preset **Ballerina**.
2. Set the same `dbHost`, `dbPort`, `dbName`, `dbUser`, `dbSslMode` and the secret `dbPassword` as the API.
3. Schedule: cron `*/15 * * * *`.
4. Trigger it once and check the logs for `expired=<n> completed=<n>`. It exits 0 on success and non-zero on failure.

## 7. Smoke test on Development

Sign in as the test users in the web app and check:

1. Student books CSL-A tomorrow 10:00 to 12:00: status Pending.
2. Student tries 11:00 to 13:00: "That time slot is already booked".
3. Admin approves the first booking; the student sees Approved.
4. Student cancels a second booking; admin rejects a third with a note.
5. Admin dashboard shows numbers.
6. **Observability** shows requests, latency and logs for `labbook-api`.

## 8. Promote to Production

1. For each component, **Deploy** > **Promote** to Production.
2. Create the Production database, run `scripts/migrate.sh` against it, and fill the Production configurables (the secret `dbPassword` again, `jwtJwksUrl` for the Production gateway, `adminEmails`).
3. Repeat the smoke test on Production. Every user story in the README must work on the Production URL.

## 9. Capture screenshots

Save these into `docs/screenshots/`: `landing.png`, `labs.png`, `lab-detail.png`, `booking-conflict.png`, `my-bookings.png`, `approvals.png`, `dashboard.png`, `choreo-project.png`, `choreo-observability.png`.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| API returns 401 for every call | **Pass Security Context To Backend** is off, or `jwtIssuer`/`jwtJwksUrl` do not match the environment |
| API fails to start | `devMode` is false and `jwtIssuer` or `jwtJwksUrl` is empty, or the database settings are wrong |
| 500 on first request | The migrations were not applied to that environment's database |
| Web app shows the dev picker or calls `/api` | The `config.js` file mount is missing or the path is wrong |
| Signed in but everyone is a student | The email claim is missing, or the email is not in `adminEmails` |
