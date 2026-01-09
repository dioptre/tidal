import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Plugin to provide stubs for React Native modules
const reactNativeStubsPlugin = () => ({
  name: 'react-native-stubs',
  enforce: 'pre',
  resolveId(id) {
    if (id === 'react-native-fs') {
      return '\0react-native-fs-stub';
    }
    if (id === 'react-native-audio-api') {
      return '\0react-native-audio-api-stub';
    }
    if (id === 'expo-modules-core') {
      return '\0expo-modules-core-stub';
    }
    if (id === 'react-reconciler') {
      return '\0react-reconciler-stub';
    }
    if (id === 'react-reconciler/constants') {
      return '\0react-reconciler-constants-stub';
    }
    return null;
  },
  load(id) {
    if (id === '\0react-native-fs-stub') {
      return 'export default {}; export const exists = () => Promise.resolve(false);';
    }
    if (id === '\0react-native-audio-api-stub') {
      return 'export const AudioContext = undefined; export default {};';
    }
    if (id === '\0expo-modules-core-stub') {
      return 'export default {}; export const NativeModulesProxy = {};';
    }
    if (id === '\0react-reconciler-stub') {
      // Stub for react-reconciler on web - Skia uses web rendering instead
      // react-reconciler is a factory function that takes a host config
      return `
        function createReconciler(hostConfig) {
          return {
            injectIntoDevTools: () => {},
            createContainer: () => ({}),
            updateContainer: () => {},
            getPublicRootInstance: () => null,
          };
        }
        export default createReconciler;
      `;
    }
    if (id === '\0react-reconciler-constants-stub') {
      return `
        export const ContinuousEventPriority = 1;
        export const DefaultEventPriority = 16;
        export const DiscreteEventPriority = 2;
        export const IdleEventPriority = 536870912;
      `;
    }
    return null;
  },
});

export default defineConfig({
  base: '/tidal/',
  plugins: [
    react({
      include: '**/*.{jsx,js}',
    }),
    reactNativeStubsPlugin(),
  ],
  resolve: {
    alias: {
      'react-native': 'react-native-web',
      'react-native/Libraries/Image/AssetRegistry': 'react-native-web/dist/modules/AssetRegistry',
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
    include: ['react', 'react-dom', 'react-dom/client'],
    exclude: [
      '@shopify/react-native-skia',
      'react-native-fs',
      'react-native-audio-api',
      'expo-modules-core',
      'react-reconciler',
      'canvaskit-wasm',
    ],
  },
  ssr: {
    noExternal: ['@shopify/react-native-skia'],
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
});
