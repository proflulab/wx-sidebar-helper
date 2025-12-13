/**
 * Vercel Serverless Function: Coze Chat 流式代理
 * 
 * 使用 SSE 转发 Coze 的流式响应
 * Token 完全在服务端管理，不暴露给前端
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';

// 配置
const APP_ID = process.env.COZE_JWT_APP_ID || '';
const KEY_ID = process.env.COZE_JWT_KEY_ID || '';
const PRIVATE_KEY = (process.env.COZE_JWT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const API_BASE = process.env.VITE_COZE_API_BASE_URL || 'https://api.coze.cn';
const BOT_ID = process.env.VITE_COZE_BOT_ID || '';

// 速率限制
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 20;

// Token 缓存
let cachedToken: { token: string; expiresAt: number } | null = null;

function getClientId(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  return ip || 'unknown';
}

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(clientId);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(clientId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) return false;
  record.count++;
  return true;
}

function generateJWT(): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iss: APP_ID, aud: 'api.coze.cn', iat: now, exp: now + 3600, jti: `${now}-${Math.random().toString(36).slice(2)}` },
    PRIVATE_KEY,
    { algorithm: 'RS256', header: { alg: 'RS256', typ: 'JWT', kid: KEY_ID } }
  );
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  const response = await fetch(`${API_BASE}/api/permission/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${generateJWT()}` },
    body: JSON.stringify({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', duration_seconds: 86400 }),
  });

  if (!response.ok) throw new Error(`OAuth failed: ${response.status}`);
  const data = await response.json();
  if (!data.access_token) throw new Error('No access_token');
  
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 86400) * 1000 };
  return data.access_token;
}

export const config = {
  // 启用流式响应
  supportsResponseStreaming: true,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 速率限制
  if (!checkRateLimit(getClientId(req))) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  try {
    const { message, user_id = 'web-user' } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const token = await getAccessToken();

    // 调用 Coze Chat API（流式）
    const chatResponse = await fetch(`${API_BASE}/v3/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        bot_id: BOT_ID,
        user_id,
        stream: true,
        auto_save_history: true,
        additional_messages: [{ role: 'user', content: message, content_type: 'text' }],
      }),
    });

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      console.error('Coze API error:', errorText);
      return res.status(502).json({ error: 'Chat API failed' });
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 转发流式响应
    const reader = chatResponse.body?.getReader();
    if (!reader) {
      return res.status(500).json({ error: 'No response body' });
    }

    const decoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }
    } finally {
      reader.releaseLock();
    }

    res.end();

  } catch (error) {
    console.error('Stream proxy error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.end();
  }
}
