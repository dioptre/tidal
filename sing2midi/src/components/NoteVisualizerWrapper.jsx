import React from 'react';
import NoteVisualizer from './NoteVisualizer';

const NoteVisualizerWrapper = (props) => {
  // Skia is loaded via LoadSkiaWeb in index.web.js before the app starts
  // Platform-specific file resolution:
  // - Web: uses NoteVisualizer.web.jsx (direct CanvasKit)
  // - iOS/Android: uses NoteVisualizer.jsx (@shopify/react-native-skia)
  return <NoteVisualizer {...props} />;
};

export default NoteVisualizerWrapper;
