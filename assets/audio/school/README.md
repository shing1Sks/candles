# Home Time - school audio

Original sound set for the haunted paper school. Every file is synthesised from scratch by
`src/make_school_audio.py` (numpy + scipy, fixed seeds, no samples, no recordings, no downloads).
It reuses the forest set's paper / metal / reverb primitives from `../src/make_audio.py`.

```
python assets/audio/school/src/make_school_audio.py               # everything (~4 min; the hymns are the slow part)
python assets/audio/school/src/make_school_audio.py --only shriek bell_loop
python assets/audio/school/src/check_school_audio.py              # durations, peaks, RMS, loop seams
```

## Conventions

- Ogg Vorbis q5, 44.1 kHz, mono (only `whisper_name` is stereo). Same as the forest set.
- Loops are built circularly: anything that runs past the end wraps round to the start, noise
  beds are FFT-shaped, tones have whole cycles per loop, filters / resonators / reverb run
  circularly. That is an exact crossfade of the loop's own tail into its head, so the seam is
  continuous. Loud events are kept away from the seam. Loop files carry `LOOPSTART`/`LOOPLENGTH`
  tags. In Web Audio use `AudioBufferSourceNode.loop = true`.
- `hymn_70s` is exactly 70.000 s (3,087,000 samples) and is NOT a loop; nor is `hymn_slow`.
- Levels: hymns -24/-25 dBFS RMS; beds -22 (bell) ... -40 (room tone) dBFS RMS; SFX normalised on
  their loudest 100 ms (-27 small ... -11 for the shriek). All peaks at or below -1 dBFS.
  Suggested starting gains: hymn 0.7, beds 0.7, SFX 1.0; duck everything under `shriek`.

## Files

