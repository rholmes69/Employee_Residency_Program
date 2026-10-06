import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ASSIST_QUESTIONS, INTEREST_AREA_VALUES, APPLICATION_STATUSES } from '@erp/shared';
import {
  AppError,
  assistAnswer,
  findMyApplication,
  generateAssessment,
  getApplication,
  getProgramInfo,
  getStats,
  isStaff,
  listApplications,
  listMemories,
  listMentors,
  remember,
  suggestMentors,
  supervisorQueue,
  type Actor,
} from '@erp/core';

const asText = (data: unknown) => ({
  content: [{ type: 'text' as const, text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }],
});

function register<S extends z.ZodRawShape>(
  server: McpServer,
  name: string,
  description: string,
  shape: S,
  run: (args: z.objectOutputType<S, z.ZodTypeAny>) => Promise<unknown>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.registerTool(name, { description, inputSchema: shape }, (async (args: any) => {
    try {
      return asText(await run(args));
    } catch (e) {
      const msg = e instanceof AppError ? e.message : 'Tool failed unexpectedly.';
      if (!(e instanceof AppError)) console.error(`[mcp] ${name}`, e);
      return { ...asText(`ERROR: ${msg}`), isError: true };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any);
}

/**
 * Builds an MCP server whose tool list is scoped to the caller's role.
 * The agent never gets a tool that changes an application's status —
 * decisions stay with humans.
 */
export function buildServer(actor: Actor) {
  const server = new McpServer({ name: 'residency-program', version: '1.0.0' });

  // ── Everyone ────────────────────────────────────────────────
  register(server, 'get_program_info', 'Official facts about the Employee Residency Program: description, deadline, HR contact, process, and the application questions.', {}, () =>
    getProgramInfo(),
  );

  register(server, 'get_my_application', "The current user's own application for the active cycle (status and answers), or null if they haven't started.", {}, () =>
    findMyApplication(actor),
  );

  register(
    server,
    'improve_answer',
    "Writing coach for the open-ended questions. question: hopeToGain (Q2), goals (Q4), strengths (Q5). mode: 'feedback' (suggestions), 'improve' (rewrite keeping their facts), 'brainstorm' (reflective prompts).",
    {
      question: z.enum(ASSIST_QUESTIONS),
      draft: z.string().max(4000).describe("The applicant's current draft text"),
      mode: z.enum(['improve', 'feedback', 'brainstorm']).default('feedback'),
    },
    async (a) => {
      const mine = await findMyApplication(actor);
      return assistAnswer({ question: a.question, draft: a.draft, mode: a.mode }, { jobTitle: mine?.jobTitle, department: mine?.department });
    },
  );

  register(server, 'list_my_supervisor_approvals', 'Applications where the current user is the listed supervisor, with sign-off status.', {}, () =>
    supervisorQueue(actor),
  );

  register(server, 'recall_memories', 'Long-term memories: shared program facts plus notes about the current user.', {}, async () =>
    (await listMemories(actor)).map((m) => ({ id: m.id, scope: m.scope, content: m.content, savedAt: m.createdAt })),
  );

  register(
    server,
    'remember',
    "Save a durable memory. Use USER scope for this person's preferences/context. GLOBAL scope (admins only) for program facts everyone should know. Never store sensitive personal data.",
    { content: z.string().min(3).max(1000), scope: z.enum(['USER', 'GLOBAL']).default('USER') },
    async (a) => {
      const m = await remember(actor, a.content, a.scope);
      return `Saved (${m.scope}).`;
    },
  );

  if (!isStaff(actor)) return server;

  // ── Reviewers & Admins ──────────────────────────────────────
  register(
    server,
    'search_applications',
    'Search submitted applications. All filters optional.',
    {
      status: z.enum([...APPLICATION_STATUSES, 'ALL']).optional(),
      department: z.string().optional().describe('clinic/department text'),
      interestArea: z.enum(INTEREST_AREA_VALUES).optional(),
      query: z.string().optional().describe('name, email or job title'),
      limit: z.number().int().min(1).max(100).default(25),
    },
    (a) => listApplications(actor, { status: a.status, department: a.department, interestArea: a.interestArea, q: a.query, limit: a.limit }),
  );

  register(server, 'get_application', 'Full detail of one application, including supervisor sign-off, human reviews, latest AI assessment, and mentor matches.', { applicationId: z.string() }, (a) =>
    getApplication(actor, a.applicationId),
  );

  register(server, 'application_stats', 'Counts for the active cycle by status, department, interest area, reason, and tenure.', {}, () => getStats(actor));

  register(
    server,
    'generate_ai_assessment',
    'Run the advisory AI rubric assessment on an application (summary, 1–5 scores, strengths, concerns, suggested rotations). Slow — only when the user asks.',
    { applicationId: z.string() },
    (a) => generateAssessment(actor, a.applicationId),
  );

  register(server, 'suggest_mentor_matches', 'Suggest the best-fit mentors for an application (embeddings + interest overlap, respecting capacity). Suggestions only; a human assigns.', { applicationId: z.string() }, async (a) =>
    (await suggestMentors(actor, a.applicationId)).map((m) => ({ mentor: m.mentor.name, title: m.mentor.title, score: m.score, rationale: m.rationale, status: m.status })),
  );

  register(server, 'list_mentors', 'Active mentors with expertise areas, capacity, and current assignments.', {}, () => listMentors(actor));

  return server;
}
