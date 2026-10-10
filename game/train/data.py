"""The recorded games as tensors: every transition (state r, both inputs, the events of step r) -> state r + 1.

Reads a batch written by tools/gen.mjs (data/<batch>/shard-*/), keeps it all in memory (on the GPU when there is
one), splits by episode (5% check, 5% exam, the rest training) and hands out random batches.
"""
import glob, json, math, os
import numpy as np
import torch


class Schema:
    """The row layout (schema.json): for each kind of piece, where its num / flag / cat fields sit."""

    def __init__(self, path):
        s = json.load(open(path))
        self.raw, self.size = s, s['stateSize']
        self.kinds = []
        tok = 0
        for t in s['tokens']:
            num, flag, cat, o = [], [], [], 0
            for f in t['fields']:
                if f['type'] == 'num': num.append(o); o += 1
                elif f['type'] == 'flag': flag.append(o); o += 1
                else: cat.append((o, f['n'])); o += f['n']
            self.kinds.append(dict(kind=t['kind'], count=t['count'], width=t['width'], offset=t['offset'], first=tok,
                                   num=num, flag=flag, cat=cat, fields=t['fields']))
            tok += t['count']
        self.n_tokens = tok
        self.by_kind = {k['kind']: k for k in self.kinds}
        self.events = s['eventTypes']
        self.ki, self.gi = s['kiFields'], s['giFields']
        self.traits = s.get('personaTraits', [])
        self.map = s['map']

    def field(self, kind, name, i=0):
        """the column of a field in the state row (cat fields: the first column of the one-hot)"""
        k = self.by_kind[kind]
        o = 0
        for f in k['fields']:
            if f['name'] == name: return k['offset'] + i * k['width'] + o
            o += f.get('n', 1) if f['type'] == 'cat' else 1
        raise KeyError(name)


PERSONA_TYPES = ['classic', 'pathfinder', 'brute', 'stalker', 'hound', 'warden']


