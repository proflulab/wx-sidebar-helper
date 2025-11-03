/* eslint-env node */
// src/client_kn_test.ts
import * as process from 'process';
import * as fs from 'fs';
import * as path from 'path';
import { CozeAPI as CozeAPIClient, ChatEventType, RoleType, COZE_CN_BASE_URL } from '@coze/api';

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const anyErr = error as { response?: { data?: unknown }; message?: string };
    const detail = anyErr.response?.data ?? anyErr.message ?? String(error);
    return typeof detail === 'string' ? detail : JSON.stringify(detail);
  }
  return String(error);
}

function loadEnv(): Record<string, string | undefined> {
  const env = { ...process.env };
  const p = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(p)) {
    const txt = fs.readFileSync(p, 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const s = line.trim();
      if (!s || s.startsWith('#')) continue;
      const i = s.indexOf('=');
      if (i === -1) continue;
      const k = s.slice(0, i).trim();
      const v = s.slice(i + 1).trim();
      if (k) env[k] = v;
    }
  }
  return env;
}

async function getToken(env: Record<string, string | undefined>): Promise<string> {
  // 优先使用已存在的环境变量
  if (env.COZE_TOKEN) return env.COZE_TOKEN as string;
  if (env.VITE_COZE_API_KEY) return env.VITE_COZE_API_KEY as string;

  // 可选：通过自有后端动态获取临时 token（需配置 COZE_TOKEN_URL）
  if (env.COZE_TOKEN_URL) {
    const res = await fetch(env.COZE_TOKEN_URL as string, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.COZE_CLIENT_ID,
        client_secret: env.COZE_CLIENT_SECRET,
      }),
    });
    if (!res.ok) {
      throw new Error(`Token URL failed: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    const tok = (data as any).access_token || (data as any).token;
    if (!tok) throw new Error('Token URL response missing access_token/token');
    return tok as string;
  }

  throw new Error('No token available. Set COZE_TOKEN / VITE_COZE_API_KEY or COZE_TOKEN_URL.');
}

(async () => {
  // ——— 自动获取配置 ———
  const env = loadEnv();
  const TOKEN = await getToken(env);
  const BOT_ID: string = (env.VITE_COZE_BOT_ID as string) || '7566254206043586623';
  const USER_ID: string = (env.VITE_COZE_USER_ID as string) || (env.USER_ID as string) || 'cli-test-user';
  const BASE_URL: string = (env.VITE_COZE_API_BASE_URL as string) || COZE_CN_BASE_URL;

  const apiClient = new CozeAPIClient({
    token: TOKEN,
    baseURL: BASE_URL,
  });

  try {
    console.log(`✅ Starting chat with bot_id=${BOT_ID}, user_id=${USER_ID}`);

    const stream: AsyncIterable<any> = await apiClient.chat.stream({
      bot_id: BOT_ID,
      user_id: USER_ID,
      additional_messages: [
        {
          content: '会员是什么？',
          content_type: 'text',
          role: RoleType.User,
          type: 'question',
        },
      ],
    });

    for await (const event of stream as AsyncIterable<any>) {
      switch (event.event) {
        case ChatEventType.CONVERSATION_MESSAGE_DELTA:
          // 实时增量输出
          process.stdout.write(event.data?.content || '');
          break;
        case ChatEventType.CONVERSATION_MESSAGE_COMPLETED:
          console.log(`\n✅ Message completed: ${event.data?.content || ''}`);
          break;
        case ChatEventType.CONVERSATION_CHAT_COMPLETED:
          console.log('🏁 Chat completed.');
          if (event.data?.usage) {
            console.log(`Usage tokens: ${event.data.usage.token_count ?? 'N/A'}`);
          }
          break;
        default:
          // 其它 event，比如 created、in_progress 等
          console.log(`ℹ️ Event: ${event.event}`, event.data);
      }
    }

    console.log('\n🔚 Stream ended.');
  } catch (err) {
    const detail = getErrorMessage(err);
    console.error('❌ Unexpected error during chat:', detail);
    process.exit(1);
  }
})();