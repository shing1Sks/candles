"""Pick review clips from a dataset: for each lesson (a rule or behaviour the model will learn), find a clear moment in
the recorded games and write a manifest of episode, step window and the events inside it.

usage: python tools/clips/pick.py [batch=v1]   -> public/clips/manifest.json
"""
import glob, json, os, sys

BATCH = sys.argv[1] if len(sys.argv) > 1 else 'v1'
ROOT = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'data', BATCH)
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'clips')
schema = json.load(open(os.path.join(ROOT, 'schema.json')))
TYPES = schema['eventTypes']

eps, events = {}, {}
for shard in sorted(glob.glob(os.path.join(ROOT, 'shard-*'))):
    for line in open(os.path.join(shard, 'episodes.jsonl')):
        e = json.loads(line); eps[e['i']] = e
    for line in open(os.path.join(shard, 'events.jsonl')):
        e = json.loads(line); events[e['i']] = [(r, TYPES[t], x, z, i, d) for r, t, x, z, i, d in e['events']]

QUIET = {'kstep', 'mstep', 'mode', 'mood'}
def find(test, prefer=lambda e: True, before=80, after=60, min_t=0):
    """the first (preferred) episode with an event matching test(i, k, evs): returns a clip window around it"""
    for strict in (True, False):
        for i in sorted(eps):
            e = eps[i]
            if strict and not prefer(e): continue
            evs = events[i]
            for k, ev in enumerate(evs):
                if ev[0] < min_t: continue
                hit = test(i, k, evs)
                if hit:
                    a, b = hit if isinstance(hit, tuple) else (ev[0] - before, ev[0] + after)
                    return i, max(0, a), min(e['rows'], b)
    return None

def after(evs, k, typ, within, pred=lambda ev: True):
    for ev in evs[k + 1:]:
        if ev[0] > evs[k][0] + within: return None
        if ev[1] == typ and pred(ev): return ev
    return None

fresh = lambda e: e['config']['start'] == 'fresh' and e['config']['kid']['style'] != 'chaos'
persona = lambda p: (lambda e: e['config']['persona']['type'] == p and e['config']['kid']['style'] != 'chaos')

