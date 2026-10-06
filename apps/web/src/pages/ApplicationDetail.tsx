import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DECISION_STATUSES, RUBRIC, RUBRIC_MAX, STATUS_LABELS } from '@erp/shared';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import type { ApplicationDetail as Detail } from '../lib/types';
import { ApplicationView } from '../components/ApplicationView';
import { Alert, Button, Card, PageLoader, StatusBadge, Tag, fmtDate } from '../components/ui';

export default function ApplicationDetail() {
  const { id } = useParams();
  const { data: app, error, loading, reload } = useApi<Detail>(`/applications/${id}`);

  if (loading && !app) return <PageLoader />;
  if (error || !app) return <Alert>{error ?? 'Not found'}</Alert>;
  const staff = app.viewerRelation === 'staff';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to={staff ? '/review' : '/supervisor'} className="text-sm text-brand-700 hover:underline">
            ← Back
          </Link>
          <h1 className="mt-1 font-serif text-2xl font-bold text-brand-700">{app.fullName}</h1>
          <p className="text-sm text-slate-600">
            {app.jobTitle} · {app.department} · Submitted {fmtDate(app.submittedAt)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={app.status} />
          <a href={`/api/applications/${app.id}/pdf`} target="_blank" rel="noreferrer">
            <Button variant="secondary">PDF</Button>
          </a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ApplicationView app={app} />
        </div>
        <div className="space-y-6 lg:col-span-2">
          {app.viewerRelation === 'supervisor' && <SupervisorPanel app={app} onDone={reload} />}
          {staff && (
            <>
              <SupervisorSummary app={app} />
              <DecisionPanel app={app} onDone={reload} />
              <AiPanel app={app} onDone={reload} />
              <MentorPanel app={app} onDone={reload} />
              <ReviewsPanel app={app} onDone={reload} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function useAction(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function SupervisorPanel({ app, onDone }: { app: Detail; onDone: () => void }) {
  const [comment, setComment] = useState('');
  const { busy, error, run } = useAction(onDone);
  if (app.supervisorReview)
    return (
      <Card title="Your sign-off">
        <p className="text-sm">
          You <strong>{app.supervisorReview.decision === 'APPROVED' ? 'approved' : 'declined'}</strong> this application on {fmtDate(app.supervisorReview.decidedAt)}.
        </p>
        {app.supervisorReview.comment && <p className="mt-2 text-sm text-slate-600">“{app.supervisorReview.comment}”</p>}
      </Card>
    );
  if (app.status !== 'PENDING_SUPERVISOR') return <Card title="Your sign-off"><p className="text-sm text-slate-600">No action needed.</p></Card>;

  const decide = (decision: 'APPROVED' | 'DECLINED') =>
    run(() => api.post(`/applications/${app.id}/supervisor-decision`, { decision, comment: comment || undefined }));
  return (
    <Card title="Supervisor sign-off">
      <p className="text-sm text-slate-600">
        {app.fullName} listed you as their immediate supervisor. Approving sends the application to HR for review.
      </p>
      <textarea className="input mt-3 min-h-24" placeholder="Optional comment (shared with the employee and HR)" value={comment} onChange={(e) => setComment(e.target.value)} />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button loading={busy} onClick={() => decide('APPROVED')}>
          Approve
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => decide('DECLINED')}>
          Decline
        </Button>
      </div>
    </Card>
  );
}

function SupervisorSummary({ app }: { app: Detail }) {
  return (
    <Card title="Supervisor sign-off">
      {app.supervisorReview ? (
        <p className="text-sm">
          <strong>{app.supervisorName}</strong> {app.supervisorReview.decision === 'APPROVED' ? '✅ approved' : '❌ declined'} on {fmtDate(app.supervisorReview.decidedAt)}
          {app.supervisorReview.comment && <span className="mt-1 block text-slate-600">“{app.supervisorReview.comment}”</span>}
        </p>
      ) : (
        <p className="text-sm text-slate-600">Waiting on {app.supervisorName}.</p>
      )}
    </Card>
  );
}

function DecisionPanel({ app, onDone }: { app: Detail; onDone: () => void }) {
  const [status, setStatus] = useState<string>(app.status);
  const [note, setNote] = useState(app.decisionNote ?? '');
  const { busy, error, run } = useAction(onDone);
  const canDecide = (DECISION_STATUSES as readonly string[]).includes(app.status);
  return (
    <Card title="Decision">
      {!canDecide ? (
        <p className="text-sm text-slate-600">Decisions are available after supervisor sign-off.</p>
      ) : (
        <div className="space-y-3">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {DECISION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <textarea className="input min-h-20" placeholder="Note to applicant (emailed with final decisions)" value={note} onChange={(e) => setNote(e.target.value)} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button loading={busy} disabled={status === app.status && note === (app.decisionNote ?? '')} onClick={() => run(() => api.post(`/applications/${app.id}/decision`, { status, note: note || undefined }))}>
            Save decision
          </Button>
        </div>
      )}
    </Card>
  );
}

function AiPanel({ app, onDone }: { app: Detail; onDone: () => void }) {
  const { busy, error, run } = useAction(onDone);
  const a = app.aiAssessments?.[0];
  return (
    <Card
      title="AI first read"
      actions={
        <Button variant="secondary" className="px-3 py-1 text-xs" loading={busy} onClick={() => run(() => api.post(`/applications/${app.id}/ai-assessment`))}>
          {a ? 'Re-run' : 'Generate'}
        </Button>
      }
    >
      <p className="mb-3 text-xs text-amber-700">Advisory only, from a local model. Identity is withheld from the model. Humans decide.</p>
      {busy && <p className="text-sm text-slate-500">Assessing… this can take 1–3 minutes on CPU.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {a ? (
        <div className="space-y-3 text-sm">
          <p className="text-slate-700">{a.summary}</p>
          <div className="space-y-1">
            {RUBRIC.map((r) => (
              <div key={r.key} className="flex items-center gap-2">
                <span className="w-44 shrink-0 text-xs text-slate-600">{r.label}</span>
                <div className="h-2 flex-1 rounded bg-slate-100">
                  <div className="h-2 rounded bg-brand-600" style={{ width: `${((a.scores[r.key] ?? 0) / 5) * 100}%` }} />
                </div>
                <span className="w-4 text-right text-xs font-semibold">{a.scores[r.key]}</span>
              </div>
            ))}
            <p className="pt-1 text-right text-xs font-semibold">
              Total {a.total}/{RUBRIC_MAX}
            </p>
          </div>
          {a.strengths.length > 0 && (
            <div>
              <p className="font-semibold text-green-800">Strengths</p>
              <ul className="list-disc pl-5 text-slate-700">{a.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
          )}
          {a.concerns.length > 0 && (
            <div>
              <p className="font-semibold text-amber-800">Follow-up questions</p>
              <ul className="list-disc pl-5 text-slate-700">{a.concerns.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
          )}
          {a.suggestedRotations.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-slate-500">Suggested rotations:</span>
              {a.suggestedRotations.map((r) => <Tag key={r}>{r}</Tag>)}
            </div>
          )}
          <p className="text-xs text-slate-400">
            {a.model} · {fmtDate(a.createdAt, true)}
          </p>
        </div>
      ) : (
        !busy && <p className="text-sm text-slate-500">No AI assessment yet.</p>
      )}
    </Card>
  );
}

function MentorPanel({ app, onDone }: { app: Detail; onDone: () => void }) {
  const { busy, error, run } = useAction(onDone);
  const visible = app.mentorMatches.filter((m) => m.status !== 'DISMISSED');
  return (
    <Card
      title="Mentor matches"
      actions={
        <Button variant="secondary" className="px-3 py-1 text-xs" loading={busy} onClick={() => run(() => api.post(`/applications/${app.id}/mentor-matches`))}>
          Suggest
        </Button>
      }
    >
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {visible.length ? (
        <div className="space-y-3">
          {visible.map((m) => (
            <div key={m.id} className="rounded-lg border border-slate-200 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{m.mentor.name}</p>
                  <p className="text-xs text-slate-500">
                    {m.mentor.title} · match {(m.score * 100).toFixed(0)}
                  </p>
                </div>
                {m.status === 'ASSIGNED' ? (
                  <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Assigned</span>
                ) : null}
              </div>
              <p className="mt-1 text-slate-700">{m.rationale}</p>
              <div className="mt-2 flex gap-2">
                {m.status !== 'ASSIGNED' ? (
                  <>
                    <Button className="px-2 py-1 text-xs" disabled={busy} onClick={() => run(() => api.patch(`/mentor-matches/${m.id}`, { status: 'ASSIGNED' }))}>
                      Assign
                    </Button>
                    <Button variant="ghost" className="px-2 py-1 text-xs" disabled={busy} onClick={() => run(() => api.patch(`/mentor-matches/${m.id}`, { status: 'DISMISSED' }))}>
                      Dismiss
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" className="px-2 py-1 text-xs" disabled={busy} onClick={() => run(() => api.patch(`/mentor-matches/${m.id}`, { status: 'SUGGESTED' }))}>
                    Unassign
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No suggestions yet. Click Suggest.</p>
      )}
    </Card>
  );
}

function ReviewsPanel({ app, onDone }: { app: Detail; onDone: () => void }) {
  const [scores, setScores] = useState<Record<string, number>>(Object.fromEntries(RUBRIC.map((r) => [r.key, 3])));
  const [recommendation, setRec] = useState('ACCEPT');
  const [notes, setNotes] = useState('');
  const { busy, error, run } = useAction(() => {
    setNotes('');
    onDone();
  });
  const total = Object.values(scores).reduce((s, n) => s + n, 0);

  return (
    <Card title={`Reviewer scores (${app.reviews?.length ?? 0})`}>
      <div className="space-y-3">
        {app.reviews?.map((r) => (
          <div key={r.id} className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="font-semibold">{r.reviewer.name}</span>
              <span>
                {r.total}/{RUBRIC_MAX} · <Tag>{r.recommendation}</Tag>
              </span>
            </div>
            {r.notes && <p className="mt-1 text-slate-600">{r.notes}</p>}
            <p className="mt-1 text-xs text-slate-400">{fmtDate(r.createdAt, true)}</p>
          </div>
        ))}
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <p className="text-sm font-semibold">Add your review</p>
          {RUBRIC.map((r) => (
            <div key={r.key} className="flex items-center justify-between gap-2" title={r.guide}>
              <span className="text-xs text-slate-600">{r.label}</span>
              <select className="input w-16 py-1" value={scores[r.key]} onChange={(e) => setScores({ ...scores, [r.key]: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold">
              Total {total}/{RUBRIC_MAX}
            </span>
            <select className="input w-36 py-1" value={recommendation} onChange={(e) => setRec(e.target.value)}>
              <option value="ACCEPT">Accept</option>
              <option value="WAITLIST">Waitlist</option>
              <option value="DECLINE">Decline</option>
            </select>
          </div>
          <textarea className="input min-h-16" placeholder="Notes (internal)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button loading={busy} onClick={() => run(() => api.post(`/applications/${app.id}/reviews`, { scores, recommendation, notes: notes || undefined }))}>
            Save review
          </Button>
        </div>
      </div>
    </Card>
  );
}
