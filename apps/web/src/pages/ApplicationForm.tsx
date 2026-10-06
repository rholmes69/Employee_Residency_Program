import { useEffect, useRef, useState } from 'react';
import {
  ACKNOWLEDGMENT,
  EMPLOYMENT_LENGTHS,
  INTEREST_AREAS,
  LOCATIONS,
  QUESTIONS,
  REASONS,
  type ApplicationDraft,
} from '@erp/shared';
import { api, ApiError } from '../lib/api';
import { useApi } from '../lib/useApi';
import type { Application } from '../lib/types';
import { AssistPanel } from '../components/AssistPanel';
import { Alert, Button, Card, Field, PageLoader, StatusBadge, fmtDate } from '../components/ui';

type Form = Required<{ [K in keyof ApplicationDraft]: NonNullable<ApplicationDraft[K]> | null }>;
type Errors = Record<string, string[] | undefined>;

const pick = (a: Application): Form => ({
  fullName: a.fullName,
  jobTitle: a.jobTitle,
  department: a.department,
  supervisorName: a.supervisorName,
  supervisorEmail: a.supervisorEmail,
  lengthOfEmployment: a.lengthOfEmployment,
  email: a.email,
  phone: a.phone,
  reasons: a.reasons as Form['reasons'],
  reasonOther: a.reasonOther,
  hopeToGain: a.hopeToGain,
  interestAreas: a.interestAreas as Form['interestAreas'],
  interestOther: a.interestOther,
  goals: a.goals,
  strengths: a.strengths,
  willingToParticipate: a.willingToParticipate,
  acknowledged: a.acknowledged,
  signatureName: a.signatureName,
});

