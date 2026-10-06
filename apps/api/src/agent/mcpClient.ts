import { SignJWT } from 'jose';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { AppError, type Actor, type ToolDef } from '@erp/core';

const MCP_URL = process.env.MCP_URL ?? 'http://localhost:4100/mcp';
const key = new TextEncoder().encode(process.env.MCP_SHARED_SECRET ?? '');

/** Short-lived token so MCP tools run with exactly this user's permissions. */
const tokenFor = (actor: Actor) =>
  new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(actor.id)
    .setIssuer('erp-api')
    .setAudience('erp-mcp')
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(key);

export async function connectMcp(actor: Actor) {
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${await tokenFor(actor)}` } },
  });
  const client = new Client({ name: 'erp-agent', version: '1.0.0' });
  try {
    await client.connect(transport);
  } catch (e) {
    console.error('[agent] MCP connect failed', e);
    throw new AppError(503, 'The assistant’s tool server (MCP) is unavailable.');
  }
  const { tools } = await client.listTools();

  return {
    tools: tools.map<ToolDef>((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description ?? '', parameters: t.inputSchema },
    })),
    async call(name: string, args: Record<string, unknown>) {
      try {
        const r = await client.callTool({ name, arguments: args });
        const text = (r.content as { type: string; text?: string }[])
          .filter((c) => c.type === 'text')
          .map((c) => c.text)
          .join('\n');
        return r.isError ? text || 'ERROR: tool failed' : text;
      } catch (e) {
        return `ERROR: ${(e as Error).message}`;
      }
    },
    close: () => client.close(),
  };
}
