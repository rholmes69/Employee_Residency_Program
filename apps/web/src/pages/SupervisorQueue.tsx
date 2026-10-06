import { Link } from 'react-router-dom';
import type { ApplicationStatus } from '@erp/shared';
import { useApi } from '../lib/useApi';
import type { SupervisorReview } from '../lib/types';
import { Alert, Card, PageLoader, StatusBadge, fmtDate } from '../components/ui';

interface QueueItem {
  id: string;
  fullName: string;
  jobTitle: string;
  department: string;
  status: ApplicationStatus;
  submittedAt: string | null;
  supervisorReview: SupervisorReview | null;
}

export default function SupervisorQueue() {
  const { data, error, loading } = useApi<QueueItem[]>('/supervisor/queue');
  if (loading) return <PageLoader />;
  if (error) return <Alert>{error}</Alert>;
  const pending = data?.filter((d) => d.status === 'PENDING_SUPERVISOR') ?? [];
  const done = data?.filter((d) => d.status !== 'PENDING_SUPERVISOR') ?? [];

  const row = (a: QueueItem) => (
    <Link key={a.id} to={`/supervisor/${a.id}`} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4 hover:border-brand-600 hover:bg-brand-50/40">
      <div>
        <p className="font-semibold text-slate-800">{a.fullName}</p>
        <p className="text-sm text-slate-600">
          {a.jobTitle} · {a.department}
        </p>
        <p className="text-xs text-slate-500">Submitted {fmtDate(a.submittedAt)}</p>
      </div>
      <StatusBadge status={a.status} />
    </Link>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-brand-700">Supervisor Approvals</h1>
        <p className="text-sm text-slate-600">Employees who listed you as their immediate supervisor. Your sign-off sends their application to HR.</p>
      </div>
      <Card title={`Waiting on you (${pending.length})`}>
        {pending.length ? <div className="space-y-3">{pending.map(row)}</div> : <p className="text-sm text-slate-500">Nothing waiting for your sign-off. 🎉</p>}
      </Card>
      {done.length > 0 && (
        <Card title="Previously reviewed">
          <div className="space-y-3">{done.map(row)}</div>
        </Card>
      )}
    </div>
  );
}
