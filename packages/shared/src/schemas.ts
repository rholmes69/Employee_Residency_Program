import { z } from 'zod';
import { DECISION_STATUSES, INTEREST_AREA_VALUES, REASON_VALUES, ROLES, RUBRIC_KEYS } from './constants';

const shortText = z.string().trim().max(200);
const longText = z.string().trim().max(4000);
const phoneRegex = /^[0-9+().\-\s]{7,25}$/;

/** Partial save while the applicant is still filling the form (autosave). */
export const applicationDraftSchema = z
  .object({
    fullName: shortText,
    jobTitle: shortText,
    department: shortText,
    supervisorName: shortText,
    // Emails are only format-checked at submit — autosave must accept half-typed values.
    supervisorEmail: shortText.toLowerCase(),
    lengthOfEmployment: shortText,
    email: shortText.toLowerCase(),
    phone: shortText,
    reasons: z.array(z.enum(REASON_VALUES)).max(REASON_VALUES.length),
    reasonOther: shortText.nullable(),
    hopeToGain: longText,
    interestAreas: z.array(z.enum(INTEREST_AREA_VALUES)).max(INTEREST_AREA_VALUES.length),
    interestOther: shortText.nullable(),
    goals: longText,
    strengths: longText,
    willingToParticipate: z.boolean().nullable(),
    acknowledged: z.boolean(),
    signatureName: shortText.nullable(),
  })
  .partial();
export type ApplicationDraft = z.infer<typeof applicationDraftSchema>;

const answer = (label: string) =>
  z.string().trim().min(20, `${label}: please write at least a couple of sentences (20+ characters).`).max(4000);

/** Everything required on the paper form, enforced at submission time. */
export const applicationSubmitSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Name is required'),
    jobTitle: z.string().trim().min(2, 'Current job title is required'),
    department: z.string().trim().min(2, 'Department/Clinic is required'),
    supervisorName: z.string().trim().min(2, 'Immediate supervisor is required'),
    supervisorEmail: z.string().trim().toLowerCase().email('Supervisor email is required for sign-off'),
    lengthOfEmployment: z.string().trim().min(1, 'Length of employment is required'),
    email: z.string().trim().toLowerCase().email('A valid email is required'),
    phone: z.string().trim().regex(phoneRegex, 'A valid phone number is required'),
    reasons: z.array(z.enum(REASON_VALUES)).min(1, 'Select at least one reason (Question 1)'),
    reasonOther: z.string().trim().nullish(),
    hopeToGain: answer('Question 2'),
    interestAreas: z.array(z.enum(INTEREST_AREA_VALUES)).min(1, 'Select at least one area (Question 3)'),
    interestOther: z.string().trim().nullish(),
    goals: answer('Question 4'),
    strengths: answer('Question 5'),
    willingToParticipate: z.boolean({ required_error: 'Answer Question 6', invalid_type_error: 'Answer Question 6' }),
    acknowledged: z.literal(true, { errorMap: () => ({ message: 'You must accept the Employee Acknowledgment' }) }),
    signatureName: z
      .string({ required_error: 'Type your full name to sign', invalid_type_error: 'Type your full name to sign' })
      .trim()
      .min(2, 'Type your full name to sign'),
  })
  .superRefine((v, ctx) => {
    if (v.reasons.includes('OTHER') && !v.reasonOther)
      ctx.addIssue({ code: 'custom', path: ['reasonOther'], message: 'Describe your "Other" reason (Question 1)' });
    if (v.interestAreas.includes('OTHER') && !v.interestOther)
      ctx.addIssue({ code: 'custom', path: ['interestOther'], message: 'Describe your "Other" area (Question 3)' });
    if (v.signatureName.toLowerCase().replace(/\s+/g, ' ') !== v.fullName.toLowerCase().replace(/\s+/g, ' '))
      ctx.addIssue({ code: 'custom', path: ['signatureName'], message: 'Typed signature must match your name exactly' });
    if (v.supervisorEmail === v.email)
      ctx.addIssue({ code: 'custom', path: ['supervisorEmail'], message: 'Supervisor email must be different from your own' });
  });
export type ApplicationSubmit = z.infer<typeof applicationSubmitSchema>;

export const supervisorDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'DECLINED']),
  comment: z.string().trim().max(2000).optional(),
});

export const scoresSchema = z.object(
  Object.fromEntries(RUBRIC_KEYS.map((k) => [k, z.number().int().min(1).max(5)])) as Record<
    (typeof RUBRIC_KEYS)[number],
    z.ZodNumber
  >,
);
export type Scores = z.infer<typeof scoresSchema>;

export const reviewSchema = z.object({
  scores: scoresSchema,
  recommendation: z.enum(['ACCEPT', 'WAITLIST', 'DECLINE']),
  notes: z.string().trim().max(4000).optional(),
});

export const decisionSchema = z.object({
  status: z.enum(DECISION_STATUSES),
  note: z.string().trim().max(2000).optional(),
});

export const applicationFilterSchema = z.object({
  status: z.string().optional(),
  department: z.string().optional(),
  interestArea: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});
export type ApplicationFilter = z.infer<typeof applicationFilterSchema>;

export const mentorSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  title: z.string().trim().max(160).default(''),
  department: z.string().trim().max(160).default(''),
  expertiseAreas: z.array(z.enum(INTEREST_AREA_VALUES)).default([]),
  bio: z.string().trim().max(2000).default(''),
  capacity: z.number().int().min(0).max(20).default(2),
  active: z.boolean().default(true),
});
export type MentorInput = z.infer<typeof mentorSchema>;

export const cycleSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4000).optional(),
  opensAt: z.coerce.date(),
  deadline: z.coerce.date(),
  hrContactName: z.string().trim().min(2).max(160),
  hrContactEmail: z.string().trim().toLowerCase().email(),
  isActive: z.boolean().default(true),
});

export const roleUpdateSchema = z.object({ role: z.enum(ROLES) });

export const ASSIST_QUESTIONS = ['hopeToGain', 'goals', 'strengths'] as const;
export const assistSchema = z.object({
  question: z.enum(ASSIST_QUESTIONS),
  draft: z.string().max(4000).default(''),
  mode: z.enum(['improve', 'feedback', 'brainstorm']).default('feedback'),
});
export type AssistInput = z.infer<typeof assistSchema>;

export const chatSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().trim().min(1).max(4000),
});

export const memorySchema = z.object({
  content: z.string().trim().min(3).max(1000),
  scope: z.enum(['USER', 'GLOBAL']).default('USER'),
});

export const devLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().max(120).optional(),
  role: z.enum(ROLES).optional(),
});
