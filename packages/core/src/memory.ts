import { prisma } from '@erp/db';
import type { Actor } from './actor';
import { forbidden, notFound } from './errors';
import { audit } from './audit';

/** Learned memories visible to this person: shared GLOBAL facts + their own USER notes. */
export async function listMemories(actor: Actor) {
  return prisma.agentMemory.findMany({
    where: { OR: [{ scope: 'GLOBAL' }, { scope: 'USER', userId: actor.id }] },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
}

export async function listAllMemories(actor: Actor) {
  if (actor.role !== 'ADMIN') throw forbidden('Admin role required');
  return prisma.agentMemory.findMany({ orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true, email: true } } } });
}

export async function remember(actor: Actor, content: string, scope: 'USER' | 'GLOBAL' = 'USER') {
  if (scope === 'GLOBAL' && actor.role !== 'ADMIN') throw forbidden('Only admins can save shared (GLOBAL) memories.');
  const mem = await prisma.agentMemory.create({
    data: { scope, content: content.trim(), userId: scope === 'USER' ? actor.id : null },
  });
  await audit(actor, 'memory.create', 'AgentMemory', mem.id, { scope });
  return mem;
}

export async function forget(actor: Actor, id: string) {
  const mem = await prisma.agentMemory.findUnique({ where: { id } });
  if (!mem) throw notFound('Memory');
  const canDelete = actor.role === 'ADMIN' || (mem.scope === 'USER' && mem.userId === actor.id);
  if (!canDelete) throw forbidden();
  await prisma.agentMemory.delete({ where: { id } });
  await audit(actor, 'memory.delete', 'AgentMemory', id);
}
