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
	// Comment out this line to use the default system output device
	if(thisProcess.platform.name == \osx) {
		s.options.outDevice = "Aggregate Device";  // Replace with your aggregate device name
		s.options.numOutputBusChannels = 4; // 2 for speakers + 2 for headphones
	} {
		// Linux/Pi: Use default system device (SoundCore 2 Bluetooth) and 2 output channels
		s.options.numOutputBusChannels = 2;
	};
	s.options.numBuffers = 1024 * 256; // increase this if you need to load more samples
	s.options.memSize = 8192 * 256; // 2 GB (max that boots without HashTable error)
	s.options.numWireBufs = 512; // increased for looper (was 256)
	s.options.maxNodes = 1024 * 32; // increase this if you are getting drop outs and the message "too many nodes"
	s.options.numInputBusChannels = 2; // set this to your hardware output channel size, if necessary
	s.latency = 0.3; // increase this if you get "late" messages

	// boot the server and start SuperDirt
	s.waitForBoot {
		~dirt.stop; // stop any old ones, avoid duplicate dirt (if it is nil, this won't do anything)
		~dirt = SuperDirt(2, s); // two channels per orbit (stereo)
		load(Platform.userHomeDir +/+ "Documents/tidal/mi-UGens/Setup/mi-ugens.scd");
	    load(Platform.userHomeDir +/+ "Documents/tidal/effects/convolveir/convolution-effect.scd");
	    load(Platform.userHomeDir +/+ "Documents/tidal/effects/compressor/compressor-effect.scd");
	    load(Platform.userHomeDir +/+ "Documents/tidal/effects/spectral-delay/spectral-delay-effect.scd");
		~looper = TidalLooper(~dirt, numBuffers: 2, maxRecordingTime: 30);  // Only 2 buffers, 30 seconds each
		load(Platform.userHomeDir +/+ "Documents/ag/instrument/supercollider/boot.scd");
		// You can adjust looper parameters in runtime:
	    // ~looper.rLevel = 2.5;
	    // ~looper.pLevel = 0.8;
	    // ~looper.linput = 15; // Set this to your main input port.
	    // ~looper.lname = "mybuffer";
	    // ~looper.debugMode = true;
		~dirt.loadSoundFiles;
		~dirt.loadSoundFiles(Platform.userHomeDir +/+ "Documents/tidal/samples-extra/*");   // load samples (path containing a wildcard can be passed in)
		// ~dirt.loadSoundFiles(Platform.userHomeDir +/+ "Documents/tidal/samples-strudel/*"); // load Strudel samples (VCSL + piano)
		// ~dirt.loadSoundFiles("/Users/andrewgrosser/Documents/tidal/sounds/bbc/*");
		// for example: ~dirt.loadSoundFiles("/Users/myUserName/Dirt/samples/*");
		// s.sync; // optionally: wait for samples to be read
		if(thisProcess.platform.name == \osx) {
			~dirt.start(57120, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2]);   // d1-d12 → speakers (ch 0-1), d13-d14 → headphones (ch 2-3)
		} {
			// Linux/Pi: route all orbits (including d13-d14) to default stereo output channels (ch 0-1)
			~dirt.start(57120, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
		};

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
} {
	"startup.scd already loaded, skipping duplicate execution.".postln;
};
);
