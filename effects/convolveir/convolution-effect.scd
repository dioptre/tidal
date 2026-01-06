// Convolution Reverb Effect for SuperDirt
// Location: effects/convolveir/convolution-effect.scd
// This creates a convolution reverb using impulse response files
// Load in startup.scd: load("/Users/andrewgrosser/Documents/tidal/effects/convolveir/convolution-effect.scd");

(
// Load impulse responses into buffers
// IR files are located in: /Users/andrewgrosser/Documents/tidal/impulse-responses/
~impulseResponses = Dictionary.new;
~irPath = "/Users/andrewgrosser/Documents/tidal/impulse-responses/";

// 52 Diverse IRs from ViperFX Collection (CC BY-SA 4.0)
// Source: https://github.com/AndroidAudioMods/ViperFX_RE
// Archive: https://archive.org/details/impulse-response-irs-wav-database

// ===== ORIGINAL 12 CORE IRs (0-11) =====
~impulseResponses[\hall] = Buffer.read(s, ~irPath ++ "hall.wav");           // 0: Small Hall - Mid RT 0.5s
~impulseResponses[\church] = Buffer.read(s, ~irPath ++ "church.wav");       // 1: Creative Church
~impulseResponses[\room] = Buffer.read(s, ~irPath ++ "room.wav");           // 2: Beetle Interior (tiny space)
~impulseResponses[\plate] = Buffer.read(s, ~irPath ++ "plate.wav");         // 3: Gold Plate - Size 1
~impulseResponses[\spring] = Buffer.read(s, ~irPath ++ "spring.wav");       // 4: Phonebooth Tight (spring-like)
~impulseResponses[\chamber] = Buffer.read(s, ~irPath ++ "chamber.wav");     // 5: Small Chamber
~impulseResponses[\cathedral] = Buffer.read(s, ~irPath ++ "cathedral.wav"); // 6: Haunted Cavern (huge space)
~impulseResponses[\concert] = Buffer.read(s, ~irPath ++ "concert-hall.wav");// 7: DFX Concert Hall
~impulseResponses[\studio] = Buffer.read(s, ~irPath ++ "studio.wav");       // 8: Sony C-Studio A1
~impulseResponses[\ambient] = Buffer.read(s, ~irPath ++ "ambient.wav");     // 9: Sewer Pipe (experimental)
~impulseResponses[\warehouse] = Buffer.read(s, ~irPath ++ "warehouse.wav"); // 10: Industrial warehouse
~impulseResponses[\space] = Buffer.read(s, ~irPath ++ "space.wav");         // 11: Deep Space (sci-fi)

// ===== 30 CREATIVE & UNIQUE IRs (12-41) =====
~impulseResponses[\bathroom] = Buffer.read(s, ~irPath ++ "bathroom.wav");           // 12: Bathroom acoustics
~impulseResponses[\cassette] = Buffer.read(s, ~irPath ++ "cassette.wav");           // 13: Cassette Type IV Metal
~impulseResponses[\tapeSat] = Buffer.read(s, ~irPath ++ "tape-sat.wav");            // 14: 15ips tape saturation
~impulseResponses[\tapeClean] = Buffer.read(s, ~irPath ++ "tape-clean.wav");        // 15: Clean tape
~impulseResponses[\locker] = Buffer.read(s, ~irPath ++ "locker.wav");               // 16: Locker room
~impulseResponses[\car] = Buffer.read(s, ~irPath ++ "car.wav");                     // 17: Car interior blue
~impulseResponses[\truck] = Buffer.read(s, ~irPath ++ "truck.wav");                 // 18: Inside truck
~impulseResponses[\glassOffice] = Buffer.read(s, ~irPath ++ "glass-office.wav");    // 19: Glass office
~impulseResponses[\woodSmall] = Buffer.read(s, ~irPath ++ "wood-small.wav");        // 20: Small wood room
~impulseResponses[\woodNatural] = Buffer.read(s, ~irPath ++ "wood-natural.wav");    // 21: Natural wood room
~impulseResponses[\drumPlate] = Buffer.read(s, ~irPath ++ "drum-plate.wav");        // 22: Drum plate
~impulseResponses[\guitarRoom] = Buffer.read(s, ~irPath ++ "guitar-room.wav");      // 23: Acoustic guitar room
~impulseResponses[\guitarHc] = Buffer.read(s, ~irPath ++ "guitar-hc.wav");          // 24: Guitar room HC 1.0kHz
~impulseResponses[\vocalBright] = Buffer.read(s, ~irPath ++ "vocal-bright.wav");    // 25: Bright vocal HC
~impulseResponses[\vocalBooth] = Buffer.read(s, ~irPath ++ "vocal-booth.wav");      // 26: Vocal booth walls
~impulseResponses[\bottle] = Buffer.read(s, ~irPath ++ "bottle.wav");               // 27: Bottle hall
~impulseResponses[\rebound] = Buffer.read(s, ~irPath ++ "rebound.wav");             // 28: Rebound
~impulseResponses[\backslap] = Buffer.read(s, ~irPath ++ "backslap.wav");           // 29: Backslap
~impulseResponses[\furnished] = Buffer.read(s, ~irPath ++ "furnished.wav");         // 30: Furnished room
~impulseResponses[\tinyRoom] = Buffer.read(s, ~irPath ++ "tiny-room.wav");          // 31: Too small mens room
~impulseResponses[\reception] = Buffer.read(s, ~irPath ++ "reception.wav");         // 32: Reception area
~impulseResponses[\arena] = Buffer.read(s, ~irPath ++ "arena.wav");                 // 33: Indoor arena
~impulseResponses[\metal] = Buffer.read(s, ~irPath ++ "metal.wav");                 // 34: Heavy metal EQ
~impulseResponses[\vintage] = Buffer.read(s, ~irPath ++ "vintage.wav");             // 35: Blues vintage electric
~impulseResponses[\wideChamber] = Buffer.read(s, ~irPath ++ "wide-chamber.wav");    // 36: Wide ambient chamber
~impulseResponses[\wideStereo] = Buffer.read(s, ~irPath ++ "wide-stereo.wav");      // 37: BBE wide stereo
~impulseResponses[\verySmall] = Buffer.read(s, ~irPath ++ "very-small.wav");        // 38: Very small room
~impulseResponses[\illusion] = Buffer.read(s, ~irPath ++ "illusion.wav");           // 39: Illusion effect
~impulseResponses[\surfin] = Buffer.read(s, ~irPath ++ "surfin.wav");               // 40: Surfin effect
~impulseResponses[\wetTack] = Buffer.read(s, ~irPath ++ "wet-tack.wav");            // 41: Wet & tack

// ===== 10 BASS-HEAVY EDM IRs for Dubstep/Bassnectar style (42-51) =====
~impulseResponses[\bassBoost] = Buffer.read(s, ~irPath ++ "bass-boost-80hz.wav");   // 42: 80Hz +15dB boost
~impulseResponses[\bbeExtra] = Buffer.read(s, ~irPath ++ "bbe-extrabass.wav");      // 43: BBE extra bass
~impulseResponses[\deep] = Buffer.read(s, ~irPath ++ "deep.wav");                   // 44: Deep bass enhance
~impulseResponses[\clubA] = Buffer.read(s, ~irPath ++ "club-a.wav");                // 45: Club A acoustics
~impulseResponses[\musicClub] = Buffer.read(s, ~irPath ++ "music-club.wav");        // 46: Music club space
~impulseResponses[\techno] = Buffer.read(s, ~irPath ++ "techno.wav");               // 47: Techno EQ curve
~impulseResponses[\dance] = Buffer.read(s, ~irPath ++ "dance.wav");                 // 48: Dance music optimized
~impulseResponses[\kickSnare] = Buffer.read(s, ~irPath ++ "kick-snare.wav");        // 49: Kick/snare focused
~impulseResponses[\bbeLocontr] = Buffer.read(s, ~irPath ++ "bbe-locontr.wav");      // 50: Low-end control
~impulseResponses[\bassSurround] = Buffer.read(s, ~irPath ++ "bass-surround.wav");  // 51: Bass-enhanced surround

// Build ordered array for dynamic IR selection (0-51)
~irArray = [
    // 0-11: Core IRs
    ~impulseResponses[\hall], ~impulseResponses[\church], ~impulseResponses[\room],
    ~impulseResponses[\plate], ~impulseResponses[\spring], ~impulseResponses[\chamber],
    ~impulseResponses[\cathedral], ~impulseResponses[\concert], ~impulseResponses[\studio],
    ~impulseResponses[\ambient], ~impulseResponses[\warehouse], ~impulseResponses[\space],
    // 12-41: Creative IRs
    ~impulseResponses[\bathroom], ~impulseResponses[\cassette], ~impulseResponses[\tapeSat],
    ~impulseResponses[\tapeClean], ~impulseResponses[\locker], ~impulseResponses[\car],
    ~impulseResponses[\truck], ~impulseResponses[\glassOffice], ~impulseResponses[\woodSmall],
    ~impulseResponses[\woodNatural], ~impulseResponses[\drumPlate], ~impulseResponses[\guitarRoom],
    ~impulseResponses[\guitarHc], ~impulseResponses[\vocalBright], ~impulseResponses[\vocalBooth],
    ~impulseResponses[\bottle], ~impulseResponses[\rebound], ~impulseResponses[\backslap],
    ~impulseResponses[\furnished], ~impulseResponses[\tinyRoom], ~impulseResponses[\reception],
    ~impulseResponses[\arena], ~impulseResponses[\metal], ~impulseResponses[\vintage],
    ~impulseResponses[\wideChamber], ~impulseResponses[\wideStereo], ~impulseResponses[\verySmall],
    ~impulseResponses[\illusion], ~impulseResponses[\surfin], ~impulseResponses[\wetTack],
    // 42-51: Bass-heavy EDM IRs
    ~impulseResponses[\bassBoost], ~impulseResponses[\bbeExtra], ~impulseResponses[\deep],
    ~impulseResponses[\clubA], ~impulseResponses[\musicClub], ~impulseResponses[\techno],
    ~impulseResponses[\dance], ~impulseResponses[\kickSnare], ~impulseResponses[\bbeLocontr],
    ~impulseResponses[\bassSurround]
];

"Checking for impulse responses...".postln;
~impulseResponses.keysValuesDo { |key, buffer|
    if(buffer.notNil, {
        postln("✓ Loaded: " ++ key);
    }, {
        postln("✗ Missing: " ++ key ++ " (file not found)");
    });
};
postln("Impulse response loading complete.");
);

