# Contributing to Jotter

Thank you for your interest in contributing to Jotter! This project demonstrates AI-powered note-taking with signal extraction and MCP integration.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/jotter.git
   cd jotter
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Set up environment** (optional, for AI features):
   ```bash
   cp .env.example .env
   # Add your OPENAI_API_KEY to .env
   ```

## Development Workflow

### Local Development
```bash
# Start the API + UI (development mode)
npm run dev:api

# In a separate terminal, start MCP server (optional)
API_URL=http://localhost:3000/api npm run dev:mcp
```

### Docker Development
```bash
# Build and run everything
docker compose up --build

# View logs
docker compose logs -f
```

### Testing
```bash
# Type check (no tests yet, but planned)
npm run build
```

## How to Contribute

### 🐛 Bug Reports
- Use the GitHub issue tracker
- Include steps to reproduce
- Mention your environment (Docker, local, etc.)

### ✨ Feature Requests
- Open an issue with the "enhancement" label
- Describe the use case and benefit
- Consider MCP integration possibilities

### 🔧 Code Contributions
1. **Create a branch** for your feature/fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. **Follow the coding style**:
   - TypeScript strict mode
   - ESM modules
   - Keep functions small and focused
   - Follow existing patterns

3. **Test your changes**:
   - Ensure `npm run build` passes
   - Test both local and Docker setups
   - Verify MCP functionality if modified

4. **Commit your changes**:
   ```bash
   git commit -m "feat: add your feature description"
   ```
   Use conventional commit format: `feat:`, `fix:`, `docs:`, `refactor:`

5. **Push and create a Pull Request**:
   ```bash
   git push origin feature/your-feature-name
   ```

## Areas for Contribution

- **Testing**: Add Vitest tests for server and UI
- **Security**: Improve authentication and secrets management
- **Features**: Semantic search, note templates, bulk operations
- **Documentation**: API docs, deployment guides, tutorials
- **MCP Integration**: New MCP tools, HTTP transport implementation
- **UI/UX**: Improvements to the React frontend

## Code Style

- Use TypeScript with strict mode
- Prefer functional programming patterns
- Keep stdout clean in MCP server (JSON only)
- Follow the TRATON-inspired UI palette
- Update AGENTS.md when changing APIs or setup

## Questions?

- Check the [README.md](README.md) for setup instructions
- Review [AGENTS.md](AGENTS.md) for technical details
- Open an issue for questions or discussions

---

**Note**: This project follows agentic development principles - documentation should enable both humans and AI agents to contribute effectively.