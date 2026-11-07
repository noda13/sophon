import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: process.env.SITE_BASE || process.env.VITE_BASE_PATH || '/',
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../shared'),
    },
  },
});
