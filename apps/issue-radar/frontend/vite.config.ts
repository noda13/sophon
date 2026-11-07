import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3902,
    proxy: {
      '/api': 'http://localhost:8902',
    },
  },
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    outDir: 'dist',
  },
});
