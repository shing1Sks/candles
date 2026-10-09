# 09 — Making The Long Way Home terrifying: research (sound, music, effects, items, night realism)

2026-10-09. Three background research passes, run after the user's second playtest
("the Tall Man was just stuck… nothing happened for 5–10 minutes… push the sky toward realism").
Condensed here with sources; what we built from it is in §5 and in `08_walk_home.md` (Pass 5+).

## 1. The organising idea

The Tall Man only moves when you're not looking. So **sound is the only proof he moves**, and **every
act of care that pulls your eyes off him (stroking Biscuit, untangling the lead, reading a poster) is
a gamble**. Everything below hangs off those two lines.

- Weeping-Angel / SCP-173 "quantum locking": tension comes from every reason the player has to look
  away; **blinking counts as not looking** ([UTulsa devlog](https://sites.utulsa.edu/csg/?p=229)).
- Dread is anticipation; constant ominous music becomes wallpaper ([Wayline](https://www.wayline.io/blog/silence-is-scary-sound-design-horror-games)).
  Near-silence makes footsteps alone frightening (Fatal Frame II, [Dread Central](https://www.dreadcentral.com/editorials/477380/dissonant-voices-the-unsettling-sounds-of-fatal-frame-ii-2/)).

## 2. Music

- Build the score from **the boy's world**: music box, celesta/toy piano, harmonium drone, humming;
  Little Nightmares processed music box + accordion + voice into "naive melodic motifs resembling
  children's rhymes — with a bleak and nauseating twist" ([gamemusic.net](https://gamemusic.net/little-nightmares-original-soundtrack/)).
  Coraline: children's choir in nonsense syllables ([Wikipedia](https://en.wikipedia.org/wiki/Coraline_(soundtrack))).
  Yamaoka: express "loneliness, sadness, anxiety", not "scary music" ([MusicRadar](https://www.musicradar.com/artists/rather-than-simply-writing-scary-music-i-wanted-to-express-loneliness-sadness-anxiety-and-the-psychological-aspects-of-fear-we-speak-to-video-game-horror-soundtrack-godfather-akira-yamaoka-about-the-legacy-of-silent-hill)).
- **Tonality decays with fear**: detune per note, wow on playback rate, tritone at dread, clusters at hunt.
- **Roughness** (30–150 Hz amplitude flutter) is what makes screams hit the amygdala ([Arnal 2015](https://www.sciencedaily.com/releases/2015/07/150716123834.htm));
  nonlinear "animal distress" sounds at climaxes ([Blumstein 2010](https://www.nbcnews.com/id/wbna40383410)).
- Infrasound can't play on laptop speakers: fake it with two beating sines (38 / 38.6 Hz) plus harmonics.
- Shepard tone for "hunt" only ([Kottke](https://kottke.org/18/05/hans-zimmers-clever-use-of-the-shepard-scale-in-dunkirk)).
- Adaptive structure: vertical layers by fear (have), phrase pools per phase, a **stinger budget**
  (≤1 per ~90 s, never on a false alarm), and **inverted peak**: duck all music 2–4 s before the closest moment.
- Free sources: freesound CC0 (per-file licence), OpenGameArt CC0 music boxes, Kevin MacLeod CC BY 4.0
  (credit line required), Pixabay (bundling OK), Sonniss GDC bundles (no AI training).

## 3. Sound design

- **Lamp deaths are his footsteps**: click, hum sagging in pitch, a glass tick as it cools, at that lamp.
- **Gaze-gated silence**: his coat/creak sounds play only while unobserved; cut in ~30 ms when you look.
- **The extra footstep**: your steps echoed ~300 ms late from behind; when you stop, one more step.
- **A sound in the wrong place**: "Biscuit…" from where nobody can be; later from *his* position.
- **The dog as instrument**: ears → growl → whimper → bark → yelp; worst of all, **the dog goes quiet**.
- British night: the **fox scream** (mistaken for a woman screaming; perfect Lewton-bus false alarm,
  [RSPB](https://community.rspb.org.uk/wildlife/f/ask-an-expert/208168/what-is-it-that-screams-in-almost-every-outdoor-night-scene-i-see-from-uk-tv));
  an ice-cream van chiming after 7 pm breaks the DEFRA code ([DEFRA](https://legacy.tendringdc.gov.uk/sites/default/files/documents/environment/pollution%20%26%20noise/8.%20DEFRA_Code_of_Practice_for_Ice_Cream_Van_Chimes.pdf)) — wrong in a way Brits feel;
  a TV through a wall (low-passed ~400 Hz); wind chimes on a windless night.
- Never true digital silence: hiss and room tone (Skinamarink, [SlashFilm](https://slashfilm.com/1167199/how-skinamarink-director-kyle-edward-ball-used-sound-to-tell-the-story)).
- After a scare: world low-pass ~1 kHz + a 6–8 kHz tinnitus whine, recovering over 5 s.

## 4. Screen effects

- Every effect follows fear or his distance; one combined pass; toggles for aberration/grain (some players get sick).
- Worth it: breathing vignette, peripheral desaturation, edge-only chromatic fringe, constant fine grain
  (Lake Mungo: grain makes viewers' minds supply figures), −6° FOV when he's near, a dolly-zoom on first sighting.
- **Forced blinks** at high fear; he advances during them.
- **Peripheral figures**: spawn > 55° off-centre, remove when looked at within ~25° (Visage).
- Avoid: VHS filters (clash with the picture book), shake spam, more than ~1 loud jump scare per area.

## 5. Items, interactions, environment (judged for *this* game)

Reference lessons: Ico's hand-hold and "design by subtraction"; Fable 2's "no dog button" — the
companion must have its own will ([Game Developer](https://www.gamedeveloper.com/game-platforms/molyneux-talks-i-fable-2-i-s-emotional-investment-with-love-dogs));
Trico's idle life; A Plague Tale's companion noise drawing enemies; Lost in Vivo's whistle → dog barks
back → find him by sound; Little Nightmares' unsafe hiding places; Among the Sleep's child-scale hiding;
Ghost of Tsushima's wind as a diegetic guide.

Ranked (impact / effort): 1 Biscuit as a second pair of eyes · 2 a physical lead (tension, slips when
you're caught) · 3 stroking costs your gaze · 4 escalating posters · 5 window vignettes · 6 calling him
after a bolt (he answers) · 7 child-scale hiding (under car, bins, phone box) · 8 his love shown without
input (leaning, licks, tail as mood) · 9 doorbells (no answer / hall light goes off / chain and close) ·
10 an LED collar light that stutters when the Tall Man is near · 11 one P.T.-style street loop · 12 chalk
drawings (a chalk tall man; the last at your own gate). Leave out: inventory, crafting, notes, batteries, map.

## 6. Night realism on an Iris Xe (three.js r186)

Avoid: SSRPass, realism-effects SSGI/SSR, shadow-raymarched god rays, volumetric clouds, the `Sky` addon (daytime).
Do (ranked):
1. **Analytic in-scattering of point lights in fog** (Macklin; Sun et al. 2005) — glows that die with their lamps.
   `s = 1/sqrt(c-b²); I = s(atan((d+b)s) - atan(bs))`. Height fog (Íñigo Quílez).
2. **Fake wet-road reflections**: long soft streaks under the mirror image of each lamp; Lagarde wet-surface darkening/gloss.
3. **Night grading**: scotopic (Purkinje) blue shift and desaturation of the dim world ([Jensen et al.](https://graphics.ucsd.edu/~henrik/papers/night/)).
4. Skyglow toward town, amplified by cloud (orange cloud base). 5. Star field with a real magnitude
distribution; limiting magnitude tied to lamp glare; twinkle stronger at the horizon. 6. Moon lit
Lommel-Seeliger (flat disc, no limb darkening) + earthshine. 7. 2.5-D moonlit cloud: silver edges,
corona, the **22° halo before rain** ([EarthSky](https://earthsky.org/astronomy-essentials/what-makes-a-halo-around-the-moon/)).
8. Silhouettes and skyline cards with aerial perspective. 9. Lamp-backlit rain, splashes, puddle ripples.
10. A low-res planar reflector for the canal only.

## 7. What we took (build log in 08, Pass 5)

- The Tall Man's rule now has the child's holes in it: **only seen where there's light** (or close, as a
  silhouette); **a lamp you watch him under flickers and he moves in the dark frames**, then it dies;
  **you blink** if you hold him too long (eyelids get heavy first), and he's nearer; a withdrawing Tall
  Man vanishes on a blink. Never stuck.
- **Omens** between his visits: footsteps behind that take one more step when you stop; Biscuit staring
  back down the road, growling at nothing; a lamp stuttering ahead; eyes in a garden; a gate creaking
  behind you; a TV / a phone / knocking inside a house; breathing behind you; his whistle far off; a
  figure at the edge of your eye that's gone when you turn.
- The clock paces him as well as the distance (dawdling no longer means nothing happens).
- Sound: his coat (gaze-gated), a cooling-bulb tick after each lamp dies, a music-box lullaby (original)
  that slows and detunes with fear and **stops dead** when he comes, a sub thump on each blink.
- Biscuit: collar light stutters when he's near; call him (R) when he's lost and he yips back (but you shouted).
- Sky: magnitude-distributed stars, a Lommel-Seeliger gibbous moon with seas and craters, moonlit
  two-layer cloud with silver edges and a corona, town skyglow on the cloud base, the 22° halo before
  the rain; star count and cloud by region. Post: analytic lamp in-scatter, wet-road streak
  reflections, scotopic night grade.
