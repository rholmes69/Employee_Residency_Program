import { prisma } from '@erp/db';
import type { z } from 'zod';
import type { reviewSchema } from '@erp/shared';
import { assertStaff, type Actor } from './actor';
import { notFound } from './errors';
import { audit } from './audit';

export async function addReview(actor: Actor, applicationId: string, input: z.infer<typeof reviewSchema>) {
  assertStaff(actor);
  const app = await prisma.application.findUnique({ where: { id: applicationId }, select: { id: true } });
  if (!app) throw notFound('Application');
  const total = Object.values(input.scores).reduce((s, n) => s + n, 0);
  const review = await prisma.review.create({
    data: {
      applicationId,
      reviewerId: actor.id,
      scores: input.scores,
      total,
      recommendation: input.recommendation,
      notes: input.notes,
    },
  });
  await audit(actor, 'review.create', 'Application', applicationId, { total, recommendation: input.recommendation });
  return review;
}
