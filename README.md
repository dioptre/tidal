# Tidal Cycles

## TL;DR

This is a rapid start for people wanting to get started with Tidal esp on a Mac. All the files and a lot of getting started info in a single place. Thanks to tidalcycles.org. See ./test.tidal for a lot of examples. This is more of a complete setup than a piece-meal introduction through the official docs.

### Install


```sh
/usr/bin/xcode-select --install
curl https://raw.githubusercontent.com/tidalcycles/tidal-bootstrap/master/tidal-bootstrap.command -sSf | sh
cabal list tidal
cabal info tidal
ls ~/.pulsar/packages/tidalcycles/node_modules/osc-min/Applications/SuperCollider.app/Contents/Resources/scsynth -v
## SuperDirt: Start SuperCollider. From the Language menu, select "Quarks." SuperDirt and Dirt-Samples should be listed and checked.
## We need to do this again as there is a bug
cabal install tidal
```

Get this if you use vs code https://marketplace.visualstudio.com/items?itemName=tidalcycles.vscode-tidalcycles

Add this to .zshrc
```
export PATH="/Applications/SuperCollider.app/Contents/MacOS:$PATH"
export PATH="/Applications/SuperCollider.app/Contents/Resources:$PATH"
```

#### MIDI/OSC (input and output)
See https://tidalcycles.org/docs/configuration/MIDIOSC/midi
also ./midi-osc-bridge.pd and https://puredata.info/

#### More samples

