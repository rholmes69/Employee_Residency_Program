// Idempotent seed — safe to run on every container start.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. The 2026 program cycle from the CEO's announcement letter (Oct 5, 2026).
  const existing = await prisma.programCycle.findFirst();
  if (!existing) {
    await prisma.programCycle.create({
      data: {
        name: '2026 Employee Residency Program',
        description:
          "Delta Health Center's Employee Residency Program supports the professional growth and development of our employees through professional development opportunities, mentorship, exposure to various departments and organizational functions, and other learning experiences. All employees are encouraged to participate, regardless of their current position or role.",
        opensAt: new Date('2026-10-05T00:00:00-05:00'),
        // Applications due October 13, 2026 (end of day, Central Time)
        deadline: new Date('2026-10-13T23:59:59-05:00'),
        hrContactName: 'Vatecia N. Spann',
        hrContactEmail: 'vspann@deltahealthcenter.org',
        isActive: true,
      },
    });
    console.log('Seeded program cycle');
  }

  // 2. Bootstrap admins from ADMIN_EMAILS.
  const admins = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  for (const email of admins) {
    await prisma.user.upsert({
      where: { email },
      update: { role: 'ADMIN' },
      create: { email, name: email.split('@')[0], role: 'ADMIN' },
    });
  }

  // 3. Demo mentors (fictional) so matching works out of the box.
  //    Replace via Admin → Mentors with real volunteers.
  if ((await prisma.mentor.count()) === 0) {
    await prisma.mentor.createMany({
      data: [
        {
          name: 'Demo Mentor — HR',
          email: 'mentor.hr@example.org',
          title: 'Human Resources Manager',
          department: 'Human Resources',
          expertiseAreas: ['HUMAN_RESOURCES', 'LEADERSHIP_MANAGEMENT'],
          bio: 'Recruiting, onboarding, employee relations, policy, and coaching first-time supervisors.',
          capacity: 3,
        },
        {
          name: 'Demo Mentor — Clinical Ops',
          email: 'mentor.clinical@example.org',
          title: 'Director of Clinical Operations',
          department: 'Clinical Operations',
          expertiseAreas: ['CLINICAL_OPERATIONS', 'LEADERSHIP_MANAGEMENT'],
          bio: 'Clinic workflow, patient experience, quality improvement, and multi-site operations across the Delta.',
          capacity: 3,
        },
        {
          name: 'Demo Mentor — Finance',
          email: 'mentor.finance@example.org',
          title: 'Finance & Compliance Officer',
          department: 'Finance/Compliance',
          expertiseAreas: ['FINANCE_COMPLIANCE_ADMIN'],
          bio: 'Budgeting, grants management, HRSA compliance, billing, and administrative operations.',
          capacity: 2,
        },
        {
          name: 'Demo Mentor — Community',
          email: 'mentor.community@example.org',
          title: 'Community Engagement Coordinator',
          department: 'Community Engagement',
          expertiseAreas: ['COMMUNITY_ENGAGEMENT'],
          bio: 'Outreach events, school-based clinic partnerships, health fairs, and special projects.',
          capacity: 2,
        },
        {
          name: 'Demo Mentor — Executive',
          email: 'mentor.exec@example.org',
          title: 'Executive Leadership Team Member',
          department: 'Administration',
          expertiseAreas: ['EXECUTIVE_LEADERSHIP', 'LEADERSHIP_MANAGEMENT'],
          bio: 'Strategy, organizational culture, board relations, and developing future leaders.',
          capacity: 2,
        },
      ],
    });
    console.log('Seeded demo mentors');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
