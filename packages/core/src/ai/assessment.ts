import { z } from 'zod';
import { prisma } from '@erp/db';
import { INTEREST_AREAS, QUESTIONS, RUBRIC, RUBRIC_KEYS, interestLabel, reasonLabel } from '@erp/shared';
import { assertStaff, type Actor } from '../actor';
import { config } from '../config';
import { AppError, notFound } from '../errors';
import { audit } from '../audit';
import { chat } from './ollama';

const rotationLabels: string[] = INTEREST_AREAS.filter((a) => a.value !== 'OTHER').map((a) => a.label);

/** JSON schema handed to Ollama's structured-output `format`. */
const FORMAT = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    scores: {
      type: 'object',
      properties: Object.fromEntries(RUBRIC_KEYS.map((k) => [k, { type: 'integer', minimum: 1, maximum: 5 }])),
      required: RUBRIC_KEYS,
    },
    strengths: { type: 'array', items: { type: 'string' } },
    concerns: { type: 'array', items: { type: 'string' } },
    suggestedRotations: { type: 'array', items: { type: 'string', enum: rotationLabels } },
  },
  required: ['summary', 'scores', 'strengths', 'concerns', 'suggestedRotations'],
};

const clamp = (n: unknown) => Math.min(5, Math.max(1, Math.round(Number(n) || 1)));
const resultSchema = z.object({
  summary: z.string().default(''),
  scores: z.record(z.unknown()).transform((s) => Object.fromEntries(RUBRIC_KEYS.map((k) => [k, clamp(s[k])]))),
  strengths: z.array(z.string()).default([]),
  concerns: z.array(z.string()).default([]),
  suggestedRotations: z.array(z.string()).default([]),
});

/**
 * Advisory AI read of one application against the rubric.
 * Name, email, and phone are withheld from the model to reduce bias.
 */
export async function generateAssessment(actor: Actor, applicationId: string) {
  assertStaff(actor);
  const app = await prisma.application.findUnique({ where: { id: applicationId }, include: { supervisorReview: true } });
  if (!app) throw notFound('Application');
  if (app.status === 'DRAFT') throw new AppError(409, 'Draft applications cannot be assessed.');

  const rubric = RUBRIC.map((r) => `- ${r.key} (${r.label}): ${r.guide}`).join('\n');
  const reasons = app.reasons.map(reasonLabel).join('; ') + (app.reasonOther ? `; Other: ${app.reasonOther}` : '');
  const areas = app.interestAreas.map(interestLabel).join('; ') + (app.interestOther ? `; Other: ${app.interestOther}` : '');
  const sup = app.supervisorReview
    ? `${app.supervisorReview.decision}${app.supervisorReview.comment ? ` — "${app.supervisorReview.comment}"` : ''}`
    : 'Not yet signed off';

  const prompt = `Assess this Employee Residency Program application (applicant identity withheld).

Current role: ${app.jobTitle} — ${app.department}
Length of employment: ${app.lengthOfEmployment}

${QUESTIONS.reasons}
${reasons}

${QUESTIONS.hopeToGain}
${app.hopeToGain}

${QUESTIONS.interestAreas}
${areas}

${QUESTIONS.goals}
${app.goals}

${QUESTIONS.strengths}
${app.strengths}

${QUESTIONS.willingToParticipate}
${app.willingToParticipate ? 'Yes' : 'No'}

Supervisor sign-off: ${sup}

RUBRIC (score each 1–5; 3 = solid, 5 = exceptional; judge substance, not polish or writing skill):
${rubric}

Return JSON with: a neutral 2–3 sentence summary; integer scores per rubric key; 2–4 strengths; 0–3 concerns or follow-up questions for the interviewer; and 1–3 suggestedRotations chosen from: ${rotationLabels.join(' | ')}.`;

  const reply = await chat({
    messages: [
      {
        role: 'system',
        content:
          'You are a fair, careful HR program assistant. You give advisory assessments only; humans make all decisions. Do not consider or infer age, race, gender, religion, disability, or other protected characteristics. Respond only with JSON matching the schema.',
      },
      { role: 'user', content: prompt },
    ],
    format: FORMAT,
    temperature: 0.1,
  });

  let parsed: z.infer<typeof resultSchema>;
  try {
    parsed = resultSchema.parse(JSON.parse(reply.content));
  } catch {
    throw new AppError(502, 'The AI model returned an unreadable assessment. Please try again.');
  }
  const total = Object.values(parsed.scores).reduce((s, n) => s + n, 0);

  const assessment = await prisma.aiAssessment.create({
    data: {
      applicationId,
      model: config.ollama.agentModel,
      summary: parsed.summary,
      scores: parsed.scores,
      total,
      strengths: parsed.strengths.slice(0, 6),
      concerns: parsed.concerns.slice(0, 6),
      suggestedRotations: parsed.suggestedRotations.filter((r) => rotationLabels.includes(r)).slice(0, 3),
    },
  });
  await audit(actor, 'ai.assessment', 'Application', applicationId, { total });
  return assessment;
}
