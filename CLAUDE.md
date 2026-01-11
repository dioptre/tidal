# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **TidalCycles live coding music environment** configured for electronic music production, plus a **voice-to-MIDI/Tidal web application** (sing2midi). TidalCycles is a Haskell-based language for pattern generation that communicates with SuperCollider's SuperDirt audio engine.

### Repository Structure

- **Root**: TidalCycles setup with SuperCollider configuration and custom effects
- **sing2midi/**: React-based voice-to-MIDI converter (dual platform: iOS + web)
- **samples-extra/**: Additional sample banks beyond SuperDirt defaults
- **samples-strudel/**: 126 instruments from Strudel's Virtual Community Sample Library
- **impulse-responses/**: 52+ IRs for custom convolution reverb
- **effects/**: Custom SuperDirt effects (convolution, compressor, spectral-delay)
- **mi-UGens/**: Mutable Instruments eurorack module ports

## System Architecture

### TidalCycles: Three-Layer Architecture

1. **Tidal (Haskell)** - Pattern generation language
   - `.tidal` files contain live coding patterns
   - `BootTidal.hs` - Tidal initialization and custom aliases
   - Communicates with SuperCollider via OSC on port 57120

2. **SuperCollider (Audio Engine)**
   - `startup.scd` - SuperCollider configuration and SuperDirt initialization
   - Loads custom synthdefs, effects, and sample banks
   - Manages 12 orbits (audio channels) with independent effect chains

3. **Custom Extensions**
   - `mi-UGens/` - Mutable Instruments eurorack module ports (Braids, Plaits, Clouds, Verb, etc.)
   - `effects/convolveir/` - Custom convolution reverb with Super IR creation system
   - `effects/compressor/` - Four compression types (standard, sidechain, limiter, multiband)
   - `effects/spectral-delay/` - Spectral delay effect filtering signal into frequency bands

### sing2midi: Voice Composer Application

A React application that converts voice/audio to MIDI and Tidal patterns using ML inference.

**Platforms:**
- Web: https://dioptre.github.io/tidal/ (GitHub Pages at `/tidal/` path)
- iOS: Voice Composer (bundle ID: `io.sfpl.sing2midi`)

**Technology Stack:**
- React 18 with dual build system (Vite for web, Metro for React Native)
- TensorFlow.js for ML inference (web only, iOS pending)
- react-native-skia for canvas rendering on iOS
- GitHub Actions CI/CD for web deployment

## Common Development Commands

### TidalCycles Session

### 1. Start SuperCollider
```supercollider
// In SuperCollider, evaluate:
SuperDirt.start;
```

This executes `startup.scd` which:
- Boots the audio server with optimized settings
- Loads mi-UGens synthdefs from `~/Library/Application Support/SuperCollider/synthdefs/mi-ugens.scd`
- Loads convolution effect from `effects/convolveir/convolution-effect.scd`
- Loads default samples and `samples-extra/*`
- Creates 12 orbits (d1-d12) with Clouds and Verb global effects

### 2. Start Tidal REPL
```bash
# In terminal:
ghci -ghci-script BootTidal.hs
```

This loads:
- TidalCycles core libraries
- Extended channels d17-d24 definitions
- mi-UGens parameter definitions from `mi-UGens/Setup/mi-ugens-params.hs`
- Convolution parameters from `effects/convolveir/convolution-params.hs`

### 3. Basic Pattern Commands
```haskell
-- Start a pattern on channel d1
d1 $ s "bd sn cp hh"

-- Stop all patterns
hush

-- Stop individual pattern
d1 silence

-- Emergency stop (kills all synths)
panic

-- Set tempo (174 BPM example)
setcps (174/60/4)

-- Record audio in SuperCollider
s.record;
s.stopRecording;
```

### sing2midi Development

**Prerequisites:**
```bash
nvm use                    # Use Node 20.19.4+ (see .nvmrc)
npm install                # Install dependencies (run from sing2midi/)
```

**Web Development:**
```bash
cd sing2midi
npm run dev                # Start Vite dev server → http://localhost:5176/tidal/
npm run build              # Build for production (outputs to build/)
npm test                   # Run Playwright tests
```

**iOS Development:**
```bash
cd sing2midi
npm run pod-install        # Install CocoaPods dependencies (first time only)
npm run xcode              # Open in Xcode (use .xcworkspace, NOT .xcodeproj)
npm start                  # Start Metro bundler (in separate terminal)
npm run ios                # Build and run on simulator
npm run ios:clean          # Clean Xcode build artifacts
npm run pod-clean          # Reinstall all CocoaPods dependencies
```

**iOS Build in Xcode:**
1. Open `sing2midi/ios/sing2midi.xcworkspace` (NOT .xcodeproj)
2. Select simulator (e.g., iPhone 16 Pro)
3. Press ⌘R to build and run
4. Metro bundler must be running in separate terminal (`npm start`)

**Deployment:**
- Web: Automatic via GitHub Actions on push to master (deploys to GitHub Pages)
- iOS: Archive in Xcode (Product → Archive) then submit to App Store

## Key File Purposes

### Configuration Files
- **`startup.scd`** - SuperCollider startup configuration (must match system paths)
- **`BootTidal.hs`** - Tidal initialization with custom channel definitions (d1-d24)
- **`.ghci`** - GHCi REPL configuration

### Pattern Files
- **`test.tidal`** - Extensive example library (930+ lines) covering all techniques
- **`dnb.tidal`** - Professional drum & bass track template with production notes

### Extension Files
- **`mi-UGens/Setup/mi-ugens.scd`** - SuperCollider synthdefs for Mutable Instruments modules
- **`mi-UGens/Setup/mi-ugens-params.hs`** - Tidal parameter definitions for mi-UGens
- **`effects/convolveir/convolution-effect.scd`** - Custom convolution reverb implementation
- **`effects/convolveir/convolution-params.hs`** - Tidal convolution parameters and presets
- **`effects/compressor/compressor-effect.scd`** - Four compression types (compress, sidechain, limit, multiband)
- **`effects/compressor/compressor-params.hs`** - Tidal compressor parameters and presets
- **`effects/spectral-delay/spectral-delay-effect.scd`** - Spectral delay implementation
- **`effects/spectral-delay/spectral-delay-params.hs`** - Tidal spectral delay parameters

### sing2midi Files
- **`sing2midi/src/App.jsx`** - Main React application component
- **`sing2midi/src/config.js`** - Platform-specific configuration (web vs iOS)
- **`sing2midi/src/components/NoteVisualizer.jsx`** - Piano roll (canvas on web, react-native-canvas on iOS)
- **`sing2midi/vite.config.js`** - Web build configuration (Vite)
- **`sing2midi/metro.config.js`** - React Native bundler configuration
- **`sing2midi/ios/sing2midi.xcworkspace`** - Xcode workspace (open this, NOT .xcodeproj)
- **`sing2midi/.nvmrc`** - Node version specification (20.19.4+)
- **`.github/workflows/deploy-sing2midi.yml`** - GitHub Actions deployment pipeline

## Path Dependencies

**Critical:** The following files contain hardcoded absolute paths that must match the system:

1. **`startup.scd`** (lines 21-28):
   ```supercollider
   load("/Users/andrewgrosser/Library/Application Support/SuperCollider/synthdefs/mi-ugens.scd");
   load("/Users/andrewgrosser/Documents/tidal/effects/convolveir/convolution-effect.scd");
   load("/Users/andrewgrosser/Documents/tidal/effects/compressor/compressor-effect.scd");
   load("/Users/andrewgrosser/Documents/tidal/effects/spectral-delay/spectral-delay-effect.scd");
   ~dirt.loadSoundFiles("/Users/andrewgrosser/Documents/tidal/samples-extra/*");
   ~dirt.loadSoundFiles("/Users/andrewgrosser/Documents/tidal/samples-strudel/*");
   ~dirt.loadSoundFiles("/Users/andrewgrosser/Documents/tidal/sounds/bbc/*");
   ```

2. **`BootTidal.hs`** (lines 38-41):
   ```haskell
   :script "/Users/andrewgrosser/Documents/tidal/mi-UGens/Setup/mi-ugens-params.hs"
   :script "/Users/andrewgrosser/Documents/tidal/effects/convolveir/convolution-params.hs"
   :script "/Users/andrewgrosser/Documents/tidal/effects/compressor/compressor-params.hs"
   :script "/Users/andrewgrosser/Documents/tidal/effects/spectral-delay/spectral-delay-params.hs"
   ```

When working on different systems, update these paths to match the actual file locations.

## Custom Features

### Convolution Reverb System
- **52 impulse responses** (indices 0-51):
  - 0-11: Core spaces (hall, church, cathedral, plate, spring, etc.)
  - 12-41: Creative (cassette, tape saturation, vehicles, vocals)
  - 42-51: Bass-heavy EDM (80Hz boost, BBE bass, dubstep, club spaces)

- **Super IR creation** - Convolve multiple IRs together:
  ```haskell
  -- Create hybrid reverb by convolving 2+ IRs
  makeSuperIR [6, 42]  -- Cathedral + bass boost
  superMega            -- Preset: 30-way mega convolution

  -- Use the created Super IR (watch SC Post window for index)
  d1 $ s "bass*4" # convolve 0.8 # convolveir 52
  ```

- **Parameters:**
  - `convolve` / `convolvemix` - Wet/dry mix (0-1)
  - `convolveir` - IR selection (0-51+)
  - `convolvedamp` - High-frequency damping/brightness (0-1)
  - `convolvepredel` - Pre-delay (0-0.2 seconds)
  - `convolvelevel` - Output boost/cut (0-2, default 1.0)

### mi-UGens Integration
Synth modules from Mutable Instruments:
- **omi** - Vibraphone-like synth
- **braids** - 48 synthesis models
- **plaits** - 16 synthesis engines
- **tides** - Tidal modulator
- **clouds** - Granular processor (global effect)
- **verb** - Reverb (global effect)
- **elements** - Modal synthesis
- **mu** - Low-frequency distortion
- **rings** - Resonator
- **ripples** - 4-pole analog filter
- **warps** - Wave-shaping and cross-modulation

### Compressor Effects System
- **Four compression types**: Standard (`#compress`), sidechain pumping (`#sidechain`), brick-wall limiter (`#limit`), multiband compression (`#multiband`)
- **Wet/dry architecture**: Similar to convolution reverb for mixing processed and dry signals
- **Parameters:**
  - `compress` - Wet/dry mix (0-1)
  - `compressratio` - Compression ratio (1-20)
  - `compressthresh` - Threshold (0-1)
  - `compressattack` - Attack time (0.0001-0.1s)
  - `compressrelease` - Release time (0.01-1s)
  - `compressmakeup` - Makeup gain (0-2)
  - `compressknee` - Knee (0-1)

- **Presets:**
  - `glueCompress` - Gentle mix bus glue compression
  - `punchyCompress` - Punchy drum compression
  - `heavyLimit` - Aggressive brick-wall limiting
  - `pump` - Classic sidechain pumping effect
  - `vocalCompress` - Vocal-optimized compression
  - `tightBass` - Bass compression for punch

**Example usage:**
```haskell
d1 $ s "bd*4" # punchyCompress
d1 $ s "bass:1*8" # pump
d1 $ s "[bd sn cp hh]" # glueCompress
d1 $ s "superpiano" # gain 1.5 # limit 0.8 # limitthresh 0.9
```

### Spectral Delay
- **Frequency-selective delay**: Filters signal into frequency bands and delays them with bitwise patterns
- **Parameters:**
  - `tsdelay` - Time scale for delay (0-1), controls overall delay time
  - `xsdelay` - Delay structure pattern (integer), determines which frequency bands are delayed via bitwise AND

**Example usage:**
```haskell
d1 $ s "arpy*4" # xsdelay 0.5 # tsdelay 0.3
```

### Extended Channels
Channels d1-d16 are standard, but `BootTidal.hs` adds d17-d24 for complex arrangements (see `dnb.tidal` for usage).

### Strudel REPL Application
A local Strudel REPL application is included in the repository (`Strudel REPL-darwin-arm64/`).

**Commands:**
```bash
npm run strudel        # Open local Strudel REPL app
npm run strudel:install  # Install/reinstall Strudel REPL
```

## Pattern Development Workflow

### Working with .tidal Files

1. **Edit patterns** - Modify `.tidal` files in any text editor
2. **Evaluate code** - Send blocks to Tidal REPL:
   - VS Code: Use TidalCycles extension (Ctrl+Enter to evaluate)
   - Atom/Pulsar: Use TidalCycles package
   - Manual: Copy/paste into ghci REPL
3. **Iterate live** - Changes take effect on the next cycle boundary

### Common Pattern Structure
```haskell
-- Use 'do' blocks for multi-channel arrangements
do
  d1 $ s "bd sn" # gain 1.2
  d2 $ s "hh*8" # lpf 8000
  d3 $ note "c e g" # s "superpiano"
```

### Mini-notation Syntax
- `*` - Repeat steps: `bd*4` = "bd bd bd bd"
- `[]` - Subdivide: `[bd sd]` = faster subdivision
- `<>` - Alternate: `<bd sn>` = cycles between values
- `~` - Rest/silence
- `,` - Layer patterns: `[bd, hh*4]`
- `|` - Random choice: `[bd|sn|cp]`
- `(n,k)` - Euclidean rhythm: `bd(3,8)` = 3 pulses over 8 steps
- `?` - Random removal: `bd?` or `bd?0.5`

## sing2midi Architecture & Key Patterns

### Dual Platform Build System

The application uses **two build systems** for maximum code reuse:

1. **Vite (Web)**: Fast dev server and optimized production builds
   - Entry: `index.html` → `src/App.jsx`
   - Output: `build/` directory
   - Config: `vite.config.js`, `craco.config.js`

2. **Metro (React Native)**: iOS bundler
   - Entry: `index.js` → `src/App.jsx`
   - Config: `metro.config.js`, `babel.config.js`

### Platform-Specific Code Patterns

**Platform Detection:**
```javascript
import { Platform } from 'react-native-web';  // Works on both platforms

if (Platform.OS === 'ios') {
  // iOS-specific code
} else {
  // Web-specific code
}
```

**Canvas Rendering:**
- Web: HTML5 Canvas (`<canvas>`)
- iOS: react-native-skia (`<Canvas>` component)
- Both implementations in `src/components/NoteVisualizer.jsx`

**File Structure:**
```
sing2midi/src/
├── App.jsx                 # Main application (platform-agnostic)
├── config.js               # Platform detection & configuration
└── components/
    ├── NoteVisualizer.jsx  # Piano roll (platform-specific canvas)
    └── ...                 # Other components
```

### Important Configuration Files

- **`ios/.xcode.env.local`**: Sets Node path for Xcode (gitignored, auto-generated)
- **`metro.config.js`**: Includes web extensions (.web.js) for React Native Web compatibility
- **`vite.config.js`**: Configures `/tidal/` base path for GitHub Pages deployment
- **`.nvmrc`**: Locks Node version to 20.19.4+ (important for React Native 0.83.1)

### Known Limitations

- **iOS**: ML inference (TensorFlow.js) not yet implemented
- **iOS**: Audio recording not yet implemented
- **Web**: Fully functional with CREPE pitch detection model

## Debugging

### SuperCollider Issues
```supercollider
// Check server status
s.queryAllNodes;

// Reboot if needed
s.reboot;

// Check if SuperDirt is running
SuperDirt.start;
```

### Tidal Connection Issues
- Verify SuperCollider is running SuperDirt on port 57120
- Check `BootTidal.hs` loaded successfully
- Confirm no firewall blocking localhost:57120

### Sample Loading Issues
- Samples must be in SuperDirt format (mono/stereo .wav or .flac)
- Check paths in `startup.scd` match actual directories
- SuperCollider Post window shows sample loading progress

### sing2midi Issues

**Metro bundler connection error (iOS):**
```bash
# Ensure Metro is running
cd sing2midi && npm start

# In Xcode: Clean (⌘⇧K) then rebuild (⌘R)
```

**Node version mismatch:**
```bash
cd sing2midi
nvm use                    # Use version from .nvmrc
# Or install required version:
nvm install 20.19.4 && nvm use 20.19.4
```

**CocoaPods issues:**
```bash
cd sing2midi
npm run pod-clean          # Reinstall all pods
npm run pod-update         # Update pods
```

**Xcode build errors:**
```bash
cd sing2midi
npm run ios:clean          # Clean build artifacts
# In Xcode: Clean (⌘⇧K) then rebuild (⌘R)
```

**Module not found errors:**
```bash
cd sing2midi
rm -rf node_modules package-lock.json
npm install
npm run pod-install
```

**Web deployment issues:**
- Check GitHub Actions logs: `.github/workflows/deploy-sing2midi.yml`
- Ensure `PUBLIC_URL=/tidal/` is set correctly in build environment
- Build outputs to `sing2midi/build/` (not `dist/`)

## Reference Resources

- **`README.md`** - Complete setup guide, installation steps, troubleshooting
- **`test.tidal`** - Comprehensive example library organized by technique

## Sample Banks

### Default SuperDirt Samples
808, 909, arpy, bass, bd, cp, hh, sn, and 200+ others (see README.md for full list)

### samples-strudel (126 instruments)
Complete Strudel VCSL (Virtual Community Sample Library) including:
- Orchestral: timpani, glockenspiel, marimba, xylophone, tubular bells
- Pianos: kawai, steinway, piano (higher quality than superpiano)
- Wind: recorder (alto/bass/soprano/tenor), sax, ocarina, harmonica
- Strings: harp, kalimba (5 variations), psaltery
- Drums: snare_modern (72 articulations), tom, cowbell, bongo, conga
- Ethnic: balafon, dantranh, darbuka, didgeridoo, slitdrum
- Electronic: clavisynth, fmpiano, super64 (C64 SID chip)
- Organs: pipeorgan, organ_4inch/8inch/full

Access via: `d1 $ s "kawai:0 kawai:15 kawai:30"`

**Note**: `piano` samples have "infinitely better" quality than `superpiano` per repository author.

### samples-extra
Additional banks: break, cpu, cpu2, dbass, foley, kick, rash, snare, etc.

Access via: `d1 $ s "cpu:0 cpu:5 cpu:12"`

## Musical Conventions

### Frequency Allocation (from dnb.tidal)
- 40-60Hz: Sub bass (MONO, centered)
- 60-100Hz: Kick punch + bass fundamental
- 100-300Hz: Bass body + snare fundamental
- 300-1kHz: Mid bass growl + pad low-mids
- 1-4kHz: Snare crack + stabs + vocals
- 4-8kHz: Hi-hat body + cymbal wash
- 8-16kHz: Hi-hat sizzle + air (WIDE STEREO)

### Tempo/Timing
```haskell
-- BPM to CPS formula:
setcps (BPM/60/4)

-- Common tempos:
setcps (120/60/4)  -- House/Techno
setcps (140/60/4)  -- Dubstep
setcps (174/60/4)  -- Drum & Bass
```
