#!/usr/bin/env bash
# Deploys LabBook to a local OpenChoreo cluster. Run from the repo root inside the quick-start
# container (or anywhere kubectl points at the OpenChoreo cluster). Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/../.."

echo "==> Project and environment bindings"
kubectl apply -f deploy/openchoreo/project.yaml
kubectl wait --for=condition=Ready --timeout=5m projectreleasebinding labbook-development -n default

echo "==> Postgres Resource (schema and seed data from db/migrations/*.sql)"
{
  cat <<'EOF'
apiVersion: openchoreo.dev/v1alpha1
kind: Resource
metadata:
  name: labbook-postgres
  namespace: default
spec:
  owner:
    projectName: labbook
  type:
    kind: ClusterResourceType
    name: postgres
  parameters:
    database: labbook
    initSQL: |
EOF
  cat db/migrations/*.sql | sed 's/^/      /'
  cat <<'EOF'
---
apiVersion: openchoreo.dev/v1alpha1
kind: ResourceReleaseBinding
metadata:
  name: labbook-postgres-development
  namespace: default
spec:
  owner:
    projectName: labbook
    resourceName: labbook-postgres
  environment: development
  retainPolicy: Delete
  resourceTypeEnvironmentConfigs:
    persistenceEnabled: true
EOF
} | kubectl apply -f -

echo "==> Waiting for the Resource release, then promoting the development binding"
release=""
for _ in $(seq 1 150); do
  release=$(kubectl get resource labbook-postgres -n default -o jsonpath='{.status.latestRelease.name}' 2>/dev/null || true)
  [ -n "$release" ] && break
  sleep 2
done
[ -n "$release" ] || { echo "Timed out waiting for the Postgres resource release"; exit 1; }
kubectl patch resourcereleasebinding labbook-postgres-development -n default \
  --type=merge -p "{\"spec\":{\"resourceRelease\":\"$release\"}}"
kubectl wait --for=condition=Ready --timeout=5m resourcereleasebinding labbook-postgres-development -n default

echo "==> Components (this starts the builds)"
# LABBOOK_BRANCH lets you build another branch (default: main).
sed "s#branch: \"main\"#branch: \"${LABBOOK_BRANCH:-main}\"#" deploy/openchoreo/components.yaml | kubectl apply -f -
echo "Done. Watch progress with: kubectl get workflowruns,components -n default"

echo "==> Scheduler schedule (every 15 minutes)"
for _ in $(seq 1 60); do
  kubectl get releasebinding labbook-scheduler-development -n default >/dev/null 2>&1 && break
  sleep 5
done
kubectl patch releasebinding labbook-scheduler-development -n default --type=merge \
  -p '{"spec":{"componentTypeEnvironmentConfigs":{"schedule":"*/15 * * * *"}}}'
echo "Open the app: kubectl get httproute -A (look for the web-labbook-web-development-... hostname) on port 19080"
