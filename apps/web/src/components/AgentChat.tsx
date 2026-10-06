import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { cx } from './ui';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
}

const SUGGESTIONS: Record<string, string[]> = {
  EMPLOYEE: ['What is the Residency Program?', 'When is the deadline?', 'What is the status of my application?', 'Help me think about my 1–3 year goals'],
  REVIEWER: ['How many applications are waiting for HR review?', 'Which interest areas are most popular?', 'List applicants interested in Human Resources', 'Who are our mentors?'],
  ADMIN: ['Give me a summary of this cycle so far', 'Which departments have the most applicants?', 'List applications awaiting supervisor sign-off', 'Who are our mentors?'],
};

/** Minimal markdown: **bold**, bullet lists, line breaks. */
function render(text: string) {
  return text.split('\n').map((line, i) => {
    const bullet = /^\s*[-*•]\s+/.test(line);
    const html = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/^\s*[-*•]\s+/, '')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    return bullet ? (
      <li key={i} className="ml-4 list-disc" dangerouslySetInnerHTML={{ __html: html }} />
    ) : (
      <p key={i} className={line.trim() ? '' : 'h-2'} dangerouslySetInnerHTML={{ __html: html }} />
    );
  });
}

export function AgentChat() {
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), [messages, busy]);

  // Prime the local model's prompt cache while the user reads/types.
  const warmed = useRef(false);
  useEffect(() => {
    if (open && !warmed.current) {
      warmed.current = true;
      void api.post('/agent/warmup').catch(() => {});
    }
  }, [open]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: message }]);
    setBusy(true);
    try {
      const res = await api.post<{ conversationId: string; reply: string; toolsUsed: string[] }>('/agent/chat', { message, conversationId });
      setConversationId(res.conversationId);
      setMessages((m) => [...m, { role: 'assistant', content: res.reply, toolsUsed: res.toolsUsed }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: `⚠️ ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setMessages([]);
    setConversationId(undefined);
  };

  if (!me) return null;
  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed right-5 bottom-5 z-40 flex items-center gap-2 rounded-full bg-brand-700 px-5 py-3 font-semibold text-white shadow-lg hover:bg-brand-800"
        aria-label="Open Residency Guide chat"
      >
        <span className="text-lg">💬</span> {open ? 'Close' : 'Ask Ria'}
      </button>

      {open && (
        <div className="fixed right-5 bottom-20 z-40 flex h-[min(620px,calc(100vh-7rem))] w-[min(420px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-brand-700 px-4 py-3 text-white">
            <div>
              <p className="font-semibold">Ria · Residency Guide</p>
              <p className="text-xs text-brand-100">Runs privately on Delta Health servers</p>
            </div>
            <button onClick={reset} className="rounded px-2 py-1 text-xs text-brand-100 hover:bg-white/10">
              New chat
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {!messages.length && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Hi {me.name.split(' ')[0]}! I can answer questions about the Employee Residency Program
                  {me.role === 'EMPLOYEE' ? ' and help you with your application.' : ', search applications, and suggest mentor matches.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(SUGGESTIONS[me.role] ?? SUGGESTIONS.EMPLOYEE).map((s) => (
                    <button key={s} onClick={() => void send(s)} className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-left text-xs text-brand-800 hover:bg-brand-100">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cx('max-w-[85%] space-y-1 rounded-2xl px-3.5 py-2.5 text-sm', m.role === 'user' ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-800')}>
                  {m.role === 'assistant' ? render(m.content) : m.content}
                  {m.toolsUsed && m.toolsUsed.length > 0 && <p className="pt-1 text-[10px] text-slate-400">used: {m.toolsUsed.join(', ')}</p>}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex gap-1 px-2 py-1">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            )}
            <div ref={bottom} />
          </div>

          <form
            className="flex gap-2 border-t border-slate-200 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <input className="input" placeholder="Ask about the program…" value={input} onChange={(e) => setInput(e.target.value)} disabled={busy} />
            <button type="submit" disabled={busy || !input.trim()} className="rounded-md bg-brand-700 px-4 text-sm font-semibold text-white disabled:opacity-50">
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
