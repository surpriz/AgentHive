import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { apiPlugin } from './vite-plugin-api';

export default defineConfig(({ mode }) => {
  // Expose .env.local to the in-process API (DATABASE_URL, GITHUB_*). Real env vars win.
  for (const [k, v] of Object.entries(loadEnv(mode, process.cwd(), ''))) process.env[k] ??= v;
  return { plugins: [react(), tailwindcss(), apiPlugin()] };
});
