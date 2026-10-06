import { useState } from 'react';
import { api } from '../lib/api';
import { Button } from './ui';

type Mode = 'feedback' | 'improve' | 'brainstorm';

/** Inline AI writing coach for Q2 / Q4 / Q5. */
export function AssistPanel({
  question,
  draft,
  onUse,
}: {
  question: 'hopeToGain' | 'goals' | 'strengths';
  draft: string;
  onUse: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Mode | null>(null);
  const [result, setResult] = useState<{ mode: Mode; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (mode: Mode) => {
    setBusy(mode);
    setError(null);
    try {
      const { text } = await api.post<{ text: string }>('/agent/assist', { question, draft, mode });
      setResult({ mode, text });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-1 text-xs font-medium text-brand-700 hover:underline">
        ✨ Get writing help from Ria
      </button>
    );

  const hasDraft = draft.trim().length >= 10;
  return (
    <div className="mt-2 rounded-lg border border-brand-100 bg-brand-50/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" className="px-3 py-1 text-xs" loading={busy === 'brainstorm'} disabled={!!busy} onClick={() => run('brainstorm')}>
          Help me get started
        </Button>
        <Button type="button" variant="secondary" className="px-3 py-1 text-xs" loading={busy === 'feedback'} disabled={!!busy || !hasDraft} onClick={() => run('feedback')}>
          Give me feedback
        </Button>
        <Button type="button" variant="secondary" className="px-3 py-1 text-xs" loading={busy === 'improve'} disabled={!!busy || !hasDraft} onClick={() => run('improve')}>
          Polish my draft
        </Button>
        <button type="button" onClick={() => setOpen(false)} className="ml-auto text-xs text-slate-500 hover:underline">
          Close
        </button>
      </div>
      {busy && <p className="mt-2 text-xs text-slate-500">Ria is thinking… this runs on a local model and can take up to a minute.</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {result && !busy && (
        <div className="mt-3 rounded-md bg-white p-3 text-sm whitespace-pre-wrap text-slate-800 shadow-sm">
          {result.text}
          {result.mode === 'improve' && (
            <div className="mt-3 flex gap-2">
              <Button type="button" className="px-3 py-1 text-xs" onClick={() => onUse(result.text)}>
                Use this version
              </Button>
              <span className="self-center text-xs text-slate-500">Review it carefully. It should still sound like you.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
