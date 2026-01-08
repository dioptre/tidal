import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/tidal/',
  plugins: [
    react({
      include: '**/*.{jsx,js}',
    }),
  ],
  resolve: {
    alias: {
      'react-native': 'react-native-web',
      buffer: 'buffer',
    },
    extensions: ['.web.js', '.js', '.web.jsx', '.jsx', '.json'],
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    esbuildOptions: {
      resolveExtensions: ['.web.js', '.js', '.web.jsx', '.jsx'],
      loader: {
        '.js': 'jsx',
      },
      define: {
        global: 'globalThis',
      },
    },
  },
});
