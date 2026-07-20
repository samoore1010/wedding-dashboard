// Client-side agent loop. Runs the tool-use conversation: streams the model's
// text, executes read tools immediately, gates write tools behind user approval
// (snapshotting for undo), and feeds tool results back until the turn ends.

import { streamAssistant } from './api';
import { anthropicToolDefs, TOOL_BY_NAME } from './tools';
import { buildSystemPrompt } from './systemPrompt';
import { useStore } from '../store';

export interface Attachment {
  kind: 'image' | 'pdf';
  media_type: string;
  data: string; // base64, no data: prefix
  name: string;
}

export interface ProposedChange {
  toolUseId: string;
  name: string;
  summary: string;
  input: any;
}

export interface AgentCallbacks {
  /** A new model turn is starting — begin a fresh streaming assistant bubble. */
  onTurnStart: () => void;
  /** Streaming text delta for the current bubble. */
  onDelta: (text: string) => void;
  /** The current model turn finished streaming — commit the bubble. */
  onTurnEnd: () => void;
  /** Non-text activity note, e.g. web search happened. */
  onToolNote: (text: string) => void;
  /** Ask the user to approve a batch of writes. Resolve true to apply. */
  requestApproval: (changes: ProposedChange[]) => Promise<boolean>;
  /** A batch of writes was applied; undoId reverts it. */
  onApplied: (undoId: string, summaries: string[]) => void;
  /** Fatal error for this turn. */
  onError: (message: string) => void;
}

const WEB_TOOLS = [
  { type: 'web_search_20260209', name: 'web_search' },
  { type: 'web_fetch_20260209', name: 'web_fetch' },
];

const MAX_STEPS = 16;

function safeSummary(tu: any): string {
  const tool = TOOL_BY_NAME[tu.name];
  try {
    return tool?.summarize?.(tu.input) || tu.name.replace(/_/g, ' ');
  } catch {
    return tu.name.replace(/_/g, ' ');
  }
}

/**
 * Run one user turn to completion, mutating `messages` (Anthropic message list)
 * in place so the caller keeps the conversation history.
 */
export async function runAgent(
  messages: any[],
  userText: string,
  attachments: Attachment[],
  cb: AgentCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const userContent: any[] = [];
  for (const a of attachments) {
    if (a.kind === 'image') {
      userContent.push({ type: 'image', source: { type: 'base64', media_type: a.media_type, data: a.data } });
    } else {
      userContent.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.data } });
    }
  }
  userContent.push({
    type: 'text',
    text: userText || (attachments.length ? 'Please look at the attached file(s) and help with them.' : ''),
  });
  messages.push({ role: 'user', content: userContent });

  const tools = [...anthropicToolDefs(), ...WEB_TOOLS];
  // Once web search/fetch spins up a code-execution container, its id must be
  // sent on every later turn of this conversation, or the API returns 400.
  let container: string | undefined;

  for (let step = 0; step < MAX_STEPS; step++) {
    cb.onTurnStart();
    let message: any;
    try {
      const res = await streamAssistant(
        {
          model: 'claude-opus-4-8',
          max_tokens: 16000,
          thinking: { type: 'adaptive' },
          output_config: { effort: 'medium' },
          system: buildSystemPrompt(),
          messages,
          tools,
          ...(container ? { container } : {}),
        },
        { onDelta: cb.onDelta, signal }
      );
      message = res.message;
      if (message?.container?.id) container = message.container.id;
    } catch (e: any) {
      cb.onTurnEnd();
      if (e?.name === 'AbortError') return;
      cb.onError(e?.message || 'Something went wrong talking to the assistant.');
      return;
    }
    cb.onTurnEnd();

    messages.push({ role: 'assistant', content: message.content });

    // Server tools (web search/fetch) ran mid-turn and hit the loop cap — resume.
    if (message.stop_reason === 'pause_turn') continue;

    const content: any[] = message.content || [];
    if (content.some((b) => b.type === 'server_tool_use')) cb.onToolNote('Searched the web.');

    const allToolUses = content.filter((b) => b.type === 'tool_use');
    if (allToolUses.length === 0) break; // normal end of turn

    const results: any[] = [];

    for (const tu of allToolUses) {
      const tool = TOOL_BY_NAME[tu.name];
      if (!tool) {
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: `Unknown tool "${tu.name}".`, is_error: true });
      } else if (tool.kind === 'read') {
        try {
          results.push({ type: 'tool_result', tool_use_id: tu.id, content: tool.run(tu.input) });
        } catch (e: any) {
          results.push({ type: 'tool_result', tool_use_id: tu.id, content: e?.message || 'error', is_error: true });
        }
      }
    }

    const writes = allToolUses.filter((tu) => TOOL_BY_NAME[tu.name]?.kind === 'write');
    if (writes.length) {
      const changes: ProposedChange[] = writes.map((tu) => ({
        toolUseId: tu.id,
        name: tu.name,
        input: tu.input,
        summary: safeSummary(tu),
      }));

      let approved = false;
      try {
        approved = await cb.requestApproval(changes);
      } catch {
        approved = false;
      }

      if (approved) {
        const label = changes.map((c) => c.summary).join('; ').slice(0, 140);
        const undoId = useStore.getState().pushUndo(label);
        const applied: string[] = [];
        for (const tu of writes) {
          const tool = TOOL_BY_NAME[tu.name];
          try {
            const out = tool.run(tu.input);
            applied.push(safeSummary(tu));
            results.push({ type: 'tool_result', tool_use_id: tu.id, content: out });
          } catch (e: any) {
            results.push({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: `Failed to apply: ${e?.message || 'error'}`,
              is_error: true,
            });
          }
        }
        cb.onApplied(undoId, applied);
      } else {
        for (const tu of writes) {
          results.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content:
              'The user declined this change. Do not repeat it; ask what they would like to change instead.',
          });
        }
      }
    }

    messages.push({ role: 'user', content: results });
  }
}
