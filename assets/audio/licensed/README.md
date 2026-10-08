# Licensed audio set (Home Time)

These are real recordings and composed music, sourced under CC0, public domain or CC BY 4.0, and meant to replace the parts of the synthesised `../school/` set that sound "off". That means voices, choir, physical foley, the bell and the music beds.

- Licences and attribution: `CREDITS.md`. The Kevin MacLeod CC BY credit must appear in the game.
- Design rationale and the full audio plan: `research/06_horror_audio_research.md`.

## Format

- Ogg Vorbis q4, 44.1 kHz. SFX are mono and should be positioned in Web Audio with HRTF panning where it matters. Music and the two outdoor or building beds are stereo.
- True peak is at or below -1 dBFS everywhere.
- Music beds sit at about -20 LUFS. Ambience beds sit at -23 to -31 LUFS. One-shots are peak-normalised, so **set every level in-game** using the mix table in the research doc, section 6.5.
- All sources are dry or close-miked. Add the room at runtime with a `ConvolverNode` per space.
- Files named `*_loop` and the `music_corridor_*`, `music_dread_*` and `music_infants_*` beds have crossfaded loop points. Play them with `loop = true`.

## Files and intended use

### Score layers (non-diegetic, driven by `dread` 0..1)

| File | Length | Use |
|---|---|---|
| `music_corridor_drone_1.ogg` | 3:56 loop | Kevin MacLeod "Ossuary 6 - Air": slow drone of impending doom. The base corridor layer from dread ≥ 0.15, low-passed at low dread. |
| `music_corridor_drone_2.ogg` | 2:19 loop | "Deep Noise": breathing or wind-like dark bed. Use it in the stairwell and as an alternate corridor bed, so the drone isn't the same every night. |
| `music_dread_mid.ogg` | 3:22 loop | "Spider Eyes": distant high strings, dissonant prepared-piano textures and detuned bells. Layer it in at dread ≥ 0.55, from a random start point. |
| `music_dread_high.ogg` | 3:00 loop | "SCP-x4x (Mind Leech)": grating low strings, the aleatoric layer. Use it at dread ≥ 0.8, during a chase and after the 3:30 bell. |
| `music_infants_celesta.ogg` | 3:50 loop | "Darkest Child": a childlike celesta over deep bass. This is the infants' room bed. |
| `music_memory_music_box_choir.ogg` | 2:41 one-shot | "Gone Beyond": music box plus a sepulchral choir. Play a short, low-passed fragment when a torn crayon page is found, or use it for the credits. |
| `music_this_old_man_dark.ogg` | 1:06 one-shot | "Children's Theme": "This Old Man" getting darker and darker. It is the score's echo of the infants' room music box, which plays the same tune. Use it as a leitmotif, for example on the first infants' room visit or on a death screen. |

### PA / diegetic music

| File | Length | Use |
|---|---|---|
| `music_pa_hymn_holy_holy_holy.ogg` | 3:22 | A real 1917 Edison recording of a boys' and mixed choir singing "Holy, Holy, Holy" (public domain). This is the **PA hymn countdown**. The acoustic recording is already band-limited, so the PA chain needs very little: high-pass 300 Hz, low-pass 3.4 kHz, +4 dB at 2 kHz, a light tanh waveshaper, a 50 Hz hum bed at -30, then the hall or corridor IR. Play it from 2-3 speaker panners with 10-40 ms offsets, and drift `playbackRate` 1.0 → 0.93 as time runs out. A short orchestral intro is followed by the verses. Quiet breaths between sections fall at about 0:19, 1:07, 1:45, 2:34 and 3:14, which make natural countdown checkpoints. |

### Corridor and lights

| File | Length | Use |
|---|---|---|
| `amb_fluorescent_hum_loop.ogg` | 8.5 s loop | A recorded ballast and tube buzz. Use one positional source per light fitting. Randomise `playbackRate` 0.97-1.03 per tube so they beat against each other. Dying tubes add the flicker below. |
| `sfx_light_flicker.ogg` | 1.1 s | A defective-lamp flicker. Trigger it when a tube stutters and when the Headmaster passes under a light. |
| `amb_wind_building_loop.ogg` | 1:26 loop | A storm heard from inside a building: shutters and low wind. This is the building room tone under everything, quiet. |
| `sfx_door_creak.ogg` | 6.5 s | A long door creak. Classroom doors and the detention door. |
| `sfx_door_slam.ogg` | 3.5 s | A door slam: a door shutting behind the player, or a diegetic cause for a scare. |
| `sfx_locker_metal.ogg` | 21.9 s | A metal filing cabinet opening and closing. Slice it into locker or cabinet open, rattle and shut one-shots. Onsets are at about 0.0, 2.4, 5.0, 7.1, 9.7, 13.3 and 16.4 s. |

### The Headmaster (HRTF, never ducked)

