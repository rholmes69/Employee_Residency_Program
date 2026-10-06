import { prisma } from '@erp/db';
import type { Role } from '@erp/shared';
import { assertAdmin, type Actor } from './actor';
import { config } from './config';
import { audit } from './audit';
import { notFound } from './errors';

export const toActor = (u: { id: string; email: string; name: string; role: string }): Actor => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role as Role,
});

/**
 * Called on every sign-in. Role precedence:
 *   ADMIN_EMAILS env  >  Entra app roles ("Admin"/"Reviewer")  >  existing DB role  >  EMPLOYEE
 */
export async function upsertLoginUser(input: {
  email: string;
  name: string;
  entraOid?: string;
  entraRoles?: string[];
  requestedRole?: Role; // dev login only
}) {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });

  let role: Role = (existing?.role as Role) ?? 'EMPLOYEE';
  const roles = (input.entraRoles ?? []).map((r) => r.toLowerCase());
  if (roles.includes('admin')) role = 'ADMIN';
  else if (roles.includes('reviewer') && role !== 'ADMIN') role = 'REVIEWER';
  if (input.requestedRole) role = input.requestedRole;
  if (config.adminEmails.includes(email)) role = 'ADMIN';

  const user = await prisma.user.upsert({
    where: { email },
    update: { name: input.name || existing?.name, entraOid: input.entraOid ?? existing?.entraOid, role, lastLoginAt: new Date() },
    create: { email, name: input.name || email.split('@')[0], entraOid: input.entraOid, role, lastLoginAt: new Date() },
  });
  return user;
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function listUsers(actor: Actor) {
  assertAdmin(actor);
  return prisma.user.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, email: true, name: true, role: true, lastLoginAt: true, createdAt: true },
  });
}

export async function setUserRole(actor: Actor, userId: string, role: Role) {
  assertAdmin(actor);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('User');
  const updated = await prisma.user.update({ where: { id: userId }, data: { role } });
  await audit(actor, 'user.role', 'User', userId, { from: user.role, to: role });
  return updated;
}
