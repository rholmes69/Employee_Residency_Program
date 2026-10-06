import type { Role } from '@erp/shared';
import { forbidden } from './errors';

/** The authenticated person on whose behalf an operation runs (HTTP user or MCP caller). */
export interface Actor {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export const isStaff = (a: Actor) => a.role === 'REVIEWER' || a.role === 'ADMIN';

export function assertStaff(a: Actor) {
  if (!isStaff(a)) throw forbidden('Reviewer or Admin role required');
}

export function assertAdmin(a: Actor) {
  if (a.role !== 'ADMIN') throw forbidden('Admin role required');
}
