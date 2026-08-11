FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
# fetch-retries/timeout : le registre npm coupe parfois les connexions longues (ECONNRESET /
# EIDLETIMEOUT) depuis cet environnement de build ; le cache mount permet de reprendre là où
# une tentative précédente s'est arrêtée au lieu de retélécharger tout node_modules à chaque retry.
RUN npm config set fetch-retries 5 fetch-retry-factor 2 fetch-retry-mintimeout 15000 fetch-retry-maxtimeout 120000 fetch-timeout 300000
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --no-audit --no-fund

FROM dependencies AS build
COPY nest-cli.json tsconfig.json ./
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm config set fetch-retries 5 fetch-retry-factor 2 fetch-retry-mintimeout 15000 fetch-retry-maxtimeout 120000 fetch-timeout 300000
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
