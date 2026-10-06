import { prisma } from '@erp/db';
import { interestLabel, reasonLabel } from '@erp/shared';
import { assertStaff, type Actor } from './actor';
import { getActiveCycle } from './cycles';

function tally(values: string[], label: (v: string) => string) {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].map(([key, count]) => ({ key, label: label(key), count })).sort((a, b) => b.count - a.count);
}

export async function getStats(actor: Actor) {
  assertStaff(actor);
  const cycle = await getActiveCycle();
  const apps = await prisma.application.findMany({
    where: { cycleId: cycle.id },
    select: { status: true, department: true, interestAreas: true, reasons: true, lengthOfEmployment: true },
  });
  const submitted = apps.filter((a) => a.status !== 'DRAFT');
  return {
    cycle: { id: cycle.id, name: cycle.name, deadline: cycle.deadline, opensAt: cycle.opensAt },
    totals: { drafts: apps.length - submitted.length, submitted: submitted.length },
    byStatus: tally(apps.map((a) => a.status), (s) => s),
    byDepartment: tally(submitted.map((a) => a.department || 'Unspecified'), (s) => s),
    byInterestArea: tally(submitted.flatMap((a) => a.interestAreas), interestLabel),
    byReason: tally(submitted.flatMap((a) => a.reasons), reasonLabel),
    byTenure: tally(submitted.map((a) => a.lengthOfEmployment || 'Unspecified'), (s) => s),
  };
}
