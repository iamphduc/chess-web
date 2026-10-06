# Sound credits

- **Pack:** Impact Sounds (1.0)
- **Author:** Kenney (www.kenney.nl)
- **Source:** https://kenney.nl/assets/impact-sounds
- **Licence:** Creative Commons Zero (CC0 1.0), http://creativecommons.org/publicdomain/zero/1.0/ . Credit is not required; it's given here anyway.

Each file is the pack's `.ogg` sound decoded and saved as a 16-bit mono 22,050 Hz `.wav`, peak-normalized, with a fade at the end (0.15 s, or the last third of a shorter sound).

`capture.wav` and `castle.wav` also pass through a 400 Hz high-pass filter (4th-order Butterworth) before normalizing. Laptop and phone speakers play little below about 250 Hz, and without the filter these two sounds were mostly bass and couldn't be heard on them. `tests/sound-audible.test.ts` checks every sound for this.

| File | Kind | Pack file | Extra processing |
|------|------|-----------|------------------|
| `move.wav` | move | `Audio/impactWood_light_002.ogg` | none |
| `capture.wav` | capture | `Audio/impactGeneric_light_002.ogg` | 400 Hz high-pass |
| `castle.wav` | castle | `Audio/impactPlank_medium_000.ogg` | 400 Hz high-pass |
| `check.wav` | check | `Audio/impactGlass_medium_004.ogg` | none (picked by ear over the metal clank) |
| `promote.wav` | promote | `Audio/impactGlass_light_000.ogg` | none |
| `game-end.wav` | game-end | `Audio/impactBell_heavy_000.ogg` | none |
