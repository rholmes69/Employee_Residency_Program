import { useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { INTEREST_AREAS, ROLES, interestLabel, type MentorInput, type Role } from '@erp/shared';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import type { Cycle, Mentor } from '../lib/types';
import { Alert, Button, Card, Field, PageLoader, Tag, cx, fmtDate } from '../components/ui';

export default function Admin() {
  const tabs = [
    ['mentors', 'Mentors'],
    ['users', 'Users & Roles'],
    ['settings', 'Program Settings'],
    ['memory', 'Agent Memory'],
  ];
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl font-bold text-brand-700">Admin</h1>
      <nav className="flex gap-1 border-b border-slate-200">
        {tabs.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cx('-mb-px border-b-2 px-4 py-2 text-sm font-medium', isActive ? 'border-brand-700 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800')
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<Navigate to="mentors" replace />} />
        <Route path="mentors" element={<Mentors />} />
        <Route path="users" element={<Users />} />
        <Route path="settings" element={<Settings />} />
        <Route path="memory" element={<Memory />} />
      </Routes>
    </div>
  );
}

const emptyMentor: MentorInput = { name: '', email: '', title: '', department: '', expertiseAreas: [], bio: '', capacity: 2, active: true };

function Mentors() {
  const { data, loading, error, reload } = useApi<Mentor[]>('/mentors?all=true');
  const [editing, setEditing] = useState<{ id?: string; form: MentorInput } | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const save = async () => {
    if (!editing) return;
    setSaveErr(null);
    try {
      if (editing.id) await api.put(`/mentors/${editing.id}`, editing.form);
      else await api.post('/mentors', editing.form);
      setEditing(null);
      void reload();
    } catch (e) {
      setSaveErr((e as Error).message);
    }
  };

  if (loading) return <PageLoader />;
  if (error) return <Alert>{error}</Alert>;
  const f = editing?.form;
  const setF = (patch: Partial<MentorInput>) => editing && setEditing({ ...editing, form: { ...editing.form, ...patch } });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        <div className="flex justify-end">
          <Button onClick={() => setEditing({ form: { ...emptyMentor } })}>Add mentor</Button>
        </div>
        {data?.map((m) => (
          <div key={m.id} className={cx('rounded-xl border bg-white p-4 shadow-sm', m.active ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-60')}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold">{m.name}</p>
                <p className="text-sm text-slate-600">
                  {m.title} · {m.department}
                </p>
                <p className="mt-1 text-sm text-slate-700">{m.bio}</p>
                <div className="mt-2 flex flex-wrap gap-1">{m.expertiseAreas.map((a) => <Tag key={a}>{interestLabel(a)}</Tag>)}</div>
              </div>
              <div className="text-right text-sm">
                <p className="text-slate-600">
                  {m.assignedCount ?? 0}/{m.capacity} mentees
                </p>
                <Button
                  variant="ghost"
                  className="mt-2 px-2 py-1 text-xs"
                  onClick={() => {
                    const { id, assignedCount: _a, ...rest } = m;
                    setEditing({ id, form: rest as MentorInput });
                  }}
                >
                  Edit
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {f && (
        <Card title={editing?.id ? 'Edit mentor' : 'New mentor'}>
          <div className="space-y-3">
            <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ name: e.target.value })} /></Field>
            <Field label="Email"><input className="input" value={f.email} onChange={(e) => setF({ email: e.target.value })} /></Field>
            <Field label="Title"><input className="input" value={f.title} onChange={(e) => setF({ title: e.target.value })} /></Field>
            <Field label="Department"><input className="input" value={f.department} onChange={(e) => setF({ department: e.target.value })} /></Field>
            <Field label="Expertise areas">
              <div className="space-y-1">
                {INTEREST_AREAS.filter((a) => a.value !== 'OTHER').map((a) => (
                  <label key={a.value} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-brand-700"
                      checked={f.expertiseAreas.includes(a.value)}
                      onChange={() =>
                        setF({ expertiseAreas: f.expertiseAreas.includes(a.value) ? f.expertiseAreas.filter((x) => x !== a.value) : [...f.expertiseAreas, a.value] })
                      }
                    />
                    {a.label}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Bio / what they can teach"><textarea className="input min-h-24" value={f.bio} onChange={(e) => setF({ bio: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Capacity"><input type="number" min={0} max={20} className="input" value={f.capacity} onChange={(e) => setF({ capacity: Number(e.target.value) })} /></Field>
              <Field label="Active">
                <label className="flex items-center gap-2 pt-2 text-sm">
                  <input type="checkbox" className="accent-brand-700" checked={f.active} onChange={(e) => setF({ active: e.target.checked })} /> Accepting mentees
                </label>
              </Field>
            </div>
            {saveErr && <p className="text-sm text-red-600">{saveErr}</p>}
            <div className="flex gap-2">
              <Button onClick={save}>Save</Button>
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  lastLoginAt: string | null;
}

function Users() {
  const { data, loading, error, setData } = useApi<UserRow[]>('/users');
  const [err, setErr] = useState<string | null>(null);
  if (loading) return <PageLoader />;
  if (error) return <Alert>{error}</Alert>;
  const change = async (u: UserRow, role: Role) => {
    setErr(null);
    try {
      await api.patch(`/users/${u.id}/role`, { role });
      setData(data!.map((x) => (x.id === u.id ? { ...x, role } : x)));
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <Card>
      {err && <Alert>{err}</Alert>}
      <p className="mb-3 text-sm text-slate-600">
        Users appear after their first sign-in. Emails in <code>ADMIN_EMAILS</code> are always Admin, and Entra app roles “Reviewer”/“Admin” are applied at sign-in.
      </p>
      <table className="w-full text-left text-sm">
        <thead className="border-b text-xs text-slate-500 uppercase">
          <tr>
            <th className="py-2">Name</th>
            <th className="py-2">Email</th>
            <th className="py-2">Last sign-in</th>
            <th className="py-2">Role</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((u) => (
            <tr key={u.id} className="border-b border-slate-100">
              <td className="py-2">{u.name}</td>
              <td className="py-2 text-slate-600">{u.email}</td>
              <td className="py-2 text-slate-600">{fmtDate(u.lastLoginAt, true)}</td>
              <td className="py-2">
                <select className="input w-36 py-1" value={u.role} onChange={(e) => change(u, e.target.value as Role)}>
                  {ROLES.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function Settings() {
  const { data, loading, error, reload } = useApi<Cycle[]>('/cycles');
  const [form, setForm] = useState<Cycle | null>(null);
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  if (loading) return <PageLoader />;
  if (error) return <Alert>{error}</Alert>;
  const active = form ?? data?.find((c) => c.isActive) ?? data?.[0] ?? null;
  if (!active) return <Alert kind="warn">No program cycle exists. Re-run the database seed.</Alert>;
  const set = (patch: Partial<Cycle>) => setForm({ ...active, ...patch });

  const save = async () => {
    setMsg(null);
    try {
      const { id, name, description, opensAt, deadline, hrContactName, hrContactEmail, isActive } = active;
      await api.put(`/cycles/${id}`, { name, description: description ?? undefined, opensAt, deadline, hrContactName, hrContactEmail, isActive });
      setMsg({ kind: 'success', text: 'Saved.' });
      setForm(null);
      void reload();
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message });
    }
  };

  return (
    <Card title="Program cycle">
      <div className="grid max-w-2xl gap-4">
        {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
        <Field label="Name"><input className="input" value={active.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Description"><textarea className="input min-h-24" value={active.description ?? ''} onChange={(e) => set({ description: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Opens"><input type="datetime-local" className="input" value={toLocalInput(active.opensAt)} onChange={(e) => set({ opensAt: new Date(e.target.value).toISOString() })} /></Field>
          <Field label="Deadline" hint="Shown to employees in Central Time."><input type="datetime-local" className="input" value={toLocalInput(active.deadline)} onChange={(e) => set({ deadline: new Date(e.target.value).toISOString() })} /></Field>
          <Field label="HR contact name"><input className="input" value={active.hrContactName} onChange={(e) => set({ hrContactName: e.target.value })} /></Field>
          <Field label="HR contact email"><input className="input" value={active.hrContactEmail} onChange={(e) => set({ hrContactEmail: e.target.value })} /></Field>
        </div>
        <div>
          <Button onClick={save}>Save settings</Button>
        </div>
      </div>
    </Card>
  );
}

interface MemoryRow {
  id: string;
  scope: 'GLOBAL' | 'USER';
  content: string;
  createdAt: string;
  user: { name: string; email: string } | null;
}

function Memory() {
  const { data, loading, error, reload } = useApi<MemoryRow[]>('/admin/memories');
  const [content, setContent] = useState('');
  if (loading) return <PageLoader />;
  if (error) return <Alert>{error}</Alert>;
  const add = async () => {
    await api.post('/agent/memories', { content, scope: 'GLOBAL' });
    setContent('');
    void reload();
  };
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card title="What Ria has learned" className="lg:col-span-2">
        <p className="mb-3 text-sm text-slate-600">
          Learned memories are added to the agent’s prompt. Curated facts live in <code>agent/MEMORY.md</code>.
        </p>
        <div className="space-y-2">
          {data?.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
              <div>
                <Tag>{m.scope === 'GLOBAL' ? 'Shared' : `About ${m.user?.name ?? 'user'}`}</Tag>
                <p className="mt-1">{m.content}</p>
                <p className="text-xs text-slate-400">{fmtDate(m.createdAt, true)}</p>
              </div>
              <Button variant="ghost" className="px-2 py-1 text-xs text-red-600" onClick={async () => { await api.del(`/admin/memories/${m.id}`); void reload(); }}>
                Forget
              </Button>
            </div>
          ))}
          {!data?.length && <p className="text-sm text-slate-500">No learned memories yet.</p>}
        </div>
      </Card>
      <Card title="Teach a shared fact">
        <textarea className="input min-h-24" placeholder="e.g. Residents meet the first Tuesday of each month in Mound Bayou." value={content} onChange={(e) => setContent(e.target.value)} />
        <Button className="mt-3" disabled={content.trim().length < 3} onClick={add}>
          Save memory
        </Button>
      </Card>
    </div>
  );
}