class Data:
    def __init__(self, root, device='cpu', frac=1.0, seed=0):
        self.schema = S = Schema(os.path.join(root, 'schema.json'))
        states, ki, gi, ev, cur, ep_of, persona, split = [], [], [], [], [], [], [], []  # cur/ep_of/split: numpy pieces
        base_s = base_i = 0
        eps = []
        for shard in sorted(glob.glob(os.path.join(root, 'shard-*'))):
            X = np.fromfile(os.path.join(shard, 'states.f32'), np.float32).reshape(-1, S.size)
            K = np.fromfile(os.path.join(shard, 'ki.f32'), np.float32).reshape(-1, len(S.ki))
            Gi = np.fromfile(os.path.join(shard, 'gi.f32'), np.float32).reshape(-1, len(S.gi))
            E = np.zeros((len(K), len(S.events)), np.uint8)
            evlines = {}
            for line in open(os.path.join(shard, 'events.jsonl')):
                d = json.loads(line); evlines[d['i']] = d['events']
            for line in open(os.path.join(shard, 'episodes.jsonl')):
                e = json.loads(line)
                for r, t, *_ in evlines.get(e['i'], []): E[e['inputRow'] + r, t] = 1
                p = e.get('persona') or {}
                vec = [float(p.get(k, 0.0)) for k in S.traits] + [1.0 if p.get('type', e['config']['persona']['type']) == t else 0.0 for t in PERSONA_TYPES]
                sp = 1 if e['i'] % 20 == 0 else 2 if e['i'] % 20 == 1 else 0  # 0 train, 1 check, 2 exam
                eps.append(dict(i=e['i'], rows=e['rows'], split=sp, persona=e['config']['persona']['type'], kid=e['config']['kid']['style'], outcome=e['outcome']))
                cur.append(base_s + e['stateRow'] + np.arange(e['rows']))
                ep_of.append(np.full(e['rows'], len(eps) - 1))
                persona.append(vec)
                split.append(np.full(e['rows'], sp))
            states.append(X); ki.append(K); gi.append(Gi); ev.append(E)
            base_s += len(X); base_i += len(K)
        self.episodes = eps
        dev = torch.device(device)
        self.states = torch.from_numpy(np.concatenate(states)).to(dev)
        self.ki = torch.from_numpy(np.concatenate(ki)).to(dev)
        self.gi = torch.from_numpy(np.concatenate(gi)).to(dev)
        self.ev = torch.from_numpy(np.concatenate(ev)).to(dev)
        self.cur = torch.from_numpy(np.concatenate(cur)).long().to(dev)
        self.ep_of = torch.from_numpy(np.concatenate(ep_of)).long().to(dev)
        self.persona = torch.tensor(np.array(persona, np.float32), device=dev)  # one row per episode
        split = torch.from_numpy(np.concatenate(split)).to(dev)
        g = torch.Generator().manual_seed(seed)
        self.idx = {}
        for name, code in (('train', 0), ('check', 1), ('exam', 2)):
            ix = torch.nonzero(split == code).squeeze(1)
            if name == 'train' and frac < 1.0:
                # a fraction of the training episodes (whole episodes, not rows)
                keep_eps = [k for k, e in enumerate(eps) if e['split'] == 0]
                perm = torch.randperm(len(keep_eps), generator=g)[: max(1, int(len(keep_eps) * frac))]
                chosen = torch.zeros(len(eps), dtype=torch.bool)
                chosen[torch.tensor(keep_eps)[perm]] = True
                ix = ix[chosen.to(dev)[self.ep_of[ix]]]
            self.idx[name] = ix
        # rows whose next row is the same game's next step (two steps in a row, for rollout training)
        same = torch.zeros(len(self.ep_of), dtype=torch.bool, device=dev)
        same[:-1] = self.ep_of[1:] == self.ep_of[:-1]
        self.idx2 = {k: v[same[v]] for k, v in self.idx.items()}
        self.weight = self._weights()
        self.gen = torch.Generator(device=dev).manual_seed(seed)

    def _weights(self):
        """Down-weight standoffs (the kid still in cover beside the monster); up-weight rows with rare events."""
        S, X = self.schema, self.states[self.cur]
        crawl = X[:, S.field('kid', 'crawl')] > 0.5
        speed = torch.hypot(X[:, S.field('kid', 'vx')], X[:, S.field('kid', 'vz')]) * 4  # vx is stored / 4
        dx = (X[:, S.field('kid', 'x')] - X[:, S.field('monster', 'x')]) * S.map['w']
        dz = (X[:, S.field('kid', 'z')] - X[:, S.field('monster', 'z')]) * S.map['h']
        standoff = crawl & (speed < 0.1) & (X[:, S.field('monster', 'awake')] > 0.5) & (torch.hypot(dx, dz) < 3)
        w = torch.where(standoff, 0.5, 1.0)
        freq = self.ev.float().mean(0).clamp_min(1e-7)
        bonus = (torch.log10(1.0 / freq) - 2).clamp(0, 3)  # events in under 1% of rows earn up to +3
        w = w + (self.ev.float() * bonus).sum(1)
        return w.clamp(max=5.0)

    def batch(self, split, B):
        ix = self.idx[split]
        pick = ix[torch.randint(len(ix), (B,), generator=self.gen, device=ix.device)]
        c = self.cur[pick]
        return dict(cur=self.states[c], nxt=self.states[c + 1], ki=self.ki[pick], gi=self.gi[pick], ev=self.ev[pick].float(),
                    persona=self.persona[self.ep_of[pick]], w=self.weight[pick])

    def batch2(self, split, B):
        """two steps in a row of the same games: (step 1, step 2); step 2's cur is step 1's nxt"""
        ix = self.idx2[split]
        pick = ix[torch.randint(len(ix), (B,), generator=self.gen, device=ix.device)]
        return [self._rows(pick), self._rows(pick + 1)]

    def _rows(self, pick):
        c = self.cur[pick]
        return dict(cur=self.states[c], nxt=self.states[c + 1], ki=self.ki[pick], gi=self.gi[pick], ev=self.ev[pick].float(),
                    persona=self.persona[self.ep_of[pick]], w=self.weight[pick])

    def sizes(self):
        return {k: len(v) for k, v in self.idx.items()}
