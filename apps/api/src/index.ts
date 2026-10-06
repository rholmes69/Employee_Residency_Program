import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { prisma } from '@erp/db';
import { authRouter, loadSession, requireAuth } from './auth';
import { errorHandler } from './http';
import { applicationsRouter } from './routes/applications';
import { adminRouter } from './routes/admin';
import { agentRouter } from './routes/agent';

const PORT = Number(process.env.API_PORT ?? 4010);
const app = express();

app.set('trust proxy', 1); // behind nginx
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(loadSession);

app.get('/api/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true });
});

app.use('/api/auth', rateLimit({ windowMs: 60_000, limit: 30 }), authRouter);

const api = express.Router();
api.use(requireAuth);
api.use('/agent', rateLimit({ windowMs: 60_000, limit: 20, keyGenerator: (req) => req.actor?.id ?? req.ip ?? 'anon' }));
api.use(applicationsRouter);
api.use(adminRouter);
api.use(agentRouter);
app.use('/api', api);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});
app.use(errorHandler);

app.listen(PORT, (err?: Error) => {
  if (err) {
    console.error(`[api] could not listen on :${PORT}`, err.message);
    process.exit(1);
  }
  console.log(`[api] listening on :${PORT}`);
});
