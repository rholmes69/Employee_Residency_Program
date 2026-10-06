import { prisma } from '@erp/db';
import { AppError, chat, notFound, type Actor, type ChatMessage } from '@erp/core';
import { buildLiveContext, buildSystemPrompt, stripContextEcho } from './persona';
import { connectMcp } from './mcpClient';

const MAX_STEPS = 5;
const HISTORY = 12;
const MAX_TOOL_RESULT = 6000;
const MAX_ANSWER_TOKENS = 450;
const OFFER =
  /\b(would you like me to|do you want me to|shall i|should i|want me to|i can (?:help you )?(?:pull|retrieve|look up|check|fetch|get|search|find|list|show)|if you'?d like,? i can)\b/i;
/** "I'll remember that…" with no remember call is a broken promise. */
const PROMISED_MEMORY = /\b(i'?ll remember|i will remember|i'?ve noted|noted that|i'?ll keep that in mind|i'?ve saved|saved that)\b/i;
/** A reply that admits it lacks data, before any tool was tried, means the model should have looked it up. */
const MISSING = /\b(not (?:listed|included|available|in the (?:context|data)|shown|provided)|isn'?t (?:listed|included|available)|no (?:details|names?|job titles?|information|data)\b|don'?t have|do not have|unavailable)/i;

/**
 * One turn of the Residency Guide agent:
 *   system prompt (persona + memory) → Ollama with MCP tools → execute tool calls → repeat → answer.
 */
export async function runAgent(actor: Actor, message: string, conversationId?: string) {
  const conversation = conversationId
    ? await prisma.agentConversation.findUnique({ where: { id: conversationId } })
    : await prisma.agentConversation.create({ data: { userId: actor.id, title: message.slice(0, 60) } });
  if (!conversation) throw notFound('Conversation');
  if (conversation.userId !== actor.id) throw new AppError(403, 'Not your conversation');

  const history = await prisma.agentMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'desc' },
    take: HISTORY,
  });

  const [system, live, mcp] = await Promise.all([buildSystemPrompt(actor), buildLiveContext(actor), connectMcp(actor)]);
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    ...history.reverse().map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    // Live facts ride on the newest message only, so the prefix above stays cacheable.
    { role: 'user', content: `${live}\n\nQuestion: ${message}` },
  ];
  await prisma.agentMessage.create({ data: { conversationId: conversation.id, role: 'user', content: message } });

  const toolsUsed: string[] = [];
  let nudged = false;
  let reply: ChatMessage = { role: 'assistant', content: '' };
  const started = Date.now();
  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const t = Date.now();
      reply = await chat({ messages, tools: mcp.tools, maxTokens: MAX_ANSWER_TOKENS });
      console.log(`[agent] step ${step + 1}: ${((Date.now() - t) / 1000).toFixed(1)}s, tool calls: ${reply.tool_calls?.map((c) => c.function.name).join(',') || 'none'}`);
      messages.push(reply);
      if (!reply.tool_calls?.length) {
        // Small local models often *offer* to look something up instead of doing it.
        // Accept that offer once on the user's behalf so they get the actual answer.
        const text = reply.content ?? '';
        if (!nudged && !toolsUsed.includes('remember') && PROMISED_MEMORY.test(text) && mcp.tools.some((t) => t.function.name === 'remember')) {
          nudged = true;
          messages.push({ role: 'user', content: 'You said you would remember that. Call the remember tool now to save it, then reply briefly.' });
          continue;
        }
        if (!toolsUsed.length && !nudged && (MISSING.test(text) || OFFER.test(text.split('\n')[0]))) {
          nudged = true;
          messages.push({ role: 'user', content: 'Use your tools to look that up now (e.g. search_applications or get_application), then answer.' });
          continue;
        }
        break;
      }

      for (const call of reply.tool_calls) {
        const { name, arguments: args } = call.function;
        toolsUsed.push(name);
        const result = await mcp.call(name, args ?? {});
        messages.push({ role: 'tool', tool_name: name, content: result.slice(0, MAX_TOOL_RESULT) });
      }
      // Out of steps but the model still wants tools → force a final written answer.
      if (step === MAX_STEPS - 1) reply = await chat({ messages, maxTokens: MAX_ANSWER_TOKENS });
    }
  } finally {
    await mcp.close().catch(() => {});
  }
  console.log(`[agent] turn done in ${((Date.now() - started) / 1000).toFixed(1)}s`);

  const content = stripContextEcho(reply.content ?? '') || "I'm sorry, I couldn't put together an answer. Could you rephrase that?";
  await prisma.agentMessage.create({
    data: { conversationId: conversation.id, role: 'assistant', content, toolsUsed: [...new Set(toolsUsed)] },
  });
  await prisma.agentConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

  return { conversationId: conversation.id, reply: content, toolsUsed: [...new Set(toolsUsed)] };
}

const warming = new Set<string>();

/**
 * Pre-fills Ollama's prompt cache with this role's system prompt + tool schemas
 * while the user is still typing. On CPU this turns a multi-minute first reply
 * into a much shorter one. Fire-and-forget; one warm-up per tool set at a time.
 */
export async function warmAgent(actor: Actor) {
  const key = actor.role === 'EMPLOYEE' ? 'employee' : 'staff';
  if (warming.has(key)) return;
  warming.add(key);
  try {
    const [system, mcp] = await Promise.all([buildSystemPrompt(actor), connectMcp(actor)]);
    await mcp.close().catch(() => {});
    const t = Date.now();
    await chat({ messages: [{ role: 'system', content: system }, { role: 'user', content: 'hi' }], tools: mcp.tools, maxTokens: 1 });
    console.log(`[agent] warmed ${key} prompt in ${((Date.now() - t) / 1000).toFixed(1)}s`);
  } catch (e) {
    console.warn('[agent] warm-up failed', (e as Error).message);
  } finally {
    warming.delete(key);
  }
}
