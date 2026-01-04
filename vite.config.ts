import fs from 'fs';
import path from 'path';

import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin, type ViteDevServer } from 'vite'

import { hasJwtConfig, requestCozeAccessToken } from './server/createJwtToken'
import {
  CozeProxyError,
  createCozeChatStream,
  parseProxyPayload,
  streamAsNdjson,
} from './server/proxyCozeStream'

const loadLocalEnv = (): void => {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf('=');
    if (i === -1) continue;
    const key = s.slice(0, i).trim();
    const value = s.slice(i + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

// 确保 Vite 本地开发环境能读取 .env 中的 JWT 配置
loadLocalEnv();

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

    server.middlewares.use('/api/coze-token', (req, res, _next) => {
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.end();
        return;
      }

      if (req.method !== 'GET') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
      }

      if (!hasJwtConfig()) {
        res.statusCode = 500;
        res.end('JWT environment variables are not configured');
        return;
      }

      requestCozeAccessToken()
        .then((token) => {
          res.statusCode = 200;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(token));
        })
        .catch((error: unknown) => {
          // eslint-disable-next-line no-console
          console.error('Failed to create Coze JWT token', error);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Failed to generate access token' }));
        });
    });

    server.middlewares.use('/api/coze-chat', async (req, res, _next) => {
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
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
      }

      try {
        const payload = await parseProxyPayload(req);
        const stream = await createCozeChatStream(payload);
        await streamAsNdjson(stream, res);
      } catch (error) {
        const status =
          error instanceof CozeProxyError
            ? error.statusCode
            : 500;
        if (!res.headersSent) {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
        }
        res.end(JSON.stringify({ error: (error as Error).message || 'Unexpected error' }));
      }
    });
  },
};

export default defineConfig({
  plugins: [react(), cozeLogMiddleware],
})
