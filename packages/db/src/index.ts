import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export { Prisma } from '@prisma/client';
export type {
  User,
  ProgramCycle,
  Application,
  SupervisorReview,
  Review,
  AiAssessment,
  Mentor,
  MentorMatch,
  AgentConversation,
  AgentMessage,
  AgentMemory,
  AuditLog,
} from '@prisma/client';
