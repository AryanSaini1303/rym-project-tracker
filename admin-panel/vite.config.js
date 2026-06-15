import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'https'

// Custom Vite plugin to act as a secure backend proxy for Auth metadata
const supabaseProxyPlugin = () => ({
  name: 'supabase-proxy',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url && req.url.startsWith('/api/get-profile/')) {
        const userId = req.url.split('/api/get-profile/')[1];
        
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
      } else {
        next();
      }
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), supabaseProxyPlugin()],
})
