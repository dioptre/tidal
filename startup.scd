/*
This is an example startup file. You can load it from your startup file
(to be found in Platform.userAppSupportDir +/+ "startup.scd")
*/


(
if (Library.at(\startupLoaded).isNil) {
	Library.put(\startupLoaded, true);

	// configure the sound server: here you could add hardware specific options
	// see http://doc.sccode.org/Classes/ServerOptions.html

	// IMPORTANT: Set this to your Aggregate Device name created in Audio MIDI Setup
	// To create: Open Audio MIDI Setup → + → Create Aggregate Device → Add both speakers and headphones
	s.options.outDevice = nil; // Use Mac default system output device
	s.options.numBuffers = 1024 * 256; // increase this if you need to load more samples
	s.options.memSize = 8192 * 256; // 2 GB (max that boots without HashTable error)
	s.options.numWireBufs = 512; // increased for looper (was 256)
	s.options.maxNodes = 1024 * 32; // increase this if you are getting drop outs and the message "too many nodes"
	s.options.numOutputBusChannels = 2; // Stereo speakers
	s.options.numInputBusChannels = 0;
	// s.options.blockSize = 1024; // larger block = less CPU overhead, slightly more latency
	// boot the server and start SuperDirt
	s.waitForBoot {
		~dirt.stop; // stop any old ones, avoid duplicate dirt (if it is nil, this won't do anything)
		~dirt = SuperDirt(2, s); // two channels per orbit (stereo)
		load("/Users/andrewgrosser/Library/Application Support/SuperCollider/synthdefs/mi-ugens.scd");
        // load("/Users/andrewgrosser/Documents/tidal/effects/convolveir/convolution-effect.scd");
        // load("/Users/andrewgrosser/Documents/tidal/effects/compressor/compressor-effect.scd");
        // load("/Users/andrewgrosser/Documents/tidal/effects/spectral-delay/spectral-delay-effect.scd");
		// ~looper = TidalLooper(~dirt, numBuffers: 2, maxRecordingTime: 30);
		// You can adjust looper parameters in runtime:
	    // ~looper.rLevel = 2.5;
	    // ~looper.pLevel = 0.8;
	    // ~looper.linput = 15; // Set this to your main input port.
	    // ~looper.lname = "mybuffer";
	    // ~looper.debugMode = true;
		~dirt.loadSoundFiles;
		s.sync; // wait for sample loading to sync cleanly
		~dirt.start(57120, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);   // d1-d16 → speakers

        // Instrument installation — depth-bucket hand controller
        load("/Users/andrewgrosser/Documents/spacehands/supercollider/boot.scd");

		// optional, needed for convenient access from sclang:
		(
			~d1 = ~dirt.orbits[0]; ~d2 = ~dirt.orbits[1]; ~d3 = ~dirt.orbits[2];
			~d4 = ~dirt.orbits[3]; ~d5 = ~dirt.orbits[4]; ~d6 = ~dirt.orbits[5];
			~d7 = ~dirt.orbits[6]; ~d8 = ~dirt.orbits[7]; ~d9 = ~dirt.orbits[8];
			~d10 = ~dirt.orbits[9]; ~d11 = ~dirt.orbits[10]; ~d12 = ~dirt.orbits[11];
			~d13 = ~dirt.orbits[12]; ~d14 = ~dirt.orbits[13];
		);
		/*
        ~dirt.orbits.do { |x|
            var clouds = GlobalDirtEffect(\global_mi_clouds, [\cloudspitch, \cloudspos, \cloudssize, \cloudsdens, \cloudstex, \cloudswet, \cloudsgain, \cloudsspread, \cloudsrvb, \cloudsfb, \cloudsfreeze, \cloudsmode, \cloudslofi]);
            var verb = GlobalDirtEffect(\global_mi_verb, [\verbwet, \verbtime, \verbdamp, \verbhp, \verbfreeze, \verbdiff, \verbgain]);
            x.globalEffects = x.globalEffects
              .addFirst(clouds)
              .addFirst(verb);
            x.initNodeTree;
        };
        */

	    // Boost gain for speaker orbits (d1-d12) to match headphone volume
	    // ~dirt.orbits[0..11].do { |orbit| orbit.set(\amp, 1.5) };
	};

	s.latency = 0.5; // increased for Aggregate Device latency
};
);
