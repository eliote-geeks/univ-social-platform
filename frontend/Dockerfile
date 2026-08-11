FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
# fetch-retries/timeout : même contournement que backend/Dockerfile (voir son commentaire) pour
# les coupures de connexion observées vers registry.npmjs.org depuis cet environnement de build.
RUN npm config set fetch-retries 5 fetch-retry-factor 2 fetch-retry-mintimeout 15000 fetch-retry-maxtimeout 120000 fetch-timeout 300000
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --no-audit --no-fund

FROM dependencies AS build
# NEXT_PUBLIC_* est inliné dans le bundle JS au moment du build (pas au démarrage du conteneur) :
# doit donc être fourni en --build-arg par infra/deploy-web.sh, pas en variable d'env du Deployment.
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
COPY . .
RUN npm run build

# output: "standalone" (next.config.ts) ne copie que les fichiers nécessaires à l'exécution —
# image finale sans le node_modules complet ni les sources.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
