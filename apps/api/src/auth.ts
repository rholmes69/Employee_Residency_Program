import { Router, type NextFunction, type Request, type Response } from 'express';
import { SignJWT, jwtVerify, createRemoteJWKSet } from 'jose';
import { z } from 'zod';
import { devLoginSchema } from '@erp/shared';
import { AppError, audit, getUserById, toActor, upsertLoginUser } from '@erp/core';
import { actorOf, parse } from './http';

const COOKIE = 'erp_session';
const SESSION_HOURS = 10;

const sessionSecret = process.env.SESSION_SECRET ?? '';
if (sessionSecret.length < 32) throw new Error('SESSION_SECRET must be set (32+ chars)');
const sessionKey = new TextEncoder().encode(sessionSecret);

const tenantId = process.env.ENTRA_TENANT_ID ?? '';
const clientId = process.env.ENTRA_CLIENT_ID ?? '';
const allowedDomains = (process.env.ENTRA_ALLOWED_DOMAINS ?? '')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);
export const devLoginEnabled = process.env.AUTH_DEV_LOGIN === 'true';
if (devLoginEnabled) console.warn('⚠️  AUTH_DEV_LOGIN=true — anyone can sign in as anyone. Disable in production.');

const jwks = tenantId ? createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`)) : null;

async function issueSession(res: Response, userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(sessionKey);
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: SESSION_HOURS * 3600 * 1000,
    path: '/',
  });
}

/** Attaches req.actor when a valid session cookie is present. Role is always read fresh from the DB. */
export async function loadSession(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      const { payload } = await jwtVerify(token, sessionKey);
      const user = payload.sub ? await getUserById(payload.sub) : null;
      if (user) req.actor = toActor(user);
    } catch {
      /* expired or tampered → treat as signed out */
    }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.actor) throw new AppError(401, 'Not signed in');
  next();
}

export const authRouter = Router();

/** Frontend reads this at startup to configure MSAL — no rebuild needed to change tenants. */
authRouter.get('/config', (_req, res) => {
  res.json({
    entra: tenantId && clientId ? { tenantId, clientId } : null,
    devLogin: devLoginEnabled,
  });
});

authRouter.post('/entra', async (req, res) => {
  if (!jwks) throw new AppError(501, 'Microsoft sign-in is not configured (ENTRA_TENANT_ID / ENTRA_CLIENT_ID).');
  const { idToken } = parse(z.object({ idToken: z.string().min(20) }), req.body);
  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, jwks, {
      issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      audience: clientId,
    }));
  } catch {
    throw new AppError(401, 'Microsoft sign-in could not be verified.');
  }
  const email = String(payload.email ?? payload.preferred_username ?? '').toLowerCase();
  if (!email.includes('@')) throw new AppError(401, 'Your Microsoft account has no email address.');
  if (allowedDomains.length && !allowedDomains.includes(email.split('@')[1]))
    throw new AppError(403, 'Please sign in with your Delta Health Center account.');

  const user = await upsertLoginUser({
    email,
    name: String(payload.name ?? ''),
    entraOid: payload.oid ? String(payload.oid) : undefined,
    entraRoles: Array.isArray(payload.roles) ? payload.roles.map(String) : [],
  });
  await issueSession(res, user.id);
  await audit(toActor(user), 'auth.login', 'User', user.id, { method: 'entra' });
  res.json(toActor(user));
});

authRouter.post('/dev-login', async (req, res) => {
  if (!devLoginEnabled) throw new AppError(404, 'Not found');
  const input = parse(devLoginSchema, req.body);
  const user = await upsertLoginUser({ email: input.email, name: input.name ?? '', requestedRole: input.role });
  await issueSession(res, user.id);
  await audit(toActor(user), 'auth.login', 'User', user.id, { method: 'dev' });
  res.json(toActor(user));
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json(actorOf(req));
});
