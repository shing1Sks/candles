"""The main model: the whole game as pieces (tokens) through a transformer in two stages.

Stage A reads the state alone (every piece, the monster type, and the 5 x 5 tiles round each mover) and predicts the
giant's buttons: the monster decides without seeing your input. Stage B adds your input and the giant's buttons and
predicts the next state of every piece, plus the step's events. One forward pass in training; at play time stage A
runs, its buttons are drawn, then stage B.

Numbers are predicted as their change, on a symlog scale, as odds over bins ("two-hot"): one network handles a
kid moving 4 mm and a timer resetting, and it can say "left or right" when the game is random.
"""
import math
import torch
import torch.nn as nn
import torch.nn.functional as F

NB = 96  # bins per number
SCALE = 1e-3  # changes are measured in thousandths of the stored unit before symlog
BINS = torch.linspace(-7.5, 7.5, NB)  # symlog(1 / 1e-3) = 6.9: covers any change of a stored value up to ~1.8


def symlog(x): return torch.sign(x) * torch.log1p(x.abs())
def symexp(x): return torch.sign(x) * torch.expm1(x.abs())


def two_hot(y, bins):
    """soft targets: y split between its two nearest bins"""
    y = y.clamp(bins[0], bins[-1])
    hi = torch.searchsorted(bins, y.contiguous()).clamp(1, len(bins) - 1)
    lo = hi - 1
    w = (y - bins[lo]) / (bins[hi] - bins[lo])
    t = torch.zeros(*y.shape, len(bins), device=y.device)
    t.scatter_(-1, lo.unsqueeze(-1), (1 - w).unsqueeze(-1))
    t.scatter_add_(-1, hi.unsqueeze(-1), w.unsqueeze(-1))
    return t


