# Candles: audio credits and licences

Every recorded file the game plays lives in this folder. All of it is CC0, public domain, our own synthesis,
or CC BY 4.0 (Kevin MacLeod's music, which requires the on-screen credit shown on the title screen).
Everything else you hear (the giant's breath, the searchlight whine, toy squeaks, clatter, the table boom,
fallbacks for any file that fails to load) is synthesised live in `src/audio.js`.

These files were taken from our earlier GameNet sound sets (`assets/audio/licensed/`, `assets/audio/walk/`,
`assets/audio/school/`), whose credits files are the source of the rows below.

Processing already done in those sets (unless stated): decoded, resampled to 44.1 kHz, trimmed, normalised
(true peak at or below -1 dBFS), Ogg Vorbis q4 (school set: q5). Loops have crossfaded loop points.

## Required attribution (CC BY 4.0)

```
Music by Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0 License
http://creativecommons.org/licenses/by/4.0/
Tracks: "Ossuary 6 - Air", "Spider Eyes", "SCP-x4x (Mind Leech)".
Excerpted, looped, normalised and converted by the GameNet team.
```

Courtesy credit (not required): *Additional sounds: Joseph SARDIN - BigSoundBank.com* (https://bigsoundbank.com).

## Music: Kevin MacLeod (incompetech.com), CC BY 4.0

Licence: https://creativecommons.org/licenses/by/4.0/ (confirmed at https://incompetech.com/music/royalty-free/faq.html). Downloaded 2026-10-08.

| Our file | Original title (ISRC) | Source URL | Changes | Used for |
|---|---|---|---|---|
| `music_corridor_drone_1.ogg` | "Ossuary 6 - Air" (USUAN1500048) | https://incompetech.com/music/royalty-free/mp3-royaltyfree/Ossuary%206%20-%20Air.mp3 | Excerpt 0:01.5-4:04; 6 s loop crossfade; stereo; normalised to -20 LUFS. In game: low-passed, random start point | the slow drone under the house |
| `music_dread_mid.ogg` | "Spider Eyes" (USUAN1100526) | https://incompetech.com/music/royalty-free/mp3-royaltyfree/Spider%20Eyes.mp3 | Excerpt 0:00.8-3:27; 4 s loop crossfade; stereo; about -21 LUFS. In game: random start point | threat layer (it is near / searching) |
| `music_dread_high.ogg` | "SCP-x4x (Mind Leech)" (USUAN2000010) | https://incompetech.com/music/royalty-free/mp3-royaltyfree/SCP-x4x.mp3 | Excerpt 0:00-3:05 of the 5:36 piece; 5 s loop crossfade; stereo; -20 LUFS. In game: random start point | chase layer |

## Public-domain historical recording

| Our file | Original | Author / performer | Source URL | Licence | Changes |
|---|---|---|---|---|---|
| `sfx_doll_twinkle_1890.ogg` | "Twinkle, twinkle little star 2 (1890)". Edison's Talking Doll, brown-wax cylinder, EDIS 1263 | Unknown performer, 1890 (Edison Phonograph Works). Poem: Jane Taylor (1806). Digitised by the US National Park Service (Thomas Edison NHP). | https://commons.wikimedia.org/wiki/File:Twinkle,_twinkle_little_star_2_(1890).ogg | Public domain (https://creativecommons.org/publicdomain/mark/1.0/); Commons tags {{PD-US}}, {{PD-Edison Records}} | Mono; 90 Hz high-pass; silence trimmed; peak-normalised |

## BigSoundBank, CC0 1.0

Source site: https://bigsoundbank.com (licence page https://bigsoundbank.com/droit.html). Each page is marked
"CC0 (public domain): Free and royalty-free", https://creativecommons.org/publicdomain/zero/1.0/.

| Our file | Original title (BigSoundBank #) | Author | Source URL | Changes |
|---|---|---|---|---|
| `amb_wind_building_loop.ogg` | "Wind from inside #2" (#1715) | Joseph SARDIN | https://bigsoundbank.com/wind-from-inside-2-s1715.html | Stereo; excerpt 0:10-1:40; 4 s loop crossfade; about -30 LUFS |
| `amb_fluorescent_hum_loop.ogg` | "Neon or transformer #2" (#2119) | Joseph SARDIN | https://bigsoundbank.com/neon-or-transformer-2-s2119.html | Mono; excerpt 0:00.2-0:09.7; 1 s loop crossfade; -23 LUFS |
| `sfx_snore_loop.ogg` | "Man Snoring" (#0170) | Joseph SARDIN | https://bigsoundbank.com/man-snoring-s0170.html | Mono; excerpt 0:02.7-0:40.0; 80 ms loop crossfade; peak-normalised. In game: pitched down for the monster's breath |
| `sfx_footsteps_headmaster.ogg` | "Man Footsteps on the Wooden Floor" (#0165) | DavidGreck (published on BigSoundBank) | https://bigsoundbank.com/man-footsteps-on-the-wooden-floor-s0165.html | Mono; trimmed; peak-normalised. In game: sliced into single steps, pitched down (monster) or up (kid) |
| `heartbeat_beats.ogg` | "Heart Beat #4" (#1929) | Joseph SARDIN | https://bigsoundbank.com/heart-beat-4-s1929.html | From our `sfx_heartbeat_slow.ogg` (mono; trimmed; peak-normalised): first 5.0 s kept, 50 ms fade-out, re-encoded Ogg Vorbis q4. In game: single beats re-sequenced |
| `sfx_door_creak.ogg` | "Long creaking door" (#0306) | DenisChardonnet (published on BigSoundBank) | https://bigsoundbank.com/long-creaking-door-s0306.html | Stereo downmixed to mono; trimmed; peak-normalised |
| `sfx_door_slam.ogg` | "Door Slamming #2" (#0223) | Joseph SARDIN | https://bigsoundbank.com/door-slamming-2-s0223.html | Mono; trimmed; -4 dB |
| `sfx_music_box_this_old_man.ogg` | "Plush music box #2" (#0416); tune "This Old Man" (traditional, public domain) | Joseph SARDIN | https://bigsoundbank.com/plush-music-box-2-s0416.html | Mono; trimmed; peak-normalised |
| `sfx_whispers.ogg` | "Whisper #1" (#3255) | Joseph SARDIN & Axeline T. | https://bigsoundbank.com/whisper-1-s3255.html | Mono; trimmed; peak-normalised |
| `breath_kid_loop.ogg` | "Breathless Woman" (#1345) | BigSoundBank (author as listed on the source page) | https://bigsoundbank.com/breathless-woman-s1345.html | From our `walk/breath_run.ogg` (44.1 kHz; 35 Hz high-pass; levelled): excerpt 0:02-0:23, 1 s equal-power loop crossfade, re-encoded Ogg Vorbis q4. In game: pitched up slightly |
| `cat_growl.ogg` | "Growling cat #1" (#1885) | BigSoundBank (author as listed on the source page) | https://bigsoundbank.com/growling-cat-1-s1885.html | 44.1 kHz; 35 Hz high-pass; trimmed; peak-normalised. In game: slowed to 0.3-0.8x for growls and the giant's roar |
| `child_laugh.ogg` | "Laughter of Children" (#1660) | BigSoundBank (author as listed on the source page) | https://bigsoundbank.com/laughter-of-children-s1660.html | 44.1 kHz; 35 Hz high-pass; trimmed; peak-normalised |
| `door_creak.ogg` | "Creaking Door #2" (#3205) | BigSoundBank (author as listed on the source page) | https://bigsoundbank.com/creaking-door-2-s3205.html | 44.1 kHz; 35 Hz high-pass; trimmed; peak-normalised. In game: wardrobe doors |
| `drips.ogg` | "Drops of water #1" (#1384) | BigSoundBank (author as listed on the source page) | https://bigsoundbank.com/drops-of-water-1-s1384.html | 44.1 kHz; 35 Hz high-pass; trimmed; peak-normalised |
| `step_concrete.ogg` | "Footsteps, Shoe on Concrete" (#0514) | BigSoundBank (author as listed on the source page) | https://bigsoundbank.com/footsteps-shoe-on-concrete-s0514.html | 44.1 kHz; 35 Hz high-pass; trimmed; peak-normalised. In game: sliced into single steps |
| `creak_boards.ogg` | "Swing, lightly loaded" (#1094) | BigSoundBank (author as listed on the source page) | https://bigsoundbank.com/swing-lightly-loaded-s1094.html | From our `walk/swing_creak.ogg` (44.1 kHz; 35 Hz high-pass; levelled): first 12.5 s kept, 0.1 s fade-out, re-encoded Ogg Vorbis q4. In game: single creaks sliced and slowed for floorboards |

(The `walk/` set credits each of the BigSoundBank items above to the site; its credit line is *Additional sounds: Joseph SARDIN - BigSoundBank.com*.)

## OpenGameArt.org, CC0 1.0

| Our file | Original title | Author | Source URL | Licence | Changes |
|---|---|---|---|---|---|
| `sfx_shriek_teacher.ogg` | "Female Scream 1" (`female_scream_1.ogg`) | Nocturnal_Vanguard ("AuraVoice", voice actor; own recording) | https://opengameart.org/content/female-scream-1 | CC0 1.0 | Resampled 48 to 44.1 kHz; silence trimmed; peak-normalised. In game: pitched up for the kid's scream |
| `sfx_stinger_dark.ogg` | "Dark Stinger 1" (`dark_stinger_0.wav`) | Kresiek The Furry | https://opengameart.org/content/dark-stinger-1 | CC0 1.0 | Downmixed to mono; resampled 96 to 44.1 kHz; first 10.6 s kept; 0.5 s fade-out; +14.6 dB peak normalisation |

## Our own synthesis (GameNet project)

Synthesised from scratch by `school/src/make_school_audio.py` in our earlier project (numpy + scipy, fixed
seeds; no recordings or samples). Owned by the project.

| Our file | What it is |
|---|---|
| `room_tone.ogg` | Almost-silence: low air, a far hum through the wall, a radiator ticking (20 s loop) |
| `door_open.ogg` | Handle and latch, then a long old-hinge creak |
| `door_shut.ogg` | A door swung shut: short creak, heavy wooden thud, latch |
| `stinger_rush.ogg` | A violent rushing roar with a dropping sub hit (the lunge) |
