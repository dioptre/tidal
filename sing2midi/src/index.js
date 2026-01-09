import React from 'react';
import ReactDOM from 'react-dom/client';
import { LoadSkiaWeb } from '@shopify/react-native-skia/src/web';

// Get base path from environment (set via PUBLIC_URL in .env or build)
const basePath = process.env.PUBLIC_URL || '/';
const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`;

// Use LoadSkiaWeb to properly initialize Skia for web
// Point to the WASM file in the public directory (served directly, not bundled by webpack)
LoadSkiaWeb({
  locateFile: (file) => `${normalizedBasePath}${file}`
}).then(async () => {
  console.log('[Skia] Skia loaded successfully via LoadSkiaWeb');
  console.log('[Skia] global.CanvasKit:', typeof global.CanvasKit);
  console.log('[Skia] window.CanvasKit:', typeof window.CanvasKit);

  // Ensure CanvasKit is available on window as well
  if (global.CanvasKit && !window.CanvasKit) {
    window.CanvasKit = global.CanvasKit;
    console.log('[Skia] Set window.CanvasKit from global.CanvasKit');
  }

  // Dynamically import App AFTER CanvasKit is loaded to avoid initialization errors
  const { default: App } = await import('./App.jsx');

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(<App />);
}).catch((error) => {
  console.error('[Skia] Failed to load Skia:', error);
  document.getElementById('root').innerHTML = '<div style="color: white; padding: 20px;">Failed to load Skia. Please refresh the page.</div>';
});