export default function ApplicationForm() {
  const { data: app, error, loading, setData } = useApi<Application>('/me/application');
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    if (app && !form) setForm(pick(app));
  }, [app, form]);

  const editable = !!app && ['DRAFT', 'SUPERVISOR_DECLINED'].includes(app.status);
  const open = !!app?.cycle && new Date() <= new Date(app.cycle.deadline);

  // Debounced autosave
  useEffect(() => {
    if (!form || !editable || !dirty.current) return;
    setSaveState('saving');
    const t = setTimeout(async () => {
      try {
        await api.put('/me/application', form);
        dirty.current = false;
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [form, editable]);

  if (loading) return <PageLoader />;
  if (error || !app) return <Alert>{error ?? 'Could not load your application.'}</Alert>;
  if (!form) return <PageLoader />;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    dirty.current = true;
    setForm((f) => (f ? { ...f, [k]: v } : f));
  };
  const toggle = (k: 'reasons' | 'interestAreas', v: string) => {
    const cur = (form[k] ?? []) as string[];
    set(k, (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]) as Form[typeof k]);
  };
  const err = (k: string) => errors[k]?.[0];

  const submit = async () => {
    setSubmitting(true);
    setBanner(null);
    setErrors({});
    try {
      await api.put('/me/application', form); // flush latest edits
      dirty.current = false;
      const updated = await api.post<Application>('/me/application/submit');
      setData(updated);
      setBanner({ kind: 'success', text: 'Application submitted! Your supervisor has been asked to sign off.' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      if (e instanceof ApiError && e.details) setErrors(e.details);
      setBanner({ kind: 'error', text: (e as Error).message });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  const withdraw = async () => {
    if (!window.confirm('Withdraw your application? This cannot be undone.')) return;
    try {
      setData(await api.post<Application>('/me/application/withdraw'));
    } catch (e) {
      setBanner({ kind: 'error', text: (e as Error).message });
    }
  };

  const ro = !editable || !open;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-brand-700">Employee Residency Program Application</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            The Employee Residency Program is designed to provide Delta Health Center employees with opportunities for professional development,
            mentorship, organizational exposure, leadership development, and career advancement.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={app.status} />
          {editable && (
            <span className="text-xs text-slate-500">
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'All changes saved' : saveState === 'error' ? '⚠ Not saved' : ''}
            </span>
          )}
        </div>
      </div>

      {banner && <Alert kind={banner.kind}>{banner.text}</Alert>}
      {app.cycle && editable && (
        <Alert kind={open ? 'info' : 'warn'}>
          {open ? (
            <>
              Applications are due <strong>{fmtDate(app.cycle.deadline, true)} CT</strong>. Your progress saves automatically.
            </>
          ) : (
            <>The application deadline has passed. Contact {app.cycle.hrContactName} ({app.cycle.hrContactEmail}).</>
          )}
        </Alert>
      )}
      {app.status === 'SUPERVISOR_DECLINED' && app.supervisorReview && (
        <Alert kind="warn">
          Your supervisor declined this application{app.supervisorReview.comment ? `: “${app.supervisorReview.comment}”` : '.'} You can talk with them, update
          your answers, and resubmit before the deadline.
        </Alert>
      )}
      {!editable && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="space-y-1">
              <p>
                Submitted <strong>{fmtDate(app.submittedAt, true)}</strong>
              </p>
              {app.supervisorReview && (
                <p>
                  Supervisor {app.supervisorReview.decision === 'APPROVED' ? 'approved' : 'declined'} on {fmtDate(app.supervisorReview.decidedAt)}
                  {app.supervisorReview.comment && <> · “{app.supervisorReview.comment}”</>}
                </p>
              )}
              {app.decisionNote && <p className="text-slate-700">Note from HR: {app.decisionNote}</p>}
            </div>
            <div className="flex gap-2">
              <a href={`/api/applications/${app.id}/pdf`} target="_blank" rel="noreferrer">
                <Button variant="secondary">Download PDF</Button>
              </a>
              {['PENDING_SUPERVISOR', 'UNDER_REVIEW', 'WAITLISTED'].includes(app.status) && (
                <Button variant="danger" onClick={withdraw}>
                  Withdraw
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      <fieldset disabled={ro} className="space-y-6">
        <Card title="Employee Information">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" error={err('fullName')}>
              <input className="input" value={form.fullName ?? ''} onChange={(e) => set('fullName', e.target.value)} />
            </Field>
            <Field label="Current Job Title" error={err('jobTitle')}>
              <input className="input" value={form.jobTitle ?? ''} onChange={(e) => set('jobTitle', e.target.value)} />
            </Field>
            <Field label="Department/Clinic" error={err('department')}>
              <input className="input" list="locations" value={form.department ?? ''} onChange={(e) => set('department', e.target.value)} />
              <datalist id="locations">
                {LOCATIONS.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </Field>
            <Field label="Length of Employment with Delta Health Center" error={err('lengthOfEmployment')}>
              <select className="input" value={form.lengthOfEmployment ?? ''} onChange={(e) => set('lengthOfEmployment', e.target.value)}>
                <option value="">Select…</option>
                {EMPLOYMENT_LENGTHS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Immediate Supervisor" error={err('supervisorName')}>
              <input className="input" value={form.supervisorName ?? ''} onChange={(e) => set('supervisorName', e.target.value)} />
            </Field>
            <Field label="Supervisor’s Email" error={err('supervisorEmail')} hint="Your supervisor will get an email asking them to sign off.">
              <input className="input" type="email" value={form.supervisorEmail ?? ''} onChange={(e) => set('supervisorEmail', e.target.value)} />
            </Field>
            <Field label="Email" error={err('email')}>
              <input className="input" type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label="Phone" error={err('phone')}>
              <input className="input" type="tel" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card title="Professional Growth & Interests">
          <div className="space-y-8">
            <div>
              <p className="label">
                {QUESTIONS.reasons} <span className="font-normal text-slate-500">Please select all that apply.</span>
              </p>
              <div className="mt-2 space-y-2">
                {REASONS.map((r) => (
                  <label key={r.value} className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-700" checked={form.reasons?.includes(r.value) ?? false} onChange={() => toggle('reasons', r.value)} />
                    {r.label}
                  </label>
                ))}
                {form.reasons?.includes('OTHER') && (
                  <input className="input mt-1" placeholder="Other reason" value={form.reasonOther ?? ''} onChange={(e) => set('reasonOther', e.target.value)} />
                )}
              </div>
              {(err('reasons') || err('reasonOther')) && <p className="mt-1 text-xs font-medium text-red-600">{err('reasons') ?? err('reasonOther')}</p>}
            </div>

            <Field label={QUESTIONS.hopeToGain} error={err('hopeToGain')}>
              <textarea className="input min-h-28" value={form.hopeToGain ?? ''} onChange={(e) => set('hopeToGain', e.target.value)} />
              {!ro && <AssistPanel question="hopeToGain" draft={form.hopeToGain ?? ''} onUse={(t) => set('hopeToGain', t)} />}
            </Field>

            <div>
              <p className="label">
                {QUESTIONS.interestAreas} <span className="font-normal text-slate-500">Please select all that apply.</span>
              </p>
              <div className="mt-2 space-y-2">
                {INTEREST_AREAS.map((a) => (
                  <label key={a.value} className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-700" checked={form.interestAreas?.includes(a.value) ?? false} onChange={() => toggle('interestAreas', a.value)} />
                    {a.label}
                  </label>
                ))}
                {form.interestAreas?.includes('OTHER') && (
                  <input className="input mt-1" placeholder="Other area" value={form.interestOther ?? ''} onChange={(e) => set('interestOther', e.target.value)} />
                )}
              </div>
              {(err('interestAreas') || err('interestOther')) && <p className="mt-1 text-xs font-medium text-red-600">{err('interestAreas') ?? err('interestOther')}</p>}
            </div>

            <Field label={QUESTIONS.goals} error={err('goals')}>
              <textarea className="input min-h-28" value={form.goals ?? ''} onChange={(e) => set('goals', e.target.value)} />
              {!ro && <AssistPanel question="goals" draft={form.goals ?? ''} onUse={(t) => set('goals', t)} />}
            </Field>

            <Field label={QUESTIONS.strengths} error={err('strengths')}>
              <textarea className="input min-h-28" value={form.strengths ?? ''} onChange={(e) => set('strengths', e.target.value)} />
              {!ro && <AssistPanel question="strengths" draft={form.strengths ?? ''} onUse={(t) => set('strengths', t)} />}
            </Field>

            <div>
              <p className="label">{QUESTIONS.willingToParticipate}</p>
              <div className="mt-2 flex gap-6 text-sm">
                {[true, false].map((v) => (
                  <label key={String(v)} className="flex items-center gap-2">
                    <input type="radio" name="willing" className="h-4 w-4 accent-brand-700" checked={form.willingToParticipate === v} onChange={() => set('willingToParticipate', v)} />
                    {v ? 'Yes' : 'No'}
                  </label>
                ))}
              </div>
              {err('willingToParticipate') && <p className="mt-1 text-xs font-medium text-red-600">{err('willingToParticipate')}</p>}
            </div>
          </div>
        </Card>

        <Card title="Employee Acknowledgment">
          <p className="text-sm text-slate-700">{ACKNOWLEDGMENT}</p>
          <label className="mt-4 flex items-start gap-2 text-sm font-medium">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-700" checked={!!form.acknowledged} onChange={(e) => set('acknowledged', e.target.checked)} />
            I have read and agree to the acknowledgment above.
          </label>
          {err('acknowledged') && <p className="mt-1 text-xs font-medium text-red-600">{err('acknowledged')}</p>}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Employee Signature" error={err('signatureName')} hint="Type your full name exactly as entered above.">
              <input className="input font-serif text-lg italic" value={form.signatureName ?? ''} onChange={(e) => set('signatureName', e.target.value)} />
            </Field>
            <Field label="Date">
              <input className="input" disabled value={app.signedAt ? fmtDate(app.signedAt) : fmtDate(new Date().toISOString())} />
            </Field>
          </div>
        </Card>
      </fieldset>

      {editable && open && (
        <div className="flex justify-end gap-3 pb-8">
          <Button onClick={submit} loading={submitting} className="px-8 py-3">
            {app.status === 'SUPERVISOR_DECLINED' ? 'Resubmit application' : 'Submit application'}
          </Button>
        </div>
      )}
    </div>
  );
}
