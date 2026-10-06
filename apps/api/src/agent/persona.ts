import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { STATUS_LABELS, type ApplicationStatus } from '@erp/shared';
import { findMyApplication, getActiveCycle, getStats, isStaff, listMemories, supervisorQueue, type Actor } from '@erp/core';

const AGENT_DIR = process.env.AGENT_DIR ?? path.resolve(process.cwd(), '../../agent');

async function readAgentFile(name: string) {
  try {
    return (await readFile(path.join(AGENT_DIR, name), 'utf8')).trim();
  } catch {
    console.warn(`[agent] ${name} not found in ${AGENT_DIR}`);
    return '';
  }
}

/**
 * Stable system prompt = SOUL.md (who I am) + AGENT.md (how I work) + MEMORY.md (curated facts)
 *                      + learned memories from the DB.
 * Kept byte-identical between requests so Ollama can reuse its prompt cache. On CPU,
 * re-reading this prompt costs minutes. Files are re-read each request, so edits apply without a restart.
 */
export async function buildSystemPrompt(actor: Actor) {
  // Nothing user-specific here: every user with the same tool set shares one cached prefix.
  const [soul, manual, memoryFile, memories] = await Promise.all([
    readAgentFile('SOUL.md'),
    readAgentFile('AGENT.md'),
    readAgentFile('MEMORY.md'),
    listMemories(actor),
  ]);
  const shared = memories.filter((m) => m.scope === 'GLOBAL').map((m) => `- ${m.content}`);
  return [soul, manual, memoryFile, shared.length ? `## Learned (shared)\n${shared.join('\n')}` : '']
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Live facts that change between requests. These are attached to the newest user message
 * (not the system prompt), so the cached prefix stays valid. Cheap DB reads here
 * save the model whole tool round-trips for the most common questions.
 */
export async function buildLiveContext(actor: Actor) {
  const [cycle, queue, mine, stats, memories] = await Promise.all([
    getActiveCycle().catch(() => null),
    supervisorQueue(actor),
    findMyApplication(actor).catch(() => null),
    isStaff(actor) ? getStats(actor).catch(() => null) : Promise.resolve(null),
    listMemories(actor),
  ]);
  const pending = queue.filter((q) => q.status === 'PENDING_SUPERVISOR').length;
  const notes = memories.filter((m) => m.scope === 'USER').map((m) => m.content);
  const lines = [
    `User: ${actor.name} <${actor.email}>, role ${actor.role}`,
    ...(notes.length ? [`Remembered about this user: ${notes.join('; ')}`] : []),
    `Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' })}`,
    `Active cycle: ${cycle ? `${cycle.name}, deadline ${cycle.deadline.toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'full', timeStyle: 'short' })} CT` : 'none'}`,
    `Supervisor sign-offs waiting on this user: ${pending}`,
    `This user's own application: ${myApplicationLine(mine)}`,
  ];
  if (stats) {
    const fmt = (rows: { label: string; count: number }[]) => rows.map((r) => `${r.label} ${r.count}`).join('; ') || 'none yet';
    lines.push(
      `Applications this cycle: ${stats.totals.submitted} submitted, ${stats.totals.drafts} drafts`,
      `By status: ${fmt(stats.byStatus.map((s) => ({ label: STATUS_LABELS[s.key as ApplicationStatus] ?? s.key, count: s.count })))}`,
      `Submitted, by interest area (Q3): ${fmt(stats.byInterestArea)}`,
      `Submitted, by department/clinic: ${fmt(stats.byDepartment)}`,
    );
  }
  return `<context>\n${lines.map((l) => `- ${l}`).join('\n')}\n</context>\nThe <context> facts are current. For names, lists, or details NOT in <context>, call a tool first. Never repeat <context> back.`;
}

/** Small models sometimes echo the context block. Remove it from replies. */
export function stripContextEcho(reply: string) {
  return reply
    .replace(/<context>[\s\S]*?<\/context>/g, '')
    .replace(/^\[Live context[^\]]*\][\s\S]*?(\n\s*\n|$)/m, '')
    .replace(/^The <context> facts are current\..*$/m, '')
    .trim();
}

function myApplicationLine(app: Awaited<ReturnType<typeof findMyApplication>>) {
  if (!app) return 'not started';
  const parts = [`status ${STATUS_LABELS[app.status as ApplicationStatus]}`];
  if (app.submittedAt) parts.push(`submitted ${app.submittedAt.toLocaleDateString('en-US', { timeZone: 'America/Chicago' })}`);
  if (app.supervisorReview) parts.push(`supervisor ${app.supervisorReview.decision.toLowerCase()}`);
  return parts.join(', ');
}
