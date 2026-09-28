import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

function googleFormWebhookPlugin(): Plugin {
  const queueFile = path.resolve(__dirname, 'temp_form_queue.json');

  const getQueue = (): any[] => {
    try {
      if (fs.existsSync(queueFile)) {
        return JSON.parse(fs.readFileSync(queueFile, 'utf8'));
      }
    } catch {}
    return [];
  };

  const saveQueue = (items: any[]) => {
    try {
      fs.writeFileSync(queueFile, JSON.stringify(items, null, 2), 'utf8');
    } catch {}
  };

  return {
    name: 'google-form-webhook-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];

        // Handle CORS preflight
        if (req.method === 'OPTIONS' && (url === '/api/google-form-response' || url === '/api/google-form-responses')) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.statusCode = 204;
          res.end();
          return;
        }

        // Webhook receiver endpoint: POST /api/google-form-response
        if (req.method === 'POST' && url === '/api/google-form-response') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const queue = getQueue();
              const submission = {
                id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                received_at: new Date().toISOString(),
                ...data,
              };
              queue.push(submission);
              saveQueue(queue);

              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, message: 'Response received', submission }));
            } catch (err: any) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
            }
          });
          return;
        }

        // Poller endpoint: GET /api/google-form-responses
        if (req.method === 'GET' && url === '/api/google-form-responses') {
          const queue = getQueue();
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.statusCode = 200;
          res.end(JSON.stringify({ queue }));
          return;
        }

        // Clear processed submissions: POST /api/google-form-responses/clear
        if (req.method === 'POST' && url === '/api/google-form-responses/clear') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const { ids } = JSON.parse(body || '{}');
              const queue = getQueue();
              const remaining = Array.isArray(ids)
                ? queue.filter((item: any) => !ids.includes(item.id))
                : [];
              saveQueue(remaining);
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ success: true, countRemaining: remaining.length }));
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Failed to clear' }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), googleFormWebhookPlugin()],
});
