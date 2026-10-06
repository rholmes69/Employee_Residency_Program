import { prisma, Prisma } from '@erp/db';
import {
  APPLICATION_STATUSES,
  INTEREST_AREAS,
  applicationSubmitSchema,
  type ApplicationDraft,
  type ApplicationFilter,
  type ApplicationStatus,
} from '@erp/shared';
import { assertStaff, isStaff, type Actor } from './actor';
import { AppError, badRequest, forbidden, notFound } from './errors';
import { getActiveCycle, isCycleOpen } from './cycles';
import { audit } from './audit';
import { emails } from './notify';

const EDITABLE: ApplicationStatus[] = ['DRAFT', 'SUPERVISOR_DECLINED'];
const WITHDRAWABLE: ApplicationStatus[] = ['DRAFT', 'PENDING_SUPERVISOR', 'SUPERVISOR_DECLINED', 'UNDER_REVIEW', 'WAITLISTED'];
const OMIT = { embedding: true } as const;

/** Applicant's application for the active cycle, created (pre-filled from their profile) on first visit. */
export async function getOrCreateMyApplication(actor: Actor) {
  const cycle = await getActiveCycle();
  const found = await prisma.application.findUnique({
    where: { cycleId_applicantId: { cycleId: cycle.id, applicantId: actor.id } },
    omit: OMIT,
    include: { supervisorReview: true, cycle: true },
  });
  if (found) return found;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
  return prisma.application.create({
    data: {
      cycleId: cycle.id,
      applicantId: actor.id,
      fullName: user.name,
      email: user.email,
      jobTitle: user.jobTitle ?? '',
      department: user.department ?? '',
    },
    omit: OMIT,
    include: { supervisorReview: true, cycle: true },
  });
}

/** Read-only lookup (no auto-create) — used by the agent. */
export async function findMyApplication(actor: Actor) {
  const cycle = await getActiveCycle();
  return prisma.application.findUnique({
    where: { cycleId_applicantId: { cycleId: cycle.id, applicantId: actor.id } },
    omit: OMIT,
    include: { supervisorReview: true },
  });
}

export async function saveDraft(actor: Actor, data: ApplicationDraft) {
  const app = await getOrCreateMyApplication(actor);
  if (!EDITABLE.includes(app.status as ApplicationStatus))
    throw new AppError(409, 'This application has been submitted and can no longer be edited.');
  // Changing the signed content invalidates a previous typed signature.
  return prisma.application.update({
    where: { id: app.id },
    data: { ...data, signedAt: null },
    omit: OMIT,
    include: { supervisorReview: true, cycle: true },
  });
}

export async function submitMyApplication(actor: Actor) {
  const app = await getOrCreateMyApplication(actor);
  if (!EDITABLE.includes(app.status as ApplicationStatus)) throw new AppError(409, 'This application was already submitted.');
  if (!isCycleOpen(app.cycle)) throw new AppError(409, `The application window is closed (deadline ${app.cycle.deadline.toDateString()}).`);

  const parsed = applicationSubmitSchema.safeParse(app);
  if (!parsed.success) throw badRequest('Please complete all required fields.', parsed.error.flatten().fieldErrors);
  if (parsed.data.supervisorEmail === actor.email.toLowerCase())
    throw badRequest('You cannot list yourself as your supervisor.', { supervisorEmail: ['Use your supervisor’s email'] });

  const now = new Date();
  const [, updated] = await prisma.$transaction([
    prisma.supervisorReview.deleteMany({ where: { applicationId: app.id } }),
    prisma.application.update({
      where: { id: app.id },
      data: {
        ...parsed.data,
        status: 'PENDING_SUPERVISOR',
        submittedAt: now,
        signedAt: now,
        embedding: [], // goals may have changed — recompute on next match
      },
      omit: OMIT,
      include: { supervisorReview: true, cycle: true },
    }),
  ]);
  await audit(actor, 'application.submit', 'Application', app.id);
  void emails.submitted(updated);
  void emails.supervisorRequest(updated);
  return updated;
}

export async function withdrawMyApplication(actor: Actor) {
  const app = await getOrCreateMyApplication(actor);
  if (!WITHDRAWABLE.includes(app.status as ApplicationStatus)) throw new AppError(409, 'This application can no longer be withdrawn.');
  const updated = await prisma.application.update({ where: { id: app.id }, data: { status: 'WITHDRAWN' }, omit: OMIT });
  await audit(actor, 'application.withdraw', 'Application', app.id);
  return updated;
}

/** Full detail, shaped by who is asking: staff see everything, applicant/supervisor see the form + sign-off only. */
export async function getApplication(actor: Actor, id: string) {
  const app = await prisma.application.findUnique({
    where: { id },
    omit: OMIT,
    include: {
      cycle: true,
      supervisorReview: true,
      reviews: { include: { reviewer: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'desc' } },
      aiAssessments: { orderBy: { createdAt: 'desc' }, take: 1 },
      mentorMatches: { include: { mentor: { omit: { embedding: true } } }, orderBy: { score: 'desc' } },
    },
  });
  if (!app) throw notFound('Application');

  if (isStaff(actor)) return { ...app, viewerRelation: 'staff' as const };

  const isOwner = app.applicantId === actor.id;
  const isSupervisor = app.status !== 'DRAFT' && app.supervisorEmail === actor.email.toLowerCase();
  if (!isOwner && !isSupervisor) throw forbidden();

  const { reviews: _r, aiAssessments: _a, mentorMatches, ...rest } = app;
  return {
    ...rest,
    // Applicants can see an assigned mentor, never internal suggestions or scores.
    mentorMatches: isOwner
      ? mentorMatches.filter((m) => m.status === 'ASSIGNED').map((m) => ({ ...m, score: 0, rationale: '' }))
      : [],
    viewerRelation: isOwner ? ('applicant' as const) : ('supervisor' as const),
  };
}

