import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin, type ViteDevServer } from 'vite'

import { saveChatInput } from './server/saveChatInput'
import { appendDoubaoCorpusEntry } from './server/saveDoubaoCorpus'
import { saveMeetingInput } from './server/saveMeetingInput'

// https://vite.dev/config/
const localApiMiddleware: Plugin = {
  name: 'local-api-middleware',
  configureServer(server: ViteDevServer) {
    server.middlewares.use('/api/meeting-save', (req, res, _next) => {
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
        let text: string | null = null;
        try {
          if (String(contentType).includes('application/json')) {
            const body = JSON.parse(data || '{}');
            text = typeof (body as any)?.text === 'string' ? (body as any).text : null;
          } else {
            text = typeof data === 'string' ? data : '';
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to parse meeting input body:', error);
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid request body' }));
          return;
        }

        if (text === null) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Text must be a string' }));
          return;
        }

        saveMeetingInput(text)
          .then((result) => {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, file: result.fileName, path: result.relativePath }));
          })
          .catch((error) => {
            // eslint-disable-next-line no-console
            console.error('Failed to save meeting input:', error);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Failed to save meeting input' }));
          });
      });
    });

    server.middlewares.use('/api/chat-save', (req, res, _next) => {
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
        let text: string | null = null;
        try {
          if (String(contentType).includes('application/json')) {
            const body = JSON.parse(data || '{}');
            text = typeof (body as any)?.text === 'string' ? (body as any).text : null;
          } else {
            text = typeof data === 'string' ? data : '';
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to parse chat input body:', error);
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid request body' }));
          return;
        }

        if (text === null) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Text must be a string' }));
          return;
        }

        saveChatInput(text)
          .then((result) => {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, file: result.fileName, path: result.relativePath }));
          })
          .catch((error) => {
            // eslint-disable-next-line no-console
            console.error('Failed to save chat input:', error);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Failed to save chat input' }));
          });
      });
    });

    server.middlewares.use('/api/doubao-corpus-add', (req, res, _next) => {
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
        let payload: { question?: string; answer?: string } | null = null;
        try {
          if (String(contentType).includes('application/json')) {
            const body = JSON.parse(data || '{}');
            payload = typeof body === 'object' && body ? body : null;
          } else {
            payload = null;
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to parse doubao corpus body:', error);
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid request body' }));
          return;
        }

        const question = payload?.question ?? null;
        const answer = payload?.answer ?? null;
        if (typeof question !== 'string' || typeof answer !== 'string') {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Question and answer must be strings' }));
          return;
        }

        appendDoubaoCorpusEntry(question, answer)
          .then((result) => {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, index: result.index, file: result.fileName, path: result.relativePath }));
          })
          .catch((error) => {
            // eslint-disable-next-line no-console
            console.error('Failed to append doubao corpus:', error);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Failed to append doubao corpus' }));
          });
      });
    });

  },
};

export default defineConfig({
  envPrefix: ['VITE_', 'ARK_', 'DOUBAO_'],
  plugins: [react(), localApiMiddleware],
})
