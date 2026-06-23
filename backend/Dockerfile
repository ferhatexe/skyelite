# Build Stage
FROM node:20-alpine AS build

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production Stage
FROM node:20-alpine AS production

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/src/db/seed.sql ./dist/db/seed.sql

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
