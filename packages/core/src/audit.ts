import { prisma, Prisma } from '@erp/db';
import type { Actor } from './actor';

export async function audit(
  actor: Actor | null,
  action: string,
  entity: string,
  entityId?: string,
  data?: Record<string, unknown>,
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor?.id,
        action,
        entity,
        entityId,
        data: (data ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (e) {
    console.error('[audit] failed to write audit log', e);
  }
}
