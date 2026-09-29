import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxies all /api requests directly to live Render backend
      '/api': {
        target: 'https://rescuebridge.onrender.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
