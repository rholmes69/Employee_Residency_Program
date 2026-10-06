import { ACKNOWLEDGMENT, INTEREST_AREAS, QUESTIONS, REASONS } from '@erp/shared';
import { getActiveCycle, isCycleOpen } from './cycles';

/** Public facts about the program, from the CEO's announcement and the application form. */
export async function getProgramInfo() {
  const cycle = await getActiveCycle();
  return {
    program: cycle.name,
    description: cycle.description,
    opensAt: cycle.opensAt.toISOString(),
    deadline: cycle.deadline.toISOString(),
    isOpen: isCycleOpen(cycle),
    hrContact: { name: cycle.hrContactName, email: cycle.hrContactEmail },
    offers: [
      'Professional development opportunities',
      'Mentorship',
      'Exposure to various departments and organizational functions',
      'Leadership development',
      'Career advancement preparation',
    ],
    eligibility: 'All Delta Health Center employees, regardless of current position or role.',
    process: [
      'Complete the online application and sign the acknowledgment',
      'Your immediate supervisor signs off',
      'HR reviews applications',
      'Participation requirements and next steps are shared with interested applicants',
    ],
    questions: QUESTIONS,
    reasonOptions: REASONS.map((r) => r.label),
    interestAreaOptions: INTEREST_AREAS.map((a) => a.label),
    acknowledgment: ACKNOWLEDGMENT,
    note: 'Participation does not guarantee a promotion or change in position.',
  };
}
