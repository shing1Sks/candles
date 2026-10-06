# GameNet audio

Every sound here is synthesised from scratch by `src/make_audio.py` (numpy + scipy, fixed seeds,
no samples, no external recordings). Re-run it to rebuild; run `src/check_audio.py` to analyse.

```
python assets/audio/src/make_audio.py            # everything (~5 min; music is the slow part)
python assets/audio/src/make_audio.py --only music_calm sfx_caught
python assets/audio/src/check_audio.py           # peaks, DC, loop seams, edges
```

## Conventions

- Format: Ogg Vorbis q5, 44.1 kHz. Music + ambience stereo, SFX mono.
- Music: D dorian, 60 bpm, both beds exactly 96.000 s (4,233,600 samples). Start them at the same
  time and keep them running; crossfade with gains (equal-power) and they stay in sync and in key.
- Loops are built circularly (wrapped tails, whole-cycle modulators, circular reverb), so the loop
  point is continuous, not crossfaded. Loop files carry `LOOPSTART`/`LOOPLENGTH` tags.
  In Web Audio use `AudioBufferSourceNode.loop = true` (not `<audio loop>`, which can gap).
- Levels: music about -25 dBFS RMS, ambience -30 to -34 dBFS RMS, SFX normalised on their loudest
  100 ms (-20 loud events ... -27 small ones). All peaks are at or below -1 dBFS.
  Suggested starting mix gains: music 0.6, ambience 0.7, SFX 1.0.

## Files

| File | Duration | Loop | Intended trigger | How it sounds |
|---|---|---|---|---|
| `music_calm.ogg` | 96.00 s | yes | Default exploration bed; always running when the entity is not hunting. | Slow felt-piano phrases with long gaps over a warm, slowly shifting Dm9-Bbmaj7-Fmaj9-G6/9-Dm9-Bbmaj7-Cadd9-Asus4 pad (D dorian, 60 bpm, 12 s per chord); occasional music-box notes; a few notes flat or sagging; faint tape wobble, hiss and a long soft reverb. |
| `music_dread.ogg` | 96.00 s | yes | Crossfade in (sample-synced with music_calm) as dread rises / entity turns; can also sit under calm. | Low beating D-E-A cluster drone, the calm melody's first half at half speed an octave down and slightly flat, the calm melody reversed and drowned in reverb, sparse sagging music-box seconds/tritones, slow uneven breathing noise. |
| `amb_wind_paper.ogg` | 32.00 s | yes | Base outdoor bed everywhere in the forest. | Soft dark wind with slow gusts, a faint hollow whistle at gust peaks, and loose paper scraps fluttering past in the gusts, panned around. |
| `amb_leaves_rustle.ogg` | 30.00 s | yes | Layer near trees / under canopy; scale with tree density. | Clumps of paper leaves crackling and rustling, near and far, density following slow gusts, over a faint airy bed. |
| `amb_mist.ogg` | 24.00 s | yes | Fade in inside fog banks. | Soft, slowly swelling airy hiss with a little low air, and very faint pitched 'bottle' resonances on D6 and A6 drifting in and out. |
| `sfx_step_paper_1.ogg` | 0.27 s | no | Player footstep (randomise 1-4, vary pitch +-3%). | Soft heel thump plus crisp paper crackle, then a lighter toe crunch and grass swish. |
| `sfx_step_paper_2.ogg` | 0.28 s | no | Player footstep. | As step 1, different grain pattern. |
| `sfx_step_paper_3.ogg` | 0.27 s | no | Player footstep. | As step 1, different grain pattern. |
| `sfx_step_paper_4.ogg` | 0.28 s | no | Player footstep. | As step 1, slightly softer. |
| `sfx_petal_pickup.ogg` | 1.61 s | no | Player catches / collects a coloured petal. | A tiny paper flick, then a soft glassy two-note chime (A6, E7) with a music-box shimmer. |
| `sfx_petal_drop.ogg` | 1.69 s | no | A petal falls / is lost / fades to grey. | Paper flutter slowing as it falls, with a soft tone gliding down a fourth (A5 to D5). |
| `sfx_field_bloom.ogg` | 4.80 s | no | The colour field appears. | Pop-up book creases snapping open, a final soft pop, and a warm Dm9 chord swelling and brightening with a rising music-box arpeggio. |
| `sfx_field_dissolve.ogg` | 5.38 s | no | The colour field dissolves as the player gets close. | The bloom chord loses its notes top-down, each sagging flat as it fades, while paper scraps rustle and flutter downward and thin out. |
| `sfx_entity_flip.ogg` | 1.02 s | no | Entity turns from smiling side to melting side. | A wet peel and plip, a big card whooshing over, then a flat slap with a sticky smack and two small drips. |
| `sfx_entity_lunge_1.ogg` | 0.49 s | no | Entity stop-motion lunge (randomise 1-3). | Tick, abrupt crumple with a low push, and a short cascade of brass split-pin rattles. |
| `sfx_entity_lunge_2.ogg` | 0.66 s | no | Entity lunge. | Same family, a double jerk (two crumples 170 ms apart). |
| `sfx_entity_lunge_3.ogg` | 0.62 s | no | Entity lunge. | Same family, shorter crumple and a longer pin rattle. |
| `sfx_entity_near.ogg` | 3.00 s | yes | Loop while the entity is within range; volume by distance. | Low shivering rumble under a restless patter of dull pin rattles and occasional staple clicks (seamless 3 s loop). |
| `sfx_staple_click.ogg` | 0.19 s | no | Staples / pins in the world (trees settling, entity twitch, UI). | A stapler: crisp metallic snap through paper, then the anvil clinch 30 ms later. |
| `sfx_bird_chirp_1.ogg` | 0.35 s | no | Random ambient bird in the canopy. | Two-part 'tsee-u' chirp, slightly rough and papery. |
| `sfx_bird_chirp_2.ogg` | 0.71 s | no | Random ambient bird. | Quick descending seven-note trill and a closing chirp. |
| `sfx_bird_chirp_3.ogg` | 0.56 s | no | Random ambient bird. | Rising whistle with a flutter vibrato, then two ticks. |
| `sfx_caught.ogg` | 3.20 s | no | The entity catches the player. | A whole sheet crumpling tighter and lower into a ball, a final crunch, then 1.35 s of dead silence. |

## Notes

- Footsteps and lunges come in variants; randomise between them and add small pitch (+-3%) and
  gain (+-2 dB) variation in the engine.
- `sfx_entity_near` is a seamless 3 s loop; drive its gain from entity distance.
- `sfx_caught` ends in deliberate digital silence (about 1.35 s); let it play out before cutting.
- Sources and licences: see `CREDITS.md`.
- After decoding in the browser, check `buffer.length` of a loop equals its `LOOPLENGTH` tag;
  ffmpeg decodes them sample-exact.

## Known weak spots (verified by analysis and spectrograms, not yet by ear)

- Birds are pure synthesis (swept sines with a little noise): stylised, can read as toy/electronic.
- The felt piano is an additive model: soft and pleasant but nearer a mellow celesta-piano than a
  real felt piano (no pedal, damper or key noise).
- The dread bed's breathing is band-passed noise; at high volume it can read as wind rather than breath.
- Paper sounds (steps, crumples, lunges) are granular crackle models; convincing as paper, less so as grass.
