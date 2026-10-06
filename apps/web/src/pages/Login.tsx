import { useState } from 'react';
import type { Role } from '@erp/shared';
import { useAuth } from '../lib/auth';
import { Alert, Button } from '../components/ui';

export default function Login() {
  const { config, loginMicrosoft, loginDev } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dev, setDev] = useState({ email: 'employee@deltahealthcenter.org', name: 'Test Employee', role: 'EMPLOYEE' as Role });

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-700 to-brand-800 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full border-4 border-brand-700 font-serif text-sm font-bold text-brand-700">
            DHC
          </div>
          <h1 className="font-serif text-2xl font-bold text-brand-700">Delta Health Center</h1>
          <p className="text-slate-600">Employee Residency Program</p>
        </div>

        {error && (
          <div className="mb-4">
            <Alert>{error}</Alert>
          </div>
        )}

        {config?.entra ? (
          <Button className="w-full py-3" loading={busy} onClick={() => run(loginMicrosoft)}>
            Sign in with Microsoft
          </Button>
        ) : (
          <Alert kind="info">Microsoft sign-in isn’t configured yet. Set ENTRA_TENANT_ID and ENTRA_CLIENT_ID.</Alert>
        )}

        {config?.devLogin && (
          <form
            className="mt-6 space-y-3 border-t border-dashed border-amber-300 pt-5"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => loginDev(dev.email, dev.name, dev.role));
            }}
          >
            <p className="text-xs font-semibold tracking-wide text-amber-700 uppercase">Development login. Disable in production.</p>
            <input className="input" type="email" value={dev.email} onChange={(e) => setDev({ ...dev, email: e.target.value })} placeholder="email" />
            <input className="input" value={dev.name} onChange={(e) => setDev({ ...dev, name: e.target.value })} placeholder="name" />
            <select className="input" value={dev.role} onChange={(e) => setDev({ ...dev, role: e.target.value as Role })}>
              <option value="EMPLOYEE">Employee (applicant / supervisor)</option>
              <option value="REVIEWER">Reviewer (HR)</option>
              <option value="ADMIN">Admin</option>
            </select>
            <Button type="submit" variant="secondary" className="w-full" loading={busy}>
              Dev sign-in
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
