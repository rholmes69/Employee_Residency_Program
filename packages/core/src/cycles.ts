import { prisma } from '@erp/db';
import type { z } from 'zod';
import type { cycleSchema } from '@erp/shared';
import { assertAdmin, type Actor } from './actor';
import { AppError, notFound } from './errors';
import { audit } from './audit';

export async function getActiveCycle() {
  const cycle = await prisma.programCycle.findFirst({ where: { isActive: true }, orderBy: { opensAt: 'desc' } });
  if (!cycle) throw new AppError(409, 'No active program cycle. An admin must create one under Admin → Settings.');
  return cycle;
}

export function isCycleOpen(cycle: { opensAt: Date; deadline: Date }, now = new Date()) {
  return now >= cycle.opensAt && now <= cycle.deadline;
}

export async function listCycles() {
  return prisma.programCycle.findMany({ orderBy: { opensAt: 'desc' } });
}

type CycleInput = z.infer<typeof cycleSchema>;

export async function saveCycle(actor: Actor, input: CycleInput, id?: string) {
  assertAdmin(actor);
  if (input.deadline <= input.opensAt) throw new AppError(400, 'Deadline must be after the open date');
  const cycle = await prisma.$transaction(async (tx) => {
    // Only one active cycle at a time.
    if (input.isActive) await tx.programCycle.updateMany({ where: { isActive: true, NOT: id ? { id } : undefined }, data: { isActive: false } });
    if (id) {
      const found = await tx.programCycle.findUnique({ where: { id } });
      if (!found) throw notFound('Cycle');
      return tx.programCycle.update({ where: { id }, data: input });
    }
    return tx.programCycle.create({ data: input });
  });
  await audit(actor, id ? 'cycle.update' : 'cycle.create', 'ProgramCycle', cycle.id, { name: cycle.name });
  return cycle;
}
