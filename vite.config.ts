import { defineConfig, type Plugin, type ViteDevServer, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
const cozeLogMiddleware: Plugin = {
  name: 'coze-log-middleware',
  configureServer(server: ViteDevServer) {
    server.middlewares.use('/__coze_log', (req, res, _next) => {
      // 允许 OPTIONS 预检与 POST
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
            // 兼容 sendBeacon 默认的 text/plain
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

// 本地开发时的 JWT Token API 中间件
function createCozeTokenMiddleware(env: Record<string, string>): Plugin {
  return {
    name: 'coze-token-middleware',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/coze-token', async (req, res, _next) => {
        // CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        try {
          // 动态导入 jsonwebtoken（仅在服务端使用）
          const jwt = await import('jsonwebtoken');
          
          const APP_ID = env.COZE_JWT_APP_ID || '';
          const KEY_ID = env.COZE_JWT_KEY_ID || '';
          const PRIVATE_KEY = (env.COZE_JWT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
          const API_BASE = env.VITE_COZE_API_BASE_URL || 'https://api.coze.cn';

          if (!APP_ID || !KEY_ID || !PRIVATE_KEY) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ 
              error: 'Missing JWT configuration',
              debug: { hasAppId: !!APP_ID, hasKeyId: !!KEY_ID, hasPrivateKey: !!PRIVATE_KEY }
            }));
            return;
          }

          // 生成 JWT
          const now = Math.floor(Date.now() / 1000);
          const payload = {
            iss: APP_ID,
            aud: 'api.coze.cn',
            iat: now,
            exp: now + 3600,
            jti: `${now}-${Math.random().toString(36).slice(2)}`,
          };

          const jwtToken = jwt.default.sign(payload, PRIVATE_KEY, {
            algorithm: 'RS256',
            header: { alg: 'RS256', typ: 'JWT', kid: KEY_ID } as any,
          });

          // 换取 access_token
          const response = await fetch(`${API_BASE}/api/permission/oauth2/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${jwtToken}`,
            },
            body: JSON.stringify({
              grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
              duration_seconds: 86399,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
          }

          const data = await response.json();
          
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            access_token: data.access_token,
            expires_in: data.expires_in || 86399,
          }));
        } catch (error) {
          console.error('Error in coze-token middleware:', error);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: 'Failed to get access token',
            message: error instanceof Error ? error.message : String(error),
          }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // 加载所有环境变量（包括不带 VITE_ 前缀的）
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react(), cozeLogMiddleware, createCozeTokenMiddleware(env)],
  };
})
