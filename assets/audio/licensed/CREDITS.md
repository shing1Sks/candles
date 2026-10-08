# Licensed audio: credits and licences

Every file in this folder (`assets/audio/licensed/`) comes from a third-party recording that is free to use, modify and redistribute commercially. This file lists the original title, author, source, licence and the changes we made for each one. **It ships with the game.**

Licences used, and what each one requires:

| Licence | What it requires |
|---|---|
| **CC0 1.0** (public-domain dedication), https://creativecommons.org/publicdomain/zero/1.0/ | Nothing. Credit is given anyway as a courtesy. |
| **Public domain** (no copyright), marked with https://creativecommons.org/publicdomain/mark/1.0/ | Nothing. The reason each recording is public domain is stated per file. |
| **CC BY 4.0**, https://creativecommons.org/licenses/by/4.0/ | Credit the author, link the licence, and say what was changed. **The game's credits screen must show the Kevin MacLeod block below.** |

No file here is NonCommercial (NC), NoDerivatives (ND), ShareAlike (SA), "personal use only" or of unclear licence.

**Changes made to every file:**
- decoded from the source format;
- resampled to 44.1 kHz with the soxr resampler;
- converted to Ogg Vorbis at quality 4;
- gain-normalised so the true peak is at or below -1 dBFS. Music beds aim for about -20 LUFS and ambience beds for -23 to -26 LUFS. One-shots are peak-normalised to about -1.5 dBFS.

Per-file changes are listed below.

"Loop crossfade" means the last N seconds of the trimmed excerpt were equal-power crossfaded over its first N seconds, so the file loops without a seam.

---

## Required attribution (CC BY 4.0): put this in the in-game credits

```
Music by Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0 License
http://creativecommons.org/licenses/by/4.0/
Tracks: "Ossuary 6 - Air", "Deep Noise", "Spider Eyes", "SCP-x4x (Mind Leech)",
"Darkest Child", "Gone Beyond", "Children's Theme".
Excerpted, looped, downmixed/normalised and converted by the Home Time team.
```

