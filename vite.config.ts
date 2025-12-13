import { defineConfig, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import jwt from 'jsonwebtoken'
import { config as dotenvConfig } from 'dotenv'

// 加载 .env 文件到 process.env
dotenvConfig();

// JWT 配置（从环境变量读取）
const getJWTConfig = () => ({
  appId: process.env.COZE_JWT_APP_ID || '',
  keyId: process.env.COZE_JWT_KEY_ID || '',
  privateKey: (process.env.COZE_JWT_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  apiBase: process.env.VITE_COZE_API_BASE_URL || 'https://api.coze.cn',
});

// Token 缓存
let tokenCache: { token: string; expiresAt: number } | null = null;

// 生成 JWT
function generateJWT(config: ReturnType<typeof getJWTConfig>): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: config.appId,
    aud: 'api.coze.cn',
    iat: now,
    exp: now + 3600,
    jti: `${now}-${Math.random().toString(36).slice(2)}`,
  };

  return jwt.sign(payload, config.privateKey, {
    algorithm: 'RS256',
    header: { alg: 'RS256', typ: 'JWT', kid: config.keyId },
  });
}

// 获取 Access Token
async function getAccessToken(config: ReturnType<typeof getJWTConfig>): Promise<{ access_token: string; expires_in: number }> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) {
    return { access_token: tokenCache.token, expires_in: Math.floor((tokenCache.expiresAt - Date.now()) / 1000) };
  }

  const jwtToken = generateJWT(config);
  const response = await fetch(`${config.apiBase}/api/permission/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`,
    },
    body: JSON.stringify({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      duration_seconds: 86400,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OAuth failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  if (data.access_token) {
    tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in || 86400) * 1000,
    };
    return { access_token: data.access_token, expires_in: data.expires_in || 86400 };
  }

  throw new Error(`Invalid OAuth response: ${JSON.stringify(data)}`);
}

// 速率限制（本地开发用）
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 30;

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }
  record.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count };
}

// JWT Token API 中间件（带安全保护）
const cozeTokenMiddleware: Plugin = {
  name: 'coze-token-middleware',
  configureServer(server: ViteDevServer) {
    server.middlewares.use('/api/coze-token', async (req, res) => {
      // 安全响应头
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Request-Id');

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      // 只允许 POST
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      // 速率限制
      const clientIp = req.socket?.remoteAddress || 'unknown';
      const rateLimit = checkRateLimit(clientIp);
      res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
      
      if (!rateLimit.allowed) {
        res.statusCode = 429;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Too many requests', retryAfter: 60 }));
        return;
      }

      try {
        const config = getJWTConfig();
        if (!config.appId || !config.keyId || !config.privateKey) {
          console.error('[Coze] Missing JWT configuration');
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Server configuration error' }));
          return;
        }

        const tokenData = await getAccessToken(config);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          access_token: tokenData.access_token,
          expires_in: tokenData.expires_in,
          token_type: 'Bearer',
        }));
      } catch (error) {
        console.error('[Coze] Token generation error:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Failed to generate token' }));
      }
    });
  },
};

// Coze 流式聊天代理中间件（Token 不暴露给前端）
const cozeStreamMiddleware: Plugin = {
  name: 'coze-stream-middleware',
  configureServer(server: ViteDevServer) {
    server.middlewares.use('/api/coze-stream', async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      // 速率限制
      const clientIp = req.socket?.remoteAddress || 'unknown';
      if (!checkRateLimit(clientIp).allowed) {
        res.statusCode = 429;
        res.end(JSON.stringify({ error: 'Too many requests' }));
        return;
      }

      // 读取请求体
      let body = '';
      req.on('data', (chunk: Buffer | string) => {
        body += typeof chunk === 'string' ? chunk : chunk.toString();
      });

      req.on('end', async () => {
        try {
          const { message, user_id = 'web-user' } = JSON.parse(body || '{}');
          if (!message) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Message is required' }));
            return;
          }

          const config = getJWTConfig();
          const tokenData = await getAccessToken(config);
          const botId = process.env.VITE_COZE_BOT_ID || '';

          // 调用 Coze API
          const chatResponse = await fetch(`${config.apiBase}/v3/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokenData.access_token}`,
            },
            body: JSON.stringify({
              bot_id: botId,
              user_id,
              stream: true,
              auto_save_history: true,
              additional_messages: [{ role: 'user', content: message, content_type: 'text' }],
            }),
          });

          if (!chatResponse.ok) {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: 'Chat API failed' }));
            return;
          }

          // 设置 SSE 响应头
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          // 转发流式响应
          const reader = chatResponse.body?.getReader();
          if (!reader) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'No response body' }));
            return;
          }

          const decoder = new TextDecoder();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(decoder.decode(value, { stream: true }));
            }
          } finally {
            reader.releaseLock();
          }
          res.end();

        } catch (error) {
          console.error('[Coze] Stream proxy error:', error);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Internal server error' }));
          } else {
            res.end();
          }
        }
      });
    });
  },
};

// Coze 日志中间件
const cozeLogMiddleware: Plugin = {
  name: 'coze-log-middleware',
  configureServer(server: ViteDevServer) {
    server.middlewares.use('/__coze_log', (req, res, _next) => {
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.end();
        return;
      }
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
      }
      const ctHeader = req.headers['content-type'];
      const contentType = Array.isArray(ctHeader) ? ctHeader[0] : (ctHeader ?? '');
      let data = '';
      req.on('data', (chunk: Buffer | string) => {
        data += typeof chunk === 'string' ? chunk : chunk.toString();
      });
      req.on('end', () => {
        let text = '';
        try {
          if (String(contentType).includes('application/json')) {
            const body = JSON.parse(data || '{}');
            text = typeof (body as any)?.text === 'string' ? (body as any).text : '';
          } else {
            text = typeof data === 'string' ? data : '';
          }
          // eslint-disable-next-line no-console
          console.log(`✅ [Coze] Message completed: ${text}`);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('Failed to parse coze log body:', e);
        }
        res.statusCode = 200;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'text/plain');
        res.end('OK');
      });
    });
  },
};

export default defineConfig({
  plugins: [react(), cozeStreamMiddleware, cozeTokenMiddleware, cozeLogMiddleware],
})
