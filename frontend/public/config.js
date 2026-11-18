// Runtime config for local development (dev sign-in picker). On OpenChoreo, nginx renders /config.js from
// environment variables (authMode "oidc"); see nginx.conf.template and workload.yaml.
window.configs = { apiUrl: "/api", authMode: "dev", timeZone: "Asia/Colombo" };
