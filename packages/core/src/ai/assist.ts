import { QUESTIONS, type AssistInput } from '@erp/shared';
import { config } from '../config';
import { chat } from './ollama';

const MODES = {
  improve:
    'Rewrite the draft so it is clear, specific, and professional, in the applicant’s own first-person voice. Keep every fact they gave; do NOT invent experiences, numbers, titles, or achievements. Keep it under 180 words. Return only the rewritten answer.',
  feedback:
    'Give 3–5 short, encouraging, specific suggestions (as a bulleted list) to make the answer stronger. Point out where a concrete example would help. Do not rewrite the answer.',
  brainstorm:
    'The applicant is stuck. Ask 4–5 thoughtful reflective questions (bulleted) that will help them write their own answer, tailored to their role. Do not write the answer for them.',
} as const;

/** Writing help for open-ended questions Q2, Q4, Q5. Uses the fast model. */
export async function assistAnswer(input: AssistInput, profile: { jobTitle?: string; department?: string }) {
  const system = `You are a supportive writing coach helping a Delta Health Center employee complete their Employee Residency Program application. The program offers professional development, mentorship, exposure to departments (Executive Leadership, HR, Clinical Operations, Finance/Compliance/Administration, Community Engagement, Leadership & Management), and career growth. Participation does not guarantee promotion. Be warm, plain-spoken, and honest. Never fabricate anything about the applicant.`;
  const user = `Question: ${QUESTIONS[input.question]}
Applicant role: ${profile.jobTitle || 'not given'}${profile.department ? `, ${profile.department}` : ''}

Current draft:
"""
${input.draft.trim() || '(empty)'}
"""

Task: ${MODES[input.mode]}`;

  const reply = await chat({
    model: config.ollama.fastModel,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: input.mode === 'improve' ? 0.4 : 0.6,
  });
  return reply.content;
}
