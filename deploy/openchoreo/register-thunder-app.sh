#!/usr/bin/env bash
# Registers (or updates) the LabBook web app as a public OIDC client in ThunderID.
# Run it INSIDE the OpenChoreo quick-start container, after the labbook-web component has deployed:
#   bash deploy/openchoreo/register-thunder-app.sh
# It authenticates to ThunderID's management API the same way the quick-start's own occ-login.sh does,
# using the system application that the installer provisions. Nothing secret is printed or stored.
set -euo pipefail

OCC_LOGIN="${OCC_LOGIN:-$HOME/occ-login.sh}"
CLIENT_ID="${LABBOOK_CLIENT_ID:-labbook-web}"
WEB_PORT="${WEB_PORT:-19080}"

THUNDER_HOST=$(kubectl get httproute -n thunder thunder-httproute -o jsonpath='{.spec.hostnames[0]}')
THUNDER="http://${THUNDER_HOST}:8080"
WEB_HOST=$(kubectl get httproute -A -o jsonpath='{range .items[*]}{.spec.hostnames[*]}{"\n"}{end}' | grep '^web-labbook-web-development' | head -1)
[ -n "$WEB_HOST" ] || { echo "labbook-web is not deployed yet (no web-labbook-web-development HTTPRoute)"; exit 1; }
WEB_URL="http://${WEB_HOST}:${WEB_PORT}"
echo "Thunder: ${THUNDER}"
echo "Web app: ${WEB_URL}"

# System application credentials, read from the installer's own script (not printed).
SYS_ID=$(grep '^SYSTEM_APP_CLIENT_ID=' "$OCC_LOGIN" | head -1 | cut -d'"' -f2)
SYS_SECRET=$(grep '^SYSTEM_APP_CLIENT_SECRET=' "$OCC_LOGIN" | head -1 | cut -d'"' -f2)
TOKEN=$(curl -s --max-time 15 -X POST "${THUNDER}/oauth2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=client_credentials" \
  --data-urlencode "client_id=${SYS_ID}" \
  --data-urlencode "client_secret=${SYS_SECRET}" \
  --data-urlencode "scope=system" \
  --data-urlencode "resource=${THUNDER}/mcp" | jq -r '.access_token')
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] || { echo "Could not get a management token from ThunderID"; exit 1; }

PAYLOAD=$(cat <<EOF
{
  "name": "LabBook",
  "description": "LabBook web app (single-page app, authorization code with PKCE)",
  "type": "custom",
  "ouId": "01900000-0000-7000-8000-000000000001",
  "url": "${WEB_URL}",
  "assertion": {"validityPeriod": 3600, "userAttributes": ["email", "name", "given_name", "family_name"]},
  "inboundAuthConfig": [
    {
      "type": "oauth2",
      "config": {
        "clientId": "${CLIENT_ID}",
        "redirectUris": ["${WEB_URL}/auth/callback"],
        "grantTypes": ["authorization_code"],
        "responseTypes": ["code"],
        "tokenEndpointAuthMethod": "none",
        "pkceRequired": true,
        "publicClient": true,
        "scopes": ["openid", "profile", "email"],
        "token": {
          "accessToken": {"userConfig": {"validityPeriod": 3600, "attributes": ["email", "name", "given_name", "family_name"]}},
          "idToken": {"validityPeriod": 3600, "userAttributes": ["email", "name", "given_name", "family_name"]}
        }
      }
    }
  ]
}
EOF
)

APP_ID=$(curl -s --max-time 15 "${THUNDER}/applications" -H "Authorization: Bearer ${TOKEN}" \
  | jq -r --arg cid "$CLIENT_ID" '.applications[]? | select(.clientId == $cid) | .id // empty')
if [ -n "$APP_ID" ]; then
  echo "Updating existing application ${APP_ID}"
  METHOD=PUT; URL="${THUNDER}/applications/${APP_ID}"
else
  echo "Creating application"
  METHOD=POST; URL="${THUNDER}/applications"
fi
RESPONSE=$(curl -s --max-time 15 -w '\n%{http_code}' -X "$METHOD" "$URL" \
  -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" -d "$PAYLOAD")
STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
echo "ThunderID answered HTTP ${STATUS}"
if [ "$STATUS" -lt 200 ] || [ "$STATUS" -ge 300 ]; then echo "$BODY"; exit 1; fi
echo "Registered client '${CLIENT_ID}' with redirect URI ${WEB_URL}/auth/callback"
