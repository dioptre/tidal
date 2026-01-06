# Impulse Response Attribution

## Source

https://archive.org/details/impulse-response-irs-wav-database

All impulse response files in this directory are from the **ViperFX RE** project.

- **Project**: ViperFX RE (Reverse Engineered)
- **Repository**: https://github.com/AndroidAudioMods/ViperFX_RE
- **License**: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)
- **License URL**: https://creativecommons.org/licenses/by-sa/4.0/

## Included Impulse Responses

The following 12 IRs from the ViperFX collection are included:

1. **hall.wav** - "0.3 Small Hall - MidRT 0.5.irs"
   - Small hall with medium reverb time (0.5s)

2. **church.wav** - "Creative Church .irs"
   - Church acoustic space

3. **room.wav** - "01 Beetle Interior.irs"
   - Tiny space simulation (car interior)

4. **plate.wav** - "0.2 Gold Plate - Size 1.irs"
   - Plate reverb emulation

5. **spring.wav** - "01 Phonebooth Tight.irs"
   - Tight, spring-like reverb character

6. **chamber.wav** - "06 Small Chamber.irs"
   - Small chamber acoustic

7. **cathedral.wav** - "Creative Haunted Cavern.irs"
   - Very large space with long reverb

8. **concert-hall.wav** - "DFX Concert Hall Ambience.irs"
   - Concert hall acoustics

9. **studio.wav** - "48000_Sony C-Studio A1.irs"
   - Professional studio environment

10. **ambient.wav** - "L960-Sewer Pipe.irs"
    - Experimental sewer pipe acoustics

11. **warehouse.wav** - "06 Warehouse.irs"
    - Industrial warehouse space

12. **space.wav** - "Deep Space.irs"
    - Sci-fi deep space reverb

## Usage in TidalCycles

These impulse responses are used for convolution reverb in TidalCycles/SuperDirt:

```haskell
-- Use by index (0-11)
d1 $ s "bd sn" # convolve 0.5 # convolveir 0  -- hall
d1 $ s "bd sn" # convolve 0.5 # convolveir 1  -- church
d1 $ s "bd sn" # convolve 0.5 # convolveir 2  -- room (beetle)
-- etc...
```

## License Terms (CC BY-SA 4.0)

You are free to:
- **Share** — copy and redistribute the material in any medium or format
- **Adapt** — remix, transform, and build upon the material for any purpose, even commercially

Under the following terms:
- **Attribution** — You must give appropriate credit, provide a link to the license, and indicate if changes were made
- **ShareAlike** — If you remix, transform, or build upon the material, you must distribute your contributions under the same license

## Credits

- **ViperFX Original Authors**: Various contributors to the ViperFX audio engine
- **ViperFX RE Project**: AndroidAudioMods team
- **Impulse Response Collection**: Compiled from various sources by the ViperFX community
- **TidalCycles Integration**: Adapted for use with SuperDirt convolution

## Notes

- Original files were in `.irs` format (WAV files with different extension)
- Files converted/renamed for SuperDirt compatibility
- All files are 44.1kHz stereo WAV format
- Original source directory: `/Users/andrewgrosser/Downloads/Android/data/com.pittvandewitt.viperfx/files/Kernel/`

## More Information

- ViperFX RE GitHub: https://github.com/AndroidAudioMods/ViperFX_RE
- Creative Commons License: https://creativecommons.org/licenses/by-sa/4.0/
- TidalCycles Documentation: https://tidalcycles.org/
