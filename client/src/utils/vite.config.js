import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/claude': {
        target: 'http://localhost:3001', // Proxy target = your proxy server
        changeOrigin: true,
        secure: false,
      },
    },
  },
});

