import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useApi } from '../lib/useApi';
import type { Application } from '../lib/types';
import { Alert, Card, PageLoader, StatusBadge, fmtDate } from '../components/ui';

interface ProgramInfo {
  program: string;
  description: string | null;
  deadline: string;
  isOpen: boolean;
  hrContact: { name: string; email: string };
  offers: string[];
  process: string[];
  note: string;
}

function daysLeft(deadline: string) {
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
}

export default function Home() {
  const { me } = useAuth();
  const program = useApi<ProgramInfo>('/program');
  const mine = useApi<Application | null>('/me/application/status');

  if (program.loading) return <PageLoader />;
  if (program.error || !program.data) return <Alert>{program.error ?? 'Program information unavailable.'}</Alert>;
  const p = program.data;
  const left = daysLeft(p.deadline);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="rounded-2xl bg-gradient-to-br from-brand-700 to-brand-800 p-8 text-white shadow">
          <p className="text-sm font-semibold tracking-wide text-gold-500 uppercase">Now accepting applications</p>
          <h1 className="mt-2 font-serif text-3xl font-bold">{p.program}</h1>
          <p className="mt-3 max-w-2xl text-brand-100">
            At Delta Health Center, we recognize that every employee has the potential to grow. All employees are encouraged to participate,
            regardless of their current position or role.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link to="/application" className="rounded-md bg-white px-5 py-2.5 font-semibold text-brand-700 shadow hover:bg-brand-50">
              {mine.data && mine.data.status !== 'DRAFT' ? 'View my application' : 'Start my application'}
            </Link>
            <span className="text-sm text-brand-100">
              Deadline <strong className="text-white">{fmtDate(p.deadline, true)} CT</strong>
              {p.isOpen && left >= 0 && ` · ${left} day${left === 1 ? '' : 's'} left`}
            </span>
          </div>
        </div>

        {!p.isOpen && <Alert kind="warn">The application window is closed. Contact {p.hrContact.name} ({p.hrContact.email}) with questions.</Alert>}

        <Card title="What the program offers">
          <ul className="grid gap-2 sm:grid-cols-2">
            {p.offers.map((o) => (
              <li key={o} className="flex gap-2 text-sm text-slate-700">
                <span className="text-brand-600">✓</span> {o}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">{p.note}</p>
        </Card>

        <Card title="How it works">
          <ol className="space-y-3">
            {p.process.map((s, i) => (
              <li key={s} className="flex gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{i + 1}</span>
                <span className="pt-0.5 text-slate-700">{s}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="space-y-6">
        <Card title={`Welcome, ${me?.name.split(' ')[0]}`}>
          {mine.loading ? (
            <PageLoader />
          ) : mine.data ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Your application</span>
                <StatusBadge status={mine.data.status} />
              </div>
              {mine.data.submittedAt && <p className="text-slate-500">Submitted {fmtDate(mine.data.submittedAt)}</p>}
              <Link to="/application" className="inline-block pt-2 font-medium text-brand-700 hover:underline">
                Open application →
              </Link>
            </div>
          ) : (
            <p className="text-sm text-slate-600">You haven’t started an application yet.</p>
          )}
        </Card>
        <Card title="Questions?">
          <p className="text-sm text-slate-700">
            Contact <strong>{p.hrContact.name}</strong>
            <br />
            <a className="text-brand-700 hover:underline" href={`mailto:${p.hrContact.email}`}>
              {p.hrContact.email}
            </a>
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Or ask <strong>Ria</strong>, the Residency Guide. Click the chat button in the corner.
          </p>
        </Card>
      </div>
    </div>
  );
}