(
// Convolution reverb effect using PartConv (partitioned convolution for efficiency)
// Dynamic IR selection: use convolveir parameter (0-51) to choose which IR
// Parameters:
//   convolvemix (0-1): dry/wet mix (default 0.3)
//   convolveir (0-51): IR selection (default 0)
//   convolvedamp (0-1): dampen high frequencies in reverb tail (default 0.5)
//   convolvepredel (0-0.2): pre-delay in seconds before reverb (default 0)
//   convolvelevel (0-2): output level boost/cut (default 1.0)
SynthDef(\dirt_convolve, { |out, dryBus, effectBus, convolvemix = 0.3, convolveir = 0,
                             convolvedamp = 0.5, convolvepredel = 0, convolvelevel = 1.0|
    var dry, wet, sig, irBuffer, irIndex;

    dry = In.ar(dryBus, 2);
    sig = InFeedback.ar(effectBus, 2);

    // Pre-delay (up to 200ms)
    sig = DelayC.ar(sig, 0.2, convolvepredel.clip(0, 0.2));

    // Select IR buffer dynamically based on convolveir parameter (0-51)
    irIndex = convolveir.clip(0, 51).round;
    irBuffer = Select.kr(irIndex, ~irArray);

    // Apply convolution
    wet = PartConv.ar(sig, 2048, irBuffer);

    // High frequency damping (simulates air absorption)
    wet = LPF.ar(wet, convolvedamp.linexp(0, 1, 800, 18000));

    // Level control
    wet = wet * convolvelevel.clip(0, 2);

    // Mix dry/wet
    sig = XFade2.ar(dry, wet, convolvemix.linlin(0, 1, -1, 1));

    Out.ar(out, sig);
}).add;
);