Optional courtesy credits (not legally required):
- **BigSoundBank:** "Additional sounds: Joseph SARDIN - BigSoundBank.com" (https://bigsoundbank.com), which is the wording BigSoundBank suggests.
- **CC0 creators on OpenGameArt and Wikimedia Commons:** the authors named below.
- **Thomas Edison National Historical Park and the UCSB Library:** the 1890 doll recording and the 1917 hymn.
- **LibriVox:** reader Nan Dodge.

---

## Music: Kevin MacLeod, CC BY 4.0

All tracks below are by **Kevin MacLeod (incompetech.com)**, licensed under **CC BY 4.0** (https://creativecommons.org/licenses/by/4.0/). The licence statement is confirmed at https://incompetech.com/music/royalty-free/faq.html. Downloaded 2026-10-08.

| Our file | Original title (ISRC) | Source URL | Changes |
|---|---|---|---|
| `music_corridor_drone_1.ogg` | "Ossuary 6 - Air" (USUAN1500048) | https://incompetech.com/music/royalty-free/mp3-royaltyfree/Ossuary%206%20-%20Air.mp3 | Excerpt 0:01.5-4:04; 6 s loop crossfade; stereo; normalised to -20 LUFS |
| `music_corridor_drone_2.ogg` | "Deep Noise" (USUAN1100381) | https://incompetech.com/music/royalty-free/mp3-royaltyfree/Deep%20Noise.mp3 | Excerpt 0:00-2:24; 5 s loop crossfade; stereo; -20 LUFS |
| `music_dread_mid.ogg` | "Spider Eyes" (USUAN1100526) | https://incompetech.com/music/royalty-free/mp3-royaltyfree/Spider%20Eyes.mp3 | Excerpt 0:00.8-3:27; 4 s loop crossfade; stereo; gain capped by its own peaks (about -21 LUFS) |
| `music_dread_high.ogg` | "SCP-x4x (Mind Leech)" (USUAN2000010) | https://incompetech.com/music/royalty-free/mp3-royaltyfree/SCP-x4x.mp3 | Excerpt 0:00-3:05 of the 5:36 piece; 5 s loop crossfade; stereo; -20 LUFS |
| `music_infants_celesta.ogg` | "Darkest Child" (USUAN1100783) | https://incompetech.com/music/royalty-free/mp3-royaltyfree/Darkest%20Child.mp3 | Excerpt 0:00-3:54; 4 s loop crossfade; stereo; -20 LUFS |
| `music_memory_music_box_choir.ogg` | "Gone Beyond" (USUAN1100752) | https://incompetech.com/music/royalty-free/mp3-royaltyfree/Gone%20Beyond.mp3 | Complete piece; leading and trailing silence trimmed; stereo; -20 LUFS |
| `music_this_old_man_dark.ogg` | "Children's Theme" (USUAN1100296) | https://incompetech.com/music/royalty-free/mp3-royaltyfree/Childrens%20Theme.mp3 | Complete piece; trailing silence trimmed; stereo; -20 LUFS |

---

## Public-domain historical recordings

| Our file | Original | Author / performer | Source URL | Licence | Changes |
|---|---|---|---|---|---|
| `music_pa_hymn_holy_holy_holy.ogg` | "Holy, Holy, Holy! Lord God Almighty!" (tune NICAEA). Edison Diamond Disc 80452, matrix 5285, recorded 12 Jan 1917, New York | Performed by the Calvary Choir and the Choir Boys of St. Andrew's Church, N.Y., with orchestra. Music: John Bacchus Dykes (1861). Words: Reginald Heber (1826). Digital transfer: UCSB Library / Thomas Edison National Historical Park (Edison Disc Recordings Access Initiative). | https://archive.org/details/edison-80452_01_5285 (file `cusb_ed_80452_01_5285_0c.flac`). Discography: https://adp.library.ucsb.edu/index.php/matrix/detail/2000152553 | **Public domain** (https://creativecommons.org/publicdomain/mark/1.0/). US: sound recordings published before 1923 entered the public domain on 1 Jan 2022 (Music Modernization Act, Title II). UK/EU: recording term long expired. Composition and words: authors died 1876 and 1826. | Downmixed to mono; 70 Hz high-pass; de-clicked (ffmpeg `adeclick`); light FFT noise reduction (`afftdn`, 10 dB); trimmed; +21 dB gain with a brickwall peak limiter (ceiling about -3 dBFS) to tame record-crackle peaks; 1.5 s fade-out; about -20 LUFS |
| `sfx_doll_twinkle_1890.ogg` | "Twinkle, twinkle little star 2 (1890)". Edison's Talking Doll, brown-wax cylinder, EDIS 1263 | Unknown performer, 1890 (Edison Phonograph Works). Poem: Jane Taylor (1806). Digitised by the US National Park Service (Thomas Edison NHP). | https://commons.wikimedia.org/wiki/File:Twinkle,_twinkle_little_star_2_(1890).ogg (original: https://www.nps.gov/edis/learn/photosmultimedia/twinkle-twinkle-little-star-edison-talking-doll-cylinder-brown-wax-tenhp-collection.htm) | **Public domain** (https://creativecommons.org/publicdomain/mark/1.0/). Commons tags: {{PD-US}} and {{PD-Edison Records}}. 1890 recording; US federal (NPS) digitisation. | Mono; 90 Hz high-pass; leading and trailing silence trimmed; peak-normalised |
| `sfx_story_fierce_bad_rabbit.ogg` | "The Story of a Fierce Bad Rabbit". Section 16 of the LibriVox recording "The Tale of Peter Rabbit and Others" | Read by **Nan Dodge** for LibriVox. Text by Beatrix Potter (1906). | https://archive.org/details/thetaleofpeterrabbitandothers_2008_librivox (file `peterrabbitandothertales_16_potter.mp3`). Catalogue: https://librivox.org/the-tale-of-peter-rabbit-and-others-by-beatrix-potter/ | **Public domain**. LibriVox recordings are dedicated to the public domain (https://librivox.org/pages/public-domain/; item marked https://creativecommons.org/publicdomain/mark/1.0/). Text: published 1906, author died 1943. | Excerpt 0:24.3-1:27.8: the LibriVox spoken intro and outro are removed and the story is kept. Mono; 70 Hz high-pass; -20 LUFS; 0.3 s fade-out |

---

## Sound effects and ambiences: BigSoundBank (CC0)

Source site: https://bigsoundbank.com. Licence page: https://bigsoundbank.com/droit.html. Every item below is marked on its page as **"CC0 (public domain): Free and royalty-free"**, licence URL https://creativecommons.org/publicdomain/zero/1.0/.

We used the site's public 320 kbps MP3 rendition, the file linked as "Listen to the MP3" on each page. Downloaded 2026-10-08.

| Our file | Original title (BigSoundBank #) | Author | Source URL | Changes |
|---|---|---|---|---|
| `sfx_bell_school_ring.ogg` | "Industrial doorbell #5" (#1925) | Joseph SARDIN | https://bigsoundbank.com/industrial-doorbell-5-s1925.html | Mono; silence trimmed; peak-normalised (full ring plus natural decay) |
| `sfx_bell_school_loop.ogg` | "Industrial doorbell #5" (#1925) | Joseph SARDIN | https://bigsoundbank.com/industrial-doorbell-5-s1925.html | Mono; sustain excerpt 0:00.6-0:09.2; 0.6 s loop crossfade; peak-normalised |
| `amb_fluorescent_hum_loop.ogg` | "Neon or transformer #2" (#2119) | Joseph SARDIN | https://bigsoundbank.com/neon-or-transformer-2-s2119.html | Mono; excerpt 0:00.2-0:09.7; 1 s loop crossfade; -23 LUFS |
| `sfx_light_flicker.ogg` | "Flashing Light Bulb #4" (#2146) | Joseph SARDIN | https://bigsoundbank.com/flashing-light-bulb-4-s2146.html | Mono; trimmed; peak-normalised |
| `sfx_keys_jangle.ogg` | "Keys in a hand" (#0445) | Joseph SARDIN | https://bigsoundbank.com/keys-in-a-hand-s0445.html | Mono; trimmed; peak-normalised |
| `sfx_footsteps_headmaster.ogg` | "Man Footsteps on the Wooden Floor" (#0165) | DavidGreck (published on BigSoundBank) | https://bigsoundbank.com/man-footsteps-on-the-wooden-floor-s0165.html | Mono; trimmed; peak-normalised |
| `sfx_cane_taps.ogg` | "3 Blows at the Theater" (#1025) | Joseph SARDIN | https://bigsoundbank.com/3-blows-at-the-theater-s1025.html | Mono; trimmed; peak-normalised |
| `sfx_snore_loop.ogg` | "Man Snoring" (#0170) | Joseph SARDIN | https://bigsoundbank.com/man-snoring-s0170.html | Mono; excerpt 0:02.7-0:40.0 (cut in the silences between breaths); 80 ms loop crossfade; peak-normalised |
| `sfx_whispers.ogg` | "Whisper #1" (#3255) | Joseph SARDIN & Axeline T. | https://bigsoundbank.com/whisper-1-s3255.html | Mono; trimmed; peak-normalised |
| `sfx_footsteps_stairs_stone.ogg` | "Step, Shoe on Stone Staircase" (#0606) | Joseph SARDIN | https://bigsoundbank.com/step-shoe-on-stone-staircase-s0606.html | Mono; trimmed; peak-normalised |
| `sfx_pencils_writing_loop.ogg` | "Pencil #2" (#3233) | Joseph SARDIN & Axeline T. | https://bigsoundbank.com/pencil-2-s3233.html | Mono; trimmed; 0.5 s loop crossfade; peak-normalised |
| `sfx_door_creak.ogg` | "Long creaking door" (#0306) | DenisChardonnet (published on BigSoundBank) | https://bigsoundbank.com/long-creaking-door-s0306.html | Stereo downmixed to mono; trimmed; peak-normalised |
| `sfx_door_slam.ogg` | "Door Slamming #2" (#0223) | Joseph SARDIN | https://bigsoundbank.com/door-slamming-2-s0223.html | Mono; trimmed; -4 dB (the source MP3 had inter-sample overs) |
| `sfx_locker_metal.ogg` | "Metal filing cabinet" (#0773) | Joseph SARDIN | https://bigsoundbank.com/metal-filing-cabinet-s0773.html | Mono; trimmed; peak-normalised |
| `sfx_paper_tear.ogg` | "Torn and creased page #1" (#1225) | Joseph SARDIN | https://bigsoundbank.com/torn-and-creased-page-1-s1225.html | Mono; trimmed; peak-normalised |
| `sfx_music_box_this_old_man.ogg` | "Plush music box #2" (#0416). The tune is the traditional "This Old Man" (public domain). | Joseph SARDIN | https://bigsoundbank.com/plush-music-box-2-s0416.html | Mono; trimmed; peak-normalised |
| `sfx_heartbeat_slow.ogg` | "Heart Beat #4" (#1929) | Joseph SARDIN | https://bigsoundbank.com/heart-beat-4-s1929.html | Mono; trimmed; peak-normalised |
| `amb_wind_building_loop.ogg` | "Wind from inside #2" (#1715) | Joseph SARDIN | https://bigsoundbank.com/wind-from-inside-2-s1715.html | Stereo; excerpt 0:10-1:40; 4 s loop crossfade; gain capped by its own peaks, no limiter (about -30 LUFS) |
| `amb_memory_fire_loop.ogg` | "Big Branching Fire #1" (#0987) | Joseph SARDIN | https://bigsoundbank.com/big-branching-fire-1-s0987.html | Mono; excerpt 0:00.5-0:38; 2 s loop crossfade; +14 dB with a brickwall peak limiter on the crackle pops (about -31 LUFS) |
| `amb_ending_playground_loop.ogg` | "Recreation Kindergarten #7" (#2746) | Joseph SARDIN | https://bigsoundbank.com/recreation-kindergarten-7-s2746.html | Stereo; excerpt 0:00.5-1:10; 3 s loop crossfade; gain capped by its own peaks, no limiter (about -28 LUFS) |

---

## Sound effects: OpenGameArt.org and Wikimedia Commons (CC0)

| Our file | Original title | Author | Source URL | Licence | Changes |
|---|---|---|---|---|---|
| `sfx_shriek_teacher.ogg` | "Female Scream 1" (`female_scream_1.ogg`) | Nocturnal_Vanguard ("AuraVoice", voice actor; own recording) | https://opengameart.org/content/female-scream-1 | CC0 1.0, https://creativecommons.org/publicdomain/zero/1.0/ | Resampled 48 to 44.1 kHz; silence trimmed; peak-normalised |
| `sfx_stinger_dark.ogg` | "Dark Stinger 1" (`dark_stinger_0.wav`) | Kresiek The Furry | https://opengameart.org/content/dark-stinger-1 | CC0 1.0, https://creativecommons.org/publicdomain/zero/1.0/ | Downmixed to mono; resampled 96 to 44.1 kHz; first 10.6 s kept (trailing silence cut); 0.5 s fade-out; +14.6 dB peak normalisation |
| `sfx_chalk_writing_loop.ogg` | "Chalkboard-writing.ogg" ("a longer audio recording of the sound of mathematics being written on a blackboard with chalk") | Tomproberts (own work, 2025-01-29) | https://commons.wikimedia.org/wiki/File:Chalkboard-writing.ogg | CC0 1.0, https://creativecommons.org/publicdomain/zero/1.0/ | Mono; trimmed; 1 s loop crossfade; peak-normalised |

---

Processing was done with ffmpeg: `silenceremove`, `afade`, `amix`, `alimiter`, `adeclick`, `afftdn`, `highpass` and `volume`, then `libvorbis` at q4. The original downloads were checked, converted and then deleted. Only the processed files above are kept.
