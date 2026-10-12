# Cut the film: shots/*.mp4 -> out/candles.mp4 (1920x1080, 30 fps) with its sound.
#   python edit.py D_SHOT D_START D_SECONDS
import sys, os, subprocess, json
FPS, W, H = 30, 1920, 1080
D_SHOT, D_START, D_LEN = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
AUD = '../../game/public/audio/'
GEORGIA = 'C\\:/Windows/Fonts/georgia.ttf'
SANS = 'C\\:/Windows/Fonts/segoeuisl.ttf' if os.path.exists('C:/Windows/Fonts/segoeuisl.ttf') else 'C\\:/Windows/Fonts/segoeui.ttf'
SANSB = 'C\\:/Windows/Fonts/seguisb.ttf' if os.path.exists('C:/Windows/Fonts/seguisb.ttf') else SANS
os.makedirs('out', exist_ok=True); os.makedirs('parts', exist_ok=True)
GRADE = 'eq=gamma=1.32:contrast=1.07:saturation=0'
spaced = lambda s: '\u200a'.join(s.upper())

def run(args):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-y', *args])
    if r.returncode: sys.exit(r.returncode)

def dur(f):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout)

def part(name, src, start, length, vf='', fin=0, fout=0):
    f = [f'trim=start={start}:duration={length}', 'setpts=PTS-STARTPTS', f'scale={W}:{H}', f'fps={FPS}']
    if vf: f.append(vf)
    if fin: f.append(f'fade=t=in:st=0:d={fin}')
    if fout: f.append(f'fade=t=out:st={length - fout}:d={fout}')
    run(['-i', src, '-vf', ','.join(f), '-an', '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', f'parts/{name}.mp4'])
    return (f'parts/{name}.mp4', length)

def textfile(name, s):
    open(f'parts/{name}.txt', 'w', encoding='utf-8').write(s); return f'parts/{name}.txt'

def counter(n, label):  # the count, as the drawn grid shows it
    tn, tl = textfile(f'n{n}', f'{n:,}'), textfile(f'l{n}', spaced(label))
    return (f"drawbox=x={(W - 660) // 2}:y={H - 210}:w=660:h=150:color=black@0.62:t=fill,"
            f"drawtext=fontfile='{GEORGIA}':textfile={tn}:fontsize=84:fontcolor=0xf2f2f2:x=(w-text_w)/2:y={H - 112}-ascent,"
            f"drawtext=fontfile='{SANSB}':textfile={tl}:fontsize=18:fontcolor=0x9a9a9a:x=(w-text_w)/2:y={H - 76}-ascent")

parts = []
# A: the game
A = [('a1_intro', 0.3, 4.0), ('a2_candle', 0.2, 2.2), ('a3_beam', 0.2, 2.0), ('a4_hand', 0.7, 2.5), ('a5_roar', 0.2, 2.0), ('a6_found', 0.0, 1.9), ('a7_lunge', 0.0, 1.8)]
for i, (n, s, l) in enumerate(A):
    parts.append(part(n, f'shots/{n}.mp4', s, l, GRADE, fin=0.8 if i == 0 else 0))
a_end = sum(p[1] for p in parts)
# B: it multiplies: 4, 16 (the 3D games), then the drawn grid
tiles = [f'shots/b_{k:02d}.mp4' for k in range(16)]
def grid(name, files, n, start, length, label):
    cols = int(len(files) ** 0.5); tw, th = W // cols, H // cols
    ins = sum([['-i', f] for f in files], [])
    pre = ''.join(f'[{k}:v]trim=start={start}:duration={length},setpts=PTS-STARTPTS,scale={tw - 4}:{th - 4},pad={tw}:{th}:2:2:black,fps={FPS}[t{k}];' for k in range(len(files)))
    lay = '|'.join(f'{(k % cols) * tw}_{(k // cols) * th}' for k in range(len(files)))
    fc = pre + ''.join(f'[t{k}]' for k in range(len(files))) + f'xstack=inputs={len(files)}:layout={lay},{GRADE},{counter(n, label)}[v]'
    run([*ins, '-filter_complex', fc, '-map', '[v]', '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', f'parts/{name}.mp4'])
    return (f'parts/{name}.mp4', length)
