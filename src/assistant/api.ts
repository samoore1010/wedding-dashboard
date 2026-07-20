// Client transport to the server assistant proxy. Streams text deltas and
// resolves with the final Anthropic message (which drives the tool loop).

export interface StreamHandlers {
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
}

export interface AssistantStatus {
  configured: boolean;
  model: string;
}

export async function getAssistantStatus(): Promise<AssistantStatus> {
  try {
    const res = await fetch('/api/assistant/status');
    if (!res.ok) return { configured: false, model: '' };
    return await res.json();
  } catch {
    return { configured: false, model: '' };
  }
}

export async function streamAssistant(
  body: unknown,
  { onDelta, signal }: StreamHandlers = {}
): Promise<{ message: any }> {
  const res = await fetch('/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    let msg = `The assistant request failed (${res.status}).`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalMessage: any = null;
  let errorMessage: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const dataLine = frame.split('\n').find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      const payload = dataLine.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      let evt: any;
      try {
        evt = JSON.parse(payload);
      } catch {
        continue;
      }
      if (evt.type === 'delta') onDelta?.(evt.text);
      else if (evt.type === 'final') finalMessage = evt.message;
      else if (evt.type === 'error') errorMessage = evt.error;
    }
  }

  if (errorMessage) throw new Error(errorMessage);
  if (!finalMessage) throw new Error('The assistant returned no response.');
  return { message: finalMessage };
}
