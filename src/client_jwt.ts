/**
 * Coze API 客户端 - JWT 授权版本
 * 
 * 通过后端 API 获取 access_token，然后调用 Coze API
 */
import { CozeAPI, RoleType, ChatEventType } from '@coze/api';

const API_BASE = import.meta.env.VITE_COZE_API_BASE_URL || 'https://api.coze.cn';
const BOT_ID = import.meta.env.VITE_COZE_BOT_ID || '';
const USER_ID = import.meta.env.VITE_COZE_USER_ID || 'web-user';
const TOKEN_URL = import.meta.env.VITE_COZE_JWT_TOKEN_URL || '/api/coze-token';

// Token 缓存
let tokenCache: { token: string; expiresAt: number } | null = null;

/**
 * 从后端获取 access_token
 */
async function fetchAccessToken(): Promise<string> {
  // 检查缓存（提前 5 分钟刷新）
  if (tokenCache && tokenCache.expiresAt > Date.now() + 5 * 60 * 1000) {
    return tokenCache.token;
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch token: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.access_token) {
    throw new Error(`Invalid token response: ${JSON.stringify(data)}`);
  }

  // 缓存 token
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };

  return data.access_token;
}

/**
 * 创建带有动态 token 的 Coze 客户端
 */
async function createClient(): Promise<CozeAPI> {
  const token = await fetchAccessToken();
  
  return new CozeAPI({
    token,
    baseURL: API_BASE,
    allowPersonalAccessTokenInBrowser: true,
  });
}

/**
 * 流式问答 - JWT 授权版本
 */
export async function streamQuestion(
  question: string,
  options: Record<string, unknown> = {}
): Promise<AsyncGenerator<string, void, unknown>> {
  const q = typeof question === 'string' ? question.trim() : '';
  if (!q) throw new Error('Question is required');

  const client = await createClient();
  
  const stream: AsyncIterable<any> = await client.chat.stream({
    bot_id: BOT_ID,
    user_id: USER_ID,
    additional_messages: [
      {
        role: RoleType.User,
        content: q,
        content_type: 'text',
        type: 'question',
      },
    ],
    ...options,
  });

  async function sendCompletedLog(text: string): Promise<void> {
    if (!import.meta.env.DEV) return;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([JSON.stringify({ text })], { type: 'application/json' });
        navigator.sendBeacon('/__coze_log', blob);
        return;
      }
      await fetch('/__coze_log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
    } catch {
      void 0;
    }
  }

  async function* onlyCompletedText(): AsyncGenerator<string, void, unknown> {
    for await (const evt of stream) {
      if (evt?.event !== ChatEventType.CONVERSATION_MESSAGE_COMPLETED) continue;
      const type = evt?.data?.content_type;
      const raw = evt?.data?.content;
      let text = '';

      const rawStr = typeof raw === 'string' ? raw.trim() : '';
      if (rawStr && rawStr.startsWith('{')) {
        try {
          const obj = JSON.parse(rawStr);
          if (obj?.msg_type === 'answer' && typeof obj?.content === 'string') {
            text = obj.content;
          }
        } catch {
          void 0;
        }
      } else if (type === 'text' && rawStr) {
        text = rawStr;
      }

      if (text && text.trim()) {
        sendCompletedLog(text);
        yield text;
      }
    }
  }
  
  return onlyCompletedText();
}

// 导出配置供其他模块使用
export const botId = BOT_ID;
export const userId = USER_ID;
export { fetchAccessToken };
