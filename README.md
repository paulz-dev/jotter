# Jotter – Less noise. More signal. With AI.

Jotter is a simple note-taking and enrichment app.  
You can create notes, edit them, delete them, search them, and enrich them with **AI-powered summaries and tags**. It also provides you an AI powered signal list for the day to help focus on what is most important to you. 

The goal of this project is to demonstrate how to combine:
- **TypeScript + Node.js / Express** (backend)
- **React (Vite)** (frontend)
- **SQLite** (persistence)
- **Docker** (packaging + portability)
- **MCP (Model Context Protocol)** (expose capabilities to agents)
- **AI (OpenAI API)** (for note enrichment)

---

## Features
- **Create** notes with free text
- **Edit** notes later
- **Delete** notes
- **Search** notes by free text or tags
- **Enrich** notes with AI → summary (≤ 25 words) + up to 5 tags
- **Persist** notes in SQLite (`notes.db`)
- **Top 5 signals (today)** — one click shows today’s five most important *signal* notes
- **Run on your desktop** via Docker (`http://localhost:3000`). This is intended as a local desktop run app only.

---

## Local Dev Setup

### 1. Clone the repo
```bash
git clone https://github.com/paulz-dev/jotter.git
cd jotter
```

---

## Docker Setup (recommended)

The simplest way to run everything is inside Docker:

```bash
docker compose up --build
```

Open **http://localhost:3000** → you’ll see Jotter.

- Data is stored in a SQLite file in `./data/notes.db`
- Stop the app:
  ```bash
  docker compose down
  ```
- Reset (start fresh):
  ```bash
  docker compose down
  rm -rf data
  docker compose up --build
  ```

---

## OpenAI API Key (for enrichment)

By default, Jotter can run without an API key → enrichment will fall back to a simple heuristic.
To use **real AI enrichment**, you need an **OpenAI API key**.

### Where to add it
**For desktop/development use:** Edit `docker-compose.yml` and add your key under `environment`:

```yaml
services:
  jotter:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DB_PATH=/app/data/notes.db
      - OPENAI_API_KEY=sk-xxxxxxx   # <-- paste your key here
    volumes:
      - ./data:/app/data
```

Then rebuild and restart:
```bash
docker compose down
docker compose up --build
```

> **Security Note**: This approach stores the API key in plain text in your compose file. For production deployments, use [Docker secrets](https://docs.docker.com/engine/swarm/secrets/) or environment variable injection from a secure key management system.

---

## Thought Process

This project was built step by step:
1. **Backend first**: Express API with in-memory store → replaced with SQLite for persistence.
2. **AI enrichment**: Added `/enrich` route using OpenAI API, with a fallback heuristic.
3. **Frontend**: Started with a minimal HTML page → upgraded to a Vite React app.
4. **Features added**: Edit, delete, search, enrichment buttons.
5. **Styling**: Inspired by TRATON.com’s palette for a clean corporate look.
6. **Packaging**: Dockerfile + docker-compose for reproducible local runs.
7. **Agent readiness**: Added `AGENTS.md` so MCP-compatible AI agents can use this app programmatically.

The key idea: **separate signal from noise within our work and life for notes with AI** → Jotter is an attempt to demonstrates this concept in practice.

---

## Development Methodology

This project demonstrates **agentic coding** principles and modern AI-assisted development practices:

**Core Approaches**:
- **Context Engineering**: Structured project documentation (`AGENTS.md`) that enables AI agents to understand, build, and extend the codebase autonomously
- **Agentic Workflows**: Development process designed for seamless human-AI collaboration, where agents can read documentation and contribute meaningfully
- **Model Context Protocol (MCP)**: First-class integration allowing the app itself to be extended and used by AI agents as a tool

**Agent-First Design**: The project structure, documentation, and tooling are optimized for AI agents to:
- Understand the codebase through clear, structured documentation
- Execute development tasks via well-defined interfaces
- Extend functionality through standardized protocols (MCP)
- Maintain consistency with established patterns and conventions

This approach follows our **Golden Path for agentic workflows** – a methodology that emphasizes documentation-driven development, clear interfaces, and AI-agent accessibility as core design principles.

The result: a codebase that humans and AI agents can collaborate on effectively, with the app itself becoming a tool that agents can use and extend.

---

## Known Issues & Architecture Considerations

### MCP Server Transport Layer
**Status**: **Architecture Limitation**

The current MCP server implementation uses stdio transport, which has limitations for containerized and production deployments:

**Current State (stdio-based)**:
- **Works**: Direct stdio communication when running locally (development)
- **Works**: Command-line JSON-RPC calls to containerized MCP server
- **Limited**: GitHub Copilot and other AI agents cannot connect to containerized MCP server via stdio (my assessment - requires vendor verification / confirmation or rejection)

**Root Cause**: Stdio transport is designed for local process-to-process communication and doesn't work well across Docker container boundaries or network deployments.

**Production Architecture Recommendation**:
For production-ready deployments, MCP servers should use **Streamable HTTP transport** to enable:
- **Network accessibility**: Agents can connect from anywhere
- **Security**: Standard HTTPS + authentication/authorization
- **Hyperscaler deployment**: Can be hosted on AWS, GCP, Azure with proper scaling
- **Load balancing**: Multiple MCP server instances behind a load balancer
- **Observability**: Standard HTTP monitoring and logging

**Development Workaround** (stdio):
```bash
# Local development only (MCP agents work via stdio)
npm install
npm run dev:api
# In separate terminal:
API_URL=http://localhost:3000/api npm run dev:mcp
```

**Roadmap**:
- **Phase 1**: Implement Streamable HTTP transport for MCP server
- **Phase 2**: Add authentication & authorization layer
- **Phase 3**: Production deployment examples (Docker + reverse proxy)

---

## Next Steps (WIP)
- Add semantic search with embeddings
- Add authentication
- Add tests (Vitest + Supertest)

---

## License
MIT
