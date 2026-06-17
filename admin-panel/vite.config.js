import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'https'
import { VitePWA } from 'vite-plugin-pwa'

// Custom Vite plugin to act as a secure backend proxy for Auth metadata
const supabaseProxyPlugin = () => ({
  name: 'supabase-proxy',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url && req.url.startsWith('/api/get-profile')) {
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const userId = urlObj.searchParams.get('id');
        
        // Load environment variables manually for Vite middleware
        const env = loadEnv(server.config.mode, process.cwd(), '');
        const supabaseUrl = env.VITE_SUPABASE_URL;
        const serviceKey = env.VITE_SUPABASE_SERVICE_KEY;

        if (!supabaseUrl || !serviceKey) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Missing Supabase credentials' }));
          return;
        }

        const url = new URL(`${supabaseUrl}/auth/v1/admin/users/${userId}`);
        const options = {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: 'GET',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json'
          }
        };

        const proxyReq = https.request(options, (proxyRes) => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        });

        proxyReq.end();
      } else if (req.url && req.url === '/api/summarize-project' && req.method === 'POST') {
        const env = loadEnv(server.config.mode, process.cwd(), '');
        const openAiKey = env.OPENAI_API_KEY;

        if (!openAiKey) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Missing OPENAI_API_KEY in .env file' }));
          return;
        }

        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            const parsedBody = JSON.parse(body);
            let rawText = parsedBody.text || '';
            const link = parsedBody.link || '';

            if (link) {
              try {
                let fetchUrl = link;
                // If it's a Google Doc, try to grab the pure text export directly
                if (link.includes('docs.google.com/document/d/')) {
                  const docIdMatch = link.match(/\/d\/([a-zA-Z0-9-_]+)/);
                  if (docIdMatch) {
                    fetchUrl = `https://docs.google.com/document/d/${docIdMatch[1]}/export?format=txt`;
                  }
                }
                
                const linkRes = await fetch(fetchUrl);
                if (!linkRes.ok) throw new Error("Failed to fetch link");
                const htmlOrText = await linkRes.text();
                
                // Strip scripts, styles, and HTML tags to get raw text
                rawText = htmlOrText
                  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                  .replace(/<[^>]*>?/gm, ' ')
                  .replace(/\s\s+/g, ' ');
              } catch (err) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Failed to extract text from link. Please ensure it is public.' }));
                return;
              }
            }

            // Truncate to save tokens (approx 4 pages of text max)
            const truncatedText = rawText.substring(0, 15000);

            const openaiReqBody = JSON.stringify({
              model: "gpt-4o-mini",
              response_format: { type: "json_object" },
              messages: [
                {
                  role: "system",
                  content: "You are an expert technical project manager. Read the following raw extracted text from a project brief/document. Create a highly accurate JSON object with exactly three keys: 'title' (a concise 3-6 word project title), 'description' (a highly detailed summary between 150-200 words capturing the full scope, requirements, and deliverables), and 'tasks' (an array of objects, where each object represents a main task/milestone/scope item extracted from headings or main sections in the text, containing: 'title' [a short, clear, action-oriented task title, 3-7 words] and 'description' [a brief task description]). The output MUST be valid JSON."
                },
                {
                  role: "user",
                  content: truncatedText
                }
              ]
            });

            const options = {
              hostname: 'api.openai.com',
              path: '/v1/chat/completions',
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openAiKey}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(openaiReqBody)
              }
            };

            const proxyReq = https.request(options, (proxyRes) => {
              res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
              proxyRes.pipe(res);
            });

            proxyReq.on('error', (err) => {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            });

            proxyReq.write(openaiReqBody);
            proxyReq.end();

          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid request body' }));
          }
        });

      } else {
        next();
      }
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    supabaseProxyPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'RYM Admin Panel',
        short_name: 'RYM Admin',
        description: 'Admin dashboard for RYM Project Tracker',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
