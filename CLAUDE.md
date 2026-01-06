# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **TidalCycles live coding music environment** configured for electronic music production. TidalCycles is a Haskell-based language for pattern generation that communicates with SuperCollider's SuperDirt audio engine.

## System Architecture

### Three-Layer Architecture

1. **Tidal (Haskell)** - Pattern generation language
   - `.tidal` files contain live coding patterns
   - `BootTidal.hs` - Tidal initialization and custom aliases
   - Communicates with SuperCollider via OSC on port 57120

2. **SuperCollider (Audio Engine)**
   - `startup.scd` - SuperCollider configuration and SuperDirt initialization
   - Loads custom synthdefs, effects, and sample banks
   - Manages 12 orbits (audio channels) with independent effect chains

3. **Custom Extensions**
   - `mi-UGens/` - Mutable Instruments eurorack module ports (Braids, Plaits, Clouds, etc.)
   - `effects/convolveir/` - Custom convolution reverb system with 52+ impulse responses
   - `impulse-responses/` - .wav files for convolution (halls, cathedrals, tape, bass-boost)
   - `samples-extra/` - Additional sample banks beyond SuperDirt defaults

## Starting a Session

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
```

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

## Path Dependencies

**Critical:** The following files contain hardcoded absolute paths that must match the system:

1. **`startup.scd`** (lines 21-24):
   ```supercollider
   load("/Users/andrewgrosser/Library/Application Support/SuperCollider/synthdefs/mi-ugens.scd");
   load("/Users/andrewgrosser/Documents/tidal/effects/convolveir/convolution-effect.scd");
   ~dirt.loadSoundFiles("/Users/andrewgrosser/Documents/tidal/samples-extra/*");
   ```

2. **`BootTidal.hs`** (lines 38-39):
   ```haskell
   :script "/Users/andrewgrosser/Documents/tidal/mi-UGens/Setup/mi-ugens-params.hs"
   :script "/Users/andrewgrosser/Documents/tidal/effects/convolveir/convolution-params.hs"
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

### Extended Channels
Channels d1-d16 are standard, but `BootTidal.hs` adds d17-d24 for complex arrangements (see `dnb.tidal` for usage).

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

## Reference Resources

- **`README.md`** - Complete setup guide, installation steps, troubleshooting
- **`test.tidal`** - Comprehensive example library organized by technique

## Sample Banks

### Default SuperDirt Samples
808, 909, arpy, bass, bd, cp, hh, sn, and 200+ others (see README.md for full list)

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
