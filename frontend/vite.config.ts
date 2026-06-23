import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl()
  ],
  server: {
    port: 5173,
    host: true, // Needed for docker mapping
    https: true,
    proxy: {
      '/api': {
        target: 'https://localhost:5000',
        secure: false, // Bypass SSL certificate verification for self-signed certificates
        changeOrigin: true
      },
      '/socket.io': {
        target: 'https://localhost:5000',
        secure: false, // Bypass SSL certificate verification for self-signed certificates
        ws: true, // Enable proxying for WebSockets
        changeOrigin: true
      }
    }
  }
});