LESSONS = [
    ('candle', 'Blowing a candle out', 'C1-C4: hold blow by a lit candle 1.5 s; it goes out; the giant slams; the monster is told where and rages.',
     lambda i, k, ev: ev[k][1] == 'candleOut', fresh, 100, 80),
    ('chase-catch', 'Seen, chased, lunged at, caught', 'S1, B1, B2, X1: it sees the kid, runs, crouches 0.25 s, lunges, and the touch catches.',
     lambda i, k, ev: ev[k][1] == 'lunge' and after(ev, k, 'caught', 40, lambda c: c[5] == 'touch') and (ev[k][0] - 120, ev[k][0] + 30), fresh),
    ('lunge-miss', 'A lunge that misses', 'B2, Z2: the lunge misses, it recovers at half speed; the miss is a setback that feeds its anger.',
     lambda i, k, ev: ev[k][1] == 'lunge' and not after(ev, k, 'caught', 60) and (ev[k][0] - 80, ev[k][0] + 80), fresh),
    ('vent', 'Into a vent: it goes round to the exit', 'G1, K3, B5: the kid crawls into a kid-only gap; a smart monster heads for the far exit instead of following.',
     lambda i, k, ev: ev[k][1] == 'tactic' and ev[k][5].startswith('ambushGap:'), fresh, 100, 120),
    ('found', 'Hiding in a wardrobe: found', 'W1, W3, W4, X2: the kid hides; the monster opens the wardrobe (0.7 s) and finds it.',
     lambda i, k, ev: ev[k][1] == 'found' and (max(0, ev[k][0] - 160), ev[k][0] + 20), lambda e: e['config']['kid']['style'] == 'hider'),
    ('empty', 'Hiding in a wardrobe: it looks in the wrong one', 'W4, W5: it checks a wardrobe and finds it empty, a setback that frustrates it.',
     lambda i, k, ev: ev[k][1] == 'checkEmpty', fresh, 80, 60),
    ('door', 'A door shut in its face', 'D1, D2, D5: the kid shuts a door between them (heard 6 m off); the monster has to stop and open it (0.6 s) or smash it (0.9 s). It feels it as a setback.',
     lambda i, k, ev: ev[k][1] == 'door' and ev[k][5] == 'shut:kid' and after(ev, k, 'doorTry', 60) and (ev[k][0] - 80, ev[k][0] + 80), fresh),
    ('yell', 'It yells: the kid got away into a gap', 'Z2: losing the kid into a vent or crack is a sharp setback; anger crosses 0.7 and it stops to roar (0.8 s) - the event records why (gapEscape).',
     lambda i, k, ev: ev[k][1] == 'yell' and ev[k][5] == 'gapEscape', fresh, 100, 60),
    ('fury', 'Fury, then spent', 'Z3: anger and frustration both high: a 4 s rampage (runs, smashes, ignores lures), then 2.5 s exhausted (the kid\'s chance).',
     lambda i, k, ev: ev[k][1] == 'fury' and after(ev, k, 'spent', 100) and (ev[k][0] - 60, ev[k][0] + 150), fresh),
    ('light', 'The searchlight finds the kid', 'L1-L3: the giant hangs its light over where it thinks the kid is; caught in the open, the monster is told exactly where.',
     lambda i, k, ev: ev[k][1] == 'beamSpot', fresh, 90, 80),
    ('hand', 'The giant\'s hand: grabbed', 'H1-H3: from two candles out, the giant reaches in; its shadow spreads 2.2 s; in the open, the kid is taken.',
     lambda i, k, ev: ev[k][1] == 'grabbed', fresh, 90, 20),
    ('hand-miss', 'The giant\'s hand: it misses', 'H2, H3: the hand comes down where the kid is not (or the kid is under a table); a miss frustrates it.',
     lambda i, k, ev: ev[k][1] == 'grab' and not after(ev, k, 'grabbed', 2), fresh, 90, 40),
    ('lure', 'A thrown toy lures it away', 'N4: the kid throws a toy; it lands with a clatter heard 13 m off; the monster (a hound especially) goes to look.',
     lambda i, k, ev: ev[k][1] == 'land' and after(ev, k, 'tactic', 20, lambda t: t[5].startswith('hunt:heard')) and (ev[k][0] - 60, ev[k][0] + 100), persona('hound')),
    ('refused', 'A door that will not shut', 'D3: a toy (or someone) is in the doorway, so the door will not shut. Nothing happens is also a rule.',
     lambda i, k, ev: ev[k][1] == 'shutRefused', fresh, 60, 40),
    ('stalker', 'Stalker: cuts you off at a candle', 'Persona: the smart one predicts where the kid is going and waits at that candle (tactic intercept).',
     lambda i, k, ev: ev[k][1] == 'tactic' and ev[k][5].startswith('intercept:'), persona('stalker'), 40, 180),
    ('warden', 'Warden: holds the candles', 'Persona: guards the lit candles, checks wardrobes, ignores most noises (tactic guard).',
     lambda i, k, ev: ev[k][1] == 'tactic' and ev[k][5].startswith('guard:') and ev[k][0] > 100, persona('warden'), 40, 200),
    ('chaos', 'A chaos kid: what does NOT happen', 'C6, D1, N5: random buttons at the wrong time: blowing at nothing, use with nothing near, walking into walls. The model must learn these change nothing.',
     lambda i, k, ev: ev[k][1] == 'blowNothing' and (0, min(eps[i]['rows'], 220)), lambda e: e['config']['kid']['style'] == 'chaos'),
    ('win', 'The last candle: the kid wins', 'G5: all six out wins the game (the giant sinks back into the dark).',
     lambda i, k, ev: ev[k][1] == 'won', fresh, 140, 10),
]

clips = []
for name, title, teaches, test, prefer, *w in LESSONS:
    before, aft = (w + [80, 60])[:2] if w else (80, 60)
    hit = find(test, prefer, before, aft)
    if not hit: print('no example for', name); continue
    i, a, b = hit
    b = min(b, a + 300)  # at most 15 s
    e = eps[i]
    evs = [{'row': r, 't': round((r - a) * 0.05, 2), 'type': typ, 'detail': d} for r, typ, x, z, _, d in events[i] if a <= r <= b and typ not in QUIET]
    clips.append({'name': name, 'title': title, 'teaches': teaches, 'episode': i, 'id': e['id'], 'from': a, 'to': b,
                  'persona': e['config']['persona']['type'], 'kid': e['config']['kid']['style'], 'skill': round(e['config']['kid']['skill'], 2),
                  'start': e['config']['start'], 'outcome': e['outcome'], 'events': evs})
    print(f'{name:12s} v1:{i} rows {a}-{b} ({(b - a) * 0.05:.1f} s) {e["config"]["persona"]["type"]} vs {e["config"]["kid"]["style"]}')
os.makedirs(OUT, exist_ok=True)
json.dump({'batch': BATCH, 'clips': clips}, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
print(f'{len(clips)} clips -> {OUT}')
