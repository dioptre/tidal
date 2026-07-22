-- Hand Instrument Pool — each orbit driven by C++ pool manager
-- Silence all orbits on load to clear stale state
hush

-- Melodic instrument pool
-- Y axis → pitch (top=high bottom=low)
-- X axis → filter cutoff (left=dark right=bright)
-- Z axis → instrument bucket (set by C++ pool)
-- Instruments from liked list, grouped melodically:
--   0-3:  melodic (moog arpy sitar pluck)
--   4-7:  textural (padlong sid newnotes peri)
--   8-11: rhythmic/tonal (stab tabla2 voodoo tacscan)

:{
let op orb =
      let pre   = "o" ++ show (orb :: Int) ++ "_"
          inst  = cS "bd" (pre ++ "inst")
          px    = cF 0.5 (pre ++ "x")
          py    = cF 0.5 (pre ++ "y")
          pz    = cF 0.3 (pre ++ "z")
          pgain = cF 0   (pre ++ "gain")
          -- Y controls pitch, X controls filter
          pcutoff = px * 7600 + 400
          -- pentatonic note sent from C++ as integer
      in s inst
           # n (fromIntegral <$> cI 0 (pre ++ "note"))
           # cutoff pcutoff
           # resonance 0.2
           # gain  (pgain * max 0 (1 - cF 0 "transformation_active") * max 0 (1 - cF 0 "reflex_active"))
           # room  (pz * 0.5 + 0.2)
           # sz    0.88
           # legato 1.5
:}

d1  $ op 0
d2  $ op 1
d3  $ op 2
d4  $ op 3
d5  $ op 4
d6  $ op 5
d7  $ op 6
d8  $ op 7
d9  $ op 8
-- d11 reserved for Reflex target head cues
d12 $ op 11

-- ============================================================
-- TRANSFORMATION STATION
-- transformation_notes = space-separated note names e.g. "c4 g4 e4"
-- transformation_active = 1 when game running
-- transformation_climax = 1 when all 8 collected
-- transformation_count  = number collected so far (0-8)
-- ============================================================

-- d13: melody loop — builds as notes collected
-- Uses supermandolin, loops at slow 2

:{
d15 $ slow 2 $ s "tides" |< note (cP "transformation_notes")
     # orbit 0
     # sustain 3
     # tidesshape 0.6
     # tidessmooth 0.7
     # room 0.92
     # sz 0.98
     # gain (cF 0 "transformation_active" * 0.8)
:}

-- d16: urgent driving beat — plays during transformation game
:{
d16 $ stack [
  s "industrial(3,8)" # gain 0.7 # room 0.3,
  s "metal(2,8,1)" # up (-24) # gain 0.5 # room 0.2,
  s "tabla2(5,8)" # gain 0.4 # speed 1.5
  ]
  # orbit 1
  # gain (cF 0 "transformation_active" * 0.8)
:}

-- Reflex Rhythm Game (Advance Nudge Target Head Cues + Silent Lead Pattern + Full Backing Track)
-- d1 reads the dynamically sent pattern from C++ over OSC (using cP "reflex_notes")
d1 $ n (cP "reflex_notes") # s "superpiano" # sustain 1.8 # gain 0

-- Here Comes The Sun Backing Track (d12 - 125 BPM, CPS = 0.5208)
-- Only plays when reflex_song_6 is active (set to 1.0 by C++ game)
:{
d12 $ stack [
  -- Acoustic Gretsch Drums (keeps steady beat)
  s "gretsch:0*4" # gain 0.5,
  s "[~ gretsch:4]*2" # gain 0.3,
  s "gretsch:12*8" # gain 0.1,
  
  -- Warm Chords on SuperPiano (8-cycle sheet music progression)
  s "superpiano" # note "<[g4'maj*4] [g4'maj*4] [g4'maj g4'maj c4'maj7 a4'seven] [g4'maj g4'maj c4'maj g4'maj] [a4'min7 g4'maj d4'seven d4'seven] [g4'maj*4] [d4'seven*4] [g4'maj*4]>" # sustain 2.5 # gain 0.3,
  
  -- Moog Bassline (8-cycle sheet music progression)
  s "moog" # note "<[g2*4] [g2*4] [g2 g2 c2 cs2] [d2 d2 c2 b1] [a1 g1 d2 d2] [g2*4] [d2*4] [g2*4]>" # legato 0.85 # gain 0.5
]
# gain (cF 0 "reflex_song_6")
:}


