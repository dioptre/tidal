/**
 * STUDIO SESSION - Brand Color Palette
 * Algorithmic Palette for Sound Recording & Audio Production
 *
 * JavaScript constants version for use in React Native StyleSheet
 */

import { Platform } from 'react-native';

// Font Families
export const FONT_UI = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
});

export const FONT_HEADER = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  web: 'Courier New, monospace'
});

export const FONT_TECHNICAL = Platform.select({
  ios: 'Courier New',
  android: 'monospace',
  web: 'monospace'
});

// Base Colors
export const STUDIO_BLACK = '#0a0e27';
export const DEEP_CHARCOAL = '#1a1f3a';
export const SLATE_GRAY = '#2a3f5f';
export const GRAPHITE = '#3a4a6f';
export const STUDIO_WHITE = '#e8eef5';

// Primary Actions
export const SIGNAL_GREEN = '#2fb878';
export const WAVEFORM_BLUE = '#1e7fb8';
export const DEEP_PURPLE = '#6b4ba8';
export const STUDIO_RED = '#c43e3e';

// Accents
export const WARM_AMBER = '#d4891f';
export const GOLD_METER = '#e6b84d';
export const CYAN_MONITOR = '#00b8d4';

// Jewel Tones
export const EMERALD = '#1fa880';
export const SAPPHIRE = '#0f5f9f';
export const AMETHYST = '#7c4fa8';

// Earth Tones
export const WARM_TAUPE = '#6b5a50';
export const CLAY = '#8b7355';
export const STEEL_BLUE = '#4a6fa8';
export const MUTED_PLUM = '#5a4a6f';
export const ASH = '#5f6a7f';

// Semantic Colors
export const BG_PRIMARY = STUDIO_BLACK;
export const BG_SECONDARY = DEEP_CHARCOAL;
export const BORDER_PRIMARY = SLATE_GRAY;
export const TEXT_PRIMARY = STUDIO_WHITE;
export const TEXT_SECONDARY = ASH;

// Button Colors
export const BTN_RECORD = STUDIO_RED;
export const BTN_PLAY = WAVEFORM_BLUE;
export const BTN_STOP = STUDIO_RED;
export const BTN_CLEAR = SLATE_GRAY;
export const BTN_UNDO = AMETHYST;
export const BTN_EXPORT = STEEL_BLUE;
export const BTN_DOWNLOAD = STEEL_BLUE;
export const BTN_UPLOAD = SAPPHIRE;
export const BTN_TOGGLE = MUTED_PLUM;
export const BTN_TOGGLE_ACTIVE = DEEP_PURPLE;
export const BTN_SECONDARY = STEEL_BLUE;
export const BTN_DISABLED = GRAPHITE;

// Default export with all colors and fonts organized by category
export default {
  // Fonts
  fontUI: FONT_UI,
  fontHeader: FONT_HEADER,
  fontTechnical: FONT_TECHNICAL,

  // Base Colors
  studioBlack: STUDIO_BLACK,
  deepCharcoal: DEEP_CHARCOAL,
  slateGray: SLATE_GRAY,
  graphite: GRAPHITE,
  studioWhite: STUDIO_WHITE,

  // Primary Actions
  signalGreen: SIGNAL_GREEN,
  waveformBlue: WAVEFORM_BLUE,
  deepPurple: DEEP_PURPLE,
  studioRed: STUDIO_RED,

  // Accents
  warmAmber: WARM_AMBER,
  goldMeter: GOLD_METER,
  cyanMonitor: CYAN_MONITOR,

  // Jewel Tones
  emerald: EMERALD,
  sapphire: SAPPHIRE,
  amethyst: AMETHYST,

  // Earth Tones
  warmTaupe: WARM_TAUPE,
  clay: CLAY,
  steelBlue: STEEL_BLUE,
  mutedPlum: MUTED_PLUM,
  ash: ASH,

  // Semantic Colors
  bgPrimary: BG_PRIMARY,
  bgSecondary: BG_SECONDARY,
  borderPrimary: BORDER_PRIMARY,
  textPrimary: TEXT_PRIMARY,
  textSecondary: TEXT_SECONDARY,

  // Button Colors
  btnRecord: BTN_RECORD,
  btnPlay: BTN_PLAY,
  btnStop: BTN_STOP,
  btnClear: BTN_CLEAR,
  btnUndo: BTN_UNDO,
  btnExport: BTN_EXPORT,
  btnDownload: BTN_DOWNLOAD,
  btnUpload: BTN_UPLOAD,
  btnToggle: BTN_TOGGLE,
  btnToggleActive: BTN_TOGGLE_ACTIVE,
  btnSecondary: BTN_SECONDARY,
  btnDisabled: BTN_DISABLED,
};
