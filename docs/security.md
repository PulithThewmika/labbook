# Security

## Trust chain

1. The browser signs in through Choreo Managed Authentication, backed by Asgardeo. The SPA never handles a token directly: the managed-auth layer keeps a session cookie and attaches the access token to API calls.
2. The Choreo API gateway validates the access token and forwards the request to `labbook-api` with a backend JWT in the `x-jwt-assertion` header.
3. `labbook-api` verifies that JWT before trusting any claim.

## Why the signature is verified

Anyone who can reach the service port could forge a header. Decoding a JWT only reads it; verifying the signature against the issuer's keys (`jwtIssuer`, `jwtJwksUrl`) proves the gateway issued it. `auth.bal` uses `ballerina/jwt` for this and rejects the request with `401 UNAUTHENTICATED` otherwise.

## Roles

`sub`, `email` and the name claim come from the verified JWT. A user gets `role = 'admin'` when their email is in the `adminEmails` configuration, otherwise `student`. The role is re-evaluated on every call, so removing an email takes effect immediately. Admin-only routes return `403 FORBIDDEN` to students.

## Dev mode

With `devMode = true` the API accepts `X-Dev-User: <email>` instead of a JWT and logs a loud warning at startup. The default is `false`. **`devMode` must never be true on Choreo**: anyone could then impersonate any user, including an admin.

## Secrets

- The database password is a Choreo secret configuration. Nothing secret is committed: `Config.toml`, `.env*` and `*.local` are gitignored, and only `*.example` files are in git.
- Logs contain no tokens or personal data, only method, path, status and duration.

## SQL injection

All queries use Ballerina `sql:ParameterizedQuery` with bound values. Strings are never concatenated into SQL.

## Data integrity

Double bookings are prevented by database exclusion constraints, not only by application checks. Error responses never include SQL text or stack traces.

## Future work

Rate limiting and quotas at the gateway, audit log of admin decisions, and email notifications are out of scope for v1.
