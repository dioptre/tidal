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


### Running

1. Check quarks
2. Ensure superdirt, vowel and dirt samples are installed
3. Recompile superdirt, restart supercollider

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