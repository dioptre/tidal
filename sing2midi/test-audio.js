// Simple script to analyze the audio file and test pitch detection
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const audioFilePath = path.join(__dirname, 'tests/scale.m4a');

if (fs.existsSync(audioFilePath)) {
  const stats = fs.statSync(audioFilePath);
  console.log('✓ Audio file found');
  console.log(`  Path: ${audioFilePath}`);
  console.log(`  Size: ${stats.size} bytes`);
  console.log(`  Modified: ${stats.mtime}`);

  // Expected notes for a chromatic scale starting from F#2:
  // F#2, G2, G#2, A2, A#2, B2, C3, C#3, D3, D#3, E3, F3
  // In Hz: ~92, 98, 104, 110, 117, 123, 131, 139, 147, 156, 165, 175

  console.log('\nExpected frequencies for chromatic scale from F#2:');
  const notes = ['F#2', 'G2', 'G#2', 'A2', 'A#2', 'B2', 'C3', 'C#3', 'D3', 'D#3', 'E3', 'F3'];
  const freqs = [92.5, 98.0, 103.8, 110.0, 116.5, 123.5, 130.8, 138.6, 146.8, 155.6, 164.8, 174.6];

  notes.forEach((note, i) => {
    console.log(`  ${note}: ${freqs[i].toFixed(1)} Hz`);
  });

  console.log('\nTo test manually:');
  console.log('  1. Start the dev server: npm run dev');
  console.log('  2. Open http://localhost:5176 in Chrome');
  console.log('  3. Open DevTools Console (F12)');
  console.log('  4. Click "Start Recording"');
  console.log('  5. Play the tests/scale.m4a file through your system audio');
  console.log('  6. Watch the console for detected frequencies');
  console.log('  7. Verify the detected notes match the expected scale above');

} else {
  console.error('✗ Audio file not found at:', audioFilePath);
  process.exit(1);
}
