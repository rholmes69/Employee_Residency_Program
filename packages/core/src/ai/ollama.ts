import { Agent, fetch } from 'undici';
import { config } from '../config';
import { AppError } from '../errors';

// Node's global fetch gives up after 300s waiting for headers. CPU inference can
// take longer, so use a dispatcher without that limit; our AbortController governs.
const ollamaDispatcher = new Agent({ headersTimeout: 0, bodyTimeout: 0, keepAliveTimeout: 60_000 });

export interface ToolCall {
  function: { name: string; arguments: Record<string, unknown> };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_name?: string;
}

export interface ToolDef {
  type: 'function';
  function: { name: string; description: string; parameters: unknown };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.ollama.timeoutMs);
  let res: Awaited<ReturnType<typeof fetch>>;
  try {
    res = await fetch(`${config.ollama.url}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      dispatcher: ollamaDispatcher,
    });
  } catch (e) {
    const timedOut = (e as Error).name === 'AbortError';
    throw new AppError(
      503,
      timedOut
        ? 'The AI model took too long to respond. Try again, or use a smaller model.'
        : `Cannot reach Ollama at ${config.ollama.url}. Is it running?`,
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new AppError(502, `Ollama ${path} failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

/** Strip any inline reasoning some models emit in content (incl. an unmatched closing tag). */
const stripThinking = (s: string) => {
  const out = s.replace(/<think>[\s\S]*?<\/think>/g, '');
  const close = out.lastIndexOf('</think>');
  return (close >= 0 ? out.slice(close + '</think>'.length) : out).trim();
};

/**
 * Some Qwen3 builds ignore Ollama's `think:false`. Qwen's documented soft switch
 * "/no_think" on the latest user turn reliably disables reasoning. On CPU that is
 * the difference between ~20s and several minutes per reply.
 */
const isQwen3Thinker = (model: string) => model.startsWith('qwen3') && !model.includes('instruct') && !model.includes('coder');

function applyNoThink(model: string, messages: ChatMessage[]) {
  if (config.ollama.think !== false || !isQwen3Thinker(model)) return messages;
  const idx = messages.map((m) => m.role).lastIndexOf('user');
  if (idx < 0 || messages[idx].content.includes('/no_think')) return messages;
  return messages.map((m, i) => (i === idx ? { ...m, content: `${m.content} /no_think` } : m));
}

export async function chat(opts: {
  messages: ChatMessage[];
  model?: string;
  tools?: ToolDef[];
  /** JSON schema object for structured output */
  format?: unknown;
  temperature?: number;
  /** Cap on generated tokens (num_predict) — generation is ~2 tok/s on CPU */
  maxTokens?: number;
}): Promise<ChatMessage> {
  const model = opts.model ?? config.ollama.agentModel;
  const body: Record<string, unknown> = {
    model,
    messages: applyNoThink(model, opts.messages),
    stream: false,
    options: {
      temperature: opts.temperature ?? 0.3,
      ...(opts.maxTokens ? { num_predict: opts.maxTokens } : {}),
      // Only the agent model gets the larger window; changing num_ctx per call would force a model reload.
      ...(model === config.ollama.agentModel ? { num_ctx: config.ollama.numCtx } : {}),
    },
    keep_alive: '30m',
  };
  if (opts.tools?.length) body.tools = opts.tools;
  if (opts.format) body.format = opts.format;
  // The think flag is only meaningful for reasoning models.
  if (config.ollama.think !== undefined && isQwen3Thinker(model)) body.think = config.ollama.think;

  const res = await post<{ message: ChatMessage }>('/api/chat', body);
  return { ...res.message, content: stripThinking(res.message.content ?? '') };
}

export async function embed(input: string[]): Promise<number[][]> {
  if (!input.length) return [];
  const res = await post<{ embeddings: number[][] }>('/api/embed', { model: config.ollama.embedModel, input });
  return res.embeddings;
}

export function cosine(a: number[], b: number[]) {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

export async function ollamaHealth() {
  try {
    const res = await fetch(`${config.ollama.url}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { ok: false as const, models: [] as string[] };
    const data = (await res.json()) as { models: { name: string }[] };
    const models = data.models.map((m) => m.name);
    const required = [config.ollama.agentModel, config.ollama.fastModel, config.ollama.embedModel];
    return { ok: true as const, models, missing: required.filter((r) => !models.includes(r)) };
  } catch {
    return { ok: false as const, models: [] as string[] };
  }
}
