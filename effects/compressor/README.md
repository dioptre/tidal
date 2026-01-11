# Compressor Effects for TidalCycles

Professional dynamics processing for SuperDirt, following the same wetness/dryness architecture as the convolution reverb system.

## Installation

Already configured in your system! The compressor is loaded automatically via:
- `startup.scd` (line 23) - Loads the SuperCollider SynthDefs
- `BootTidal.hs` (line 40) - Loads the Tidal parameters

## Four Compressor Types

### 1. **Standard Compressor** (`#compress`)
Full-featured dynamics control with all standard parameters.

```haskell
d1 $ s "bd*4"
  # compress 0.5           -- Wet/dry mix (0-1)
  # compressratio 4        -- Compression ratio (1-20)
  # compressthresh 0.5     -- Threshold (0=low, 1=high)
  # compressattack 0.01    -- Attack time (0.0001-0.1 sec)
  # compressrelease 0.1    -- Release time (0.01-1 sec)
  # compressmakeup 1.3     -- Makeup gain (0-2)
  # compressknee 0.5       -- Soft knee amount (0-1)
```

### 2. **Sidechain Compressor** (`#sidechain`)
Rhythmic pumping effect, classic EDM/French house style.

```haskell
d1 $ s "bass:1*8"
  # sidechain 0.8          -- Wet/dry mix
  # sidechainratio 6       -- Compression ratio
  # sidechainthresh 0.5    -- Threshold
  # sidechainattack 0.01   -- Attack time
  # sidechainrelease 0.2   -- Release time (longer = more pump)
```

### 3. **Limiter** (`#limit`)
Brick wall limiting to prevent clipping.

```haskell
d1 $ s "superpiano" # gain 1.5
  # limit 0.8              -- Wet/dry mix
  # limitthresh 0.9        -- Threshold (0.1-1.0, typically 0.8-0.95)
  # limitrelease 0.01      -- Release time (0.001-0.1)
```

### 4. **Multiband Compressor** (`#multiband`)
Compress different frequency ranges independently (low/mid/high).

```haskell
d1 $ s "breaks165"
  # multiband 0.6              -- Wet/dry mix
  # multibandlowratio 6        -- Bass compression (60Hz-200Hz)
  # multibandmidratio 3        -- Mid compression (200Hz-2kHz)
  # multibandhighratio 2       -- High compression (2kHz+)
  # multibandlowfreq 200       -- Low/mid crossover (50-500Hz)
  # multibandhighfreq 2000     -- Mid/high crossover (1000-10000Hz)
```

## Presets

Six ready-to-use presets are defined in `compressor-params.hs`:

```haskell
glueCompress        -- Gentle 2:1 mix bus compression
punchyCompress      -- Aggressive drum compression (4:1, fast attack)
heavyLimit          -- Heavy limiting for loudness
pump                -- Classic sidechain pump (6:1, slow release)
vocalCompress       -- Transparent vocal dynamics (3:1, soft knee)
tightBass           -- Multiband with heavy sub control (6:1 on lows)
```

Usage:
```haskell
d1 $ s "bd sn" # punchyCompress
d2 $ s "bass:1*8" # pump
all $ (# glueCompress)  -- Apply to all channels
```

## Common Techniques

### Parallel Compression (NY Compression)
Blend heavy compression with dry signal for punch + dynamics:
```haskell
d1 $ s "bd sn cp hh*4"
  # compress 0.3            -- Only 30% wet
  # compressthresh 0.2      -- Low threshold
  # compressratio 10        -- Heavy compression
  # compressmakeup 2        -- Big makeup gain
```

### Master Bus Glue
Apply gentle compression to everything for cohesion:
```haskell
all $ (# glueCompress)
```

### Sidechain Bass to Kick
Make bass "pump" around kick drum:
```haskell
d1 $ s "bd(3,8)"
d2 $ s "bass:1*8"
  # pump  -- or manual: sidechain 0.8 # sidechainrelease 0.2
```

