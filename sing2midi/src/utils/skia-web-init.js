// Import JsiSkFont to properly wrap fonts
import { JsiSkFont } from '@shopify/react-native-skia/lib/module/skia/web/JsiSkFont';

// Initialize Skia on web using globally loaded CanvasKit
export const initializeSkiaWeb = async () => {
  console.log('[Skia Init] Starting initialization...');

  if (typeof window === 'undefined') {
    throw new Error('Window is undefined - not in browser environment');
  }

  if (!window.CanvasKit) {
    throw new Error('CanvasKit not loaded on window object');
  }

  console.log('[Skia Init] CanvasKit found on window');

  // CanvasKit is already initialized, just need to set it up for @shopify/react-native-skia
  const CanvasKit = window.CanvasKit;

  // Create a Skia object compatible with @shopify/react-native-skia
  if (!window.Skia) {
    console.log('[Skia Init] Creating Skia compatibility layer...');

    try {
      // Create default font manager
      // CanvasKit uses a singleton pattern - the FontMgr is accessed via static methods
      let defaultFontMgr = null;

      console.log('[Skia Init] CanvasKit.FontMgr methods:', CanvasKit.FontMgr ? Object.keys(CanvasKit.FontMgr) : 'FontMgr not found');

      // Try various ways to get/create a FontMgr
      try {
        if (CanvasKit.FontMgr) {
          // CanvasKit has FromData - this creates a FontMgr from font data
          // When called without args, it should create an empty font manager
          if (CanvasKit.FontMgr.FromData) {
            try {
              // Try with empty array (no custom fonts)
              defaultFontMgr = CanvasKit.FontMgr.FromData([]);
              console.log('[Skia Init] FontMgr.FromData([]) created:', !!defaultFontMgr);
            } catch (e1) {
              console.warn('[Skia Init] FromData([]) failed:', e1);
              try {
                // Try with no args
                defaultFontMgr = CanvasKit.FontMgr.FromData();
                console.log('[Skia Init] FontMgr.FromData() created:', !!defaultFontMgr);
              } catch (e2) {
                console.warn('[Skia Init] FromData() failed:', e2);
                // Try with null
                try {
                  defaultFontMgr = CanvasKit.FontMgr.FromData(null);
                  console.log('[Skia Init] FontMgr.FromData(null) created:', !!defaultFontMgr);
                } catch (e3) {
                  console.warn('[Skia Init] Could not create FontMgr from data:', e3);
                }
              }
            }
          }

          // Try Ce if available (might be internal CanvasKit method)
          if (!defaultFontMgr && CanvasKit.FontMgr.Ce) {
            try {
              defaultFontMgr = CanvasKit.FontMgr.Ce();
              console.log('[Skia Init] FontMgr.Ce() created:', !!defaultFontMgr);
            } catch (e) {
              console.warn('[Skia Init] Could not call Ce():', e);
            }
          }
        }
      } catch (e) {
        console.warn('[Skia Init] Error exploring FontMgr:', e);
      }

      // Create a mock FontMgr that can create basic fonts even without actual font data
      const mockFontMgr = {
        matchFamilyStyle: (family, style) => {
          console.log('[Skia] matchFamilyStyle called for:', family);
          // Return null - Font constructor can handle null typeface in CanvasKit
          return null;
        },
        countFamilies: () => 0,
        getFamilyName: () => 'sans-serif',
      };

      window.Skia = {
        FontMgr: {
          RefDefault: () => {
            if (defaultFontMgr) {
              console.log('[Skia] Returning cached defaultFontMgr');
              return defaultFontMgr;
            }
            // Return mock if no real FontMgr available
            console.log('[Skia] Returning mock FontMgr');
            return mockFontMgr;
          },
          System: () => {
            // System() should return the same as RefDefault()
            if (defaultFontMgr) {
              console.log('[Skia] System() returning cached defaultFontMgr');
              return defaultFontMgr;
            }
            console.log('[Skia] System() returning mock FontMgr');
            return mockFontMgr;
          },
        },
        Font: (typeface, size) => {
          // Wrap CanvasKit Font in JsiSkFont (same pattern as JsiSkia.js)
          try {
            const canvasKitFont = new CanvasKit.Font(typeface, size);
            const wrappedFont = new JsiSkFont(CanvasKit, canvasKitFont);
            console.log('[Skia] Created JsiSkFont with size:', size, 'typeface:', !!typeface);
            return wrappedFont;
          } catch (e) {
            console.error('[Skia] Error creating font:', e);
            // Return null on error - components can handle null fonts
            return null;
          }
        },
        Color: (r, g, b, a) => CanvasKit.Color(r, g, b, a),
        ...CanvasKit,
      };

      console.log('[Skia Init] Skia object created with keys:', Object.keys(window.Skia));
      // Don't call RefDefault here - it might trigger errors before everything is ready
      console.log('[Skia Init] FontMgr.RefDefault function created:', typeof window.Skia.FontMgr.RefDefault === 'function');
    } catch (error) {
      console.error('[Skia Init] Error creating Skia object:', error);
      throw error;
    }
  } else {
    console.log('[Skia Init] Skia object already exists');
  }

  // Dispatch event to notify components
  console.log('[Skia Init] Dispatching skia-loaded event');
  window.dispatchEvent(new Event('skia-loaded'));

  console.log('[Skia Init] Initialization complete!');
  return true;
};