- [Freesound](https://freesound.org/) - Free sounds
- [BBC Sound Effects](https://sound-effects.bbcrewind.co.uk/) - Direct from the BBC (Note: Read the license)
- [Legowelt Samples](http://legowelt.org/samples/) - Free samples from Legowelt by Legowelt himself
- [Music Radar](https://www.musicradar.com/news/tech/free-music-samples-royalty-free-loops-hits-and-multis-to-download) - Extensive collection of royalty-free audio samples
- [Reverb Drum Collection](https://reverb.com/software/samples-and-loops/reverb/3514-reverb-drum-machines-the-complete-collection) - Reverb Drum machines collection
- [We Sound Effects](https://wesoundeffects.com/we-sound-effects-bundle-2020/) - Sizable collection (Note: Read the license)
- [Young Guru Breaks](https://mgthefuture.com/product/305630) - Breakbeats curated by Young Guru
- [Sounds from Space](http://www.svengrahn.pp.se/sounds/sounds.htm) - Celestial audio for experimental composition
- [VSCO Orchestra](https://vis.versilstudios.com/vsco-community.html) - Live orchestra samples for live-coding
- [Free Samples for All](https://www.reddit.com/r/samplesforall/) - Community-driven Reddit resource
- [Looperman](https://www.looperman.com/) - Community-made bank of loops and accapellas
- [SampleSwap](https://sampleswap.org/) - 16-bit wav samples, huge library
- [99 Sounds](https://99sounds.org/) - More than 99 samples



### Running

1. Check quarks
2. Ensure superdirt, vowel and dirt samples are installed
3. Recompile superdirt, restart supercollider
4. Add more samples from samples-extra
   - Open SuperCollider, and open the example startup file via: File -> Open User Support Directory -> downloaded-quarks -> SuperDirt -> superdirt_startup.scd
   - Copy the contents to your clipboard
   - Open your SuperCollider startup file via: File -> Edit startup file
   - Paste the contents into there. (Don't have SuperDirt.startup in there as well) You'll see a line with ~dirt.loadSoundFiles;, which loads the default samples.
   - Keep that line, creating a new line underneath that looks like this: ```~dirt.loadSoundFiles("/home/alex/Documents/tidalclub/samples-extra/*");```
   - You'll need to change the above so that it contains the path to the samples-extra folder on your system.
   - Don't forget to have /* at the end of the path, and a semicolon ; at the end of the line.
   - Save the file (File -> Save)
   - Mine looks like this:
```
/*
This is an example startup file. You can load it from your startup file
(to be found in Platform.userAppSupportDir +/+ "startup.scd")
*/


(
s.reboot { // server options are only updated on reboot
	// configure the sound server: here you could add hardware specific options
	// see http://doc.sccode.org/Classes/ServerOptions.html
	s.options.numBuffers = 1024 * 256; // increase this if you need to load more samples
	s.options.memSize = 8192 * 32; // increase this if you get "alloc failed" messages
	s.options.numWireBufs = 256; // increase this if you get "exceeded number of interconnect buffers" messages
	s.options.maxNodes = 1024 * 32; // increase this if you are getting drop outs and the message "too many nodes"
	s.options.numOutputBusChannels = 2; // set this to your hardware output channel size, if necessary
	s.options.numInputBusChannels = 2; // set this to your hardware output channel size, if necessary
	// boot the server and start SuperDirt
	s.waitForBoot {
		~dirt.stop; // stop any old ones, avoid duplicate dirt (if it is nil, this won't do anything)
		~dirt = SuperDirt(2, s); // two output channels, increase if you want to pan across more channels
		load("/Users/andrewgrosser/Library/Application Support/SuperCollider/synthdefs/mi-ugens.scd");
		~dirt.loadSoundFiles;
		~dirt.loadSoundFiles("/Users/andrewgrosser/Documents/tidal/samples-extra/*");   // load samples (path containing a wildcard can be passed in)
		// for example: ~dirt.loadSoundFiles("/Users/myUserName/Dirt/samples/*");
		// s.sync; // optionally: wait for samples to be read
		~dirt.start(57120, 0 ! 12);   // start listening on port 57120, create two busses each sending audio to channel 0

		// optional, needed for convenient access from sclang:
		(
			~d1 = ~dirt.orbits[0]; ~d2 = ~dirt.orbits[1]; ~d3 = ~dirt.orbits[2];
			~d4 = ~dirt.orbits[3]; ~d5 = ~dirt.orbits[4]; ~d6 = ~dirt.orbits[5];
			~d7 = ~dirt.orbits[6]; ~d8 = ~dirt.orbits[7]; ~d9 = ~dirt.orbits[8];
			~d10 = ~dirt.orbits[9]; ~d11 = ~dirt.orbits[10]; ~d12 = ~dirt.orbits[11];
		);
		~dirt.orbits.do { |x|
            var clouds = GlobalDirtEffect(\global_mi_clouds, [\cloudspitch, \cloudspos, \cloudssize, \cloudsdens, \cloudstex, \cloudswet, \cloudsgain, \cloudsspread, \cloudsrvb, \cloudsfb, \cloudsfreeze, \cloudsmode, \cloudslofi]);
            var verb = GlobalDirtEffect(\global_mi_verb, [\verbwet, \verbtime, \verbdamp, \verbhp, \verbfreeze, \verbdiff, \verbgain]);
            x.globalEffects = x.globalEffects
              .addFirst(clouds)
              .addFirst(verb); 
            x.initNodeTree;    
        };    
	};

	s.latency = 0.3; // increase this if you get "late" messages
};
);


```
5. Add more synths from https://tidalcycles.org/docs/reference/mi-ugens-installation 
6. Then run/restart supercollider & run super dirt:

```
SuperDirt.start;
```

### Debug Supercollider

This didn't really help but leaving here for posterity.

```supercollider
ServerBoot.removeAll;
s = Server.default;
s.quit;
SystemClock.clear;
s = Server.local;
s.options.memSize = 524288;
s.options.maxLogins = 16;
s.options.numWireBufs = 256;
s.options.numOutputBusChannels = 2;
// s.options.numInputBusChannels = 0;
s.boot;

//{SinOsc.ar(440) * 0.1}.play

// wait then
SuperDirt.start;

Server.default.status
```

#### Setup Additional Synth MI-UGENS


##### Automatic Installation (Debian/Ubuntu/Mint)

For Debian, Ubuntu, and Mint systems, mi-UGens can be installed using the Ansible Tidal installer.

##### Manual Installation

### Step 1: Install the UGens

1. Download the latest release of mi-UGens for your operating system
2. Extract the archive and move the top-level `mi-UGens/` directory to your SuperCollider Extensions folder:

   - **Linux**: `~/.local/share/SuperCollider/Extensions/mi-UGens`
   - **Windows**: `C:\Users\<youruser>\AppData\Local\SuperCollider\Extensions\mi-UGens`
   - **macOS**: `~/Library/Application Support/SuperCollider/Extensions/mi-UGens`

> **Tip**: Find your SuperCollider Extensions folder by running `Platform.userExtensionDir` in SuperCollider. The path will be printed to the post window.

### Step 2: Create Synthdef File

Create a new file named `mi-ugens.scd` in your SuperCollider synthdefs folder:

- **Linux**: `~/.local/share/SuperCollider/synthdefs/mi-ugens.scd`
- **Windows**: `C:\Users\<youruser>\AppData\Local\SuperCollider\synthdefs\mi-ugens.scd`
- **macOS**: `~/Library/Application Support/SuperCollider/synthdefs/mi-ugens.scd`

[Insert the synthdef contents here]

### Step 3: Create Parameter Definitions File

Create a new file named `mi-ugens-params.hs` in your SuperCollider synthdefs folder:

- **Linux**: `~/.local/share/SuperCollider/synthdefs/mi-ugens-params.hs`
- **Windows**: `C:\Users\<youruser>\AppData\Local\SuperCollider\synthdefs/mi-ugens-params.hs`
- **macOS**: `~/Library/Application Support/SuperCollider/synthdefs/mi-ugens-params.hs`

[Insert the parameter definitions here]

### Step 4: Configure SuperCollider Startup

Edit your SuperCollider startup file:

- **Linux**: `~/.conf/SuperCollider/startup.scd`
- **Windows**: `C:\Users\<youruser>\AppData\Local\SuperCollider\startup.scd`
- **macOS**: `~/Library/Application Support/SuperCollider/startup.scd`

Add the following code after the `~dirt = SuperDirt(2, s);` line:

```supercollider
// load mi-ugens.scd synthdefs
load("FULL_PATH_TO_mi-ugens.scd");
// end load mi-ugens.scd synthdefs
```

> **Note for Windows Users**: Use double backslashes in the path, e.g., `load("C:\\Users\\<youruser>\\...");`

### Step 5: Configure Global Effects

Add the following code after the orbit definitions (around `~d10 = ~dirt.orbits[9]; ~d11 = ~dirt.orbits[10]; ~d12 = ~dirt.orbits[11];`):

```supercollider
// define global effects for mutable instruments effects
~dirt.orbits.do { |x|
    var clouds = GlobalDirtEffect(\global_mi_clouds, [\cloudspitch, \cloudspos, \cloudssize, \cloudsdens, \cloudstex, \cloudswet, \cloudsgain, \cloudsspread, \cloudsrvb, \cloudsfb, \cloudsfreeze, \cloudsmode, \cloudslofi]);
    var verb = GlobalDirtEffect(\global_mi_verb, [\verbwet, \verbtime, \verbdamp, \verbhp, \verbfreeze, \verbdiff, \verbgain]);
    x.globalEffects = x.globalEffects
      .addFirst(clouds)
      .addFirst(verb); 
    x.initNodeTree;    
};                     
// end define global effects for mutable instruments effects
```

### Step 6: Import Parameters (Optional)

You can import the mi-UGens parameter definitions in two ways:

**Option A**: Import manually in your Tidal session

**Option B**: Add to your BootTidal.hs file

Add the following `:script` directive after the `setR` and `setB` definitions:

```haskell
:script FULL_PATH_TO_mi-ugens-params.hs
```

This should be followed by:

```haskell
:set prompt "tidal>"
:set prompt-cont ""
```

### Step 7: Restart SuperCollider

Restart SuperCollider to apply all changes.

> **Note for macOS Users**: You may see a security dialog preventing the UGens from running. See [this post](https://discourse.tidalcycles.org/) for workarounds and fixes. Try this from the extensions subdirectory.

```
xattr -d com.apple.quarantine *
```

## Troubleshooting

- Ensure all file paths are correct for your operating system
- Double-check that SuperCollider can find the Extensions folder using `Platform.userExtensionDir`
- On macOS, you may need to adjust security settings to allow the UGens to run
- Make sure startup.scd is properly saved before restarting SuperCollider

---

## TidalCycles Reference Quick Guide


### Available Sample Banks

#### Default Sample Banks
- 808 (6)
- 808bd (25)
- 808cy (25)
- 808hc (5)
- 808ht (5)
- 808lc (5)
- 808lt (5)
- 808mc (5)
- 808mt (5)
- 808oh (5)
- 808sd (25)
- 909 (1)
- ab (12)
- ade (10)
- ades2 (9)
- ades3 (7)
- ades4 (6)
- alex (2)
- alphabet (26)
- amencutup (32)
- armora (7)
- arp (2)
- arpy (11)
- auto (11)
- baa (7)
- baa2 (7)
- bass (4)
- bass0 (3)
- bass1 (30)
- bass2 (5)
- bass3 (11)
- bassdm (24)
- bassfoo (3)
- battles (2)
- bd (24)
- bend (4)
- bev (2)
- bin (2)
- birds (10)
- birds3 (19)
- bleep (13)
- blip (2)
- blue (2)
- bottle (13)
- breaks125 (2)
- breaks152 (1)
- breaks157 (1)
- breaks165 (1)
- breath (1)
- bubble (8)
- can (14)
- casio (3)
- cb (1)
- cc (6)
- chin (4)
- circus (3)
- clak (2)
- click (4)
- clubkick (5)
- co (4)
- coins (1)
- control (2)
- cosmicg (15)
- cp (2)
- cr (6)
- crow (4)
- d (4)
- db (13)
- diphone (38)
- diphone2 (12)
- dist (16)
- dork2 (4)
- dorkbot (2)
- dr (42)
- dr2 (6)
- dr55 (4)
- dr_few (8)
- drum (6)
- drumtraks (13)
- e (8)
- east (9)
- electro1 (13)
- em2 (6)
- erk (1)
- f (1)
- feel (7)
- feelfx (8)
- fest (1)
- fire (1)
- flick (17)
- fm (17)
- foo (27)
- future (17)
- gab (10)
- gabba (4)
- gabbaloud (4)
- gabbalouder (4)
- glasstap (3)
- glitch (8)
- glitch2 (8)
- gretsch (24)
- gtr (3)
- h (7)
- hand (17)
- hardcore (12)
- hardkick (6)
- haw (6)
- hc (6)
- hh (13)
- hh27 (13)
- hit (6)
- hmm (1)
- ho (6)
- hoover (6)
- house (8)
- ht (16)
- if (5)
- ifdrums (3)
- incoming (8)
- industrial (32)
- insect (3)
- invaders (18)
- jazz (8)
- jungbass (20)
- jungle (13)
- juno (12)
- jvbass (13)
- kicklinn (1)
- koy (2)
- kurt (7)
- latibro (8)
- led (1)
- less (4)
- lighter (33)
- linnhats (6)
- lt (16)
- made (7)
- made2 (1)
- mash (2)
- mash2 (4)
- metal (10)
- miniyeah (4)
- monsterb (6)
- moog (7)
- mouth (15)
- mp3 (4)
- msg (9)
- mt (16)
- mute (28)
- newnotes (15)
- noise (1)
- noise2 (8)
- notes (15)
- num (21)
- numbers (9)
- oc (4)
- odx (15)
- off (1)
- outdoor (6)
- pad (3)
- padlong (1)
- pebbles (1)
- perc (6)
- peri (15)
- pluck (17)
- popkick (10)
- print (11)
- proc (2)
- procshort (8)
- psr (30)
- rave (8)
- rave2 (4)
- ravemono (2)
- realclaps (4)
- reverbkick (1)
- rm (2)
- rs (1)
- sax (22)
- sd (2)
- seawolf (3)
- sequential (8)
- sf (18)
- sheffield (1)
- short (5)
- sid (12)
- simplesine (6)
- sitar (8)
- sn (52)
- space (18)
- speakspell (12)
- speech (7)
- speechless (10)
- speedupdown (9)
- stab (23)
- stomp (10)
- subroc3d (11)
- sugar (2)
- sundance (6)
- tabla (26)
- tabla2 (46)
- tablex (3)
- tacscan (22)
- tech (13)
- techno (7)
- tink (5)
- tok (4)
- toys (13)
- trump (11)
- ul (10)
- ulgab (5)
- uxay (3)
- v (6)
- voodoo (5)
- wind (10)
- wobble (1)
- world (3)
- xmas (1)
- yeah (31)

#### Additional Sample Banks (from samples-extra) (https://slab.org/tmp/samples-extra.zip)
- break (33)
- bsbass (9)
- bsguitar (19)
- bshihat (3)
- bskick (9)
- bsnoise (22)
- bsperc (7)
- bssnare (8)
- bsvocals (13)
- clap (8)
- claus (16)
- cpu (23)
- cpu2 (29)
- dbass (12)
- dsynth (3)
- foley (287)
- hi (8)
- kick (21)
- lo (8)
- rash (72)
- snare (90)

### Basic Commands

#### Cycles
**Cycles**: Introduces cyclical time measurement using cycles per second (CPS) rather than BPM.
Example: `d1 $ s "bd hh bd hh"`

**Dividing the Cycle**: Patterns automatically divide cycles into equal parts based on element count.
Example: `d1 $ s "bd hh hh"`

**Visualizing Cycles**: Display pattern output using text or graphics with built-in visualization tools.
Example: `drawLine "a b*2 d"`

**Convert Between BPM and CPS**: Formula for converting beats-per-minute to cycles-per-second.
Example: `setcps (130/60/4)`

**Pop-up Window**: SuperCollider GUI script for displaying real-time clock state during performance.
Example: `p "tick" $ "0*4" # s "tick"`

#### Patterns
**Patterns**: Create music using named pattern connections to SuperDirt synthesizer.
Example: `d1 $ s "bd ~ bd ~"`

**Classic Pattern Names**: Standard `d1` to `d16` naming convention, each connected to its own effects track.
Example: `d1 ...`

**Patterns by Number**: Use `p` followed by any number as alternative pattern declaration.
Example: `p 1234 $ s "bd bd"`

**Patterns by Name**: Assign custom string identifiers to patterns instead of numeric designations.
Example: `p "romeo" $ s "bd bd"`

**Doing Things Once**: The `once` function plays sounds that execute a single time rather than repeating.
Example: `once $ s "trump"`

**Stop a Single Pattern**: The `silence` function terminates one specific pattern at cycle boundary.
Example: `p "loudpattern" $ silence`

**Stop Everything**: The `hush` command stops all currently running patterns.
Example: `hush`

**Panic**: Emergency command that halts patterns and kills all active synthesizers/samples.
Example: `panic`

#### Pattern Structure
**Pattern Structure**: Two patterns combine by default, taking structure from both and creating new events at intersections.
Example: `"2 3" + "4 5 6"`

**Structure from the Left**: Use `|+` operator to inherit structural divisions exclusively from the first pattern.
Example: `"2 3" |+ "4 5 6"`

**Structure from the Right**: The `+|` operator takes structural divisions only from the second pattern.
Example: `"2 3" +| "4 5 6"`

**All the Operators**: Comprehensive table of arithmetic operators for combining numerical patterns.
Example: `|+|`, `|-|`, `|*|`, `|/|`

**Combining Control Patterns**: Named control patterns combine similarly to numerical patterns, with values merging when identical controls appear.
Example: `d1 $ sound "drum" |+| n "2 3" |+| n "4 5 6"`

#### Mini Notation
**Rests**: Create silent moments using the tilde symbol.
Example: `d1 $ s "~ hh"`

**Pattern Grouping**: Divide cycles into subdivisions using square brackets for nested rhythmic layers.
Example: `p "demo" $ s "[bd [hh [cp sn:2] hh]] bd bd bd"`

**Pattern Grouping Shorthand**: Use dot notation to separate multiple pattern groupings at top level.
Example: `p "demo" $ s "bd*3 . hh*4 cp"`

**Superposition**: Play multiple patterns simultaneously with different rhythmic subdivisions.
Example: `d1 $ s "[bd*2,hh*3,[~ cp]*2, bass]"`

**Step Repetition**: Use multiplication to repeat individual steps multiple times within a pattern.
Example: `d2 $ s "cp cp cp*2"`

**Step Division**: Slow down pattern elements using the forward slash operator.
Example: `d1 $ s "bd cp/2"`

**Alternate**: Cycle through different events using angle brackets to create variations and melodies.
Example: `d1 $ fast 2 $ n "<c e g>" # s "superpiano"`

**Replicate**: Create new steps by duplicating events a specified number of times.
Example: `d2 $ s "bd!2 cp!2"`

**Elongate**: Extend event duration across multiple steps using underscores.
Example: `d2 $ s "bd _ _ hh*4"`

**Randomization**: Randomly remove pattern events with customizable probability using question marks.
Example: `d1 $ s "bd hh? bd hh?0.8"`

**Random Choice**: Select randomly between multiple events with equal probability using pipe symbols.
Example: `d1 $ s "[bd*4|hh*12|cp*2]"`

**Sample Selection**: Select specific audio files from folders using colon notation with numeric indices.
Example: `p "scroll" $ s "arpy:1 arpy:2 arpy:3 arpy:4 arpy:5"`

**Euclidian Sequences**: Create mathematically-distributed rhythms using greatest common divisor algorithm.
Example: `d1 $ s "[bd(3,8), cp(2,8), hh(7,8), bass:1(7,16)]"`

**Euclidian Sequence Offset**: Shift euclidian patterns left by specified number of steps using third parameter.
Example: `(3,8,2)`

**Euclidian Variation: Distrib**: Provide rhythmic variation by selecting or distributing specific beats from euclidian patterns.
Example: `d1 $ distrib [5, 9,16] $ sound "east:2"`

**Polymetric Sequences**: Create patterns with different time signatures playing simultaneously using curly brackets.
Example: `d1 $ s "{bd sd stab, cp arpy cr arpy}"`

**Ratio Shorthand**: Use percentage symbol to express numerical ratios and floating-point values in patterns.
Example: `d2 $ s "[bd*4%2]"`

**Polymetric Sequences with Subdivision**: Specify precise subdivisions for polymetric patterns using percentage notation.
Example: `d1 $ s "{bd hh 808:4}%8"`

#### Oscillators
**What is an Oscillator?**: Continuous patterns without structure that must be paired with structured patterns.
Example: `d1 $ sound "bd*8" |> pan sine`

**Sine**: Sinusoidal waves that create smooth transitions for effect parameters like panning.
Example: `d1 $ sound "bd*8" # pan sine`

**Cosine**: Time-shifted sine wave producing similar auditory results.
Example: `d1 $ sound "bd*8" # pan cosine # speed (sine + 0.5)`

**Square**: Waveform that jumps from 0 to 1 halfway through each cycle.
Example: `d1 $ sound "bd*8" # pan (cat [square, sine])`

**Tri**: Triangle wave that linearly rises to 1 then falls back to 0 within each cycle.
Example: `d1 $ sound "bd*16" # speed (slow 2 $ range 0.5 2 tri)`

**Saw**: Sawtooth wave that linearly climbs to 1 then resets across each cycle.
Example: `d1 $ sound "bd*8" # pan (slow 2 saw)`

**Isaw**: Inverted sawtooth beginning at 1 and descending to 0 before resetting.
Example: `d1 $ sound "bd*8" # pan (slow 2 isaw)`

**Smooth**: Smooth linear interpolation between numerical values within a pattern.
Example: `d1 $ sound "bd*4" # pan (slow 4 $ smooth "0 1 0.5 1")`

**Rand**: Endless stream of pseudo-random values for unpredictable parameter variation.
Example: `d1 $ sound "bd*8" # pan rand`

**Irand**: Pseudo-random integers bounded by a specified maximum value.
Example: `d1 $ sound "drum*8" # n (irand 8)`

**Scaling Oscillators**: Use `range` function to rescale oscillator outputs to desired intervals.
Example: `d1 $ s "bass:5*8" # lpf (range 200 5000 $ sine)`

**Speeding Up/Down Oscillators**: Oscillators can be tempo-synchronized using standard speed functions like `fast` and `slow`.
Example: `d1 $ s "bass:5*8" # lpf (slow 4 $ range 200 5000 $ sine)`

#### Synthesizers
**supergong**: Constructs gong-like tones by summing sine-wave harmonics with adjustable envelope.
Example: `d1 $ n (slow 2 $ fmap (*7) $ run 8) # s "supergong" # decay "[1 0.2]/4"`

**supersquare**: Moog-inspired square-wave synthesizer featuring variable-width pulses and LFO-modulated filtering.
Example: `d1 $ s "supersquare" # voice 0.5 # resonance 0.2`

**supersaw**: Moog-inspired sawtooth with detuned oscillators, triangle harmonics, and LFO-controlled filtering.

**superpwm**: Pulse-width modulation synth utilizing phase-shifted pulses with dual filtering and envelope control.

**superchip**: Atari ST emulation unit featuring three oscillators for vintage computer-style sounds.

**superhoover**: Hoover synth adapted from Wouter Snoei's SuperCollider implementation.

**superzow**: Phase-modulated sawtooth waves with envelope shaping and pitch-bend capabilities.

**supertron**: Feedback PWM synth with voice and detune parameters.
Example: `d1 $ s "supertron" # octave 3 # accelerate "0.2"`

**superreese**: Reese-style synthesizer with voice and detune adjustments.

**supernoise**: Digital noise generator featuring multiple flavors and bandpass filtering.

**superstatic**: Impulse noise synthesizer with fade-in and fade-out control.

**supercomparator**: Comparator-based oscillator with filter modulation by LFO.

**supermandolin**: Vibrating string simulation using delay lines excited by initial pulses, with dual detuned lines.

**superpiano**: Piano synthesizer integrated from SuperCollider featuring velocity and muffle control.

**superfork**: Tuning fork simulation based on acoustic research.

**superhammond**: Hammond B3 organ emulation with drawbar presets and percussion simulation.

**supervibe**: Vibraphone emulation with tremolo modulation and harmonic adjustment.

**superfm**: Six-operator FM synthesizer (DX7-like) offering flexible operator modulation routing.
Example: `d1 $ s "superfm" # n 0 # octave "<4 5 6>" # amp1 1 # amp3 1`

**superhex**: Hexagonal waveguide mesh producing drum-like membrane tones.

**superkick**: Kick drum based on Rumble-San's implementation with click filtering.

**super808**: 808-style kick drum featuring chirp frequency and filter sweep control.

**superhat**: Hi-hat drum synthesizer adapted from Rumble-San's design.

**supersnare**: Snare drum combining tonal and noise components with adjustable decay.

**superclap**: Hand clap emulation featuring echo delay and bandpass tuning.

**soskick**: Electronic kick drum with modulation frequency and noise sweep parameters.

**soshats**: Hi-hat variant with resonance and oscillator modulation controls.

**sostoms**: Tom drum synthesizer with modulation phase control.

**sossnare**: Snare variant featuring resonance filtering and semitone modulation.

**in**: Direct live audio input processing.

**inr**: Pitch-shifted live audio input with glide capability.

**imp**: Band-limited impulse oscillator with pitch-glide modulation.

**psin**: Phase-modulated sine waves supporting pitch gliding.

**gabor**: Gabor grain synthesis for granular processing.

**cyclo**: Shepard tone cycle generator creating illusion of continuous pitch rise.

**supersiren**: Controllable siren synthesizer with adjustable duration via sustain parameter.

**supergrind**: Harmonic-variable synthesizer with impulse-trigger rate modulation.

#### Audio Effects
**Octer**: Generates octave harmonics and sub-harmonics using frequency multiplication techniques.
Example: `octer, octersub, octersubsub`

**Frequency Shifter**: Implements single sideband amplitude modulation to shift frequencies.
Example: `fshift, fshiftnote, fshiftphase`

**Ring Modulation**: Applies amplitude modulation at a specified frequency to create metallic tones.
Example: `ring, ringf, ringdf`

**Tremolo**: Modulates amplitude at a set rate and depth for volume wobbling effects.
Example: `tremolodepth, tremolorate`

**Delay**: Creates echo effects with adjustable timing, feedback, and cycle-relative locking.
Example: `delay, delaytime, delayfeedback, lock`

**Reverb**: Simulates acoustic spaces using room size and depth parameters.
Example: `dry, room, size`

**Leslie**: Emulates rotating speaker cabinet effects with adjustable rotation speed.
Example: `leslie, lrate, lsize`

**Phaser**: Creates swooshing effects through phase shifting at adjustable rates and depths.
Example: `phaserrate, phaserdepth`

**Spectral Delay**: Applies frequency-dependent delays to individual spectral components.
Example: `xsdelay, tsdelay`

**Magnitude Freeze**: Preserves current spectral magnitudes while advancing phase information.
Example: `freeze`

**ASR Envelope**: Controls sound onset, sustain, and release timing in seconds.
Example: `attack, hold, release`

**Legato**: Adjusts overlap duration between successive synthesizer notes for smoother transitions.
Example: `legato (values 0.5-1.5)`

**DJ Filter**: Sweeps between low-pass and high-pass filtering across a single parameter range.
Example: `djf (0 to 1)`

**Lowpass Filter**: Removes high frequencies above a specified cutoff point with adjustable resonance.
Example: `cutoff, resonance`

**Highpass Filter**: Removes low frequencies below a specified cutoff with resonance control.
Example: `hcutoff, hresonance`

**Bandpass Filter**: Isolates frequencies around a center point with resonance adjustment.
Example: `bandf, bandq`

**Vowel**: Applies formant filtering to simulate vowel sounds using character patterns.
Example: `d1 $ s "gtr*5" #vowel "a e i o u"`

**Spectral Comb Filter**: Creates comb filtering effects with unified teeth and width control.
Example: `comb`

**Spectral High Pass Filter**: Removes low frequencies from spectral data across full range.
Example: `hbrick (0.0 to 1.0)`

**Spectral Low Pass Filter**: Removes high frequencies from spectral data across full range.
Example: `lbrick (0.0 to 1.0)`

**Distort**: Applies crunchy distortion with prominent high-frequency harmonics.
Example: `distort`

**Triode**: Introduces tube-like distortion characteristic using a single parameter.
Example: `triode`

**Shape**: Amplifies signal with nonlinear waveshaping between zero and one.
Example: `shape (0 to 1)`

**Squiz**: Pitch-raising algorithm cutting and stretching signal fragments unpredictably.
Example: `squiz (try multiples of 2)`

**Bin Shifting**: Stretches and repositions frequency bins as a crude frequency scaling tool.
Example: `binshift`

**Bin Scrambling**: Randomizes spectral bin positions within a controlled range.
Example: `scram`

**Crush**: Reduces bit-depth from full resolution down to extremely degraded audio quality.
Example: `crush (1 to 16)`

**Coarse**: Simulates audio resampling by dividing playback rate into integer fractions.
Example: `coarse (1, 2, 3, etc.)`

**Waveloss**: Drops audio segments at zero-crossings to create destructive artifacts.
Example: `waveloss, mode`

**Krush**: Combines bit-crushing with low-pass filtering in integrated effect.
Example: `krush, kcutoff`

**Magnitude Smearing**: Spreads spectral magnitudes across frequency domain with adjustable intensity.
Example: `smear`

**Spectral Conformer**: Applies complex plane transformation to phase vocoder bins for artifacts.
Example: `real, imag`

**Spectral Enhance**: Boosts spectral components for clarified frequency content.
Example: `enhance`

#### Controls
**Controls**: Control functions transform string and number patterns into control patterns that govern sound behavior.
Example: `d1 $ s "bd hh bd hh*2" # lpf "500 1000 1500" # lpq 0.5`

**Control synthesizers**: Activate SuperDirt synthesizers using the `sound` control pattern to switch between different instruments.
Example: `d1 $ note "c d e f g a" # sound "<superpiano supersquare supersaw>"`

**Control effects**: Apply audio effects like filtering to drum patterns using control functions.
Example: `d1 $ s "bd hh bd hh*2" # lpf "500 1000 1500" # lpq 0.5`

**Combine everything**: Layer synthesizer selection, melodic content, and effects together into one expressive pattern.
Example: `d1 $ note "c d e f g a" # sound "<superpiano supersquare supersaw>" # lpf "500 1000 1500" # lpq 0.5`

#### Tempo
**Tempo**: Tempo and cycles are interconnected in Tidal, using cycles per second as the time representation.

**setcps**: Sets the tempo by specifying the number of cycles per second.
Example: `setcps 1`

**cps**: Control pattern that allows dynamic tempo manipulation across all patterns simultaneously.
Example: `p "cpfun" $ s "bd sd(3,8)" # cps (slow 8 $ 0.5 + saw)`

#### Transitions
**What are transitions?**: Transition functions for musically switching between patterns using identifiers.
Example: `xfade 1 $ s "arpy*8" # n (run 8)`

**Anticipate**: Queue patterns to trigger after 8 cycles, or specify custom cycle counts before playback begins.
Example: `anticipate 1 $ sound "bd sn" # delay "0.5" # room "0.3"`

**Clutch**: Gradually removes events from current pattern while restoring events from next one over two cycles.
Example: `clutch 1 $ sound "[hh*4, odx(3,8)]"`

**histpan**: Pans the four most recent patterns on a channel from left to right, newest on the left.
Example: `histpan 1 4 $ sound "bd sn"`

**Interpolate**: Morphs control values between patterns over four cycles (or custom duration).
Example: `interpolate 1 $ sound "arpy*16" # cutoff 16000`

**Jump**: Instantly switches to a new pattern with optional cycle-boundary or modulo-based timing.
Example: `jumpIn 1 2 $ sound "hh*8"`

**Wait**: Pauses a running pattern for specified cycles before launching a replacement.
Example: `wait 2 4 $ s "feel:4*4 cp*3"`

**Fade**: Crossfades patterns using gain, with options to fade in/out over custom timeframes.
Example: `xfadeIn 1 8 $ s "arpy*8" # n (run 8)`

#### State Values
**The problem with state**: Difficulty in aligning events and sequencing parameter values independently from cycle structure.
Example: `d1 $ slow 2 $ sound "alphabet(5,8)" # n "0 .. 4"`

**Introduction to State Values**: State values apply sequences from circular lists without binding them to cycles.
Example: `d1 $ sound "alphabet(5,8)" # nTake "susan" [0 .. 4]`

**Un-intuitive behavior**: Counters run independently from patterns, and operations like `rev` don't affect the counter's direction.
Example: `d1 $ rev $ sound "newnotes(5,8)" # nCount "harold"`

**Syntax**: Proper syntax for state values using `# nTake "name" [list]` notation without quotes in brackets.
Example: `d3 $ n "0 2 3" #s "bass" #speedTake "sVal" [1, 2, 5, 4, 3, 4]`

**State Values with other controls**: Apply state values to various controls like speed, acceleration, frequency, and amplitude.
Example: `d3 $ n "0 2 3" #s "bass" # freqTake "sVal4" [200, 400, 700, 300, 220]`

### Reference

#### Even more
**Hackage**: Central Haskell package repository with exhaustive auto-generated documentation for Tidal modules.

**Old school Perl script**: Use GHCI `:browse` command combined with Perl script to generate human-readable list of all available functions.
Example: `perl -pe 's!(.*?)\s*::\s*(.*)!|-\n|[[$1]]\n|<code>$2</code>!'`

#### Concatenation
**cat**: Concatenates a list of patterns into a new pattern; each pattern maintains its original duration.
Example: `d1 $ cat [sound "bd*2 sn", sound "arpy jvbass*2"]`

**fastcat**: Combines patterns by squashing them to fit within a single cycle.
Example: `d1 $ fastcat [sound "bd*2 sn", sound "arpy jvbass*2"]`

**timeCat**: Merges patterns with proportional sizing based on specified time ratios.
Example: `d1 $ timeCat [(1, s "bd*4"), (1, s "hh27*8")]`

**randcat**: Selects patterns randomly rather than playing them sequentially.
Example: `d1 $ randcat [sound "bd*2 sn", sound "jvbass*3"]`

**wrandcat**: Random pattern selection with weighted probability values.
Example: `d1 $ sound (wrandcat [("bd*2 sn", 5), ("jvbass*3", 2)])`

**append**: Combines two patterns into a new pattern, where cycles alternate between first and second pattern.
Example: `d1 $ append (sound "bd*2 sn") (sound "arpy jvbass*2")`

**fastAppend**: Merges pattern pairs into single cycles rather than alternating whole cycles.
Example: `d1 $ fastAppend (sound "bd*2 sn") (sound "arpy jvbass*2")`

**wedge**: Splits a cycle between two patterns using a specified ratio.
Example: `d1 $ wedge (1/4) (sound "bd*2 arpy*3") (sound "odx hh")`

**brak**: Creates a breakbeat effect by alternately squashing patterns and offsetting them.
Example: `d1 $ brak $ sound "[feel feel:3, hc:3 hc:2]"`

**listToPat**: Transforms a list into a pattern where all items occur simultaneously within each cycle.
Example: `d1 $ n (listToPat [0, 1, 2]) # s "superpiano"`

**fromList**: Converts a list into a pattern where each item lasts one full cycle.
Example: `d1 $ n (fromList [0, 1, 2]) # s "superpiano"`

**fromMaybes**: Builds patterns from lists of optional values, creating gaps for Nothing entries.
Example: `d1 $ n (fromMaybes [Just 0, Nothing, Just 2]) # s "superpiano"`

**flatpat**: Flattens nested list patterns so all events within lists play simultaneously.
Example: `d1 $ n (flatpat $ listToPat [[0,4,7],[(-12),(-8),(-5)]]) # s "superpiano"`

**run**: Generates a sequence of numbers from zero to n-1 for cycling through samples.
Example: `d1 $ n (run 8) # sound "amencutup"`

**scan**: Creates an incrementing pattern starting at 1, adding numbers each cycle until reaching n.
Example: `d1 $ n (scan 8) # sound "amencutup"`

#### Accumulation
**Superposition**: Functions for layering and combining multiple patterns simultaneously to create overlapping sounds.
Example: `d1 $ sound (overlay "bd sn:2" "cp*3")`

**overlay**: Merges two patterns together, functioning as an alternative to `cat` for combining pattern pairs.
Example: `d1 $ sound ("bd sn:2" <> "cp*3")`

**<>**: Operator form of `overlay` that combines two patterns using infix notation.
Example: `d1 $ sound ("bd sn:2" <> "cp*3")`

**stack**: Layers multiple patterns from a list into one unified pattern played simultaneously.
Example: `d1 $ stack [sound "bd bd*2", sound "hh*2 [sn cp] cp future*4"]`

**superimpose**: Plays a transformed version of a pattern alongside the original version at the same time.
Example: `d1 $ superimpose (fast 2) $ sound "bd sn [cp ht] hh"`

**layer**: Applies multiple functions to a single pattern, layering the results together.
Example: `d1 $ layer [id, rev, fast 2] $ sound "arpy [~ arpy:4]"`

**steps**: Plays multiple string pairs simultaneously, similar to combining several `step` functions.
Example: `d1 $ s (steps [("cp","x  x x  x x  x"),("bd", "xxxx")])`

**iter**: Divides a pattern into subdivisions and rotates the starting point forward each cycle.
Example: `d1 $ iter 4 $ sound "bd hh sn cp"`

**iter'**: Reverse version of `iter` that rotates subdivisions backward through cycles.
Example: `d1 $ iter' 4 $ sound "bd hh sn cp"`

#### Alteration
**Scaling**: Functions that transform numeric patterns to different ranges or quantize values.
Example: `d1 $ jux (iter 4) $ sound "arpy arpy:2*2" |+ speed (slow 4 $ range 1 1.5 sine)`

**Degrade**: Randomly removing events from patterns at specified percentages.
Example: `d1 $ slow 2 $ degradeBy 0.9 $ sound "[[[feel:5*8,feel*3] feel:3*8], feel*4]"`

**Repetitions**: Methods to repeat pattern events with various timing and transformation options.
Example: `d1 $ ply 3 $ s "bd ~ sn cp"`

**Truncation**: Techniques for playing only portions of patterns or repeating truncated sections.
Example: `d1 $ trunc 0.75 $ sound "bd sn*2 cp hh*4 arpy bd*2 cp bd*2"`

**Shuffling and Scrambling**: Functions that reorder or randomize pattern segments.
Example: `d1 $ sound $ shuffle 3 "bd sn hh"`

**Step Sequencers**: String-based step sequencing and generative L-system methods.
Example: `d1 $ s (step "sn" "x x 12 ")`

**Higher-order**: Functions that apply multiple transformations across pattern cycles.
Example: `d1 $ spread fast[2,3] $ sound "ho ho:2 ho:3 hc"`

#### Performance
**Tempo**: Functions for managing tempo and cycle timing during performances.
Example: `setcps (130/60/4)`

**resetCycles / setCycle**: Resets cycle count to 0 or sets it to a specific number for pattern synchronization.
Example: `resetCycles`

**trigger**: Aligns pattern start with evaluation time rather than global start time.
Example: `d2 $ trigger $ s "clap*2"`

**qtrigger**: Quantizes pattern start to the next cycle boundary.
Example: `d1 $ qtrigger $ s "hh(5, 8)" # amp envL`

**mtrigger**: Aligns pattern start to cycle boundaries divisible by a specified number.
Example: `d1 $ mtrigger 4 $ filterWhen (>=0) $ s "arpy"`

#### Conditions
**every**: Applies a function at regular intervals.
Example: `d1 $ every 3 rev $ n "0 1 [~ 2] 3" # sound "arpy"`

**foldEvery**: Chains multiple conditions together, applying functions when cycles match given periods.
Example: `d1 $ foldEvery [5,3] (|+ n 1) $ s "moog" # legato 1`

**when**: Applies transformation only when a test function returns true for the current cycle.
Example: `d1 $ when ((elem '4').show) (striate 4) $ sound "hh hc"`

**whenmod**: Applies functions based on modulo operations on loop numbers.
Example: `d1 $ whenmod 8 4 (fast 2) (sound "bd sn kurt")`

**ifp**: Conditionally applies one of two functions based on a test.
Example: `d1 $ ifp ((== 0).(flip mod 2)) (striate 4) (# coarse "24 48") $ sound "hh hc"`

**fix**: Applies transformations to events matching specific control patterns.
Example: `d1 $ fix (# crush 3) (n "[1,4]") $ n "0 1 2 3 4 5 6" # sound "arpy"`

**contrast**: Implements if-else logic for patterns, choosing transformations based on control equality.
Example: `d1 $ contrast (|+ n 12) (|- n 12) (n "c") $ n (run 4) # s "superpiano"`

**choose**: Randomly selects values from a list as a continuous pattern.
Example: `d1 $ sound "drum ~ drum drum" # n (choose [0,2,3])`

**wchoose**: Like `choose` but weighted to favor certain selections.
Example: `d1 $ sound "drum ~ drum drum" # n (wchoose [(0,0.25),(2,0.5),(3,0.25)])`

**struct**: Applies a binary rhythm structure to a pattern.
Example: `d1 $ struct ("t ~ t*2 ~") $ sound "cp"`

**mask**: Filters events using a boolean pattern, keeping only those aligned with true values.
Example: `d1 $ mask "t t t ~ t t ~ t" $ s (cat ["sn*8", "[cp*4 bd*4, bass*5]"])`

**sew**: Switches between two patterns based on boolean values.
Example: `d1 $ sound (sew "t f" "bd*8" "cp*8")`

**euclid**: Creates Euclidean rhythmic structures with customizable parameters.
Example: `d1 $ euclid 3 8 $ sound "cp"`

**euclidInv**: Inverts the pattern from `euclid` to play the inverse rhythm.
Example: `d1 $ stack [euclid 5 8 $ s "bd", euclidInv 5 8 $ s "hh27"]`

#### Time
**fast**: Accelerates a pattern's repetition rate.
Example: `d1 $ sound (fast 2 "bd sn kurt")`

**fastGap**: Speeds up while compressing into available space rather than repeating.
Example: `d1 $ sound (fastGap 2 "bd sn")`

**slow**: Decelerates pattern repetition.
Example: `d1 $ sound (slow 2 "bd sn kurt")`

**hurry**: Accelerates pattern and increases pitch proportionally.
Example: `d1 $ every 2 (hurry 2) $ sound "bd sn:2"`

**compress**: Squeezes pattern into specified timespan while maintaining speed.
Example: `d1 $ compress (1/4, 3/4) $ s "[bd sn]!"`

**zoom**: Extracts and plays a portion of a pattern over full cycle.
Example: `d1 $ zoom (0.25, 0.75) $ sound "bd*2 hh*3"`

**within**: Applies functions selectively to pattern sections.
Example: `d1 $ within (0, 0.5) (fast 2) $ sound "bd*2 sn"`

**off**: Layers offset copies with transformations applied.
Example: `d1 $ off 0.125 (# crush 2) $ sound "bd"`

**rotL**: Shifts pattern backward through time in cycles.
Example: `d1 $ rotL 4 $ seqP [(0, 12, sound "bd bd*2")]`

**rotR**: Shifts pattern forward temporally (opposite of rotL).

**spin**: Distributes multiple offset copies across stereo channels.
Example: `d1 $ spin 4 $ sound "drum*3 tabla:4"`

**rev**: Reverses pattern direction on per-cycle basis.
Example: `d1 $ every 3 rev $ n "0 1 [~ 2]"`

**jux**: Applies transformation only to right stereo channel.
Example: `d1 $ jux (rev) $ striate' 32 (1/16)`

**juxBy**: Like jux with adjustable channel positioning.
Example: `d1 $ juxBy 0.5 (fast 2) $ sound "bd sn:1"`

**swingBy**: Delays alternate notes within subdivisions for shuffle effect.
Example: `d1 $ swingBy (1/3) 4 $ sound "hh*8"`

**ghost**: Adds quiet pitch-shifted echo simulating drumming technique.
Example: `d1 $ ghost $ sound "~ sn"`

**inside**: Applies operation within subdivided cycle portions.
Example: `inside 2 rev "0 1 2 3 4 5 6 7"`

**outside**: Applies operation across multiple cycles before compression.
Example: `d1 $ outside 4 (rev) $ cat [s "bd"]`

**echo**: Adds decaying delayed repetitions.
Example: `d1 $ echo 4 0.2 0.5 $ sound "bd sn"`

#### Harmony & Melody
**scale**: Interprets note patterns into specific named scales.
Example: `n (scale "ritusen" "0 .. 7") # sound "superpiano"`

**toScale**: Applies unnamed scales directly without naming them first.
Example: `n (toScale [0,2,3,5,7,8,10] "0 1 2 3 4 5 6 7")`

**arpeggiate**: Spreads chord notes sequentially over time.
Example: `n (arpg "'major7 [0,4,7,11]") # sound "superpiano"`

**arp**: Arpeggiation with directional modes (up, down, diverge, etc.).
Example: `n (arp "<up down diverge>" "<a'm9'8 e'7sus4'8>")`

**rolled**: Simulates downward guitar strumming across notes.
Example: `rolled $ n "<a'm9'8 e'7sus4'8>" # sound "superpiano"`

**Chord Inversions**: Raises lowest N notes up an octave.
Example: `n "c'min9'i2"`

**metatune**: Reads WAV file pitch metadata for accurate sample tuning.
Example: `note "<d4 c4 a3 bf3>" # s "bass1:18" # metatune 1`

#### Samplers
**amp**: Controls sound volume using a linear scaling method with a default value of 0.4.
Example: `d1 $ s "arpy" # amp "<0.4 0.8 0.2>"`

**gain**: Adjusts sound volume using exponential scaling with typical values between 0 and 1.5.
Example: `d1 $ s "ab*16" # gain (range 0.8 1.3 $ sine)`

**accelerate**: A pattern of numbers that speed up (or slow down) samples while they play.
Example: `d1 $ s "arpy" # accelerate 2`

**speed**: A pattern of numbers which changes the speed of sample playback.
Example: `d1 $ slow 5 $ s "sax:5" # legato 1 # speed 0.5`

**unit**: Specifies how speed values are interpreted: rate, cycles, or seconds.
Example: `d1 $ stack [s "sax:5" # legato 1 # speed 2 # unit "c",s "bd*2"]`

**timescale**: Primary function for activating time-stretching with a ratio parameter.
Example: `d1 $ slow 2 $ s "breaks152" # legato 1 # timescale (152/130)`

#### Sampling
**chop**: Divides samples into equal parts for granular synthesis effects.
Example: `d1 $ chop 16 $ sound "arpy ~ feel*2 newnotes"`

**striate**: Cuts samples into bits and plays them across multiple loop repetitions.
Example: `d1 $ slow 4 $ striate 3 $ sound "numbers:0 numbers:1 numbers:2 numbers:3"`

**slice**: Rearranges sample slices as a pattern rather than playing sequentially.
Example: `d1 $ slice 8 "7 6 5 4 3 2 1 0" $ sound "breaks165" # legato 1`

**loopAt**: Stretches or compresses samples to fit a specified number of cycles.
Example: `d1 $ loopAt 4 $ chop 32 $ sound "breaks125"`

**segment**: Samples continuous patterns at fixed rates to convert them into discrete events.
Example: `d1 $ n (slow 2 $ segment 16 $ range 0 32 $ sine) # sound "amencutup"`

#### Randomness
**rand**: Generates floating-point random values between 0.0 and 1.0.
Example: `d1 $ sound "bd*8" # pan rand`

**irand**: Produces random integers from 0 to n-1, useful for selecting samples.
Example: `d1 $ sound "amencutup*8" # n (irand 8)`

**perlin**: Produces 1D Perlin (smooth) noise that changes each cycle.
Example: `d1 $ sound "bd*32" # speed (perlin + 0.5)`

**sometimes**: Applies another function to a pattern, around 50% of the time, at random.
Example: `d1 $ sometimes (# crush 2) $ n "0 1 [~ 2] 3" # sound "arpy"`

**sometimesBy**: Allows precise probability specification (0-1 range).
Example: `sometimesBy 0.93 (# speed 2)`

**choose**: Emits a stream of randomly chosen values from the given list.
Example: `d1 $ sound "drum ~ drum drum" # n (choose [0,2,3])`

**wchoose**: Selects from weighted choices where some options occur more frequently.
Example: `d1 $ sound "drum ~ drum drum" # n (wchoose [(0,0.25),(2,0.5),(3,0.25)])`

**cycleChoose**: Only picks once per cycle from the provided list.
Example: `d1 $ sound "drum ~ drum drum" # n (cycleChoose [0,2,3])`

#### Composition
**ur**: Enables long-form composition by creating patterns of patterns that loop repeatedly with optional transformations.
Example: `ind1 $ ur 12 "a b c" pats []`

**seqP**: Sequences multiple patterns with specified start and end times in cycles.
Example: `d1 $ qtrigger $ seqP [(0, 12, sound "bd bd*2"), (4, 12, sound "hh*2 [sn cp] cp future*4")]`

**seqPLoop**: Similar to seqP but automatically loops the entire sequence when reaching the end.
Example: `d1 $ qtrigger $ seqPLoop [(0, 12, sound "bd bd*2"), (4, 12, sound "hh*2 [sn cp] cp future*4")]`

#### mi-UGens
**omi**: An almost vibraphone-like synth with electric bass lows and tinkling highs.
Example: `d1 $ s "omi" <| note "a [~ g] [c b] [g gs]" # octave "<3 4 5 6 7 8>"`

**braids**: A voltage-controlled monophonic synthesizer with 48 models controlled by timbre and color parameters.
Example: `d1 $ s "braids" <| note "a [~ g]" # model (slow 48 $ run 48) # timbre (slow 3 sine)`

**plaits**: A successor to braids offering 16 synthesis engines with timbre, harmonics, and morph controls.
Example: `d1 $ s "plaits" <| note "a [~ g]" # engine (slow 16 $ run 16) # timbre (slow 3 sine)`

**tides**: A tidal modulator based on Flow and Ebb concepts with shape, smoothness, slope, and shift parameters.
Example: `d1 $ s "tides" <| note "a [~ g]" # mode "<0 1 2 3>" # shift (slow 5 sine)`

**verb (global effect)**: A gentle reverb effect with tweakable parameters for gain, wet/dry mix, sustain time, damping, and high-pass filtering.
Example: `d1 $ s "[[bd sd], linnhats*8]" # verb 0.9 0.9 0.1 0.2`

**clouds (global effect)**: A granular audio processor creating textures by combining overlapping, delayed, transposed audio segments.
Example: `d1 $ s "[[bd sd], [linnhats*8]]" # clouds 0.1 0.5 0.05 0.1`

**elements**: A modal synthesis voice effect simulating bowing, blowing, or striking techniques.
Example: `d1 $ s "[[bd sd], linnhats*8]" # elementsstrength "0.9" # elementspitch (slow 3 sine)`

**mu**: A low-frequency distortion effect adjusting gain and applying distortion.
Example: `d1 $ s "bass1:1" # mu 5 # gain 0.7`

**rings**: A resonator effect simulating three families of vibrating structures with pitch, decay, brightness, and damping controls.
Example: `d1 $ s "[[bd sd], linnhats*8]" # rings 100 rand 0.7 (slow 3 sine) 0.9`

**ripples**: An analog four-pole filter with cutoff frequency, resonance, and drive parameters.
Example: `d1 $ s "[[bd sd], linnhats*8]" # ripplescf 0.4 # ripplesreson (range 0.5 1 $ slow 7 sine)`

**warps**: A wave-shaping and cross-modulation effect offering eight modulation algorithms.
Example: `d1 $ s "[[bd sd], linnhats*8]" # warpstimb (slow 5 sine) # warpsalgo "<0 1 2 3 4 5 6 7 6>"`

#### Control Busses
**Control Busses**: Allows routing effects via a bus to pattern them while sound plays.
Example: `d1 $ sound "sax" # legato 1 # squizbus 1 "1 2 5 1.5"`

**Why we need control busses**: Demonstrates problems with traditional approaches and explains why busses solve the issue of modifying effects without retriggering samples.
Example: `d1 $ sound "sax" # legato 1 # squiz "1 2 5 1.5"`

**Using control busses**: Shows practical implementation including bus identification, multiple busses, receiving patterns, and creating LFOs on effects.
Example: `d1 $ sound "sax" # legato 1 # squizbus 1 "1 2 5 1.5" # lpfbus 2 "400 2000 5000"`

**Control busses and MIDI**: Explains mapping MIDI CC numbers to control busses for real-time parameter control.
Example: `d1 $ n "<d6'm9 g6'dom7'ii>" # s "superhoover" # djfbus 1 (cF 0.5 "21")`