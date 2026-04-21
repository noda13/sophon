import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    port: 3902,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8902',
        changeOrigin: true,
      },
    },
  },
});
