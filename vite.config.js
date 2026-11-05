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
  },
  preview: {
    host: true,
    port: parseInt(process.env.VITE_PORT || '5173', 10),
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    sourcemap: false, // Strictly hide and suppress source maps in all production builds
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  esbuild: {
    legalComments: 'none' // Remove comments from production bundles
  }
});