class Block(nn.Module):
    def __init__(s, d, heads):
        super().__init__()
        s.h = heads
        s.n1, s.n2 = nn.LayerNorm(d), nn.LayerNorm(d)
        s.qkv, s.o = nn.Linear(d, 3 * d), nn.Linear(d, d)
        s.f1, s.f2 = nn.Linear(d, 4 * d), nn.Linear(4 * d, d)

    def forward(s, x):
        B, T, D = x.shape
        q, k, v = s.qkv(s.n1(x)).view(B, T, 3, s.h, D // s.h).permute(2, 0, 3, 1, 4)
        x = x + s.o(F.scaled_dot_product_attention(q, k, v).transpose(1, 2).reshape(B, T, D))
        return x + s.f2(F.gelu(s.f1(s.n2(x))))


# the giant's buttons: sticks and aims as bins, buttons as yes/no
GI_STICK, GI_AIM = 21, 32
GI_BUTTONS = ['run', 'lunge', 'use', 'bash', 'yell', 'light', 'reach']


class WorldModel(nn.Module):
    def __init__(s, schema, d=256, layers_a=4, layers_b=4, heads=None, fourier=0):
        super().__init__()
        s.S, s.d, s.fourier = schema, d, fourier
        heads = heads or max(2, d // 64)
        s.register_buffer('bins', BINS.clone(), persistent=False)
        # positions (fields stored as a share of the house's width or depth) also go in as sines and cosines at
        # `fourier` frequencies: sight, walls and doorways are sharp facts about places, which a plain linear code of
        # x and z represents poorly (as in NeRF)
        s.pos = {}
        for k in schema.kinds:
            cols, o = [], 0
            for f in k['fields']:
                if f['type'] == 'num' and f.get('scale') in (schema.map['w'], schema.map['h']): cols.append(o)
                o += f.get('n', 1) if f['type'] == 'cat' else 1
            s.pos[k['kind']] = cols if fourier else []
        s.register_buffer('freqs', (2.0 ** torch.arange(max(1, fourier))) * math.pi, persistent=False)
        s.inp = nn.ModuleDict({k['kind']: nn.Linear(k['width'] + 2 * fourier * len(s.pos[k['kind']]), d) for k in schema.kinds})
        s.out = nn.ModuleDict({k['kind']: nn.Linear(d, len(k['num']) * NB + len(k['flag']) + sum(n for _, n in k['cat'])) for k in schema.kinds})
        s.slot = nn.Embedding(schema.n_tokens, d)  # which piece (candle 3, door 7)
        s.persona = nn.Linear(len(schema.traits) + 6, d)
        s.ki = nn.Linear(len(schema.ki), d)
        s.gi = nn.Linear(len(schema.gi), d)
        s.qa, s.qb = nn.Parameter(torch.randn(d) * 0.02), nn.Parameter(torch.randn(d) * 0.02)
        # the 5 x 5 tiles round each mover (kid, monster, 7 toys); type n = a shut door, n + 1 = off the map
        M = schema.map
        s.n_types = len(M['tileTypes'])
        s.register_buffer('tiles', torch.tensor(M['tiles'], dtype=torch.long).view(M['h'], M['w']), persistent=False)
        s.register_buffer('door_at', torch.tensor(M['doorAt'], dtype=torch.long).view(M['h'], M['w']), persistent=False)
        s.tile_emb = nn.Embedding(s.n_types + 2, 8)
        s.patch = nn.Linear(25 * 8, d)
        s.blocks_a = nn.ModuleList([Block(d, heads) for _ in range(layers_a)])
        s.blocks_b = nn.ModuleList([Block(d, heads) for _ in range(layers_b)])
        s.norm_a, s.norm_b = nn.LayerNorm(d), nn.LayerNorm(d)
        s.giant = nn.Linear(d, 4 * GI_STICK + 2 * GI_AIM + len(GI_BUTTONS))
        s.events = nn.Linear(d, len(schema.events))
        # columns used for the tile patches
        s.mover_cols = [('kid', 0), ('monster', 0)] + [('toy', i) for i in range(7)]
        s.register_buffer('mover_x', torch.tensor([schema.field(k, 'x', i) for k, i in s.mover_cols]), persistent=False)
        s.register_buffer('mover_z', torch.tensor([schema.field(k, 'z', i) for k, i in s.mover_cols]), persistent=False)
        s.register_buffer('door_open', torch.tensor([schema.field('door', 'open', i) for i in range(schema.by_kind['door']['count'])]), persistent=False)
        s.mover_tok = [schema.by_kind[k]['first'] + i for k, i in s.mover_cols]
        place = torch.zeros(schema.n_tokens, len(s.mover_tok))
        for j, t in enumerate(s.mover_tok): place[t, j] = 1
        s.register_buffer('place', place, persistent=False)

    def patch_ids(s, cur):
        """tile types in the 5 x 5 round each mover, shut doors marked (the game computes the same in JS)"""
        M = s.S.map
        x = torch.floor(cur[:, s.mover_x] * M['w']).long()
        z = torch.floor(cur[:, s.mover_z] * M['h']).long()
        off = torch.arange(-2, 3, device=cur.device)
        gx = (x.unsqueeze(-1).unsqueeze(-2) + off.view(1, 1, 1, 5))  # B, movers, 1, 5
        gz = (z.unsqueeze(-1).unsqueeze(-1) + off.view(1, 1, 5, 1))  # B, movers, 5, 1
        gx, gz = gx.expand(-1, -1, 5, 5), gz.expand(-1, -1, 5, 5)
        inside = (gx >= 0) & (gx < M['w']) & (gz >= 0) & (gz < M['h'])
        cx, cz = gx.clamp(0, M['w'] - 1), gz.clamp(0, M['h'] - 1)
        t = s.tiles[cz, cx]
        d = s.door_at[cz, cx]
        shut = (d >= 0) & (cur[:, s.door_open].gather(1, d.clamp(min=0).flatten(1)).view_as(d) < 0.5)
        t = torch.where(shut, s.n_types, t)
        return torch.where(inside, t, s.n_types + 1)  # B, movers, 5, 5

    def tokens(s, cur, ids=None):
        B = cur.shape[0]
        if ids is None: ids = s.patch_ids(cur)
        out = []
        for k in s.S.kinds:
            x = cur[:, k['offset']: k['offset'] + k['count'] * k['width']].view(B, k['count'], k['width'])
            if s.pos[k['kind']]:
                a = x[..., s.pos[k['kind']]].unsqueeze(-1) * s.freqs  # B, count, positions, fourier
                x = torch.cat([x, torch.sin(a).flatten(2), torch.cos(a).flatten(2)], -1)
            out.append(s.inp[k['kind']](x))
        if ids.is_floating_point():  # tile ids as floats (the play graphs: no integer ops, which WebGPU runs on the CPU)
            e = (ids.unsqueeze(-1) == torch.arange(s.n_types + 2, device=ids.device, dtype=ids.dtype)).to(cur.dtype) @ s.tile_emb.weight
        else: e = s.tile_emb(ids)
        patches = s.patch(e.flatten(2))  # B, movers, d
        # added to the movers' pieces through a fixed placement matrix (no in-place writes: friendlier to export)
        return torch.cat(out, 1) + s.slot.weight.unsqueeze(0) + torch.einsum('nm,bmd->bnd', s.place, patches)

    def forward(s, cur, ki, gi, persona, ids=None):
        B = cur.shape[0]
        n = s.S.n_tokens
        a = torch.cat([s.tokens(cur, ids), s.persona(persona).unsqueeze(1), s.qa.expand(B, 1, -1)], 1)
        for blk in s.blocks_a: a = blk(a)
        a = s.norm_a(a)
        giant = s.giant(a[:, -1])
        b = torch.cat([a[:, : n + 1], s.ki(ki).unsqueeze(1), s.gi(gi).unsqueeze(1), s.qb.expand(B, 1, -1)], 1)
        for blk in s.blocks_b: b = blk(b)
        b = s.norm_b(b)
        heads = {}
        for k in s.S.kinds:
            h = b[:, k['first']: k['first'] + k['count']]
            heads[k['kind']] = s.out[k['kind']](h)
        return dict(world=heads, events=s.events(b[:, -1]), giant=giant)


def split_head(k, y):
    """a piece's output -> (num logits [.., n_num, NB], flag logits [.., n_flag], [cat logits ...])"""
    nn_, nf = len(k['num']), len(k['flag'])
    num = y[..., : nn_ * NB].unflatten(-1, (nn_, NB))
    flag = y[..., nn_ * NB: nn_ * NB + nf]
    cats, o = [], nn_ * NB + nf
    for _, n in k['cat']:
        cats.append(y[..., o: o + n]); o += n
    return num, flag, cats


def piece(k, X):
    return X[:, k['offset']: k['offset'] + k['count'] * k['width']].unflatten(1, (k['count'], k['width']))


def gi_targets(gi):
    """the giant's recorded buttons -> bin / flag targets (sticks in [-1, 1], aims as stored x/w, z/h)"""
    stick = ((gi[:, [0, 1, 11, 12]] + 1) / 2 * (GI_STICK - 1)).round().long().clamp(0, GI_STICK - 1)
    aim = ((gi[:, [9, 10]] + 0.1) / 1.2 * (GI_AIM - 1)).round().long().clamp(0, GI_AIM - 1)
    buttons = gi[:, 2:9]
    return stick, aim, buttons


def losses(model, out, batch):
    """per-sample losses (weighted later): the world (numbers, flags, choices), the events, the giant's buttons"""
    S, cur, nxt = model.S, batch['cur'], batch['nxt']
    B = cur.shape[0]
    num_l, flag_l, cat_l = cur.new_zeros(B), cur.new_zeros(B), cur.new_zeros(B)
    n_num = n_flag = n_cat = 0
    for k in S.kinds:
        num, flag, cats = split_head(k, out['world'][k['kind']].float())
        c, x = piece(k, cur), piece(k, nxt)
        if k['num']:
            d = x[..., k['num']] - c[..., k['num']]
            t = two_hot(symlog(d / SCALE), model.bins)
            num_l = num_l + (-(t * F.log_softmax(num, -1)).sum(-1)).sum((1, 2))
            n_num += k['count'] * len(k['num'])
        if k['flag']:
            flag_l = flag_l + F.binary_cross_entropy_with_logits(flag, x[..., k['flag']], reduction='none').sum((1, 2))
            n_flag += k['count'] * len(k['flag'])
        for (o, n), logit in zip(k['cat'], cats):
            cat_l = cat_l + F.cross_entropy(logit.flatten(0, 1), x[..., o: o + n].argmax(-1).flatten(), reduction='none').view(B, -1).sum(1)
            n_cat += k['count']
    ev_l = F.binary_cross_entropy_with_logits(out['events'].float(), batch['ev'], reduction='none').mean(1)
    g = out['giant'].float()
    stick, aim, buttons = gi_targets(batch['gi'])
    gl = sum(F.cross_entropy(g[:, i * GI_STICK:(i + 1) * GI_STICK], stick[:, i], reduction='none') for i in range(4)) / 4
    o = 4 * GI_STICK
    aiming = (buttons[:, 5] + buttons[:, 6]).clamp(max=1)  # aim only matters when it uses the light or the hand
    gl = gl + aiming * sum(F.cross_entropy(g[:, o + i * GI_AIM: o + (i + 1) * GI_AIM], aim[:, i], reduction='none') for i in range(2)) / 2
    o += 2 * GI_AIM
    gl = gl + F.binary_cross_entropy_with_logits(g[:, o:], buttons, reduction='none').mean(1)
    return dict(num=num_l / n_num, flag=flag_l / n_flag, cat=cat_l / max(1, n_cat), events=ev_l, giant=gl)


@torch.no_grad()
def predict_next(model, out, cur, sample=False, temp=1.0):
    """the predicted next state row: numbers from their bins (expected value, or a draw), flags and choices"""
    S, nxt = model.S, cur.clone()
    for k in S.kinds:
        num, flag, cats = split_head(k, out['world'][k['kind']].float())
        c = piece(k, cur)
        p = piece(k, nxt)  # a view: writing into it writes the row
        if k['num']:
            if sample:
                idx = torch.distributions.Categorical(logits=num / temp).sample()
                y = model.bins[idx]
            else:
                y = (F.softmax(num, -1) * model.bins).sum(-1)
            p[..., k['num']] = c[..., k['num']] + symexp(y) * SCALE
        if k['flag']:
            p[..., k['flag']] = (torch.sigmoid(flag) > 0.5).float() if not sample else torch.bernoulli(torch.sigmoid(flag / temp))
        for (o, n), logit in zip(k['cat'], cats):
            choice = logit.argmax(-1) if not sample else torch.distributions.Categorical(logits=logit / temp).sample()
            p[..., o: o + n] = F.one_hot(choice, n).float()
    return nxt


def param_count(m): return sum(p.numel() for p in m.parameters())
