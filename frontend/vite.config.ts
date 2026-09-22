/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load .env files and process.env so the dev-server proxy target is
  // configurable both on the host (VITE_API_PROXY_TARGET in .env) and inside
  // Docker Compose (service environment).
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8000';

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      // Accept any hostname so the app works behind preview/reverse proxies
      // (dev server only; production hosting should set its own host policy).
      allowedHosts: true,
      // The browser always calls same-origin relative URLs (e.g. /api/v1/health);
      // the Vite dev server proxies them to FastAPI. This keeps frontend code
      // free of hardcoded backend hosts and works behind any preview proxy.
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
    },
  };
});