(
// Alternative: Simple Convolution2 (less CPU efficient but simpler)
SynthDef(\dirt_convolve2, { |out, dryBus, effectBus, convolvemix = 0.3|
    var dry, wet, sig, irBuffer;

    dry = In.ar(dryBus, 2);
    sig = InFeedback.ar(effectBus, 2);

    // Use a built-in short IR for testing
    // In practice, load your own IR files
    irBuffer = LocalBuf.newFrom(
        Array.fill(44100, { |i|
            // Simple synthetic IR (exponential decay with some modulation)
            exp(i.neg / 8000) * SinOsc.ar(i / 100).range(0.8, 1)
        }).dup
    );

    // Apply convolution
    wet = Convolution2.ar(sig, irBuffer, 0, 512);

    // Mix dry/wet
    sig = XFade2.ar(dry, wet, convolvemix.linlin(0, 1, -1, 1));

    Out.ar(out, sig);
}).add;
);

"Convolution effects loaded. Use #convolve or #convolve2 in Tidal".postln;

// ============================================
// SUPER IR GENERATOR - Convolve IRs together at runtime
// ============================================

// Function to convolve two IRs together to create a "super IR"
~convolveTwoIRs = { |ir1Index, ir2Index|
    var ir1 = ~irArray[ir1Index.clip(0, 51).asInteger];
    var ir2 = ~irArray[ir2Index.clip(0, 51).asInteger];
    var result;

    if(ir1.notNil and: ir2.notNil, {
        var ir1Data, ir2Data, convolved;

        // Load IR data into arrays
        ir1.loadToFloatArray(action: { |data1|
            ir2.loadToFloatArray(action: { |data2|
                var fftSize, paddedSize;
                var fft1, fft2, fftResult;

                // Determine FFT size (next power of 2)
                fftSize = (data1.size + data2.size - 1).nextPowerOfTwo;

                // Pad both IRs to FFT size
                data1 = data1 ++ Array.fill(fftSize - data1.size, 0);
                data2 = data2 ++ Array.fill(fftSize - data2.size, 0);

                // Perform convolution via FFT
                fft1 = data1.rfft;
                fft2 = data2.rfft;

                // Multiply in frequency domain (convolution in time domain)
                fftResult = fft1.complex * fft2.complex;

                // Transform back to time domain
                convolved = fftResult.real.irfft;

                // Normalize
                convolved = convolved / convolved.abs.maxItem;

                // Create new buffer with result
                result = Buffer.loadCollection(s, convolved);

                postln("Super IR created: IR" ++ ir1Index ++ " * IR" ++ ir2Index ++ " -> Buffer" ++ result.bufnum);
            });
        });
    }, {
        "Error: One or both IRs not loaded".postln;
    });

    result;
};

