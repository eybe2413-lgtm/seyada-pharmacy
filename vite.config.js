import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'vendor-i18n':     ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          'vendor-xlsx':     ['xlsx'],
          'vendor-charts':   ['recharts'],
          'vendor-scanner':  ['html5-qrcode'],
        },
      },
    },
  },
  server: { port: 5173 },
});
