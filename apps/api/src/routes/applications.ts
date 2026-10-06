import { Router } from 'express';
import { z } from 'zod';
import {
  applicationDraftSchema,
  applicationFilterSchema,
  decisionSchema,
  reviewSchema,
  supervisorDecisionSchema,
} from '@erp/shared';
import {
  addReview,
  findMyApplication,
  generateAssessment,
  getApplication,
  getOrCreateMyApplication,
  getProgramInfo,
  listApplications,
  saveDraft,
  setDecision,
  setMatchStatus,
  submitMyApplication,
  suggestMentors,
  supervisorDecide,
  supervisorQueue,
  withdrawMyApplication,
} from '@erp/core';
import { actorOf, parse } from '../http';
import { renderApplicationPdf } from '../pdf';

export const applicationsRouter = Router();

applicationsRouter.get('/program', async (_req, res) => {
  res.json(await getProgramInfo());
});

// ── Applicant: my application ─────────────────────────────────
/** Status check that does not create a draft (home page). */
applicationsRouter.get('/me/application/status', async (req, res) => {
  res.json(await findMyApplication(actorOf(req)));
});

applicationsRouter.get('/me/application', async (req, res) => {
  res.json(await getOrCreateMyApplication(actorOf(req)));
});

applicationsRouter.put('/me/application', async (req, res) => {
  res.json(await saveDraft(actorOf(req), parse(applicationDraftSchema, req.body)));
});

applicationsRouter.post('/me/application/submit', async (req, res) => {
  res.json(await submitMyApplication(actorOf(req)));
});

applicationsRouter.post('/me/application/withdraw', async (req, res) => {
  res.json(await withdrawMyApplication(actorOf(req)));
});

// ── Supervisor sign-off ───────────────────────────────────────
applicationsRouter.get('/supervisor/queue', async (req, res) => {
  res.json(await supervisorQueue(actorOf(req)));
});

applicationsRouter.post('/applications/:id/supervisor-decision', async (req, res) => {
  res.json(await supervisorDecide(actorOf(req), req.params.id, parse(supervisorDecisionSchema, req.body)));
});

// ── Shared detail + PDF (access checked in core) ─────────────
applicationsRouter.get('/applications/:id', async (req, res) => {
  res.json(await getApplication(actorOf(req), req.params.id));
});

applicationsRouter.get('/applications/:id/pdf', async (req, res) => {
  const app = await getApplication(actorOf(req), req.params.id);
  const safeName = app.fullName.replace(/[^a-z0-9]+/gi, '_') || 'application';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Residency_Application_${safeName}.pdf"`);
  renderApplicationPdf(app, res);
});

// ── Reviewer / Admin ──────────────────────────────────────────
applicationsRouter.get('/applications', async (req, res) => {
  res.json(await listApplications(actorOf(req), parse(applicationFilterSchema, req.query)));
});

applicationsRouter.post('/applications/:id/reviews', async (req, res) => {
  res.status(201).json(await addReview(actorOf(req), req.params.id, parse(reviewSchema, req.body)));
});

applicationsRouter.post('/applications/:id/decision', async (req, res) => {
  res.json(await setDecision(actorOf(req), req.params.id, parse(decisionSchema, req.body)));
});

applicationsRouter.post('/applications/:id/ai-assessment', async (req, res) => {
  res.status(201).json(await generateAssessment(actorOf(req), req.params.id));
});

applicationsRouter.post('/applications/:id/mentor-matches', async (req, res) => {
  res.json(await suggestMentors(actorOf(req), req.params.id));
});

applicationsRouter.patch('/mentor-matches/:id', async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(['ASSIGNED', 'DISMISSED', 'SUGGESTED']) }), req.body);
  res.json(await setMatchStatus(actorOf(req), req.params.id, status));
});
