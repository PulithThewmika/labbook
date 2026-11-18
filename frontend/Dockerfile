# Build the SPA, then serve it with nginx. The official nginx image renders
# /etc/nginx/templates/*.template with environment variables at start-up (LABBOOK_API_URL).
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
