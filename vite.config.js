import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const apiProxy = {
  '/api': {
    target: process.env.VITE_API_TARGET || 'http://localhost:3001',
    changeOrigin: true
  }
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Expose to all network interfaces (LAN / Wi-Fi)
    port: parseInt(process.env.VITE_PORT || '5173', 10),
    strictPort: true,
    allowedHosts: true,
    proxy: apiProxy
  },
  preview: {
    host: true,
    port: parseInt(process.env.VITE_PORT || '5173', 10),
    strictPort: true,
    allowedHosts: true,
    proxy: apiProxy
  },
  build: {
    sourcemap: false, // Strictly hide and suppress source maps in all production builds
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      // Two pages: the LottoTrack Pro site (/, /signin, /signup) and the POS app (/app/)
      input: {
        site: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app/index.html')
      }
    }
  },
  esbuild: {
    legalComments: 'none' // Remove comments from production bundles
  }
});
