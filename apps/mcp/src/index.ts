import express, { type Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { jwtVerify } from 'jose';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { prisma } from '@erp/db';
import { toActor, type Actor } from '@erp/core';
import { buildServer } from './tools';

const PORT = Number(process.env.MCP_PORT ?? 4100);
const secret = process.env.MCP_SHARED_SECRET;
if (!secret || secret.length < 32) throw new Error('MCP_SHARED_SECRET must be set (32+ chars)');
const key = new TextEncoder().encode(secret);

const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Two ways in:
 *  1. The API's agent: short-lived HS256 JWT (sub = user id) — tools run as that user.
 *  2. External MCP clients (optional): static MCP_SERVICE_TOKEN acting as MCP_SERVICE_USER_EMAIL.
 */
async function authenticate(req: Request): Promise<Actor> {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('missing token');

  const svc = process.env.MCP_SERVICE_TOKEN;
  if (svc && svc.length >= 32 && safeEqual(token, svc)) {
    const user = await prisma.user.findUnique({ where: { email: (process.env.MCP_SERVICE_USER_EMAIL ?? '').toLowerCase() } });
    if (!user) throw new Error('service user not found');
    return toActor(user);
  }

  const { payload } = await jwtVerify(token, key, { issuer: 'erp-api', audience: 'erp-mcp' });
  const user = await prisma.user.findUnique({ where: { id: String(payload.sub) } });
  if (!user) throw new Error('user not found');
  return toActor(user); // role is read fresh from the DB on every call
}

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Stateless Streamable HTTP: a fresh server per request, scoped to the caller.
app.post('/mcp', async (req, res) => {
  let actor: Actor;
  try {
    actor = await authenticate(req);
  } catch {
    res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null });
    return;
  }
  try {
    const server = buildServer(actor);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error('[mcp] request failed', e);
    if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
  }
});

const methodNotAllowed = (_req: Request, res: express.Response) => {
  res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed (stateless server)' }, id: null });
};
app.get('/mcp', methodNotAllowed);
app.delete('/mcp', methodNotAllowed);

app.listen(PORT, (err?: Error) => {
  if (err) {
    console.error(`[mcp] could not listen on :${PORT}`, err.message);
    process.exit(1);
  }
  console.log(`[mcp] residency-program MCP server on :${PORT}/mcp`);
});
