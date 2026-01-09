import React from 'react';
import { Canvas, Fill } from '@shopify/react-native-skia';

function TestSkia() {
  console.log('[TestSkia] Rendering');
  console.log('[TestSkia] CanvasKit:', typeof global.CanvasKit);

  // Try the EXACT pattern from Shopify example
  const canvases = [];
  for (let i = 0; i < 3; i++) {
    canvases.push(
      <div key={i} style={{ margin: '10px', display: 'inline-block' }}>
        <h4 style={{ color: 'white' }}>Canvas {i + 1}</h4>
        <Canvas style={{ width: 200, height: 200 }}>
          <Fill color={`hsl(${(i * 120) % 360}, 70%, 50%)`} />
        </Canvas>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      <h1 style={{ color: 'white' }}>Skia Test - Shopify Pattern</h1>
      <p style={{ color: 'white' }}>Testing with exact Shopify example pattern:</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {canvases}
      </div>
    </div>
  );
}

export default TestSkia;
