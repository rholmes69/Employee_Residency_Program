# CLAUDE.md

Guidance for Claude Code (and other coding agents) working in this repository.

## What this is
The online application platform for **Delta Health Center's Employee Residency Program**, built from the paper application in `docs/`. Employees apply, their supervisor signs off, and HR reviews, scores, and decides. A local-LLM assistant ("Ria") helps every role. Single organization, not multi-tenant.

## Layout (npm workspaces, TypeScript everywhere)
```
packages/shared  Zod schemas + form constants (Pydantic's role). Browser-safe; used by web, api, mcp.
packages/db      Prisma schema, migrations, seed, PrismaClient singleton
packages/core    ALL business logic + permission checks + Ollama AI + email. Both api and mcp call this.
apps/api         Express 5 HTTP layer, Entra SSO/session auth, agent loop (Ollama ↔ MCP), PDF export
apps/mcp         MCP server (Streamable HTTP, stateless). Role-scoped tools wrapping core services
apps/web         React 19 + Vite + Tailwind v4 SPA (served by nginx in Docker)
agent/           Runtime persona of the assistant: SOUL.md, AGENT.md, MEMORY.md
docker/          Shared Node service Dockerfile
```

## Rules for changes
- **Put business rules and authorization in `packages/core`**, never only in a route or MCP tool. Every core function takes an `Actor` and enforces access itself (`assertStaff`, `assertAdmin`, owner/supervisor checks).
- **Validate all input with Zod schemas from `packages/shared`.** Add new form fields to `constants.ts`, `schemas.ts`, `schema.prisma`, the form page, `ApplicationView`, and `pdf.ts`.
- **The agent must never get a tool that changes application status or signs off.** Humans decide.
- The AI never sees applicant name, email, or phone during assessments (bias reduction). Keep it that way.
- Prisma changes: edit `packages/db/prisma/schema.prisma`, then `npm run db:migrate -- --name <change>`. Commit the migration.
- Keep the agent's system prompt **stable** (`apps/api/src/agent/persona.ts`). Anything per-user or time-varying goes in `buildLiveContext`, which rides on the latest user message. Otherwise Ollama's prompt cache breaks, and on CPU every reply gets minutes slower.
- Keep `agent/*.md` short. Every line is re-read by the model on each request.

## Commands
```bash
npm install
docker compose up -d db mailpit      # Postgres on :5433, Mailpit UI on :8025
npm run db:migrate && npm run db:seed
npm run dev:mcp   # :4100
npm run dev:api   # :4010
npm run dev:web   # :5173 (proxies /api → :4010)
npm run typecheck
docker compose up -d --build         # full stack → http://localhost:8080
```

## Gotchas
- On Windows, Node resolves `localhost` to IPv6 first. Use `127.0.0.1` for Ollama.
- Port 4000 is taken by another app on the dev machine, so the API uses **4010**.
- The dev machine is CPU-only (i7-4790). The model is `qwen3:4b-instruct` (the plain `qwen3:4b` tag is a thinking-only build that ignores `think:false`). A cold agent prompt takes about 2–3 minutes; warm turns take about 40–70 s.
- Express 5: async errors propagate automatically; the `listen` callback also receives errors.
