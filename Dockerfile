# ---------- Build frontend (React) ----------
FROM node:20 AS ui
WORKDIR /app
COPY ui ./ui
WORKDIR /app/ui
RUN npm ci && npm run build

# ---------- Build backend (TypeScript -> JS) ----------
FROM node:20 AS api
WORKDIR /app
COPY package*.json tsconfig.json ./
COPY src ./src
RUN npm ci && npm run build

# ---------- Runtime (serve API + built UI) ----------
FROM node:20-slim
WORKDIR /app

# App code (built)
COPY --from=api /app/dist ./dist
COPY --from=api /app/node_modules ./node_modules
COPY package*.json ./

# Built React assets
COPY --from=ui /app/ui/dist ./ui/dist

# --- MCP TCP bridge (for VS Code / external clients) ---
# Expect a file named server-tcp.js at the repo root.
COPY server-tcp.js ./server-tcp.js

# Data dir for SQLite (we'll mount a volume here)
RUN mkdir -p /app/data
ENV DB_PATH=/app/data/notes.db
ENV NODE_ENV=production
ENV PORT=3000
# Default TCP port for the MCP bridge (can be overridden in compose)
ENV MCP_PORT=7020

# Expose API and MCP bridge ports
EXPOSE 3000 7020

# Start the API + static UI server (unchanged)
CMD ["node", "dist/server/index.js"]