| File | Duration | Loop | What it is for | How it sounds |
|---|---|---|---|---|
| `hymn_70s.ogg` | 70.00 s | no | Plays over the PA at the start of each run (the 70-second 'home time' countdown). | Children's choir on 'ooh' (9 sopranos + 5 altos in thirds, detuned, gentle vibrato, scoops, timing drift) singing a four-line F-major hymn with one note per line sung a semitone flat (Ab, Db, Db, Eb); hall reverb, band-limited 300-4000 Hz through a cheap overdriven speaker with dust crackle and hiss; final F chord held over the last 6 s and faded. Exactly 70.000 s. |
| `hymn_slow.ogg` | 82.25 s | no | 'Lights out' version: replace hymn_70s when the school goes dark. | The same hymn re-sung 15% slower and 1.5 semitones lower, wider vibrato, a slow seasick tape wow, longer darker hall, duller (300-3200 Hz) and more overdriven speaker. Final chord fades over the last ~7 s. |
| `corridor_hum.ogg` | 20.00 s | yes | Base bed in corridors. | Fluorescent tube hum (50 Hz mains, strong 100 Hz and harmonics, faint ballast sizzle, slowly breathing), soft ventilation air, three distant wooden building creaks in a long corridor reverb. |
| `room_tone.ogg` | 20.00 s | yes | Base bed inside classrooms at night. | Almost-silence: low air, faint far hum through the wall, and an old radiator ticking in small irregular clusters with the odd deeper pipe 'tonk'. |
| `bell_loop.ogg` | 8.00 s | yes | The school bell ringing (loop for as long as it rings). | Old electric bell: a striker hammering a ~1.2 kHz gong 21 times a second, beating metallic partials, armature chatter, overdriven and harsh, light corridor reverb. |
| `pencils_loop.ogg` | 10.00 s | yes | A class (of paper children) writing; scale with how many are writing. | Fourteen pencils near and far scratching words in strokes on paper: band-noise friction, gritty graphite ticks, a little desk body, small classroom reverb. |
| `keys_loop.ogg` | 6.00 s | yes | The Headmaster walking (attach to him; gain by distance). | A heavy bunch of keys jangling at a slow walking pace (8 steps per 6 s): a cluster of key hits on each heel strike, a smaller swing-back, restless tinkle between, the duller ring, a faint cloth swish. |
| `light_buzz_loop.ogg` | 6.00 s | yes | A failing ceiling light; attach to the fitting. | Harsh 100 Hz tube buzz with arcing sizzle that stutters off and on in three bursts, drops out once and re-strikes with a flash, starter ticks on re-strike; the ballast hum stays underneath. |
| `story_murmur_loop.ogg` | 12.00 s | yes | Story time heard through a classroom wall. | A woman reading aloud in four phrases with falling intonation - formant-synthesised babble, no real words - in the next room, through a wall (low-passed at 700 Hz), unintelligible. |
| `snore_loop.ogg` | 8.00 s | yes | Something asleep (the Headmaster in his office?). | Two slow deep snores: a fluttering soft-palate rattle on the in-breath, an airy nasal exhale with a lip 'puh', quiet room between. |
| `chalk_squeak_1.ogg` | 1.47 s | no | Teacher writing on the board (randomise 1-3). | Three chalk strokes: gritty stick-slip chatter on the board, dry and scratchy. |
| `chalk_squeak_2.ogg` | 1.90 s | no | Teacher writing. | Four strokes; the second one squeals briefly. |
| `chalk_squeak_3.ogg` | 2.65 s | no | Teacher writing (the nasty one). | Long strokes with two full squeals - the one that sets your teeth on edge. |
| `chalk_stop.ogg` | 0.45 s | no | Teacher stops writing / puts the chalk down (a cue to hide). | Chalk set down on the wooden ledge: a small hard tap, a tiny scrape, a tick as it settles. |
| `paper_pick_1.ogg` | 0.32 s | no | Picking up a sheet (randomise 1-3). | Slide off the desk, a quick crackle and a soft air 'whomp' as the sheet flexes. |
| `paper_pick_2.ogg` | 0.46 s | no | Picking up a sheet. | As 1, slower lift, more crackle. |
| `paper_pick_3.ogg` | 0.38 s | no | Picking up a sheet. | As 1, different crackle pattern. |
| `desk_lid.ogg` | 1.88 s | no | Opening/searching a desk. | Lid lifted with a small knock and a hinge creak, contents shuffle, then dropped: a hollow wooden slam, hinge clank, pencils jumping inside. |
| `chair_scrape.ogg` | 1.10 s | no | A chair moves (by itself). | Three chair legs juddering across a wooden floor (stick-slip chatter) with friction noise. |
| `door_open.ogg` | 2.60 s | no | Classroom door opens. | Handle and latch clack, then a long old-hinge creak that rises and wavers, with the door's air. |
| `door_shut.ogg` | 1.80 s | no | Classroom door shuts. | Swing air, short creak, a heavy wooden thud, the latch catching and the glass pane rattling, corridor reverb. |
| `door_lock.ogg` | 1.30 s | no | A door is locked (you are locked in). | Key sliding in over the pins, seated tick, a turn with friction and ratchet ticks, the bolt clunking home. |
| `locker_open.ogg` | 1.30 s | no | Opening a locker (hiding place). | Thin latch clack, a wobbling sheet-metal (paper-ish) door with a small squeak and paper rustle, bumping against its neighbour. |
| `locker_shut.ogg` | 1.60 s | no | Locker slammed / closing yourself in. | Thin, wobbling metal clang with the latch catching, a papery crunch and flutter. |
| `cane_tap_1.ogg` | 0.80 s | no | The Headmaster's cane on the floor (randomise 1-3). | Hard wooden tap on a hard floor, ringing down the corridor. |
| `cane_tap_2.ogg` | 0.80 s | no | Cane tap. | As 1, a slightly higher, harder knock. |
| `cane_tap_3.ogg` | 0.80 s | no | Cane tap. | As 1, a lower knock with a small bounce. |
| `hm_step_1.ogg` | 1.00 s | no | Headmaster footsteps (cycle 1-4, slow). | Leather heel click and thud, then the sole slap, in the corridor. |
| `hm_step_2.ogg` | 1.00 s | no | Headmaster footstep. | Heavier, with a gritty scuff. |
| `hm_step_3.ogg` | 1.00 s | no | Headmaster footstep. | With a small leather creak, later sole slap. |
| `hm_step_4.ogg` | 1.00 s | no | Headmaster footstep. | Scuff and creak, quick roll. |
| `light_clunk.ogg` | 1.90 s | no | A ceiling light dies. | Tube hum, then a heavy relay clunk with contact bounce; the hum sags and dies in ~0.4 s, a cooling tick. |
| `shriek.ogg` | 1.53 s | no | THE jump scare: the teacher shrieks. | Instant attack: a rising (430 Hz to ~1.4 kHz), jittery, doubled formant scream with a sub-octave growl, ring-mod edge and breath, paper tearing through it, a sub hit underneath, heavily overdriven, choked off at 1.5 s. |
| `crack_chorus.ogg` | 1.01 s | no | All the paper children turn their heads at once. | ~50 dry paper-neck cracks inside 120 ms over a crumple burst and a low mass thump, then a soft paper settle. |
| `whisper_name.ogg` | 1.20 s | no | Someone whispers your name, right behind you (stereo, slightly right). | Breathy unvoiced two-syllable whisper ('sh/h-ah . l-ee'), unclear, close to the ear, breath on the ear, panned right with a tiny interaural delay. |
| `stamp.ogg` | 0.90 s | no | Gold-star reward stamped on your sheet. | Rubber stamp thumped onto paper on a desk, a sticky peel, the sheet settling. |
| `stinger_rush.ogg` | 1.23 s | no | Generic jump-scare stinger (something rushes you). | Violent roar of crumpling paper with a low body, a dropping sub boom and hit, overdriven. |
| `page_turn.ogg` | 1.01 s | no | A page of the register / storybook turns. | Corner lifted with small crackles, a slow sliding bend, then the page flops over and settles. |

## Notes

- Variants (chalk, paper_pick, cane_tap, hm_step): randomise and add +-3% pitch, +-2 dB gain.
- `hymn_70s` and `hymn_slow` are the same arrangement; to switch at 'lights out', crossfade at the
  same musical position (time x 1/0.85).
- Sources and licence: see `../CREDITS.md`.

## Known weak spots (checked by analysis and spectrograms, not yet by ear)

- The choir is additive formant synthesis: through the band-limited speaker it reads as a distant
  'ooh' choir, but up close it is purer and more organ-like than real children.
- `story_murmur_loop` and `whisper_name` are formant babble: they read as voice-like through the
  wall / as a whisper, but have no real consonant articulation.
- `shriek` is a synthetic scream; it is loud, harsh and wrong, but not a convincing human scream.
- `snore_loop` is a noise-flutter model; at high gain it can sound more like a growl than a snore.