parts.append(grid('b_4', tiles[:4], 4, 0.6, 1.6, 'bots playing the real game'))
parts.append(grid('b_16', tiles, 16, 1.3, 1.8, 'bots playing the real game'))
parts.append(part('b_grid', 'shots/grid.mp4', 0, dur('shots/grid.mp4'), fout=0.5))
b_end = sum(p[1] for p in parts)
# C: the rules, replaced
c_len = dur('shots/rules.mp4')
parts.append(part('c_rules', 'shots/rules.mp4', 0, c_len, fin=0.5, fout=0.5))
c_end = sum(p[1] for p in parts)
# D: the final thing, with a line on it
k1, k2 = textfile('dk', spaced('GameNet')), textfile('dl', "every frame here is the network's guess")
cap = (f"drawtext=fontfile='{SANSB}':textfile={k1}:fontsize=17:fontcolor=0xa0a0a0:x=96:y={H - 168}-ascent:alpha='min(1,max(0,(t-0.6)/0.5))*min(1,max(0,(4.6-t)/0.5))',"
       f"drawtext=fontfile='{GEORGIA}':textfile={k2}:fontsize=40:fontcolor=0xeeeeee:x=96:y={H - 118}-ascent:alpha='min(1,max(0,(t-0.8)/0.5))*min(1,max(0,(4.8-t)/0.5))'")
parts.append(part('d_gamenet', f'shots/{D_SHOT}.mp4', D_START, D_LEN, GRADE + ',' + cap, fin=0.4, fout=0.6))
d_end = sum(p[1] for p in parts)
parts.append(part('e_card', 'shots/card.mp4', 0, dur('shots/card.mp4')))
total = sum(p[1] for p in parts)

open('parts/list.txt', 'w').write(''.join(f"file '{os.path.basename(p)}'\n" for p, _ in parts))
run(['-f', 'concat', '-safe', '0', '-i', 'parts/list.txt', '-c', 'copy', 'parts/video.mp4'])

# sound: the house's drone all through; the chase music while it multiplies; hits on the moments
at = {n: sum(p[1] for p in parts[:i]) for i, (n, _, _) in enumerate(A)}
hits = [  # (file, time, volume, filter)
    ('cat_growl.ogg', at['a5_roar'] + 0.62, 1.0, 'asetrate=44100*0.5,aresample=44100'),
    ('door_creak.ogg', at['a6_found'] + 0.55, 0.8, ''),
    ('stinger_rush.ogg', at['a7_lunge'] + 1.15, 1.0, ''),
    ('sfx_stinger_dark.ogg', c_end - c_len + 1.0 + 6 * 2.0 + 0.2, 0.9, ''),
]
ins = ['-i', AUD + 'music_corridor_drone_1.ogg', '-i', AUD + 'music_dread_high.ogg'] + sum([['-i', AUD + h[0]] for h in hits], [])
fc = (f'[0:a]atrim=0:{total},afade=t=in:d=2,afade=t=out:st={total - 3}:d=3,volume=1.1[drone];'
      f'[1:a]atrim=0:{c_end - a_end},afade=t=in:d=1.2,afade=t=out:st={c_end - a_end - 4}:d=4,volume=0.75,adelay={int(a_end * 1000)}|{int(a_end * 1000)}[chase];')
for k, (f, t, v, extra) in enumerate(hits):
    fc += f"[{k + 2}:a]{extra + ',' if extra else ''}volume={v},adelay={int(t * 1000)}|{int(t * 1000)}[h{k}];"
fc += '[drone][chase]' + ''.join(f'[h{k}]' for k in range(len(hits))) + f'amix=inputs={2 + len(hits)}:normalize=0,alimiter=limit=0.9,atrim=0:{total}[a]'
run([*ins, '-filter_complex', fc, '-map', '[a]', '-c:a', 'aac', '-b:a', '192k', 'parts/audio.m4a'])
run(['-i', 'parts/video.mp4', '-i', 'parts/audio.m4a', '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', 'out/candles.mp4'])
print(json.dumps({'total': round(total, 2), 'a_end': round(a_end, 2), 'b_end': round(b_end, 2), 'c_end': round(c_end, 2), 'd_end': round(d_end, 2)}))
