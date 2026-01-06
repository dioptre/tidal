:set -fno-warn-orphans -Wno-type-defaults -XMultiParamTypeClasses -XOverloadedStrings
:set prompt ""

-- Import all the boot functions and aliases.
import Sound.Tidal.Boot

default (Rational, Integer, Double, Pattern String)

-- Create a Tidal Stream with the default settings.
-- To customize these settings, use 'mkTidalWith' instead
tidalInst <- mkTidal

-- tidalInst <- mkTidalWith [(superdirtTarget { oLatency = 0.01 }, [superdirtShape])] (defaultConfig {cFrameTimespan = 1/50, cProcessAhead = 1/20})

-- This orphan instance makes the boot aliases work!
-- It has to go after you define 'tidalInst'.
instance Tidally where tidal = tidalInst

-- `enableLink` and `disableLink` can be used to toggle synchronisation using the Link protocol.
-- Uncomment the next line to enable Link on startup.
-- enableLink

-- You can also add your own aliases in this file. For example:
-- fastsquizzed pat = fast 2 $ pat # squiz 1.5

-- Extended channels d17-d24 for more complex arrangements
:{
let d17 = streamReplace tidal 16
    d18 = streamReplace tidal 17
    d19 = streamReplace tidal 18
    d20 = streamReplace tidal 19
    d21 = streamReplace tidal 20
    d22 = streamReplace tidal 21
    d23 = streamReplace tidal 22
    d24 = streamReplace tidal 23
:}

:set prompt "tidal> "
:set prompt-cont ""
