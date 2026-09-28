import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true, // Expose to all network interfaces (LAN / Wi-Fi)
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