export async function listApplications(actor: Actor, f: ApplicationFilter = {}) {
  assertStaff(actor);
  const where: Prisma.ApplicationWhereInput = {};
  // Tolerate loose input (the agent may send "all" or "under review").
  const status = f.status?.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (status && (APPLICATION_STATUSES as readonly string[]).includes(status)) where.status = status as ApplicationStatus;
  else if (status !== 'ALL') where.status = { not: 'DRAFT' };
  if (f.department) where.department = { contains: f.department, mode: 'insensitive' };
  const area = f.interestArea?.trim().toUpperCase();
  if (area) where.interestAreas = { has: INTEREST_AREAS.find((a) => a.value === area || a.label.toUpperCase() === area)?.value ?? area };
  if (f.q)
    where.OR = [
      { fullName: { contains: f.q, mode: 'insensitive' } },
      { email: { contains: f.q, mode: 'insensitive' } },
      { jobTitle: { contains: f.q, mode: 'insensitive' } },
    ];

  const rows = await prisma.application.findMany({
    where,
    take: f.limit ?? 200,
    orderBy: [{ submittedAt: 'desc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      fullName: true,
      email: true,
      jobTitle: true,
      department: true,
      lengthOfEmployment: true,
      status: true,
      interestAreas: true,
      reasons: true,
      submittedAt: true,
      supervisorName: true,
      aiAssessments: { select: { total: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      reviews: { select: { total: true } },
      mentorMatches: { where: { status: 'ASSIGNED' }, select: { mentor: { select: { name: true } } } },
    },
  });
  return rows.map(({ aiAssessments, reviews, mentorMatches, ...r }) => ({
    ...r,
    aiScore: aiAssessments[0]?.total ?? null,
    reviewCount: reviews.length,
    avgReviewScore: reviews.length ? Math.round((reviews.reduce((s, x) => s + x.total, 0) / reviews.length) * 10) / 10 : null,
    assignedMentors: mentorMatches.map((m) => m.mentor.name),
  }));
}

export async function supervisorQueue(actor: Actor) {
  return prisma.application.findMany({
    where: { supervisorEmail: actor.email.toLowerCase(), status: { not: 'DRAFT' } },
    orderBy: { submittedAt: 'desc' },
    select: { id: true, fullName: true, jobTitle: true, department: true, status: true, submittedAt: true, supervisorReview: true },
  });
}

export async function supervisorDecide(actor: Actor, id: string, input: { decision: 'APPROVED' | 'DECLINED'; comment?: string }) {
  const app = await prisma.application.findUnique({ where: { id }, omit: OMIT });
  if (!app) throw notFound('Application');
  if (app.supervisorEmail !== actor.email.toLowerCase()) throw forbidden('Only the listed supervisor can sign off on this application.');
  if (app.status !== 'PENDING_SUPERVISOR') throw new AppError(409, 'This application is not awaiting supervisor sign-off.');

  const approved = input.decision === 'APPROVED';
  const [, updated] = await prisma.$transaction([
    prisma.supervisorReview.create({
      data: {
        applicationId: id,
        supervisorEmail: actor.email.toLowerCase(),
        supervisorUserId: actor.id,
        decision: input.decision,
        comment: input.comment,
      },
    }),
    prisma.application.update({ where: { id }, data: { status: approved ? 'UNDER_REVIEW' : 'SUPERVISOR_DECLINED' }, omit: OMIT }),
  ]);
  await audit(actor, `supervisor.${input.decision.toLowerCase()}`, 'Application', id, { comment: input.comment });
  void emails.supervisorDecided(updated, approved, input.comment);
  return updated;
}

export async function setDecision(actor: Actor, id: string, input: { status: ApplicationStatus; note?: string }) {
  assertStaff(actor);
  const app = await prisma.application.findUnique({ where: { id }, omit: OMIT });
  if (!app) throw notFound('Application');
  const reviewable: ApplicationStatus[] = ['UNDER_REVIEW', 'ACCEPTED', 'WAITLISTED', 'NOT_SELECTED'];
  if (!reviewable.includes(app.status as ApplicationStatus))
    throw new AppError(409, 'Decisions can only be made after supervisor sign-off.');

  const final = input.status !== 'UNDER_REVIEW';
  const updated = await prisma.application.update({
    where: { id },
    data: { status: input.status, decisionNote: input.note, decidedAt: final ? new Date() : null },
    omit: OMIT,
  });
  await audit(actor, 'application.decision', 'Application', id, { from: app.status, to: input.status });
  if (final && app.status !== input.status) void emails.decision(updated, input.status, input.note);
  return updated;
}
