import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { APPLICATION_STATUSES, INTEREST_AREAS, RUBRIC_MAX, STATUS_LABELS, interestLabel } from '@erp/shared';
import { useApi } from '../lib/useApi';
import type { ApplicationRow } from '../lib/types';
import { Alert, Card, PageLoader, StatusBadge, fmtDate } from '../components/ui';

interface Stats {
  cycle: { name: string; deadline: string };
  totals: { drafts: number; submitted: number };
  byStatus: { key: string; count: number }[];
  byInterestArea: { key: string; label: string; count: number }[];
  byDepartment: { key: string; count: number }[];
}

function BarList({ items }: { items: { label: string; count: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="space-y-1.5">
      {items.slice(0, 7).map((i) => (
        <div key={i.label} className="flex items-center gap-2 text-xs">
          <span className="w-40 shrink-0 truncate text-slate-600" title={i.label}>
            {i.label}
          </span>
          <div className="h-2 flex-1 rounded bg-slate-100">
            <div className="h-2 rounded bg-brand-600" style={{ width: `${(i.count / max) * 100}%` }} />
          </div>
          <span className="w-6 text-right font-semibold">{i.count}</span>
        </div>
      ))}
      {!items.length && <p className="text-xs text-slate-400">No data yet</p>}
    </div>
  );
}

export default function ReviewList() {
  const [status, setStatus] = useState('');
  const [interestArea, setInterest] = useState('');
  const [q, setQ] = useState('');
  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (interestArea) p.set('interestArea', interestArea);
    if (q.trim()) p.set('q', q.trim());
    return p.toString();
  }, [status, interestArea, q]);

  const stats = useApi<Stats>('/stats');
  const list = useApi<ApplicationRow[]>(`/applications${query ? `?${query}` : ''}`);
  const statusCount = (k: string) => stats.data?.byStatus.find((s) => s.key === k)?.count ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-brand-700">Applications</h1>
        {stats.data && (
          <p className="text-sm text-slate-600">
            {stats.data.cycle.name} · deadline {fmtDate(stats.data.cycle.deadline, true)} CT
          </p>
        )}
      </div>

      {stats.data && (
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ['Submitted', stats.data.totals.submitted],
            ['Awaiting supervisor', statusCount('PENDING_SUPERVISOR')],
            ['Ready for HR review', statusCount('UNDER_REVIEW')],
            ['Accepted', statusCount('ACCEPTED')],
          ].map(([label, n]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase">{label}</p>
              <p className="mt-1 text-3xl font-bold text-brand-700">{n}</p>
            </div>
          ))}
        </div>
      )}
      {stats.data && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Interest areas">
            <BarList items={stats.data.byInterestArea} />
          </Card>
          <Card title="Departments / clinics">
            <BarList items={stats.data.byDepartment.map((d) => ({ label: d.key, count: d.count }))} />
          </Card>
        </div>
      )}

      <Card>
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <input className="input" placeholder="Search name, email, title…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All submitted</option>
            <option value="ALL">Everything (incl. drafts)</option>
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select className="input" value={interestArea} onChange={(e) => setInterest(e.target.value)}>
            <option value="">Any interest area</option>
            {INTEREST_AREAS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        {list.loading ? (
          <PageLoader />
        ) : list.error ? (
          <Alert>{list.error}</Alert>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="py-2 pr-4">Applicant</th>
                  <th className="py-2 pr-4">Department</th>
                  <th className="py-2 pr-4">Interests</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">AI</th>
                  <th className="py-2 pr-4">Reviews</th>
                  <th className="py-2">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {list.data?.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 pr-4">
                      <Link to={`/review/${a.id}`} className="font-semibold text-brand-700 hover:underline">
                        {a.fullName || '(no name)'}
                      </Link>
                      <div className="text-xs text-slate-500">{a.jobTitle}</div>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-700">{a.department}</td>
                    <td className="max-w-56 py-2.5 pr-4 text-xs text-slate-600">{a.interestAreas.map(interestLabel).join(', ')}</td>
                    <td className="py-2.5 pr-4">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="py-2.5 pr-4">{a.aiScore != null ? `${a.aiScore}/${RUBRIC_MAX}` : '—'}</td>
                    <td className="py-2.5 pr-4">{a.reviewCount ? `${a.avgReviewScore} avg (${a.reviewCount})` : '—'}</td>
                    <td className="py-2.5 text-slate-600">{fmtDate(a.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!list.data?.length && <p className="py-8 text-center text-sm text-slate-500">No applications match.</p>}
          </div>
        )}
      </Card>
    </div>
  );
}