// Function to convolve multiple IRs together
~convolveManyIRs = { |irIndexArray|
    var result = ~irArray[irIndexArray[0].clip(0, 51).asInteger];

    irIndexArray[1..].do { |irIndex|
        result = ~convolveTwoIRs.value(irIndexArray[0], irIndex);
        // Use result as input for next convolution
    };

    postln("Super IR created from: " ++ irIndexArray);
    result;
};

// Initialize global storage for collecting IR indices
~superIRIndices = [];
~superIRProcessing = false;
~superIRTask = nil;

// SynthDef to catch superir events from Tidal
// This receives the IR indices sent by makeSuperIR
SynthDef(\superir, { |out, n = 0|
    var sig;

    // Store the IR index in a global array
    SendReply.kr(Impulse.kr(0), '/superir_index', n);

    // Silent output (this is just a data collection synth)
    sig = Silent.ar(2);
    Out.ar(out, sig);

    // Free immediately
    FreeSelf.kr(Impulse.kr(0));
}).add;

// OSCdef to receive IR indices
OSCdef(\superirReceiver, { |msg|
    var irIndex = msg[3].asInteger;

    ~superIRIndices = ~superIRIndices ++ [irIndex];
    postln("→ Received IR index: " ++ irIndex ++ " (total: " ++ ~superIRIndices.size ++ ")");

    // Cancel previous processing task if it exists
    if(~superIRTask.notNil, {
        ~superIRTask.stop;
    });

    // Start a new task that will process after 0.2 seconds of no new indices
    ~superIRTask = {
        0.2.wait;
        ~processSuperIR.value;
    }.fork;
}, '/superir_index');

