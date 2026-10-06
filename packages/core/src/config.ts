const env = process.env;

const list = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export const config = {
  appUrl: env.APP_URL ?? 'http://localhost:8080',
  adminEmails: list(env.ADMIN_EMAILS),
  hrNotifyEmail: env.HR_NOTIFY_EMAIL ?? '',
  ollama: {
    url: (env.OLLAMA_URL ?? 'http://127.0.0.1:11434').replace(/\/$/, ''),
    agentModel: env.OLLAMA_AGENT_MODEL ?? 'qwen3:4b-instruct',
    fastModel: env.OLLAMA_FAST_MODEL ?? 'qwen3:4b-instruct',
    embedModel: env.OLLAMA_EMBED_MODEL ?? 'nomic-embed-text:latest',
    /** undefined → don't send the flag at all */
    think: env.OLLAMA_THINK === undefined || env.OLLAMA_THINK === '' ? undefined : env.OLLAMA_THINK === 'true',
    timeoutMs: Number(env.OLLAMA_TIMEOUT_MS ?? 420_000),
    /** Context window for the agent model — persona + tool schemas exceed Ollama's 4096 default. */
    numCtx: Number(env.OLLAMA_NUM_CTX ?? 8192),
  },
  smtp: {
    host: env.SMTP_HOST ?? '',
    port: Number(env.SMTP_PORT ?? 1025),
    secure: env.SMTP_SECURE === 'true',
    user: env.SMTP_USER ?? '',
    pass: env.SMTP_PASS ?? '',
    from: env.MAIL_FROM ?? 'Employee Residency Program <no-reply@localhost>',
  },
};
