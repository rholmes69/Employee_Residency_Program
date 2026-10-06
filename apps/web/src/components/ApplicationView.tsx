import { QUESTIONS, interestLabel, reasonLabel } from '@erp/shared';
import type { Application } from '../lib/types';
import { Card, Tag, fmtDate } from './ui';

/** Read-only rendering of an application's answers. */
export function ApplicationView({ app }: { app: Application }) {
  const info: [string, string][] = [
    ['Current Job Title', app.jobTitle],
    ['Department/Clinic', app.department],
    ['Immediate Supervisor', `${app.supervisorName} (${app.supervisorEmail})`],
    ['Length of Employment', app.lengthOfEmployment],
    ['Email', app.email],
    ['Phone', app.phone],
  ];
  const qa = (q: string, a: string) => (
    <div>
      <p className="text-sm font-semibold text-slate-800">{q}</p>
      <p className="mt-1 text-sm whitespace-pre-wrap text-slate-700">{a || '—'}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card title="Employee Information">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          {info.map(([k, v]) => (
            <div key={k}>
              <dt className="text-slate-500">{k}</dt>
              <dd className="font-medium text-slate-800">{v || '—'}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card title="Professional Growth & Interests">
        <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold text-slate-800">{QUESTIONS.reasons}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {app.reasons.map((r) => (
                <Tag key={r}>{r === 'OTHER' ? `Other: ${app.reasonOther}` : reasonLabel(r)}</Tag>
              ))}
            </div>
          </div>
          {qa(QUESTIONS.hopeToGain, app.hopeToGain)}
          <div>
            <p className="text-sm font-semibold text-slate-800">{QUESTIONS.interestAreas}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {app.interestAreas.map((a) => (
                <Tag key={a}>{a === 'OTHER' ? `Other: ${app.interestOther}` : interestLabel(a)}</Tag>
              ))}
            </div>
          </div>
          {qa(QUESTIONS.goals, app.goals)}
          {qa(QUESTIONS.strengths, app.strengths)}
          {qa(QUESTIONS.willingToParticipate, app.willingToParticipate == null ? '—' : app.willingToParticipate ? 'Yes' : 'No')}
        </div>
      </Card>
      <Card title="Employee Acknowledgment">
        <p className="text-sm text-slate-700">
          Signed by <span className="font-serif text-base italic">{app.signatureName ?? '—'}</span> on {fmtDate(app.signedAt)}
        </p>
      </Card>
    </div>
  );
}
