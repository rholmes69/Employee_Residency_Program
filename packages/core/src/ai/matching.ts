import { z } from 'zod';
import { prisma } from '@erp/db';
import { interestLabel } from '@erp/shared';
import { assertStaff, type Actor } from '../actor';
import { config } from '../config';
import { AppError, notFound } from '../errors';
import { audit } from '../audit';
import { chat, cosine, embed } from './ollama';

const AREA_BONUS = 0.08; // per shared interest/expertise area

/**
 * Suggest mentors for an application:
 *   1. semantic similarity (nomic-embed-text) between the applicant's goals and mentor profiles
 *   2. + a bonus for each overlapping interest area
 *   3. skip mentors at capacity
 *   4. the fast LLM writes a one-sentence rationale for each pick
 */
export async function suggestMentors(actor: Actor, applicationId: string, topN = 3) {
  assertStaff(actor);
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw notFound('Application');

  const mentors = await prisma.mentor.findMany({
    where: { active: true },
    include: { matches: { where: { status: 'ASSIGNED' }, select: { applicationId: true } } },
  });
  if (!mentors.length) throw new AppError(409, 'No active mentors. Add mentors under Admin → Mentors.');

  // Lazily compute and cache embeddings.
  const needEmbedding = mentors.filter((m) => !m.embedding.length);
  if (needEmbedding.length) {
    const vectors = await embed(needEmbedding.map(mentorText));
    await Promise.all(
      needEmbedding.map((m, i) => {
        m.embedding = vectors[i];
        return prisma.mentor.update({ where: { id: m.id }, data: { embedding: vectors[i] } });
      }),
    );
  }
  let appVec = app.embedding;
  if (!appVec.length) {
    [appVec] = await embed([applicationText(app)]);
    await prisma.application.update({ where: { id: app.id }, data: { embedding: appVec } });
  }

  const ranked = mentors
    .filter((m) => m.matches.length < m.capacity || m.matches.some((x) => x.applicationId === app.id))
    .map((m) => {
      const shared = m.expertiseAreas.filter((a) => app.interestAreas.includes(a));
      return { mentor: m, shared, score: cosine(appVec, m.embedding) + shared.length * AREA_BONUS };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  const rationales = await writeRationales(app, ranked).catch(() => ({}) as Record<string, string>);

  // Replace previous *suggestions*; keep anything a human assigned or dismissed.
  await prisma.mentorMatch.deleteMany({ where: { applicationId: app.id, status: 'SUGGESTED' } });
  const keep = await prisma.mentorMatch.findMany({ where: { applicationId: app.id }, select: { mentorId: true } });
  const keepIds = new Set(keep.map((k) => k.mentorId));

  for (const r of ranked) {
    if (keepIds.has(r.mentor.id)) continue;
    await prisma.mentorMatch.create({
      data: {
        applicationId: app.id,
        mentorId: r.mentor.id,
        score: Math.round(r.score * 1000) / 1000,
        rationale:
          rationales[r.mentor.id] ||
          (r.shared.length ? `Shared focus: ${r.shared.map(interestLabel).join(', ')}.` : 'Closest match on stated goals.'),
      },
    });
  }
  await audit(actor, 'ai.match', 'Application', app.id, { mentors: ranked.map((r) => r.mentor.id) });

  return prisma.mentorMatch.findMany({
    where: { applicationId: app.id },
    include: { mentor: { omit: { embedding: true } } },
    orderBy: { score: 'desc' },
  });
}

type AppForMatch = { interestAreas: string[]; interestOther: string | null; goals: string; hopeToGain: string; jobTitle: string; department: string };
type MentorForMatch = { name: string; title: string; department: string; expertiseAreas: string[]; bio: string };

function applicationText(a: AppForMatch) {
  return `Interests: ${a.interestAreas.map(interestLabel).join(', ')}${a.interestOther ? `, ${a.interestOther}` : ''}. Goals: ${a.goals} Hopes to gain: ${a.hopeToGain}`;
}

function mentorText(m: MentorForMatch) {
  return `${m.title}, ${m.department}. Expertise: ${m.expertiseAreas.map(interestLabel).join(', ')}. ${m.bio}`;
}

async function writeRationales(app: AppForMatch, picks: { mentor: MentorForMatch & { id: string } }[]) {
  const reply = await chat({
    model: config.ollama.fastModel,
    format: {
      type: 'object',
      properties: {
        rationales: {
          type: 'array',
          items: { type: 'object', properties: { id: { type: 'string' }, rationale: { type: 'string' } }, required: ['id', 'rationale'] },
        },
      },
      required: ['rationales'],
    },
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: 'You match employees with mentors. For each mentor, write ONE sentence (max 30 words) explaining why they fit this applicant. Respond only with JSON.',
      },
      {
        role: 'user',
        content: `Applicant (${app.jobTitle}, ${app.department}): ${applicationText(app)}\n\nMentors:\n${picks
          .map((p) => `id=${p.mentor.id}: ${mentorText(p.mentor)}`)
          .join('\n')}`,
      },
    ],
  });
  const parsed = z
    .object({ rationales: z.array(z.object({ id: z.string(), rationale: z.string() })) })
    .parse(JSON.parse(reply.content));
  return Object.fromEntries(parsed.rationales.map((r) => [r.id, r.rationale]));
}
