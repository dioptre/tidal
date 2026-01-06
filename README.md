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

Add this to .zshrc
```
export PATH="/Applications/SuperCollider.app/Contents/MacOS:$PATH"
export PATH="/Applications/SuperCollider.app/Contents/Resources:$PATH"
```


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
	s.options.numWireBufs = 64; // increase this if you get "exceeded number of interconnect buffers" messages
	s.options.maxNodes = 1024 * 32; // increase this if you are getting drop outs and the message "too many nodes"
	s.options.numOutputBusChannels = 2; // set this to your hardware output channel size, if necessary
	s.options.numInputBusChannels = 2; // set this to your hardware output channel size, if necessary
	// boot the server and start SuperDirt
	s.waitForBoot {
		~dirt.stop; // stop any old ones, avoid duplicate dirt (if it is nil, this won't do anything)
		~dirt = SuperDirt(2, s); // two output channels, increase if you want to pan across more channels
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
s.options.numWireBufs = 512;
s.options.numOutputBusChannels = 2;
// s.options.numInputBusChannels = 0;
s.boot;

//{SinOsc.ar(440) * 0.1}.play

// wait then
SuperDirt.start;

Server.default.status
```

### Available Sample Banks

#### Default Sample Banks (21 banks)
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

#### MI-UGENS

# mi-UGens Installation Guide

## Automatic Installation (Debian/Ubuntu/Mint)

For Debian, Ubuntu, and Mint systems, mi-UGens can be installed using the Ansible Tidal installer.

## Manual Installation

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

> **Note for macOS Users**: You may see a security dialog preventing the UGens from running. See [this post](https://discourse.tidalcycles.org/) for workarounds and fixes.

## Troubleshooting

- Ensure all file paths are correct for your operating system
- Double-check that SuperCollider can find the Extensions folder using `Platform.userExtensionDir`
- On macOS, you may need to adjust security settings to allow the UGens to run
- Make sure startup.scd is properly saved before restarting SuperCollider