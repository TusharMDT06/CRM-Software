# ==========================================
# Flowdesk CRM - Production Client Dockerfile
# ==========================================

FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . ./
RUN npm run build

# Nginx alpine to serve static build
FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx configuration for SPA routing
RUN printf 'server {\n\
    listen 80;\n\
    server_name localhost;\n\
    location / {\n\
        root /usr/share/nginx/html;\n\
        index index.html index.htm;\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
    error_page 500 502 503 504 /50x.html;\n\
    location = /50x.html {\n\
        root /usr/share/nginx/html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
