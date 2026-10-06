import { Router } from 'express';
import { assistSchema, chatSchema, memorySchema } from '@erp/shared';
import { prisma } from '@erp/db';
import { AppError, assistAnswer, config, findMyApplication, forget, listMemories, ollamaHealth, remember } from '@erp/core';
import { actorOf, parse } from '../http';
import { runAgent, warmAgent } from '../agent/runAgent';

export const agentRouter = Router();

agentRouter.get('/agent/health', async (_req, res) => {
  const ollama = await ollamaHealth();
  res.json({
    ollama,
    models: { agent: config.ollama.agentModel, fast: config.ollama.fastModel, embed: config.ollama.embedModel },
  });
});

/** Called when the chat panel opens; returns immediately. */
agentRouter.post('/agent/warmup', (req, res) => {
  void warmAgent(actorOf(req));
  res.status(202).json({ ok: true });
});

agentRouter.post('/agent/chat', async (req, res) => {
  const { message, conversationId } = parse(chatSchema, req.body);
  res.json(await runAgent(actorOf(req), message, conversationId));
});

agentRouter.get('/agent/conversations', async (req, res) => {
  res.json(
    await prisma.agentConversation.findMany({
      where: { userId: actorOf(req).id },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      select: { id: true, title: true, updatedAt: true },
    }),
  );
});

agentRouter.get('/agent/conversations/:id', async (req, res) => {
  const convo = await prisma.agentConversation.findUnique({
    where: { id: req.params.id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (!convo || convo.userId !== actorOf(req).id) throw new AppError(404, 'Conversation not found');
  res.json(convo);
});

agentRouter.delete('/agent/conversations/:id', async (req, res) => {
  await prisma.agentConversation.deleteMany({ where: { id: req.params.id, userId: actorOf(req).id } });
  res.status(204).end();
});

/** Inline "help me write this" for Q2/Q4/Q5 on the application form. */
agentRouter.post('/agent/assist', async (req, res) => {
  const actor = actorOf(req);
  const input = parse(assistSchema, req.body);
  const mine = await findMyApplication(actor);
  const text = await assistAnswer(input, { jobTitle: mine?.jobTitle, department: mine?.department });
  res.json({ text });
});

// Personal memories the agent keeps about me
agentRouter.get('/agent/memories', async (req, res) => {
  res.json(await listMemories(actorOf(req)));
});
agentRouter.post('/agent/memories', async (req, res) => {
  const { content, scope } = parse(memorySchema, req.body);
  res.status(201).json(await remember(actorOf(req), content, scope));
});
agentRouter.delete('/agent/memories/:id', async (req, res) => {
  await forget(actorOf(req), req.params.id);
  res.status(204).end();
});
