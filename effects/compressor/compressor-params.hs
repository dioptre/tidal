-- Compressor Parameters for TidalCycles
-- Load in BootTidal.hs: :script "/Users/andrewgrosser/Documents/tidal/effects/compressor/compressor-params.hs"

let
    -- ===== STANDARD COMPRESSOR =====
    -- Main compressor effect with full control over dynamics

    -- Wet/dry mix: 0 = fully dry (no compression), 1 = fully wet (full compression)
    compressmix = pF "compressmix"
    compress = pF "compress"  -- Alias for compressmix
    -- Threshold: 0 = compress everything (-40dB), 1 = compress only peaks (0dB)
    -- Lower values = more compression
    compressthresh = pF "compressthresh"
    -- Compression ratio: 1 = no compression, 4 = 4:1 (typical), 10+ = heavy, 20 = limiting
    compressratio = pF "compressratio"
    -- Attack time: 0.0001-0.1 seconds (how fast compression kicks in)
    -- Shorter = more aggressive, longer = more natural
    compressattack = pF "compressattack"
    -- Release time: 0.01-1 seconds (how fast compression releases)
    -- Shorter = pumping effect, longer = smooth
    compressrelease = pF "compressrelease"
    -- Makeup gain: 0-2 (compensate for volume reduction from compression)
    -- 1.0 = no change, >1 = boost, <1 = cut
    compressmakeup = pF "compressmakeup"
    -- Soft knee: 0 = hard knee (abrupt), 1 = soft knee (gentle)
    compressknee = pF "compressknee"


    -- ===== SIDECHAIN COMPRESSOR =====
    -- Rhythmic pumping effect (simulates kick drum ducking)

    sidechainmix = pF "sidechainmix"
    sidechain = pF "sidechain"  -- Alias
    sidechainthresh = pF "sidechainthresh"
    sidechainratio = pF "sidechainratio"
    sidechainattack = pF "sidechainattack"
    sidechainrelease = pF "sidechainrelease"
    sidechainmakeup = pF "sidechainmakeup"


    -- ===== LIMITER =====
    -- Brick wall limiting to prevent clipping

    limitmix = pF "limitmix"
    limit = pF "limit"  -- Alias
    limitthresh = pF "limitthresh"  -- 0.1-1.0, typically 0.8-0.95
    limitrelease = pF "limitrelease"  -- 0.001-0.1, fast release


    -- ===== MULTIBAND COMPRESSOR =====
    -- Compress different frequency ranges independently

    multibandmix = pF "multibandmix"
    multiband = pF "multiband"  -- Alias
    -- Compression ratios for each band
    multibandlowratio = pF "multibandlowratio"   -- Bass (default 4)
    multibandmidratio = pF "multibandmidratio"   -- Mids (default 3)
    multibandhighratio = pF "multibandhighratio" -- Highs (default 2)
    -- Crossover frequencies
    multibandlowfreq = pF "multibandlowfreq"     -- Low/mid split (50-500Hz, default 200)
    multibandhighfreq = pF "multibandhighfreq"   -- Mid/high split (1000-10000Hz, default 2000)


    -- ===== PRESETS =====

    -- Gentle "glue" compression for mix bus
    glueCompress = compress 0.3 # compressthresh 0.6 # compressratio 2 # compressattack 0.01 # compressrelease 0.1 # compressmakeup 1.2
    -- Punchy drum compression
    punchyCompress = compress 0.5 # compressthresh 0.4 # compressratio 4 # compressattack 0.005 # compressrelease 0.05 # compressmakeup 1.3
    -- Heavy limiting for loudness
    heavyLimit = compress 0.7 # compressthresh 0.3 # compressratio 10 # compressattack 0.001 # compressrelease 0.05 # compressmakeup 1.5
    -- Classic sidechain pump (EDM/French house style)
    pump = sidechain 0.8 # sidechainratio 6 # sidechainattack 0.01 # sidechainrelease 0.2
    -- Transparent vocal compression
    vocalCompress = compress 0.4 # compressthresh 0.5 # compressratio 3 # compressattack 0.01 # compressrelease 0.1 # compressknee 0.8
    -- Bass control with multiband
    tightBass = multiband 0.5 # multibandlowratio 6 # multibandmidratio 3 # multibandhighratio 2 # multibandlowfreq 150


-- ===== USAGE EXAMPLES =====
--
-- Basic compression
-- d1 $ s "bd sn" # compress 0.5 # compressratio 4
--
-- Punchy drums with makeup gain
-- d2 $ s "bd*4" # punchyCompress
--
-- Sidechain pumping bass
-- d3 $ s "bass:1*8" # pump
--
-- Gentle glue compression on full pattern
-- d1 $ s "bd sn cp hh" # glueCompress
--
-- Heavy limiter on loud synth
-- d4 $ note "c a f e" # s "superpiano" # gain 1.5 # limit 0.8 # limitthresh 0.9
--
-- Multiband compression for full mix control
-- d1 $ s "[bd sn, hh*8, bass:1*2]" # multiband 0.6 # multibandlowratio 4 # multibandmidratio 3 # multibandhighratio 2
--
-- Dynamic range control - aggressive
-- d5 $ s "breaks165" # compress 0.7 # compressthresh 0.3 # compressratio 8 # compressattack 0.001
--
-- Parallel compression (NY compression) using gain and mix
-- d6 $ s "bass:1*4" # compress 0.3 # compressthresh 0.2 # compressratio 10 # compressmakeup 2
