FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS production-deps
WORKDIR /app
ENV NODE_ENV=production
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=peer \
    && rm -rf \
      node_modules/prisma \
      node_modules/@prisma/config \
      node_modules/deepmerge-ts \
    && test ! -e node_modules/prisma \
    && test ! -e node_modules/@prisma/config \
    && test ! -e node_modules/deepmerge-ts \
    && npm cache clean --force

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY package.json package-lock.json ./

RUN node -e "require('@prisma/client'); console.log('Prisma runtime client import OK')" \
    && test ! -e node_modules/prisma \
    && test ! -e node_modules/@prisma/config \
    && test ! -e node_modules/deepmerge-ts

USER node

EXPOSE 8080
CMD ["node", "dist/main.js"]