### Multiband for Bass Music
Heavy sub control while keeping mids/highs dynamic:
```haskell
d1 $ note "c1 f1 g1 bf1" # s "bass1:18"
  # multiband 0.8
  # multibandlowratio 10     -- Squash sub bass
  # multibandmidratio 4      -- Moderate mids
  # multibandhighratio 2     -- Light highs
```

### Compression + Reverb Chain
Professional studio signal chain:
```haskell
d1 $ s "sn*4"
  # compress 0.5 # compressratio 4      -- Compress first
  # convolve 0.4 # convolveir 0         -- Then reverb
  # compressmakeup 1.2                  -- Makeup gain
```

## Parameter Ranges Quick Reference

| Parameter | Range | Default | Notes |
|-----------|-------|---------|-------|
| `compress` / `compressmix` | 0-1 | 0.5 | Wet/dry mix |
| `compressthresh` | 0-1 | 0.5 | 0 = compress everything, 1 = only peaks |
| `compressratio` | 1-20 | 4 | 1 = no compression, 4 = typical, 20 = limiting |
| `compressattack` | 0.0001-0.1 | 0.01 | Seconds, shorter = more aggressive |
| `compressrelease` | 0.01-1 | 0.1 | Seconds, shorter = pumping, longer = smooth |
| `compressmakeup` | 0-2 | 1.0 | Compensate volume loss, >1 = boost |
| `compressknee` | 0-1 | 0.5 | 0 = hard/abrupt, 1 = soft/gentle |

## Examples in test.tidal

See lines 1164+ in `test.tidal` for comprehensive examples including:
- Basic compression techniques
- All four compressor types
- Preset usage
- Creative effects (breathing, parallel compression)
- Full mix scenarios (drum & bass production)
- Dynamic parameter modulation
- Compression + reverb chains

## Technical Details

### Signal Flow
All compressors use the same dry/wet architecture:
1. Dry signal captured from `dryBus`
2. Wet signal from `effectBus`
3. Compression applied to wet signal
4. `XFade2` mixes dry/wet based on mix parameter (-1 to +1)

### Algorithms
- **Standard**: SuperCollider's `Compander` with configurable parameters
- **Sidechain**: `Compander` with separate control signal (currently simulated LFO)
- **Limiter**: Fast attack/high ratio compression via `Limiter`
- **Multiband**: Split signal into 3 bands, compress separately, recombine

### CPU Usage
- Standard compressor: Very light (~1% CPU per instance)
- Sidechain: Light (~2% CPU per instance)
- Limiter: Very light (~1% CPU per instance)
- Multiband: Moderate (~5% CPU per instance due to filtering)

## Tips

1. **Start subtle**: Begin with 30-50% wet mix and increase as needed
2. **Fast attack for drums**: 0.001-0.01 seconds for transient control
3. **Slow release for pumping**: 0.2-0.5 seconds for rhythmic breathing
4. **Makeup gain**: Compression reduces volume, so boost with makeup gain
5. **Soft knee for transparency**: Use 0.7-0.9 for gentle, musical compression
6. **Parallel for punch**: Low wet mix (0.2-0.4) with heavy compression and high makeup gain
7. **Multiband for full mixes**: Control bass tightly while leaving highs dynamic

## Comparison to Convolution Reverb

Both effects share the same design philosophy:

| Feature | Convolution | Compressor |
|---------|-------------|------------|
| Mix parameter | `convolve` / `convolvemix` | `compress` / `compressmix` |
| Range | 0-1 (dry to wet) | 0-1 (dry to wet) |
| Architecture | XFade2 dry/wet blend | XFade2 dry/wet blend |
| Additional params | IR selection, damping, pre-delay | Ratio, threshold, attack, release |

## Future Enhancements

Potential additions:
- True sidechain input routing (currently uses simulated kick LFO)
- Look-ahead limiting (zero latency artifact-free limiting)
- Expandable multiband (5-band, 7-band options)
- Stereo linking control (independent L/R vs linked compression)
- Visual gain reduction metering (via OSC feedback)

## Credits

- Architecture inspired by the convolution reverb system in `effects/convolveir/`
- Built using SuperCollider's `Compander`, `Limiter`, and filter UGens
- Integrates seamlessly with TidalCycles parameter system