| File | Length | Use |
|---|---|---|
| `sfx_keys_jangle.ogg` | 27.6 s | A real keyring in a hand. Loop random 2-4 s windows locked to his gait. **Stopping the keys is his "listening" tell.** |
| `sfx_footsteps_headmaster.ogg` | 8.2 s | 13 man's footsteps on a wooden floor. Slice them into one-shots: onsets at about 0.00, 0.81, 1.41, 1.93, 2.66, 3.22, 3.86, 4.56, 5.12, 5.84, 6.50, 7.23 and 7.87 s. Re-space them to his slow pace (about 0.9 steps/s) and vary pitch ±3%. |
| `sfx_cane_taps.ogg` | 7.5 s | A wooden stick struck on a stage floor: 12 quick strikes (0.0-3.7 s), then **3 isolated heavy taps at about 4.86, 6.02 and 7.25 s**. The isolated taps are the cane, one every 2nd step. The fast run works as a "rapping on the desk" variant. |
| `sfx_snore_loop.ogg` | 37.2 s loop | A real man snoring, about 9 breaths, cut in the gaps. This is the detention room. Re-sequence breaths with 3.5-5.5 s cycles; a **missed breath is the warning**. |
| `sfx_whispers.ogg` | 28.5 s | A man whispering. Use it very quiet: "a light breath" at -30 or lower, close and HRTF, behind the player. Slice, reverse or granulate fragments for name-whispers. |

### Classroom

| File | Length | Use |
|---|---|---|
| `sfx_chalk_writing_loop.ogg` | 40 s loop | Real chalk writing on a blackboard. The teacher writes in 3-7 s strokes taken from random offsets. **Hard-cut it when she turns**, along with everything else in the room. |
| `sfx_pencils_writing_loop.ogg` | 10.2 s loop | Pencil writing on paper. Stack 3-6 copies with random offsets, rates and panning for a whole class scratching. |
| `sfx_story_fierce_bad_rabbit.ogg` | 1:03 | A real woman's voice (LibriVox, Nan Dodge) reading Beatrix Potter's "The Story of a Fierce Bad Rabbit". This is the teacher reading aloud. Play it through the classroom IR, or muffled through the door. **On player noise, stop it mid-word.** |
| `sfx_paper_tear.ogg` | 3.2 s | A notebook page torn and crumpled. Use it when picking up or tearing crayon pages, and layer it into the shriek or the paper-head snap. |

### Infants' room

| File | Length | Use |
|---|---|---|
| `sfx_music_box_this_old_man.ogg` | 15.7 s | A real plush-toy music box playing "This Old Man". It is a diegetic toy, positional. Slow its `playbackRate` towards 0.85 so it "winds down" when the player lingers. |
| `sfx_doll_twinkle_1890.ogg` | 18.5 s | One of the **1890 Edison Talking Doll** cylinder recordings of "Twinkle, Twinkle, Little Star": a real 136-year-old wax cylinder, eerie on its own. A toy on a shelf plays it once. Use it rarely. |

### Stairwell

| File | Length | Use |
|---|---|---|
| `sfx_footsteps_stairs_stone.ogg` | 26 s | Shoes on a stone staircase. These are the player's stair steps, and the **"one step behind" copy**: the same steps, delayed 0.25-0.4 s, from 0.7 m behind and below, through the stairwell IR. |

### Scares and body

| File | Length | Use |
|---|---|---|
| `sfx_shriek_teacher.ogg` | 1.0 s | A real female scream, voice actor, CC0. This is the **teacher's shriek**. Pitch it up 2-4 semitones, add 60-90 Hz amplitude modulation (scream "roughness") and the paper tear on top. Put a silence drop before it. |
| `sfx_stinger_dark.ogg` | 10.6 s | A dark synth stinger with a long tail. Use it for the face-fill scare hit, layered with a synth sub thump. Respect the cooldowns in the research doc: at least 45 s apart, and at most one non-diegetic sting every 3 minutes. |
| `sfx_heartbeat_slow.ogg` | 45.8 s | A slow real heartbeat. Use it sparingly and only at high dread or while hiding, low and centred. |

### 3:30 bell and ending

| File | Length | Use |
|---|---|---|
| `sfx_bell_school_loop.ogg` | 8.0 s loop | The sustained ring of an electric (industrial) bell. This is **the continuous 3:30 bell**: loop it at several positional "bell boxes" along the corridors. |
| `sfx_bell_school_ring.ogg` | 11 s | The same bell, one ring plus its natural decay. Use it to stop the 3:30 loop (crossfade into the tail), and **for the ending**, played dry and outdoors once: the sound that meant death now means release. |
| `amb_ending_playground_loop.ogg` | 1:07 loop | A real kindergarten playground at break, for the daylight ending. **Note:** the children speak French. Keep it distant (low-passed, -18) so the words don't read, or replace it with an English playground recording later. |
| `amb_memory_fire_loop.ogg` | 35.5 s loop | A big crackling fire. Use it in the crayon-page memory flash: low-pass to about 600 Hz, mono and centred, rising under the music box and choir fragment, then cut. |

## Not sourced, and why

- **Children's choir only (no adults):** no clearly public-domain, CC0 or CC-BY children-only choir recording was found. The 1917 hymn has a boys' choir with adults. Commons does have school-choir recordings, but they are CC BY-SA, which the brief excluded.
- **Room impulse responses:** none were downloaded. Use the OpenAIR library (check each IR's licence) or keep the synthetic IRs but add early reflections.
- **Paper-children heads snapping:** no good recording was found. Build it from `sfx_paper_tear.ogg` plus a synth crack and card flutter.
- **Synthesised on purpose (see the research doc):** sub-drones, beating pairs, scream roughness AM, tinnitus ring and sub hits stay synthesised live in Web Audio.
