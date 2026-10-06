import { prisma } from '@erp/db';
import type { MentorInput } from '@erp/shared';
import { assertAdmin, assertStaff, type Actor } from './actor';
import { notFound } from './errors';
import { audit } from './audit';

export async function listMentors(actor: Actor, includeInactive = false) {
  assertStaff(actor);
  const mentors = await prisma.mentor.findMany({
    where: includeInactive ? {} : { active: true },
    omit: { embedding: true },
    orderBy: { name: 'asc' },
    include: { matches: { where: { status: 'ASSIGNED' }, select: { id: true } } },
  });
  return mentors.map(({ matches, ...m }) => ({ ...m, assignedCount: matches.length }));
}

export async function saveMentor(actor: Actor, input: MentorInput, id?: string) {
  assertAdmin(actor);
  if (id && !(await prisma.mentor.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Mentor');
  // Profile text changed → clear the cached embedding so matching recomputes it.
  const mentor = id
    ? await prisma.mentor.update({ where: { id }, data: { ...input, embedding: [] }, omit: { embedding: true } })
    : await prisma.mentor.create({ data: input, omit: { embedding: true } });
  await audit(actor, id ? 'mentor.update' : 'mentor.create', 'Mentor', mentor.id, { name: mentor.name });
  return mentor;
}

export async function setMatchStatus(actor: Actor, matchId: string, status: 'ASSIGNED' | 'DISMISSED' | 'SUGGESTED') {
  assertStaff(actor);
  const match = await prisma.mentorMatch.findUnique({ where: { id: matchId } });
  if (!match) throw notFound('Match');
  const updated = await prisma.mentorMatch.update({ where: { id: matchId }, data: { status } });
  await audit(actor, `match.${status.toLowerCase()}`, 'Application', match.applicationId, { mentorId: match.mentorId });
  return updated;
}
