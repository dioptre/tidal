// Compressor Effect for SuperDirt
// Location: effects/compressor/compressor-effect.scd
// This creates a dynamics compressor with flexible control
// Load in startup.scd: load("/Users/andrewgrosser/Documents/tidal/effects/compressor/compressor-effect.scd");

(
// Main compressor effect using SuperCollider's Compander
// Parameters:
//   compressmix (0-1): dry/wet mix (default 0.5)
//   compressthresh (0-1): threshold - lower = more compression (default 0.5 = -10dB)
//   compressratio (1-20): compression ratio (default 4)
//   compressattack (0.0001-0.1): attack time in seconds (default 0.01)
//   compressrelease (0.01-1): release time in seconds (default 0.1)
//   compressmakeup (0-2): makeup gain to compensate for level reduction (default 1.0)
//   compressknee (0-1): soft knee amount (default 0.5)
SynthDef(\dirt_compress, { |out, dryBus, effectBus,
                            compressmix = 0.5,
                            compressthresh = 0.5,
                            compressratio = 4,
                            compressattack = 0.01,
                            compressrelease = 0.1,
                            compressmakeup = 1.0,
                            compressknee = 0.5|
    var dry, wet, sig, thresh, slopeBelow, slopeAbove, clampTime, relaxTime;

    dry = In.ar(dryBus, 2);
    sig = InFeedback.ar(effectBus, 2);

    // Convert threshold from 0-1 to dB range (-40dB to 0dB)
    thresh = compressthresh.linexp(0, 1, 0.01, 1);

    // Compander parameters
    slopeBelow = 1.0; // No compression below threshold
    slopeAbove = 1.0 / compressratio.clip(1, 20); // Compression ratio
    clampTime = compressattack.clip(0.0001, 0.1); // Attack time
    relaxTime = compressrelease.clip(0.01, 1); // Release time

    // Apply compression with soft knee
    // Compander: (in, control, thresh, slopeBelow, slopeAbove, clampTime, relaxTime)
    wet = Compander.ar(
        sig,
        sig,
        thresh,
        slopeBelow,
        slopeAbove,
        clampTime,
        relaxTime,
        compressmakeup.clip(0, 2)
    );

    // Optional soft knee shaping using a gentle limiter
    wet = (wet * (1 - compressknee)) + (wet.softclip * compressknee);

    // Mix dry/wet
    sig = XFade2.ar(dry, wet, compressmix.linlin(0, 1, -1, 1));

    Out.ar(out, sig);
}).add;
);

(
// Sidechain compressor - uses external signal to trigger compression
// Parameters:
//   sidechainmix (0-1): dry/wet mix
//   sidechainthresh (0-1): threshold
//   sidechainratio (1-20): compression ratio
//   sidechainattack (0.0001-0.1): attack time
//   sidechainrelease (0.01-1): release time
//   sidechainmakeup (0-2): makeup gain
SynthDef(\dirt_sidechain, { |out, dryBus, effectBus,
                             sidechainmix = 0.5,
                             sidechainthresh = 0.5,
                             sidechainratio = 4,
                             sidechainattack = 0.01,
                             sidechainrelease = 0.1,
                             sidechainmakeup = 1.0|
    var dry, wet, sig, control, thresh, slopeBelow, slopeAbove, clampTime, relaxTime;

    dry = In.ar(dryBus, 2);
    sig = InFeedback.ar(effectBus, 2);

    // Create a rhythmic control signal (simulates kick drum sidechain)
    // In practice, you'd route an actual kick drum here
    control = LFPulse.ar(2, 0, 0.1) * 0.8;
    control = control.dup;

    // Convert threshold
    thresh = sidechainthresh.linexp(0, 1, 0.01, 1);

    slopeBelow = 1.0;
    slopeAbove = 1.0 / sidechainratio.clip(1, 20);
    clampTime = sidechainattack.clip(0.0001, 0.1);
    relaxTime = sidechainrelease.clip(0.01, 1);

    // Apply sidechain compression
    wet = Compander.ar(
        sig,
        control, // Use control signal instead of sig
        thresh,
        slopeBelow,
        slopeAbove,
        clampTime,
        relaxTime,
        sidechainmakeup.clip(0, 2)
    );

    // Mix dry/wet
    sig = XFade2.ar(dry, wet, sidechainmix.linlin(0, 1, -1, 1));

    Out.ar(out, sig);
}).add;
);

(
// Limiter - extreme compression for preventing clipping
// Parameters:
//   limitmix (0-1): dry/wet mix
//   limitthresh (0-1): threshold (how loud before limiting)
//   limitrelease (0.001-0.1): release time
SynthDef(\dirt_limit, { |out, dryBus, effectBus,
                         limitmix = 0.5,
                         limitthresh = 0.8,
                         limitrelease = 0.01|
    var dry, wet, sig, thresh;

    dry = In.ar(dryBus, 2);
    sig = InFeedback.ar(effectBus, 2);

    thresh = limitthresh.clip(0.1, 1);

    // Limiter is just a compressor with very high ratio and fast attack
    wet = Limiter.ar(sig, thresh, limitrelease.clip(0.001, 0.1));

    // Mix dry/wet
    sig = XFade2.ar(dry, wet, limitmix.linlin(0, 1, -1, 1));

    Out.ar(out, sig);
}).add;
);

(
// Multiband compressor - split into 3 bands and compress separately
// Parameters:
//   multibandmix (0-1): dry/wet mix
//   multibandlowratio (1-20): low band compression ratio
//   multibandmidratio (1-20): mid band compression ratio
//   multibandhighratio (1-20): high band compression ratio
//   multibandlowfreq (50-500): low/mid crossover frequency
//   multibandhighfreq (1000-10000): mid/high crossover frequency
SynthDef(\dirt_multiband, { |out, dryBus, effectBus,
                             multibandmix = 0.5,
                             multibandlowratio = 4,
                             multibandmidratio = 3,
                             multibandhighratio = 2,
                             multibandlowfreq = 200,
                             multibandhighfreq = 2000|
    var dry, wet, sig, low, mid, high, lowComp, midComp, highComp;

    dry = In.ar(dryBus, 2);
    sig = InFeedback.ar(effectBus, 2);

    // Split into bands
    low = LPF.ar(sig, multibandlowfreq.clip(50, 500));
    high = HPF.ar(sig, multibandhighfreq.clip(1000, 10000));
    mid = sig - low - high;

    // Compress each band
    lowComp = Compander.ar(low, low, 0.5, 1, 1.0/multibandlowratio.clip(1, 20), 0.01, 0.1);
    midComp = Compander.ar(mid, mid, 0.5, 1, 1.0/multibandmidratio.clip(1, 20), 0.01, 0.1);
    highComp = Compander.ar(high, high, 0.5, 1, 1.0/multibandhighratio.clip(1, 20), 0.005, 0.05);

    // Recombine
    wet = lowComp + midComp + highComp;

    // Mix dry/wet
    sig = XFade2.ar(dry, wet, multibandmix.linlin(0, 1, -1, 1));

    Out.ar(out, sig);
}).add;
);

"Compressor effects loaded successfully!".postln;
"Available: #compress, #sidechain, #limit, #multiband".postln;
