import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

/**
 * The OCR engine, its worker and the English language data are served from CareLink's own site (not a public CDN),
 * at fixed paths under /ocr/. Only DH and TCC load them, when a report is summarised.
 */
const require = createRequire(import.meta.url);
const OCR_FILES: Record<string, string> = {
  'ocr/worker.min.js': require.resolve('tesseract.js/dist/worker.min.js'),
  'ocr/tesseract-core-lstm.wasm.js': require.resolve('tesseract.js-core/tesseract-core-lstm.wasm.js'),
  'ocr/eng.traineddata.gz': require.resolve('@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'),
};
const ocrFiles = {
  name: 'self-hosted-ocr',
  configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, res: { setHeader: (k: string, v: string) => void; end: (b: Buffer) => void }, next: () => void) => void) => void } }) {
    server.middlewares.use((req, res, next) => {
      const path = (req.url ?? '').split('?')[0].replace(/^\//, '');
      const file = OCR_FILES[path];
      if (!file) return next();
      res.setHeader('Content-Type', path.endsWith('.gz') ? 'application/octet-stream' : 'text/javascript');
      res.end(readFileSync(file));
    });
  },
  generateBundle(this: { emitFile: (f: { type: 'asset'; fileName: string; source: Uint8Array }) => void }) {
    for (const [fileName, file] of Object.entries(OCR_FILES)) this.emitFile({ type: 'asset', fileName, source: readFileSync(file) });
  },
};

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
              if (body.length > 20000) { res.statusCode = 413; res.end('Request too large'); return; }
            }
            const request = req as typeof req & { body?: unknown };
            try { request.body = body ? JSON.parse(body) : undefined; } catch { res.statusCode = 400; res.end('Invalid JSON'); return; }
            const { default: handler } = await server.ssrLoadModule('/api/interpret-answer.ts');
            await handler(request, res);
          } catch { res.statusCode = 500; res.end('Interpretation unavailable'); }
        });
      },
    },
    ocrFiles,
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
        // Report reading (PDF and OCR) is only used online at DH and TCC; keep it out of the offline install.
        globIgnores: ['ocr/**', '**/pdf.worker*', '**/reportText*', '**/pdf-*', '**/tesseract*'],
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