// Function to process collected IR indices into a super IR
~processSuperIR = {
    var indices = ~superIRIndices.copy;
    var superIR;

    if(~superIRProcessing, {
        postln("Already processing a Super IR, please wait...");
        ^this;
    });

    if(indices.size > 0, {
        ~superIRProcessing = true;
        postln("\n=== Processing Super IR from " ++ indices.size ++ " indices: " ++ indices ++ " ===");

        fork {
            // Start with first IR
            var result = ~irArray[indices[0].clip(0, 51).asInteger];

            if(indices.size == 1, {
                // Single IR - just add it as-is
                ~irArray = ~irArray ++ [result];
                postln("✓ Single IR added at index: " ++ (~irArray.size - 1));
                postln("Use in Tidal: # convolveir " ++ (~irArray.size - 1));
            }, {
                // Multiple IRs - convolve them together
                indices[1..].do { |irIndex, i|
                    var ir2 = ~irArray[irIndex.clip(0, 51).asInteger];

                    postln("Convolving " ++ (i+1) ++ "/" ++ (indices.size-1) ++ ": IR" ++ indices[0] ++ " * IR" ++ irIndex);

                    // Load result data
                    result.loadToFloatArray(action: { |data1|
                        ir2.loadToFloatArray(action: { |data2|
                            var convolved, fftSize, real1, imag1, real2, imag2, realResult, imagResult, cosTable;
                            var maxSize = 524288; // Max 524k samples to prevent memory issues

                            // Limit data size to prevent crashes
                            if(data1.size > maxSize, {
                                postln("  Warning: Truncating IR1 from " ++ data1.size ++ " to " ++ maxSize);
                                data1 = data1[..maxSize-1];
                            });
                            if(data2.size > maxSize, {
                                postln("  Warning: Truncating IR2 from " ++ data2.size ++ " to " ++ maxSize);
                                data2 = data2[..maxSize-1];
                            });

                            // Determine FFT size (next power of 2)
                            fftSize = (data1.size + data2.size - 1).nextPowerOfTwo;
                            postln("  FFT size: " ++ fftSize ++ " samples (" ++ (fftSize / s.sampleRate).round(0.01) ++ "s)");

                            // Create cosine table (only once)
                            cosTable = Signal.fftCosTable(fftSize);

                            // Pad both signals to FFT size and create separate real/imag buffers
                            real1 = Signal.newFrom(data1 ++ Array.fill(fftSize - data1.size, 0));
                            imag1 = Signal.newClear(fftSize);
                            real2 = Signal.newFrom(data2 ++ Array.fill(fftSize - data2.size, 0));
                            imag2 = Signal.newClear(fftSize);

                            // Perform FFT (modifies real1/imag1 and real2/imag2 in place)
                            real1.fft(imag1, cosTable);
                            real2.fft(imag2, cosTable);

                            // Complex multiplication for convolution
                            // Store result in new signals
                            realResult = (real1 * real2) - (imag1 * imag2);
                            imagResult = (real1 * imag2) + (imag1 * real2);

                            // Inverse FFT (modifies realResult/imagResult in place)
                            realResult.ifft(imagResult, cosTable);

                            // Take the real part as the convolved result
                            convolved = realResult.asArray;

                            // Normalize to prevent clipping
                            convolved = convolved / convolved.abs.maxItem.max(0.001);

                            // Truncate to reasonable length (keep only meaningful part)
                            convolved = convolved[..(data1.size + data2.size - 1).min(maxSize - 1)];

                            // Update result buffer
                            result = Buffer.loadCollection(s, convolved);

                            postln("  ✓ Convolved (result: " ++ convolved.size ++ " samples)");
                        });
                    });

                    // Wait for async processing
                    0.5.wait;
                };

                // Wait a bit more for final processing
                1.wait;

                // Add to IR array
                ~irArray = ~irArray ++ [result];

                postln("\n✓✓✓ Super IR COMPLETE! Created from " ++ indices.size ++ " IRs ✓✓✓");
                postln("✓ Added at index: " ++ (~irArray.size - 1));
                postln("Use in Tidal: # convolveir " ++ (~irArray.size - 1) ++ "\n");
            });

            // Clear the collected indices and reset processing flag
            ~superIRIndices = [];
            ~superIRProcessing = false;
            ~superIRTask = nil;
        };
    }, {
        postln("No IR indices to process");
    });
};

"Super IR system loaded!".postln;
"Use makeSuperIR [indices] in Tidal - processing is fully automatic!".postln;
