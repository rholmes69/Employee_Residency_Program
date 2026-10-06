// Values mirror the paper "Employee Residency Program Application" exactly.

export const REASONS = [
  { value: 'PROFESSIONAL_DEVELOPMENT', label: 'Professional development' },
  { value: 'LEADERSHIP_DEVELOPMENT', label: 'Leadership development' },
  { value: 'CAREER_ADVANCEMENT', label: 'Career advancement within Delta Health Center' },
  { value: 'LEARN_OTHER_DEPARTMENTS', label: 'Learning more about other departments' },
  { value: 'DEVELOP_NEW_SKILLS', label: 'Developing new skills' },
  { value: 'MENTORSHIP', label: 'Mentorship and guidance' },
  { value: 'FUTURE_SUPERVISORY', label: 'Preparing for a future supervisory or management position' },
  { value: 'UNDERSTAND_OPERATIONS', label: "Gaining a better understanding of Delta Health Center's overall operations" },
  { value: 'EXPLORE_CAREER_PATH', label: 'Exploring a different career path within the organization' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const INTEREST_AREAS = [
  { value: 'EXECUTIVE_LEADERSHIP', label: 'Executive Leadership & Organizational Culture' },
  { value: 'HUMAN_RESOURCES', label: 'Human Resources' },
  { value: 'CLINICAL_OPERATIONS', label: 'Clinical Operations & Patient Experience' },
  { value: 'FINANCE_COMPLIANCE_ADMIN', label: 'Finance/Compliance/Administration' },
  { value: 'COMMUNITY_ENGAGEMENT', label: 'Community Engagement & Special Projects' },
  { value: 'LEADERSHIP_MANAGEMENT', label: 'Leadership & Management' },
  { value: 'OTHER', label: 'Other' },
] as const;

export type ReasonValue = (typeof REASONS)[number]['value'];
export type InterestAreaValue = (typeof INTEREST_AREAS)[number]['value'];

export const REASON_VALUES = REASONS.map((r) => r.value) as [ReasonValue, ...ReasonValue[]];
export const INTEREST_AREA_VALUES = INTEREST_AREAS.map((a) => a.value) as [InterestAreaValue, ...InterestAreaValue[]];

export const reasonLabel = (v: string) => REASONS.find((r) => r.value === v)?.label ?? v;
export const interestLabel = (v: string) => INTEREST_AREAS.find((a) => a.value === v)?.label ?? v;

// Delta Health Center locations (from the program letterhead) — offered as
// suggestions for the free-text Department/Clinic field.
export const LOCATIONS = [
  'Administration Office (Mound Bayou)',
  'Dr. H. Jack Geiger Medical Center (Mound Bayou)',
  'Searcy Medical Center (Cleveland)',
  'Dr. Robert Smith Center, Central (Greenville)',
  'Dr. Robert Smith Center, South (Greenville)',
  'Indianola',
  'Moorhead',
  'Hollandale Medical/Dental',
  'Rolling Fork',
  'Mayersville',
  'W. Inge Dental Clinic (Mound Bayou)',
  'Barbara Brooks, Leland Center',
  'Mississippi Valley State University (Itta Bena)',
  'DHC School Based Clinics (Sunflower County)',
] as const;

export const EMPLOYMENT_LENGTHS = [
  'Less than 1 year',
  '1–2 years',
  '3–5 years',
  '6–10 years',
  'More than 10 years',
] as const;

export const QUESTIONS = {
  reasons: '1. Why are you interested in participating in the Employee Residency Program?',
  hopeToGain: '2. Please briefly explain what you hope to gain from the experience.',
  interestAreas: '3. Which areas of Delta Health Center are you most interested in learning more about?',
  goals: '4. What are your professional goals for the next 1–3 years?',
  strengths: '5. What skills, strengths, or experiences do you believe you would bring to the Employee Residency Program?',
  willingToParticipate:
    '6. Are you willing to actively participate in assigned professional development activities, departmental learning experiences, mentorship opportunities, and program requirements?',
} as const;

export const ACKNOWLEDGMENT =
  'I understand that participation in the Employee Residency Program requires commitment, professionalism, active participation, and completion of assigned program activities. I understand that participation in the program does not guarantee a promotion or change in position but is intended to provide opportunities for professional growth and development.';

export const APPLICATION_STATUSES = [
  'DRAFT',
  'PENDING_SUPERVISOR',
  'SUPERVISOR_DECLINED',
  'UNDER_REVIEW',
  'ACCEPTED',
  'WAITLISTED',
  'NOT_SELECTED',
  'WITHDRAWN',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: 'Draft',
  PENDING_SUPERVISOR: 'Awaiting supervisor',
  SUPERVISOR_DECLINED: 'Supervisor declined',
  UNDER_REVIEW: 'Under HR review',
  ACCEPTED: 'Accepted',
  WAITLISTED: 'Waitlisted',
  NOT_SELECTED: 'Not selected',
  WITHDRAWN: 'Withdrawn',
};

/** Statuses an HR reviewer may set. */
export const DECISION_STATUSES = ['UNDER_REVIEW', 'ACCEPTED', 'WAITLISTED', 'NOT_SELECTED'] as const;

export const ROLES = ['EMPLOYEE', 'REVIEWER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

/**
 * Review rubric (1–5 each, 25 max). This is a starting point — the program
 * letter says participation requirements will be published later, so HR
 * should adjust these criteria once they are.
 */
export const RUBRIC = [
  { key: 'motivation', label: 'Motivation & clarity of purpose', guide: 'Q1–Q2: specific, sincere reasons and a clear idea of what they want to gain.' },
  { key: 'goalAlignment', label: 'Goal alignment', guide: 'Q3–Q4: goals are concrete and the program areas chosen support them.' },
  { key: 'contribution', label: 'Strengths & contribution', guide: 'Q5: relevant skills, experiences, and what they would bring to peers.' },
  { key: 'commitment', label: 'Commitment', guide: 'Q6 and acknowledgment: willingness to take on assigned activities.' },
  { key: 'supervisorSupport', label: 'Supervisor support', guide: 'Supervisor endorsement and any comments.' },
] as const;
export type RubricKey = (typeof RUBRIC)[number]['key'];
export const RUBRIC_KEYS = RUBRIC.map((r) => r.key) as [RubricKey, ...RubricKey[]];
export const RUBRIC_MAX = RUBRIC.length * 5;
