# 06 - Horror audio: research and an audio plan for *Home Time*

Status: research note, 2026-10-08. Feeds the sound pass for the school slice (03_slice_v1_spec.md §9) and the licensed-asset sourcing in `assets/audio/licensed/`.

The short version: **dread comes from uncertainty, scares come from contrast, and believability comes from real physical sources.** Keep synthesis for the beds, hums and processing. Use recordings for anything with a human body or a physical object behind it.

---

## 1. Why horror audio works

- **We hear threats before we see them.** Hearing covers 360 degrees and never switches off, so it is the brain's early-warning system. Horror games turn this into gameplay. In *Five Nights at Freddy's*, reviewers found "the quiet to be panic-inducing when it was interrupted by noises from the animatronics" and told players to wear headphones "to also detect the noises" ([Wikipedia: FNaF](https://en.wikipedia.org/wiki/Five_Nights_at_Freddy%27s_(video_game))).
- **Rough, chaotic sounds are hard-wired alarms.** Arnal et al. (2015) found that human screams sit in a "privileged" part of the acoustic space: amplitude modulation between about **30 and 150 Hz**, which we hear as *roughness*. Normal speech modulates at about 4-5 Hz. Roughness "engages subcortical structures critical to rapidly appraise danger" (amygdala), and adding it to artificial alarms makes them easier to detect ([Arnal et al., *Current Biology* 2015](https://archive-ouverte.unige.ch/unige:75898)).
- **Nonlinearity reads as panic.** Blumstein and colleagues traced animal alarm calls to "nonlinear" vocal chaos: an overblown larynx gives subharmonics, sudden pitch jumps and noise. Film scores imitate this ([Science News](https://www.sciencenews.org/article/chaos-makes-scream-seem-real)). In a 2012 *Biology Letters* study, adding nonlinearities to neutral music raised arousal ratings and lowered valence ratings. When the same music was paired with benign video, the arousal effect disappeared ([Blumstein, Bryant & Kaye 2012](https://researchinnovation.kingston.ac.uk/en/publications/the-sound-of-arousal-in-music-is-context-dependent-2/)). **Lesson: a rough sound only frightens when the picture or context backs it up.**
- **The uncanny lives in sound too.** Grimshaw's "audio uncanny valley" argues that sounds which are nearly but not quite natural produce unease. He points to procedural audio as a tool for this ([Grimshaw 2009](https://vbn.aau.dk/en/publications/the-audio-uncanny-valley-sound-fear-and-the-horror-game)). This cuts both ways for us: it is useful when we mean it, and it is fatal when it is accidental (see §5).
- **Fear is structured over time.** Ekman & Lankoski studied *Silent Hill 2* and *Fatal Frame*. They show that horror sound works by managing expectation, which is a mix of what the player knows, what they can guess, and what the sound withholds ([Ekman & Lankoski 2009](https://research.aalto.fi/en/publications/hair-raising-entertainment-emotion-sound-and-structure-in-silent-/)).

---

## 2. Techniques

Each technique below gives what it is, why it works, and how it applies to *Home Time*.

### 2.1 Drones and pedal tones
- **What:** a sustained low tone or noise band that lasts for minutes.
- **Why:** it sets a baseline level of arousal without any event. Because it never resolves, the listener stays braced. Small changes in it (a filter opening, a second tone creeping in) register as "something changed" even when nothing visible did.
- ***Home Time*:** each space gets a drone in its own key-less colour. Fluorescent tubes are a diegetic drone: 50 Hz mains plus harmonics at 100, 150 and 300 Hz, plus ballast buzz. The tube hum *is* the pedal tone, so we never need an extra synth pad in corridors at low dread.

### 2.2 Clusters, dissonance and beating
- **What:** tritones, minor 2nds and microtonal pairs. Two tones a few Hz apart produce slow **beating**, an audible pulsing of loudness.
- **Why:** dissonance never settles. Beating is a slow amplitude modulation. Push the beat rate up into the 30-150 Hz zone and it becomes roughness, the scream signature (Arnal). The [tritone](https://en.wikipedia.org/wiki/Tritone) carries centuries of "unstable" association.
- ***Home Time*:** add a dread-driven "beater" (§6.3) made of two sines around 55/58 Hz or 110/116 Hz. Their offset slides from about 0.5 Hz (calm) toward about 6 Hz (danger). For chase or caught states, add true 40-70 Hz AM to a noise or string layer.

### 2.3 Aleatoric and extended-technique strings
- **What:** Penderecki's *Threnody to the Victims of Hiroshima* is written for 52 strings, timed in seconds rather than bars. It uses quarter-tone clusters, "slapped instruments, playing on the tailpiece and behind the bridge", and varying vibrato ([Wikipedia](https://en.wikipedia.org/wiki/Threnody_to_the_Victims_of_Hiroshima)). Other techniques in this family: sul ponticello (glassy and thin), col legno (wood clicks), glissando swarms.
- **Why:** the result is mass sound with no pulse and no key. It is unpredictable, rough and nonlinear. Film borrowed it directly. *The Shining* uses Penderecki (*De Natura Sonoris*, *Utrenja*, *The Awakening of Jacob*, *Polymorphia*), Ligeti's *Lontano* and Bartók, beside the Wendy Carlos / Rachel Elkind *Dies Irae* main title ([Wikipedia: The Shining](https://en.wikipedia.org/wiki/The_Shining_(film))).
- ***Home Time*:** use one or two **recorded** aleatoric string textures (CC0/CC-BY) as our top dread layer, time-stretched and filtered. Real bowed noise is the clearest case where synthesis fails.

### 2.4 Prepared piano, music boxes, toy instruments
- **What:** [prepared piano](https://en.wikipedia.org/wiki/Prepared_piano) has objects on the strings, which gives detuned, clanky, bell-like tones. Music boxes and toy pianos are mechanical and slightly out of tune, and their spring drive makes the tempo sag.
- **Why:** a child's object makes a sound from the safe world. When it slows, detunes, or plays in an empty room, safety turns into threat. FNaF's Freddy plays a music-box "Toreador Song" when the power fails. In the fiction it was installed "to provide comfort to children", which turns comfort into an omen ([Slashfilm](https://slashfilm.com/1398653/five-nights-freddys-toreadors-march-french-opera)). Tobias Lilja built *Little Nightmares* from "recordings of acoustic instruments such as music box, trombone, accordion and vocals - often heavily processed", blended with world sounds to create "a blurred line between musical elements and environmental sounds" ([Bandai Namco](https://store.bandainamcoent.eu/little-nightmares-the-music-box-collection/)).
- ***Home Time*:** the infants' room has a real recorded music box. Its playback rate drifts like a winding-down spring, and when it stops it means something.

### 2.5 Children's choirs and nursery tunes
- **What:** innocent material placed in a threatening context. Tropers call it the "Ironic Nursery Tune" ([Tropedia](https://tropedia.fandom.com/wiki/Ironic_Nursery_Tune)).
- **Why:**
  - *Contaminated innocence:* the sound promises safety and the context denies it.
  - *Uncanny familiarity:* a tune you know, sung slightly too slow or slightly flat, is "familiar but not quite right".
  - *Absent singers:* children are heard but not seen.
- **Prior art:** *Resident Evil 7*'s theme is Michael A. Levine's dark rework of "Go Tell Aunt Rhody", sung by Jordan Reyne. Capcom asked him "to take a familiar song and reimagine it, darker and more threatening", using a traditional song "for legal reasons" ([UploadVR](https://uploadvr.com/resident-evil-7-theme-song)). Note: the main theme is Levine's. Akiyuki Morimoto is one of the score's other composers.
- ***Home Time*:** the hymn over the PA. It must be a **real recorded choir** (§5). Its innocence carries the horror, so we leave it un-processed apart from the PA chain.

### 2.6 Reversed audio
- **What and why:** reversed reverbs and swells start from nothing and end abruptly. That envelope never happens in nature, so it reads as "time is wrong". It is good for memory and dream moments.
- ***Home Time*:** a reverse swell leads into the crayon-page memory flash. Use it sparingly, once per page.

### 2.7 Infrasound: be honest about the evidence
- **Tandy (1998):** Vic Tandy and Tony Lawrence ("The Ghost in the Machine", *Journal of the Society for Psychical Research*) traced a "haunted" lab to an extractor fan producing **18.98 Hz**. Tandy linked it to a claimed eyeball resonance of about 18 Hz ([Wikipedia: Infrasound](https://en.wikipedia.org/wiki/Infrasound); [IFLScience](https://www.iflscience.com/vic-tandy-and-the-bizarre-story-of-the-haunted-lab-that-was-solved-by-bringing-a-sword-to-work-83586)). This is one anecdotal case, and the eye-resonance mechanism is speculative.
- **Wiseman / Angliss / Lord "Infrasonic" concerts (2003):** about 700-750 concert-goers heard pieces with and without a ~17 Hz tone "near the edge of hearing". About **22%** reported more unease, chills or sorrow when it was present ([NBC News](https://www.nbcnews.com/news/amp/wbna3077192); [Wikipedia](https://en.wikipedia.org/wiki/Infrasound)). Angliss herself calls the results "tantalising but inconclusive" and notes the audience "were *expecting* something unusual" ([sarahangliss.com](https://www.sarahangliss.com/?p=27293)).
- **Verdict: weak, suggestive evidence.** In practice it does not matter for us: laptop speakers and most headphones cannot reproduce 17-19 Hz in a browser. **Do not design around infrasound.** Get the "felt" effect with 30-60 Hz content, slow amplitude modulation and beating, which people can actually hear.

### 2.8 Silence and the silence drop
- **What:** pull the bed, music and room tone right down for 1-3 s before a scare.
- **Why:** the scare is measured against what came before it, so a drop makes the same hit feel louder. Silence also hands the work to the player's imagination. Constant scoring turns into "sonic wallpaper" ("After an hour of ominous strings, your brain starts filtering it out", [Wayline](https://www.wayline.io/blog/silence-is-scary-sound-design-horror-games)). Colin Stetson describes his *Hereditary* score as "amplifying silence until the inherent sonic character became apparent", with the music hidden "in plain sight" ([Stereogum](https://stereogum.com/2001874/colin-stetson-hereditary-music-interview/interviews)).
- ***Home Time*:** many of our silences are *diegetic*, which makes them stronger:
  - the chalk stops
  - the snoring stops
  - the Headmaster's keys go quiet

  Each one means *someone is listening*.

### 2.9 Stingers, and how not to cheapen them
- **What:** a sudden loud musical or SFX hit.
- **Risks:** fatigue, predictability, and stingers firing without a cause (the "boo" with no ghost). Amnesia's music swelling whenever a monster spawned was learned by players as a "safe/unsafe" indicator, which drained tension ([Wikipedia: Amnesia](https://en.wikipedia.org/wiki/Amnesia:_The_Dark_Descent)). FNaF critics found the repeated jump scares wore thin (Wikipedia, above).
- **Rules for us:**
  1. Every stinger has a diegetic cause the player can see or hear.
  2. Respect the cooldowns in §6.3.
  3. Make most "edge of view" events *without* a sting.
  4. Keep 3+ variants per stinger with random pitch and filter.
  5. Timing is everything. Creative Assembly's Sam Cooper: "a sound that plays a second or two late can mean the difference between abject horror and catastrophic comedy" ([MCV](https://mcvuk.com/?p=75051)).

### 2.10 Diegetic, non-diegetic, and the line between
- **What:** *Silent Hill*'s pocket radio "alerts Harry to the presence of nearby creatures with bursts of static" ([Wikipedia](https://en.wikipedia.org/wiki/Silent_Hill_(video_game))). It is a story object, a UI meter and a noise score all at once. *P.T.*'s radio narrates a familicide, and a "muffled sound of a crying baby" comes from a shaking refrigerator ([Wikipedia: P.T.](https://en.wikipedia.org/wiki/P.T._(video_game))). Yamaoka picked an industrial, "cold, rusty" palette, and staff at first mistook it for a technical fault (Silent Hill Wikipedia, above).
- ***Home Time*:** the PA hymn, the bell, the story-reader and the music box are all diegetic music. The player can never be sure whether the "score" belongs to the building. Non-diegetic layers stay low, tonal and textural so they blend with the hum.

### 2.11 Positional audio for stalkers
- **What:** HRTF binaural rendering lets a sound sit behind, above or below you.
- **Prior art:** *Baldi's Basics* is a school game where Baldi "chases the player with a ruler while smacking it against his hand as he moves" and "can also hear every sound that they make" ([Wikipedia](https://en.wikipedia.org/wiki/Baldi%27s_Basics)). The slap rate rises with his anger, so it works as sonar ([guide](https://steamah.com/baldis-basics-classic-remastered-complete-character-guide/)). That is the model for our Headmaster.
- **Useful twist:** research cited around Ekman's work suggests that making a sound *hard* to localise can raise fear. So we should be precise when the player needs information (keys and cane at a distance) and deliberately vague for the stairwell presence.

### 2.12 Room tone and reverb as storytelling
- **What and why:** reverb tells the player size, material, emptiness and distance. A tiled corridor's long, bright tail says "empty building at night". A dead, close detention room says "trapped".
- **How:** use real impulse responses where possible. The [OpenAIR library](https://www.openair.hosted.york.ac.uk/?page_id=2) (University of York) hosts mostly Creative Commons IRs.

---

## 3. Case studies

| Work | What to take |
|---|---|
| **Silent Hill** (Yamaoka) | Diegetic radio static as a threat meter; industrial noise as score; music that "barely sounded like music". |
| **Amnesia: The Dark Descent** (Tarmia; Frictional) | Sanity drain is heard as a crackle that Thomas Grip says "was created by cracking egg shells in front of a microphone" and "gets worse and worse the longer" sanity drains ([Game Developer](https://www.gamedeveloper.com/design/game-design-deep-dive-i-amnesia-i-s-sanity-meter-)). That is a physical recording used as a psychological signal. Also a warning: monster-tied music became predictable. |
| **Alien: Isolation** (Creative Assembly) | Music delivered "in a kind of 'kit form'" and played back depending on "where the Alien is, if it knows where you are" (composer Joe Henson, [MCV](https://mcvuk.com/development-news/the-music-of-alien-isolation)). "Music changes depending on both what the player and the Alien is doing" (Al Hope, [SEGAbits](https://segabits.com/blog/2014/04/03/the-sound-of-alien-isolation/)). The team leaned on "conditioning, misdirection and innate or primal responses" (Sam Cooper, MCV). See also Hope's GDC 2015 talk [Building Fear in Alien: Isolation](http://www.gdcvault.com/play/1021852/Building-Fear-in-Alien) and the GDC [Foley in Alien: Isolation](https://www.gdcvault.com/play/1023223/Foley-in-Alien-Isolation-Gears) session. Byron Bullock (senior sound designer) later co-presented creature sound design at GDC 2017 ([Game Developer](https://gamedeveloper.com/audio/video-next-level-creature-sound-design)). |
| **Little Nightmares** (Lilja) | Processed real music box, accordion and voice, blended with world noise; small, distinct footsteps against huge ambience to make the player feel small ([Sound Architect interview](https://thesoundarchitect.co.uk/?p=18494)). |
| **P.T.** | Radio as narrator; a looping space where small sound changes signal escalation; a baby's cry from an object. |
| **Outlast** (Laflamme) | Bowed tremolo and familiar instruments detuned "to get an unfamiliar texture"; a custom wood-and-metal "Redneck Bass"; music tested in-game with the audio director ([HorrorDNA](https://www.horrordna.com/features/ryan-interviews-samuel-laflamme-composer-for-outlast-2)). |
| **RE7** | A folk or children's tune twisted ("everybody's dead") as the identity of the whole game. |
| **FNaF** | Audio *is* the gameplay: listening, silence and a music-box countdown before death. |
| **Baldi's Basics** | A school; a rhythmic positional cue whose tempo encodes danger; the antagonist hears your noise. This is closest to our design. |
| **Hereditary** (Stetson) | Clarinet choirs and voice, "obscured so as to not really be recognizable"; avoiding "ubiquitous" horror tropes. |
| **The Shining** | Pre-existing modernist concert music (Penderecki, Ligeti) cut against a cold institutional space. |

---

## 4. Adaptive systems and mixing

### 4.1 Adaptive music
- **Vertical layering:** synchronised stems faded in and out by a parameter. Best for continuous dread.
- **Horizontal re-sequencing:** swap short segments at boundaries. Best for state changes such as calm to hunted to chase ([Winifred Phillips, GDC 2021](https://www.gamedeveloper.com/audio/horizontal-resequencing-and-dynamic-transitions-for-game-music-composers-from-spyder-to-sackboy-gdc-2021-); [hybrid](https://www.gamedeveloper.com/game-platforms/hybrid-horizontal-vertical-structure-for-game-music-composers-from-spyder-to-sackboy-gdc-2021-)).
- **RTPC-style parameters:** in our case a single `dread` value from 0 to 1, smoothed, drives gains, filter cutoffs and beat rates.
- **Hysteresis and minimum hold times** stop layers from flapping.
- **Avoid Amnesia's tell:** don't let one layer map 1:1 to "monster nearby". Blend several inputs and add noise.

### 4.2 Mixing for dread
- **Wide dynamic range.** Ambience sits low so scares have headroom. No master limiter squashing everything flat.
- **Loudness reference:**
  - Sony's ASWG recommends **-24 LUFS integrated (±2 LU) for console and -18 LUFS for mobile** ([Designing Sound, Garry Taylor interview](https://designingsound.org/2012/07/30/video-games-and-loudness-standards-interview-with-sonys-garry-taylor/); [Audiokinetic: mastering](https://audiokinetic.com/en/mastering-a-game-with-wwise-part1)).
  - A browser game played on laptops and headphones sits between the two: **aim for about -20 LUFS integrated over a session**.
  - Pure ambience passages at about **-26 to -23 LUFS**.
  - Scare peaks reach about **-10 LUFS momentary** for under 1 s, with **true peak ≤ -1 dBTP**.
- **Ducking:** gameplay-critical cues (keys, cane, chalk stop) duck music and beds a few dB so they always read.

---

## 5. Why our synthesised set sounds "off"

Looking at `assets/audio/school/src/make_school_audio.py`:

1. **Voices are additive formant models.**
   - **What the code does:** the choir, shriek, whisper and story murmur are harmonic stacks through formant filters, with sine vibrato and a little random drift. The choir is three parts on a single "ooh" vowel.
   - **What real voices have that the model lacks:** jitter and shimmer at the cycle-to-cycle level, breath and aspiration that track the phrase, consonants and onsets, pitch "scoops" that differ per child, mouth and chest resonances that shift with the note, and a real ensemble of 20-40 de-correlated children.
   - **Why it matters:** voices are the sound we are most expert at hearing, so a near-miss lands right in Grimshaw's audio uncanny valley. It sounds like a machine pretending, not like a ghost.
2. **The reverb is synthetic.** `make_ir()` is exponentially-decaying filtered noise with a 15 ms fade-in. It has no discrete early reflections, so there are no walls, floor or ceiling, and no flutter between parallel corridor walls. Real rooms say "tiles" and "this wide" in their first 50 ms. Without those reflections, every space reads as a generic "reverb plugin".
3. **Reverb is baked into the files.** A pre-reverbed sound can't be re-placed: the corridor tail follows you into the classroom and fights the positional panner. Keep sources dry and add the room at runtime.
4. **Periodicity.** Loops use whole-cycle modulators so they repeat seamlessly, but the ear catches the repetition within one or two cycles. Real hums and snores wander.
5. **Physical foley is idealised.** Modal "strikes" (cane, keys, footsteps, latches) have clean, few-mode resonances. Real keys are dozens of chaotic collisions. Real chalk is stick-slip friction with grit and board resonance. Real paper is broadband crackle with sharp micro-tears.
6. **The work is spread thin.** One generator tries to do everything. The places where synthesis is strong (beds, hums, tones, beating, AM roughness, processing chains) get the same effort as the places where it is weakest (voices, ensembles, friction foley).

**Recommendation:**
- **Record (source):** anything with a human body, a crowd or a physical object.
- **Synthesise:** drones, mains hum, the beater, roughness AM, tinnitus, sub hits.
- **Hybrid:** recorded material processed live in Web Audio (PA chain, rate drift, HRTF, convolution), which gives procedural variation over real sources.

---

## 6. Audio plan for *Home Time*

### 6.1 Global structure

**Buses:**
- `diegetic`: SFX and voices, panned with HRTF
- `ambience`: room tone, hum, building
- `score`: non-diegetic drones and layers
- `pa`: the hymn and announcements
- `scare`: jump-scare hits

These feed a `pre-master` gain that ducks, then a gentle `DynamicsCompressor` used as a safety limiter only (threshold about -6 dB, ratio about 4, knee 6), then the destination.

**Reference level (REF = 0 dB):** the player's own footsteps on lino at walking pace. Everything below is relative to REF, before distance attenuation.

### 6.2 Spaces

| Space | Layers | Reverb (runtime convolver, dry sources) |
|---|---|---|
| **Corridor** | Tube hum per light (positional, 50 Hz + harmonics; dying tubes add ballast tick and flicker buzz) -22; building room tone -28; distant structure (radiator tick, a far door) every 20-60 s at -24; score drone from dread 0.15 | Tiled, hard, parallel walls: **RT60 1.2-1.8 s**, predelay 15-25 ms, bright; add a faint flutter echo |
| **Classroom** | Chalk squeak (recorded, many variations) -8 at 3 m; pencils scratching bed -16; paper and desk-lid incidentals; story reader in *Story Time* -10 | **RT60 0.6-0.8 s**, predelay 8 ms |
| **Infants' room** | Music box -14 with rate drift; soft toy creaks and squeaks; a ticking wall clock -26 | Soft and absorbent (carpet, toys): **RT60 ~0.5 s**, dark |
| **Stairwell** | Concrete wind and air -26; the "one step behind" system (6.4) | Hard and tall: **RT60 2-3 s**, long low tail, predelay 30 ms |
| **Detention** | Snoring Headmaster -12; clock tick -20; the player's chalk lines -8 | Small and dead: **RT60 ~0.4 s**, close |
| **After 3:30** | The bell everywhere (6.4); score held at dread ≥ 0.8 | Bell sources carry their own spaces' reverb |
| **Ending (daylight)** | Birdsong and distant playground (real field recording) -18; one clean outdoor school bell -10; then silence | **Dry**: outdoors, no tail. The first time the player hears no room. |

### 6.3 Dread, layers, silence and cooldowns

`dread` (0..1) is a weighted max/sum of these inputs, then smoothed (attack about 2 s, release about 8 s):
- Headmaster proximity: 1 - d/25 m
- Headmaster awareness: 0 = patrol, 0.5 = heard, 1 = sees or chases
- Lesson danger: the teacher turning, or *Story Time* noise
- Clock: rises slowly toward 3:30
- Recent-scare afterglow: decays over 20 s

| dread | Score layer (all `score` bus) | Notes |
|---|---|---|
| ≥ 0.00 | Space bed only (hum + room tone) | No music at all in calm. Silence is the default. |
| ≥ 0.15 | Synth drone, low-passed, ~45-80 Hz root, slow filter wander, -26 | Hysteresis: off below 0.10 |
| ≥ 0.35 | Beater: sine pair, beat rate 0.5 → 6 Hz with dread, -24 → -18 | Tritone or minor-2nd partials enter at 0.5 |
| ≥ 0.55 | Recorded aleatoric strings or scrapes, time-stretched, band-passed, -22 | Random start point, 30-90 s hold minimum |
| ≥ 0.80 | Roughness: noise or strings with 40-70 Hz AM; low pulse | Only when the Headmaster is aware or after the bell |

**Silence-drop rule (scripted scares only):**
1. 1.2-2.5 s before the hit, ramp `score` and `ambience` down 15-18 dB over 300 ms. Keep the player's footsteps and breath up, so the player hears themselves.
2. Optionally stop one diegetic source with a cause (chalk, snore, keys).
3. Hit.
4. Then a 4-6 s "ring": tinnitus-like 3-4 kHz sine at -30 fading out, and beds return over 3 s.

**Stinger cooldowns:**
- At least 45 s between any two `scare`-bus events.
- At most one non-diegetic sting per 3 minutes.
- At most 1 in 3 "edge of view" events (spec §6) gets any sting. The rest are diegetic only: footsteps, breath, a whisper.
- Never play the same variant twice in a row; randomise pitch ±1.5 semitones and filter ±20%.

### 6.4 Events

- **Headmaster (stalker cues, HRTF):**
  - Keys loop: recorded keyring, -12 at 5 m, rhythm locked to his gait.
  - Slow footsteps: recorded leather heels, 4+ variants, about 0.9 steps/s, -10.
  - Cane tap: every 2nd step, -10; a sharper, drier tap on tile than on lino.
  - Distance: inverse model, refDistance 2 m, rolloff 1.2, maxDistance 30 m.
  - **Occlusion:** low-pass to about 900 Hz and -6 dB when no line of sight (a nav-graph or raycast check is enough).
  - **Tell:** when he stops to listen, the keys *stop* and one last jingle settles. The keys going quiet is the scariest sound he makes.
  - Near tubes flicker as he passes: light buzz and clunk.
  - Chase: footsteps become faster scuffs and the cane drags.
- **Chalk stop on turn:**
  - The squeak plays in 3-7 s strokes.
  - At the stop: a hard cut plus a tiny chalk "tick" lift-off, then a paper-and-cloth rustle as the teacher card turns.
  - **All classroom sound freezes with her:** pencils stop, the murmur stops. Only the player's noise remains audible. This is a diegetic silence drop on every turn, 1.5-2.5 s long.
- **Choir countdown over the PA:**
  - Source: a real recorded children's choir hymn (PD or CC).
  - Chain: high-pass 300 Hz, low-pass 3.4 kHz (telephone band, [Wikipedia: Voice frequency](https://en.wikipedia.org/wiki/Voice_frequency)); peaking +4 dB at about 2 kHz (cheap horn speaker); `WaveShaper` soft-clip (tanh, drive about 2); a 50 Hz mains hum bed at -30; then the corridor or hall reverb.
  - Play from 2-3 positional "speaker" panners with 10-40 ms offsets, so you hear the building's PA, not a track.
  - As the countdown nears its end, drift `playbackRate` from 1.0 down to about 0.93: the tape is dragging. On later nights use the slowed version.
- **Story reader:**
  - Source: a real woman's voice reading a public-domain children's story. LibriVox recordings are public domain in the USA ([LibriVox collection example](https://archive.org/details/childrensshortworks040_2009_librivox)). Check that the specific reader's credit and licence fit.
  - On player noise she stops mid-word. Then silence, then one page turn.
- **Snore (detention):**
  - A recorded snore loop, cut into single breaths and re-sequenced with random 3.5-5.5 s cycles and occasional snorts.
  - **A missed breath is the warning.**
- **The 3:30 bell:**
  - A real recorded electric bell, looped seamlessly, placed at bell boxes along corridors (multiple positional sources, so it is loud near a box and far away elsewhere).
  - It ducks `score` 6 dB, pins dread at ≥ 0.8, and becomes the soundtrack.
- **Stairwell "one step behind":**
  - On each player footstep, schedule a copy (a *different* variant of the same surface sample) about 0.25-0.4 s later, from a panner 0.7 m behind and one step lower. Low-pass it slightly and run it through the stairwell IR.
  - Over 20-40 s, drift the delay so it slips out of sync.
  - When the player stops: one extra step lands.
  - Keep the localisation slightly vague (wider source, more reverb), as §2.11 recommends.
- **Paper children's heads snapping:** a recorded thick-paper fold or crack layered with a dry stem or celery snap and a short card flutter. Positional and close, -2.
- **Teacher's shriek:**
  - Source: a recorded human scream (CC0), pitched up 2-4 semitones.
  - Add 60-90 Hz AM (Arnal roughness) and a paper rip on top.
  - Precede it with the silence drop. Level +6 over REF, true peak ≤ -1 dBTP.
- **Headmaster's face fills the screen:**
  - Sequence: last key jingle, then 0.8-1.5 s silence, then a full-band hit.
  - The hit layers: sub thump 35-55 Hz (synth); a recorded orchestral cluster stab or string smear; a breath or roar fragment; a paper crumple.
  - Level +8, true peak ≤ -1 dBTP; momentary loudness about -10 LUFS for under 1 s.
- **Torn crayon pages (memory):**
  - A reverse-reverb swell (1.5 s) into 4-6 s of a muffled end-of-term concert: children singing, recorder, applause.
  - Underneath, a crackle that grows into fire and crowd unease, all low-passed to about 600 Hz with heavy hall reverb, mono and centred (inside the head).
  - It ends abruptly. Then the tinnitus ring.
  - Never explain it.
- **Home time ending:** the drone and hum cut to true silence for 1 s. Then daylight: birds, a far playground, a car, and the same bell recording clean and outdoors, ringing once and stopping. The sound that meant death now means release.

### 6.5 Mix levels (relative to REF = player footsteps)

| Element | Level | Ducking |
|---|---|---|
| Room tone / building | -28 | None |
| Tube hum (at 1 m) | -22 | -3 under PA |
| Score drone / beater / strings | -26 → -18 by dread | -4 to -6 when Headmaster cues are within 10 m; -6 under the bell; -15 to -18 on silence drop |
| Headmaster steps / cane / keys (5 m) | -10 / -10 / -12 | Never ducked |
| Chalk / pencils / story voice | -8 / -16 / -10 | Story voice ducks score -3 |
| PA hymn | -14 | Ducks score -4 |
| Bell after 3:30 | -6 near a box | None |
| Memory flash | -12 | Ducks everything else -12 |
| Scares | +6 to +8 | Everything else ducked by the drop |

### 6.6 Source vs synthesise vs hybrid

| Sound | Approach | Notes |
|---|---|---|
| Children's choir hymn | **Source** + PA processing (hybrid) | The single most important replacement |
| Story reader voice | **Source** (LibriVox PD) + room | |
| Whispers / name | **Source** (CC0 whispers) + HRTF | Reverse or granulate lightly |
| Shriek / scream | **Source** + roughness AM, pitch | |
| Snore | **Source**, re-sequenced live | |
| Chalk, pencils, paper, desk lid, chair | **Source** (multi-variant) | |
| Keys, footsteps, cane, doors, lockers | **Source** (multi-variant) | |
| School bell | **Source** | The same recording for 3:30 and the ending |
| Music box | **Source** + live rate drift | |
| Aleatoric strings / clusters | **Source** (CC0/CC-BY) + stretch | |
| Daylight ambience | **Source** (field recording) | |
| Concert-fire memory | **Hybrid**: sourced crowd, choir, fire + filtering | |
| Tube hum, mains, flicker buzz | **Synthesise** (keep current, add slow random wander) | Strong as synthesis |
| Drones, beater, roughness AM, tinnitus, sub hits | **Synthesise** (live in Web Audio) | Driven by dread |
| Room tone | **Hybrid**: a recorded empty-room bed plus synth air | |
| Reverbs | **Source** IRs (OpenAIR CC) | Corridor, stairwell, classroom-sized, small room |

### 6.7 Web Audio notes

- **Positional sources:** `PannerNode` with `panningModel = 'HRTF'` (the default is `equalpower`; [MDN](https://developer.mozilla.org/en-US/docs/Web/API/PannerNode/panningModel)) and `distanceModel = 'inverse'`. Update the `AudioListener` from the camera each frame. Reserve HRTF for important sources (Headmaster, stairwell, whispers) to save CPU on Iris Xe-class laptops. Everything else can use `equalpower`.
- **Rooms:** one `ConvolverNode` per space type ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/ConvolverNode)), fed by per-source send gains. Crossfade sends when the player crosses a door.
- **PA:** `BiquadFilterNode` highpass 300 Hz, lowpass 3400 Hz, peaking 2 kHz, then `WaveShaperNode`, then the convolver ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/BiquadFilterNode)).
- **Ducking:** Web Audio's `DynamicsCompressorNode` has no sidechain input. Do ducking with `GainNode.gain.setTargetAtTime()` driven by game events. Use the compressor only as a final safety limiter ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode)).
- **Variation:** for every one-shot, pick a random variant (never the last one), apply `playbackRate` within 0.94-1.06 and start-offset jitter.
- **Timing:** schedule on `audioContext.currentTime`, not on frames. Cooper's "a second or two late" warning also applies to 100 ms of frame jitter on a scare.

### 6.8 What has been sourced (`assets/audio/licensed/`)

There are 33 processed files, about 24 MB. Licences are in `assets/audio/licensed/CREDITS.md` and per-file use is in its `README.md`.

| Plan item | File(s) | Licence |
|---|---|---|
| PA choir hymn | `music_pa_hymn_holy_holy_holy.ogg`: the 1917 Edison "Holy, Holy, Holy", a boys' choir with adults. The acoustic recording is already narrow-band, so the PA chain needs very little. | Public domain |
| Story reader | `sfx_story_fierce_bad_rabbit.ogg`: Nan Dodge reading Beatrix Potter for LibriVox | Public domain |
| Score layers by dread | `music_corridor_drone_1/2`, `music_dread_mid`, `music_dread_high` (aleatoric strings), `music_infants_celesta`. These sit alongside the synth drone, beater and roughness layers. | CC BY 4.0, Kevin MacLeod |
| Nursery leitmotif | `sfx_music_box_this_old_man.ogg` (a diegetic toy) and `music_this_old_man_dark.ogg` (the score's darkening echo of the same tune) | CC0 / CC BY 4.0 |
| Memory flash | `music_memory_music_box_choir.ogg` and `amb_memory_fire_loop.ogg`, plus the hymn filtered as "the concert" | CC BY 4.0 / CC0 / PD |
| Headmaster | `sfx_keys_jangle`, `sfx_footsteps_headmaster` (13 slices), `sfx_cane_taps` (3 isolated heavy taps), `sfx_snore_loop`, `sfx_whispers` | CC0 |
| Classroom | `sfx_chalk_writing_loop`, `sfx_pencils_writing_loop`, `sfx_paper_tear`, `sfx_door_creak/slam`, `sfx_locker_metal` | CC0 |
| Infants' room | `sfx_doll_twinkle_1890.ogg` (an 1890 Edison Talking Doll cylinder) | Public domain |
| Stairwell | `sfx_footsteps_stairs_stone.ogg`, used for both the player's steps and the "one step behind" copy | CC0 |
| Bell | `sfx_bell_school_loop` (the 3:30 bell) and `sfx_bell_school_ring` (the ending) | CC0 |
| Lights and building | `amb_fluorescent_hum_loop`, `sfx_light_flicker`, `amb_wind_building_loop` | CC0 |
| Scares | `sfx_shriek_teacher` (a real scream), `sfx_stinger_dark`, `sfx_heartbeat_slow` | CC0 |
| Ending | `amb_ending_playground_loop`. The children speak French, so keep it distant. | CC0 |

**Change to 6.6:** the tube hum is now a recording, used in place of the synthesised one. Keep the synthesised version as a fallback and for the 50 Hz mains bed.

**Still open:**
- A children-only choir. None was found under PD, CC0 or CC BY; Commons school choirs are CC BY-SA.
- Real room IRs (OpenAIR).
- A paper "neck snap" recording.
- An English-language playground.

---

## Sources

1. Arnal et al. 2015, Human screams occupy a privileged niche - https://archive-ouverte.unige.ch/unige:75898
2. Blumstein, Bryant & Kaye 2012, The sound of arousal in music is context-dependent - https://researchinnovation.kingston.ac.uk/en/publications/the-sound-of-arousal-in-music-is-context-dependent-2/
3. Science News, Chaos makes a scream seem real - https://www.sciencenews.org/article/chaos-makes-scream-seem-real
4. Grimshaw 2009, The audio Uncanny Valley - https://vbn.aau.dk/en/publications/the-audio-uncanny-valley-sound-fear-and-the-horror-game
5. Ekman & Lankoski 2009, Hair-raising entertainment - https://research.aalto.fi/en/publications/hair-raising-entertainment-emotion-sound-and-structure-in-silent-/
6. Wikipedia, Infrasound - https://en.wikipedia.org/wiki/Infrasound
7. NBC News, Infrasound linked to spooky effects - https://www.nbcnews.com/news/amp/wbna3077192
8. Sarah Angliss, The experimental concerts - https://www.sarahangliss.com/?p=27293
9. IFLScience, Vic Tandy and the haunted lab - https://www.iflscience.com/vic-tandy-and-the-bizarre-story-of-the-haunted-lab-that-was-solved-by-bringing-a-sword-to-work-83586
10. Wikipedia, Threnody to the Victims of Hiroshima - https://en.wikipedia.org/wiki/Threnody_to_the_Victims_of_Hiroshima
11. Wikipedia, The Shining (film) - https://en.wikipedia.org/wiki/The_Shining_(film)
12. Wikipedia, Tritone - https://en.wikipedia.org/wiki/Tritone
13. Wikipedia, Prepared piano - https://en.wikipedia.org/wiki/Prepared_piano
14. Stereogum, Colin Stetson on Hereditary - https://stereogum.com/2001874/colin-stetson-hereditary-music-interview/interviews
15. Wikipedia, Silent Hill (video game) - https://en.wikipedia.org/wiki/Silent_Hill_(video_game)
16. Wikipedia, P.T. - https://en.wikipedia.org/wiki/P.T._(video_game)
17. Wikipedia, Amnesia: The Dark Descent - https://en.wikipedia.org/wiki/Amnesia:_The_Dark_Descent
18. Game Developer, Amnesia's sanity meter (Thomas Grip) - https://www.gamedeveloper.com/design/game-design-deep-dive-i-amnesia-i-s-sanity-meter-
19. MCV, The music of Alien: Isolation - https://mcvuk.com/development-news/the-music-of-alien-isolation
20. MCV, Sam Cooper on Alien: Isolation sound - https://mcvuk.com/?p=75051
21. SEGAbits, The sound of Alien: Isolation - https://segabits.com/blog/2014/04/03/the-sound-of-alien-isolation/
22. GDC Vault, Building Fear in Alien: Isolation - http://www.gdcvault.com/play/1021852/Building-Fear-in-Alien
23. GDC Vault, Foley in Alien: Isolation & Gears of War - https://www.gdcvault.com/play/1023223/Foley-in-Alien-Isolation-Gears
24. Game Developer, Next-level creature sound design (Philipp & Bullock) - https://gamedeveloper.com/audio/video-next-level-creature-sound-design
25. Bandai Namco, Little Nightmares Music Box Collection (Lilja) - https://store.bandainamcoent.eu/little-nightmares-the-music-box-collection/
26. The Sound Architect, Tobias Lilja interview - https://thesoundarchitect.co.uk/?p=18494
27. HorrorDNA, Samuel Laflamme interview - https://www.horrordna.com/features/ryan-interviews-samuel-laflamme-composer-for-outlast-2
28. UploadVR, Resident Evil 7 theme song - https://uploadvr.com/resident-evil-7-theme-song
29. Wikipedia, Five Nights at Freddy's - https://en.wikipedia.org/wiki/Five_Nights_at_Freddy%27s_(video_game)
30. Slashfilm, FNaF and the Toreador March - https://slashfilm.com/1398653/five-nights-freddys-toreadors-march-french-opera
31. Wikipedia, Baldi's Basics - https://en.wikipedia.org/wiki/Baldi%27s_Basics
32. Baldi's Basics character guide - https://steamah.com/baldis-basics-classic-remastered-complete-character-guide/
33. Tropedia, Ironic Nursery Tune - https://tropedia.fandom.com/wiki/Ironic_Nursery_Tune
34. Wayline, Silence is scary - https://www.wayline.io/blog/silence-is-scary-sound-design-horror-games
35. Game Developer, Horizontal resequencing (Winifred Phillips, GDC 2021) - https://www.gamedeveloper.com/audio/horizontal-resequencing-and-dynamic-transitions-for-game-music-composers-from-spyder-to-sackboy-gdc-2021-
36. Game Developer, Hybrid horizontal/vertical structure (Phillips) - https://www.gamedeveloper.com/game-platforms/hybrid-horizontal-vertical-structure-for-game-music-composers-from-spyder-to-sackboy-gdc-2021-
37. Designing Sound, Loudness standards (Garry Taylor, Sony) - https://designingsound.org/2012/07/30/video-games-and-loudness-standards-interview-with-sonys-garry-taylor/
38. Audiokinetic, Mastering a game with Wwise - https://audiokinetic.com/en/mastering-a-game-with-wwise-part1
39. OpenAIR impulse response library - https://www.openair.hosted.york.ac.uk/?page_id=2
40. Internet Archive, LibriVox Children's Short Works 040 - https://archive.org/details/childrensshortworks040_2009_librivox
41. Wikipedia, Voice frequency - https://en.wikipedia.org/wiki/Voice_frequency
42. MDN, PannerNode.panningModel - https://developer.mozilla.org/en-US/docs/Web/API/PannerNode/panningModel
43. MDN, ConvolverNode - https://developer.mozilla.org/en-US/docs/Web/API/ConvolverNode
44. MDN, BiquadFilterNode - https://developer.mozilla.org/en-US/docs/Web/API/BiquadFilterNode
45. MDN, DynamicsCompressorNode - https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode
