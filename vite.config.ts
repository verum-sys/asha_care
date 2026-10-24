import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const name of ['GROQ_API_KEY', 'GROQ_MODEL', 'CLERK_SECRET_KEY']) if (env[name]) process.env[name] = env[name];
  return {
  plugins: [
    react(),
    {
      name: 'local-answer-api',
      configureServer(server) {
        server.middlewares.use('/api/interpret-answer', async (req, res) => {
          try {
            let body = '';
            for await (const chunk of req) {
              body += chunk.toString();
              if (body.length > 5000) { res.statusCode = 413; res.end('Request too large'); return; }
            }
            const request = req as typeof req & { body?: unknown };
            try { request.body = body ? JSON.parse(body) : undefined; } catch { res.statusCode = 400; res.end('Invalid JSON'); return; }
            const { default: handler } = await server.ssrLoadModule('/api/interpret-answer.ts');
            await handler(request, res);
          } catch { res.statusCode = 500; res.end('Interpretation unavailable'); }
        });
      },
    },
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'DiagNXT CareLink',
        short_name: 'CareLink',
        description: 'Offline AI for care continuity — referral & follow-up for frontline health workers',
        theme_color: '#0b3b5c',
        background_color: '#f4f7fa',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,m4a}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  test: { environment: 'node' },
  };
});
