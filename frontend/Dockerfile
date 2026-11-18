# Build the SPA, then serve it with nginx. The official nginx image renders
# /etc/nginx/templates/*.template with environment variables at start-up.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# Defaults for running the image on its own (dev sign-in picker, no identity provider).
# OpenChoreo overrides these through frontend/workload.yaml.
ENV LABBOOK_AUTH_MODE=dev \
    LABBOOK_OIDC_AUTHORITY="" \
    LABBOOK_OIDC_CLIENT_ID=labbook-web \
    LABBOOK_IDP_TOKEN_URL=http://127.0.0.1:9/oauth2/token \
    LABBOOK_IDP_PUBLIC_HOST=localhost \
    LABBOOK_API_URL=http://127.0.0.1:8080
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
