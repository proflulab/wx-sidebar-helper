type ArkRole = 'system' | 'user' | 'assistant';

export type ArkMessage = {
  role: ArkRole;
  content: string;
};

export type ArkChatOptions = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  signal?: AbortSignal;
};

const DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const DEFAULT_MODEL = 'doubao-lite-4k';

const ENV_API_KEY = import.meta.env.ARK_API_KEY;
const ENV_BASE_URL = import.meta.env.ARK_BASE_URL;
const ENV_MODEL = import.meta.env.DOUBAO_MODEL || import.meta.env.ARK_MODEL;

function resolveConfig(options: ArkChatOptions) {
  const apiKey = options.apiKey || ENV_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ARK_API_KEY. Set it in .env or pass apiKey.');
  }
  return {
    apiKey,
    baseUrl: options.baseUrl || ENV_BASE_URL || DEFAULT_BASE_URL,
    model: options.model || ENV_MODEL || DEFAULT_MODEL,
    temperature: options.temperature,
    top_p: options.top_p,
    max_tokens: options.max_tokens,
    signal: options.signal,
  };
}

function buildUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

async function getErrorDetail(response: Response): Promise<string> {
  const fallback = `${response.status} ${response.statusText}`.trim();
  const text = await response.text();
  if (!text) return fallback;
  try {
    const payload = JSON.parse(text);
    const msg =
      payload?.error?.message ||
      payload?.message ||
      payload?.error ||
      payload?.detail;
    if (typeof msg === 'string' && msg) return msg;
  } catch {
    // ignore json parse error
  }
  return text;
}

function buildPayload(messages: ArkMessage[], options: ReturnType<typeof resolveConfig>, stream: boolean) {
  const payload: Record<string, unknown> = {
    model: options.model,
    messages,
    stream,
  };
  if (typeof options.temperature === 'number') payload.temperature = options.temperature;
  if (typeof options.top_p === 'number') payload.top_p = options.top_p;
  if (typeof options.max_tokens === 'number') payload.max_tokens = options.max_tokens;
  return payload;
}

function parseSsePayload(data: string): string | null {
  if (!data || data === '[DONE]') return null;
  try {
    const payload = JSON.parse(data);
    const delta = payload?.choices?.[0]?.delta?.content;
    if (typeof delta === 'string' && delta) return delta;
  } catch {
    // ignore malformed chunk
  }
  return null;
}

async function* streamFromResponse(response: Response): AsyncGenerator<string, void, unknown> {
  if (!response.body) {
    throw new Error('Stream response body is empty.');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, '\n');

    let idx = buffer.indexOf('\n\n');
    while (idx !== -1) {
      const rawEvent = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 2);
      if (rawEvent) {
        for (const line of rawEvent.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') return;
          const chunk = parseSsePayload(data);
          if (chunk) yield chunk;
        }
      }
      idx = buffer.indexOf('\n\n');
    }
  }

  const tail = buffer.trim();
  if (tail) {
    for (const line of tail.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      const chunk = parseSsePayload(data);
      if (chunk) yield chunk;
    }
  }
}

export async function chatCompletion(
  messages: ArkMessage[],
  options: ArkChatOptions = {}
): Promise<string> {
  const cfg = resolveConfig(options);
  const response = await fetch(buildUrl(cfg.baseUrl, '/chat/completions'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(buildPayload(messages, cfg, false)),
    signal: cfg.signal,
  });

  if (!response.ok) {
    const detail = await getErrorDetail(response);
    throw new Error(`Ark chat completion failed: ${detail}`);
  }

  const payload = await response.json();
  const text = payload?.choices?.[0]?.message?.content;
  return typeof text === 'string' ? text : '';
}

export async function streamChatCompletion(
  messages: ArkMessage[],
  options: ArkChatOptions = {}
): Promise<AsyncGenerator<string, void, unknown>> {
  const cfg = resolveConfig(options);
  const response = await fetch(buildUrl(cfg.baseUrl, '/chat/completions'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(buildPayload(messages, cfg, true)),
    signal: cfg.signal,
  });

  if (!response.ok) {
    const detail = await getErrorDetail(response);
    throw new Error(`Ark stream failed: ${detail}`);
  }

  return streamFromResponse(response);
}

export async function streamQuestion(
  question: string,
  options: ArkChatOptions & { system?: string } = {}
): Promise<AsyncGenerator<string, void, unknown>> {
  const q = typeof question === 'string' ? question.trim() : '';
  if (!q) throw new Error('Question is required');
  const messages: ArkMessage[] = [];
  if (options.system) messages.push({ role: 'system', content: options.system });
  messages.push({ role: 'user', content: q });
  return streamChatCompletion(messages, options);
}
