# Dois alvos na mesma Dockerfile:
#   docker build --target api -t letterclub-api:<versão> .
#   docker build --build-arg SITE_URL=https://seu-dominio -t letterclub-web:<versão> .   (padrão: web)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- site estático (telas/ → dist/) ----
FROM deps AS build
COPY . .
ARG SITE_URL
RUN test -n "$SITE_URL" || (echo "passe --build-arg SITE_URL=https://seu-dominio" && exit 1)
RUN SITE_URL=$SITE_URL npm run build

# ---- API (Node + Postgres) ----
FROM node:22-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
USER node
EXPOSE 3000
HEALTHCHECK CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server/index.js"]

# ---- web: nginx sem root, serve o site e repassa /api/ para API_UPSTREAM ----
FROM nginxinc/nginx-unprivileged:1.27-alpine AS web
ENV API_UPSTREAM=http://api:3000
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
