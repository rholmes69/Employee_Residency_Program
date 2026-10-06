# Employee Residency Program: Delta Health Center

An online application and review platform for Delta Health Center's **Employee Residency Program**, with a private, locally hosted AI assistant (**Ria, the Residency Guide**). It replaces the paper form in [`docs/`](docs/) that employees emailed to HR.

| Who | What they do |
|---|---|
| **Employee** | Fill out the application (same questions as the paper form), autosave, get AI writing feedback on Q2/Q4/Q5, sign by typing their name, track status, download a PDF |
| **Supervisor** | Gets an email, then approves or declines with a comment |
| **HR Reviewer** | Dashboard and stats, filters, rubric scoring, AI first read, mentor matching, decisions (applicant is emailed) |
| **Admin** | Mentors, user roles, program dates and deadline, and the agent's learned memory |

## Architecture

```
 Browser ── React + Tailwind (nginx :8080)
              │ /api
              ▼
         API  (Express, :4010) ── Entra SSO / sessions, PDF, email
              │   │
              │   └─ Agent loop: SOUL.md + AGENT.md + MEMORY.md → Ollama (tools) ⇄ MCP
              ▼                                                          │
         packages/core (business rules + permissions + AI)  ◄────────── MCP server (:4100)
              │                                                    role-scoped tools
              ▼
         PostgreSQL 16 (Prisma ORM)          Ollama on host: qwen3:4b-instruct + nomic-embed-text
```

- **Validation:** Zod schemas in `packages/shared`, the Node equivalent of Pydantic. They're shared by the browser, API, and MCP.
- **Agent memory:** curated facts live in `agent/MEMORY.md`. Learned facts are stored in the `AgentMemory` table, either per user or shared (admin-curated).
- **Safety:** the agent has no tool that changes a decision. AI assessments hide name, email, and phone from the model and are labeled advisory. Every action is written to `AuditLog`.

## Quick start (Docker)

Requirements: Docker Desktop and [Ollama](https://ollama.com) running on the host.

```powershell
ollama pull qwen3:4b-instruct
ollama pull nomic-embed-text
copy .env.example .env      # then edit secrets (already done on the dev machine)
docker compose up -d --build
```

| URL | |
|---|---|
| http://localhost:8080 | The app |
| http://localhost:8025 | Mailpit (catches all outgoing email in dev) |
| localhost:5433 | PostgreSQL (`emp_residency_prgm_db`) |
| http://localhost:4100/mcp | MCP server |

With `AUTH_DEV_LOGIN=true`, the sign-in page lets you pick any email and role. Try:
1. Sign in as an employee, fill out the form, and submit. Use a supervisor email such as `sam@deltahealthcenter.org`.
2. Sign out, then sign in as `sam@deltahealthcenter.org` and approve under **Supervisor Approvals**.
3. Sign in as a **Reviewer**: open the application, click **Generate** (AI first read), click **Suggest** (mentors), score it, and decide.

## Local development (without Docker for the Node apps)

```powershell
npm install
docker compose up -d db mailpit
npm run db:migrate; npm run db:seed
npm run dev:mcp     # terminal 1
npm run dev:api     # terminal 2
npm run dev:web     # terminal 3 → http://localhost:5173
```

## Microsoft Entra SSO (production)
1. Azure portal → **App registrations → New**. Platform: **Single-page application**. Redirect URI: your `APP_URL`.
2. Optional: add **App roles** `Reviewer` and `Admin` and assign HR staff. They're applied at each sign-in.
3. Set `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, and `ADMIN_EMAILS`, then set **`AUTH_DEV_LOGIN=false`** and `COOKIE_SECURE=true` (behind HTTPS).

## AI models and performance
| Role | Default | Notes |
|---|---|---|
| Agent + writing help | `qwen3:4b-instruct` | Reliable tool calling, 2.5 GB, one model in RAM |
| Embeddings (mentor matching) | `nomic-embed-text` | 274 MB |

The dev machine is **CPU-only** (i7-4790, 24 GB). Expect:
- Agent replies: **40–90 s** once warm. The chat panel pre-warms the model when opened. The first reply after the model loads takes about **2–4 min**.
- AI assessment: **1–4 min**. Mentor matching: about **1 min**.

On a server with an NVIDIA GPU (12 GB+), everything gets 10–30× faster. Set `OLLAMA_AGENT_MODEL=qwen3:8b` or `qwen3:14b` for higher quality.

## Connecting another MCP client
Set `MCP_SERVICE_TOKEN` (32+ characters) and `MCP_SERVICE_USER_EMAIL` (an existing user, whose role decides the tools). Then point any Streamable HTTP MCP client at `http://<host>:4100/mcp` with `Authorization: Bearer <token>`.

## Project files for AI agents
- [`CLAUDE.md`](CLAUDE.md): instructions for coding agents working on this repo
- [`agent/SOUL.md`](agent/SOUL.md): Ria's identity and values
- [`agent/AGENT.md`](agent/AGENT.md): how Ria works: roles, tools, rules
- [`agent/MEMORY.md`](agent/MEMORY.md): curated program facts (human-edited; live in Docker via a volume)
