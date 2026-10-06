import { Router } from 'express';
import { cycleSchema, mentorSchema, roleUpdateSchema } from '@erp/shared';
import {
  assertAdmin,
  forget,
  getStats,
  listAllMemories,
  listCycles,
  listMentors,
  listUsers,
  saveCycle,
  saveMentor,
  setUserRole,
} from '@erp/core';
import { actorOf, parse } from '../http';

export const adminRouter = Router();

adminRouter.get('/stats', async (req, res) => {
  res.json(await getStats(actorOf(req)));
});

// Mentors (reviewers can view, admins edit)
adminRouter.get('/mentors', async (req, res) => {
  res.json(await listMentors(actorOf(req), req.query.all === 'true'));
});
adminRouter.post('/mentors', async (req, res) => {
  res.status(201).json(await saveMentor(actorOf(req), parse(mentorSchema, req.body)));
});
adminRouter.put('/mentors/:id', async (req, res) => {
  res.json(await saveMentor(actorOf(req), parse(mentorSchema, req.body), req.params.id));
});

// Users & roles
adminRouter.get('/users', async (req, res) => {
  res.json(await listUsers(actorOf(req)));
});
adminRouter.patch('/users/:id/role', async (req, res) => {
  res.json(await setUserRole(actorOf(req), req.params.id, parse(roleUpdateSchema, req.body).role));
});

// Program cycles
adminRouter.get('/cycles', async (req, res) => {
  assertAdmin(actorOf(req));
  res.json(await listCycles());
});
adminRouter.post('/cycles', async (req, res) => {
  res.status(201).json(await saveCycle(actorOf(req), parse(cycleSchema, req.body)));
});
adminRouter.put('/cycles/:id', async (req, res) => {
  res.json(await saveCycle(actorOf(req), parse(cycleSchema, req.body), req.params.id));
});

// Agent memory oversight
adminRouter.get('/admin/memories', async (req, res) => {
  res.json(await listAllMemories(actorOf(req)));
});
adminRouter.delete('/admin/memories/:id', async (req, res) => {
  await forget(actorOf(req), req.params.id);
  res.status(204).end();
});
