# Sing2MIDI

Real-time voice-to-MIDI converter with TidalCycles pattern generation.

## Features

- **ML-based pitch detection** using Spotify's Basic Pitch ONNX model
  - State-of-the-art accuracy with deep learning
  - Polyphonic note detection (multiple notes at once)
  - Precise timing and duration tracking
  - No octave jumping issues
- **Live note visualization** showing detected notes as they're sung
- **TidalCycles pattern generation** with:
  - Automatic speed compensation for note density
  - Pattern repetition detection using `<>` syntax
  - Note duration tracking and quantization
  - Musical subdivision handling `[]` for fast notes
- **MIDI file export** - Save recordings as standard MIDI files
- **React Native Web** - Works on web, can be adapted for iOS

## Setup

```bash
npm install
```

## Run Development Server

**Option 1: Using the start script**
```bash
./start.sh
```

**Option 2: Manual start** (requires Node 22.14+)
```bash
source ~/.nvm/nvm.sh
nvm use 22.14.0
npm run dev
```

Open your browser to **http://localhost:5176/**

## Usage

1. Click **Start Recording** and grant microphone permission
2. Sing or hum notes - they'll appear in real-time on the visualizer
3. Click **Stop Recording** to finish
4. View the generated TidalCycles pattern
5. Click **Export to MIDI** to save as a MIDI file

## TidalCycles Pattern Format

The generated patterns use:
- Note notation: `"c" "d" "e"` etc with octave adjustments
- Fast subdivisions: `[c d e]` for quick note sequences
- Repetition detection: `<pattern1 pattern2>` for alternating sections
- Speed compensation: `# speed 2.0` when many notes are detected

## Architecture

- **PitchDetector** - ML-based pitch detection using Spotify Basic Pitch
  - Records audio with MediaRecorder
  - Processes with ONNX model after recording stops
  - Returns precise note data with timing and pitch
- **NoteVisualizer** - Canvas-based note graph showing all detected notes
- **TidalGenerator** - Pattern generation with repetition detection
- **MIDIExporter** - Standard MIDI File (SMF) Format 0 export

## Technical Details

- **Pitch detection**: Spotify's Basic Pitch ML model (ONNX)
  - Model size: ~38 MB
  - Processes entire recording after stop
  - Accurate to within a few cents
  - Handles polyphonic audio
- **MIDI export**: 480 ticks per beat, default 120 BPM
- **TidalCycles tempo**: Automatic `slow`/`fast` based on recording length
