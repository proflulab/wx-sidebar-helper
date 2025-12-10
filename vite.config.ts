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

// JWT Token API 中间件
const cozeTokenMiddleware: Plugin = {
  name: 'coze-token-middleware',
  configureServer(server: ViteDevServer) {
    server.middlewares.use('/api/coze-token', async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      try {
        const config = getJWTConfig();
        if (!config.appId || !config.keyId || !config.privateKey) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing JWT configuration' }));
          return;
        }

        const tokenData = await getAccessToken(config);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(tokenData));
      } catch (error) {
        console.error('Token generation error:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ 
          error: 'Failed to generate token',
          message: error instanceof Error ? error.message : String(error),
        }));
      }
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
  plugins: [react(), cozeTokenMiddleware, cozeLogMiddleware],
})
