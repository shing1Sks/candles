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
    def __init__(self, root, device='cpu', frac=1.0, seed=0, out=None, endgame=0.0, stride=1):
        """stride: each example spans this many recorded steps (state r -> r + stride), for a model that steps 0.05 * stride s"""
        """device: where the rows are kept; out: where batches go (rows in RAM, batches to the GPU, for data bigger than it)"""
        self.schema = S = Schema(os.path.join(root, 'schema.json'))
        ki, gi, ev, cur, ep_of, persona, split = [], [], [], [], [], [], []  # cur/ep_of/split: numpy pieces
        base_s = base_i = 0
        eps = []
        shards = sorted(glob.glob(os.path.join(root, 'shard-*')))
        # the states (most of the data) are read straight into one array: no second copy while joining shards
        total = sum(os.path.getsize(os.path.join(sh, 'states.f32')) for sh in shards) // (4 * S.size)
        all_states = np.empty((total, S.size), np.float32)
        for shard in shards:
            X = np.fromfile(os.path.join(shard, 'states.f32'), np.float32).reshape(-1, S.size)
            all_states[base_s: base_s + len(X)] = X
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
            ki.append(K); gi.append(Gi); ev.append(E)
            base_s += len(X); base_i += len(K); del X
        self.episodes = eps
        dev = torch.device(device)
        self.states = torch.from_numpy(all_states).to(dev)
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
        self._idxk = {}  # rows with k - 1 more steps of the same game after them (rollout training), made when asked
        self.endgame, self.stride = endgame, stride
        if stride > 1:  # starts with stride - 1 more steps of the same game after them
            for name in self.idx:
                ix = self.idx[name]; ix = ix[ix + stride - 1 < len(self.ep_of)]
                self.idx[name] = ix[self.ep_of[ix + stride - 1] == self.ep_of[ix]]
        self.weight = self._weights()
        self.gen = torch.Generator(device=dev).manual_seed(seed)
        self.out = torch.device(out) if out else dev

    def _weights(self):
        """Down-weight standoffs (the kid still in cover beside the monster); up-weight rows with rare events and rows
        where the monster changes its mind. Columns are gathered one at a time: whole rows for every step would be
        another copy of the data."""
        S = self.schema
        col = lambda kind, name, nxt=False: self.states[self.cur + int(nxt), S.field(kind, name)]
        crawl = col('kid', 'crawl') > 0.5
        speed = torch.hypot(col('kid', 'vx'), col('kid', 'vz')) * 4  # vx is stored / 4
        dx = (col('kid', 'x') - col('monster', 'x')) * S.map['w']
        dz = (col('kid', 'z') - col('monster', 'z')) * S.map['h']
        standoff = crawl & (speed < 0.1) & (col('monster', 'awake') > 0.5) & (torch.hypot(dx, dz) < 3)
        w = torch.where(standoff, 0.5, 1.0)
        freq = torch.stack([self.ev[:, e].float().mean() for e in range(self.ev.shape[1])]).clamp_min(1e-7)
        bonus = (torch.log10(1.0 / freq) - 2).clamp(0, 3)  # events in under 1% of rows earn up to +3
        for e in range(self.ev.shape[1]): w = w + self.ev[:, e].float() * bonus[e]
        # the monster changing its mind (its mode or what it is doing) is rare among rows and decides whether it chases:
        # those rows count double, so it learns to switch instead of staying in one mode
        for kind, name in (('mind', 'mode'), ('monster', 'act')):
            o = S.field(kind, name); n = next(f['n'] for k in S.kinds if k['kind'] == kind for f in k['fields'] if f['name'] == name)
            a = torch.stack([self.states[self.cur, o + j] for j in range(n)], 1).argmax(1)
            b = torch.stack([self.states[self.cur + 1, o + j] for j in range(n)], 1).argmax(1)
            w = w + (a != b).float()
        # the endgame: the last 1.5 s (30 steps) before a catch weigh +endgame. Catches are ~1 row in 1,700, so the
        # model got little practice at the end of a hunt (in its world the monster lunged but rarely caught)
        if self.endgame:
            rows = torch.tensor([e['rows'] for e in self.episodes], device=w.device)
            caught = torch.tensor([e['outcome'] == 'caught' for e in self.episodes], device=w.device)
            starts = torch.cumsum(rows, 0) - rows
            ep = self.ep_of.to(w.device)
            to_end = rows[ep] - 1 - (torch.arange(len(ep), device=w.device) - starts[ep])
            w = w + self.endgame * (caught[ep] & (to_end < 30)).float()
        return w.clamp(max=5.0)

    def batch(self, split, B):
        ix = self.idx[split]
        return self._rows(ix[torch.randint(len(ix), (B,), generator=self.gen, device=ix.device)])

    def batchk(self, split, B, k=2):
        """k steps in a row of the same games: [step 1, ..., step k]; each step's cur is the one before's nxt"""
        S = self.stride
        if (split, k) not in self._idxk:
            ix = self.idx[split]
            ix = ix[ix + k * S - 1 < len(self.ep_of)]
            self._idxk[(split, k)] = ix[self.ep_of[ix + k * S - 1] == self.ep_of[ix]]
        ix = self._idxk[(split, k)]
        pick = ix[torch.randint(len(ix), (B,), generator=self.gen, device=ix.device)]
        return [self._rows(pick + j * S) for j in range(k)]

    def batch2(self, split, B):
        return self.batchk(split, B, 2)

    def _rows(self, pick):
        c, S = self.cur[pick], self.stride
        b = dict(cur=self.states[c], nxt=self.states[c + S], ki=self.ki[pick], gi=self.gi[pick], ev=self.ev[pick].float(),
                 persona=self.persona[self.ep_of[pick]], w=self.weight[pick])
        if S > 1:  # the window's held inputs are its first step's; a press anywhere in it counts; its events and weight too
            ki, gi = b['ki'].clone(), b['gi'].clone()
            for j in range(1, S):
                ki[:, 4:6] = torch.maximum(ki[:, 4:6], self.ki[pick + j][:, 4:6])  # use, throw
                gi[:, 2:9] = torch.maximum(gi[:, 2:9], self.gi[pick + j][:, 2:9])  # run lunge use bash yell light reach
                b['ev'] = torch.maximum(b['ev'], self.ev[pick + j].float())
                b['w'] = torch.maximum(b['w'], self.weight[pick + j])
            b['ki'], b['gi'] = ki, gi
        return b if self.out == self.states.device else {k: v.to(self.out, non_blocking=True) for k, v in b.items()}

    def sizes(self):
        return {k: len(v) for k, v in self.idx.items()}
