/*
This is an example startup file. You can load it from your startup file
(to be found in Platform.userAppSupportDir +/+ "startup.scd")
*/


(
s.reboot { // server options are only updated on reboot
	// configure the sound server: here you could add hardware specific options
	// see http://doc.sccode.org/Classes/ServerOptions.html

	// IMPORTANT: Set this to your Aggregate Device name created in Audio MIDI Setup
	// To create: Open Audio MIDI Setup → + → Create Aggregate Device → Add both speakers and headphones
	// Comment out this line to use the default system output device
	s.options.outDevice = "Aggregate Device";  // Replace with your aggregate device name
	s.options.numBuffers = 1024 * 256; // increase this if you need to load more samples
	s.options.memSize = 8192 * 32; // increase this if you get "alloc failed" messages
	s.options.numWireBufs = 256; // increase this if you get "exceeded number of interconnect buffers" messages
	s.options.maxNodes = 1024 * 32; // increase this if you are getting drop outs and the message "too many nodes"
	s.options.numOutputBusChannels = 4; // 2 for speakers + 2 for headphones
	s.options.numInputBusChannels = 2; // set this to your hardware output channel size, if necessary
	// boot the server and start SuperDirt
	s.waitForBoot {
		~dirt.stop; // stop any old ones, avoid duplicate dirt (if it is nil, this won't do anything)
		~dirt = SuperDirt(2, s); // two channels per orbit (stereo)
		load("/Users/andrewgrosser/Library/Application Support/SuperCollider/synthdefs/mi-ugens.scd");
        load("/Users/andrewgrosser/Documents/tidal/effects/convolveir/convolution-effect.scd");
        load("/Users/andrewgrosser/Documents/tidal/effects/compressor/compressor-effect.scd");
        load("/Users/andrewgrosser/Documents/tidal/effects/spectral-delay/spectral-delay-effect.scd");
		~dirt.loadSoundFiles;
		~dirt.loadSoundFiles("/Users/andrewgrosser/Documents/tidal/samples-extra/*");   // load samples (path containing a wildcard can be passed in)
		~dirt.loadSoundFiles("/Users/andrewgrosser/Documents/tidal/samples-strudel/*"); // load Strudel samples (VCSL + piano)
		~dirt.loadSoundFiles("/Users/andrewgrosser/Documents/tidal/sounds/bbc/*");
		// for example: ~dirt.loadSoundFiles("/Users/myUserName/Dirt/samples/*");
		// s.sync; // optionally: wait for samples to be read
		~dirt.start(57120, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2]);   // d1-d12 → speakers (ch 0-1), d13-d14 → headphones (ch 2-3)

		// optional, needed for convenient access from sclang:
		(
			~d1 = ~dirt.orbits[0]; ~d2 = ~dirt.orbits[1]; ~d3 = ~dirt.orbits[2];
			~d4 = ~dirt.orbits[3]; ~d5 = ~dirt.orbits[4]; ~d6 = ~dirt.orbits[5];
			~d7 = ~dirt.orbits[6]; ~d8 = ~dirt.orbits[7]; ~d9 = ~dirt.orbits[8];
			~d10 = ~dirt.orbits[9]; ~d11 = ~dirt.orbits[10]; ~d12 = ~dirt.orbits[11];
			~d13 = ~dirt.orbits[12]; ~d14 = ~dirt.orbits[13];
		);
		~dirt.orbits.do { |x|
            var clouds = GlobalDirtEffect(\global_mi_clouds, [\cloudspitch, \cloudspos, \cloudssize, \cloudsdens, \cloudstex, \cloudswet, \cloudsgain, \cloudsspread, \cloudsrvb, \cloudsfb, \cloudsfreeze, \cloudsmode, \cloudslofi]);
            var verb = GlobalDirtEffect(\global_mi_verb, [\verbwet, \verbtime, \verbdamp, \verbhp, \verbfreeze, \verbdiff, \verbgain]);
            x.globalEffects = x.globalEffects
              .addFirst(clouds)
              .addFirst(verb);
            x.initNodeTree;
        };

        // Boost gain for speaker orbits (d1-d12) to match headphone volume
        // ~dirt.orbits[0..11].do { |orbit| orbit.set(\amp, 1.5) };
	};

	s.latency = 0.3; // increase this if you get "late" messages
};
);
