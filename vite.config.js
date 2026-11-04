import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true, // Expose to all network interfaces (LAN / Wi-Fi)
    port: parseInt(process.env.VITE_PORT || '5173', 10),
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
