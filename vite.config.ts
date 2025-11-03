import { defineConfig, type Plugin, type ViteDevServer } from 'vite'
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

export default defineConfig({
  plugins: [react(), cozeLogMiddleware],
})
