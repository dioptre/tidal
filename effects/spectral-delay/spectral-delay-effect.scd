/*
Spectral Delay Effect for SuperDirt
A weird spectral delay that splits the signal into 16 frequency bands
and delays them based on bitwise patterns.

Parameters:
- tsdelay: Time scale for delay (0-1), controls overall delay time
- xsdelay: Delay structure (integer), determines which bands are delayed via bitwise AND

Usage in Tidal:
d1 $ sound "can*4" # tsdelay "0 0.25 0.5 0.75 1" # xsdelay "3 124 3 12 62 2"
*/

(
// Add the spectral delay module to SuperDirt
~dirt.addModule('spectral-delay', { |dirtEvent|
    dirtEvent.sendSynth('spectral-delay' ++ ~dirt.numChannels,
        [
            xsdelay: ~xsdelay,
            tsdelay: ~tsdelay,
            sustain: ~sustain,
            out: ~out
        ]
    )
}, { ~tsdelay.notNil or: { ~xsdelay.notNil } }); // play synth only if at least one parameter is given

// Define the spectral delay SynthDef
var numChannels = ~dirt.numChannels;

SynthDef("spectral-delay" ++ numChannels, { |out, tsdelay, xsdelay = 1, sustain|

    var signal, delayTime, delays, freqs, filtered;
    var size = 16;
    var maxDelayTime = 0.2;

    signal = In.ar(out, numChannels);
    delayTime = tsdelay * maxDelayTime;
    filtered = (1..size).sum { |i|
        var filterFreq = i.linexp(1, size, 40, 17000);
        var sig = BPF.ar(signal, filterFreq, 0.005);
        // the delay pattern is determined from xsdelay by bitwise-and:
        DelayN.ar(sig, maxDelayTime, i & xsdelay * (1/size) * delayTime )
    };
    signal = signal * 0.2 + (filtered * 4); // this controls wet/dry
    ReplaceOut.ar(out, signal)

}).add;

"Spectral Delay effect loaded".postln;
)
