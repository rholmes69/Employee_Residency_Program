import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { STATUS_LABELS, type ApplicationStatus } from '@erp/shared';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
const variants: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-700/50',
  secondary: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/50',
  ghost: 'text-brand-700 hover:bg-brand-50',
};

export function Button({
  variant = 'primary',
  loading,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed',
        variants[variant],
        className,
      )}
    >
      {loading && <Spinner small />}
      {children}
    </button>
  );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-800">{title}</h2>
          <div className="flex gap-2">{actions}</div>
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Spinner({ small }: { small?: boolean }) {
  return (
    <span
      className={cx('inline-block animate-spin rounded-full border-2 border-current border-r-transparent', small ? 'h-4 w-4' : 'h-6 w-6')}
      aria-label="Loading"
    />
  );
}

export function PageLoader() {
  return (
    <div className="flex justify-center py-20 text-brand-700">
      <Spinner />
    </div>
  );
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success' | 'info' | 'warn'; children: ReactNode }) {
  const styles = {
    error: 'bg-red-50 text-red-800 border-red-200',
    success: 'bg-green-50 text-green-800 border-green-200',
    info: 'bg-brand-50 text-brand-800 border-brand-100',
    warn: 'bg-amber-50 text-amber-900 border-amber-200',
  };
  return <div className={cx('rounded-md border px-4 py-3 text-sm', styles[kind])}>{children}</div>;
}

const statusColors: Record<ApplicationStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  PENDING_SUPERVISOR: 'bg-amber-100 text-amber-800',
  SUPERVISOR_DECLINED: 'bg-red-100 text-red-800',
  UNDER_REVIEW: 'bg-blue-100 text-blue-800',
  ACCEPTED: 'bg-green-100 text-green-800',
  WAITLISTED: 'bg-purple-100 text-purple-800',
  NOT_SELECTED: 'bg-slate-200 text-slate-700',
  WITHDRAWN: 'bg-slate-100 text-slate-500',
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={cx('inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', statusColors[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{children}</span>;
}

export function Field({ label, error, hint, children }: { label: ReactNode; error?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

export const fmtDate = (d?: string | null, withTime = false) =>
  d
    ? new Date(d).toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        dateStyle: 'medium',
        ...(withTime ? { timeStyle: 'short' } : {}),
      })
    : '—';

export { cx };
