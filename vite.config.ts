import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { registryPlugin } from './vite-plugin-registry';

export default defineConfig({
  plugins: [react(), tailwindcss(), registryPlugin()],
});
