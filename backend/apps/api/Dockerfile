FROM node:20-alpine

WORKDIR /usr/src/app

# Copy root monorepo config and lock files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY backend/apps/api/package*.json ./backend/apps/api/
COPY backend/packages/db/package*.json ./backend/packages/db/

# Install dependencies in non-interactive mode
RUN npm ci

# Copy codebase
COPY backend/packages/db ./backend/packages/db
COPY backend/apps/api ./backend/apps/api

# Build TS files
RUN npm run build --workspace=@pharmasafe/api

EXPOSE 4000

ENV NODE_ENV=production

CMD ["npm", "start", "--workspace=@pharmasafe/api"]
