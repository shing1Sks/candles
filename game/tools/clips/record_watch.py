"""Record a game by the rules (?watch=BATCH:I, its kid bot playing) against a chosen monster as a video at real speed,
the whole board revealed, one exact 50 ms frame at a time.

usage: python tools/clips/record_watch.py BATCH:I NAME [--persona nightmare] [--seconds 60] [--port 5173]
-> public/clips/NAME.mp4 (and NAME.jpg, and NAME_sheet.jpg: 12 frames on one sheet, for a quick look)
"""
import argparse, os, shutil, subprocess, tempfile
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument('episode'); ap.add_argument('name')
ap.add_argument('--persona', default='nightmare'); ap.add_argument('--seconds', type=float, default=60); ap.add_argument('--port', default='5173')
a = ap.parse_args()
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'clips')
FPS, TAIL = 20, 30

with sync_playwright() as p:
    b = p.chromium.launch(headless=False, args=['--window-position=0,0'])
    page = b.new_page(viewport={'width': 1280, 'height': 720})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(f"http://localhost:{a.port}/?watch={a.episode}&persona={a.persona}&rec=1&manual=1&zoom=0.4&reveal=1")
    page.wait_for_function("window.__g && window.__g.ep && window.__g.phase !== 'title'", timeout=60000)
    page.wait_for_timeout(2000)  # the nightmare's weights load
    for _ in range(10): page.evaluate('window.__frame(0.05)')
    tmp = tempfile.mkdtemp(prefix='watch-')
    n, tail = 0, 0
    while n < a.seconds * FPS and tail < TAIL:
        page.evaluate('window.__frame(0.05)')
        page.screenshot(path=os.path.join(tmp, f'f{n:05d}.jpg'), type='jpeg', quality=85)
        n += 1
        if page.evaluate("window.__g.G.state !== 'play'"): tail += 1
    state = page.evaluate("[window.__g.G.state, window.__g.G.candles.filter((c) => !c.lit).length]")
    b.close()
mp4, jpg = os.path.join(OUT, a.name + '.mp4'), os.path.join(OUT, a.name + '.jpg')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(tmp, 'f%05d.jpg'),
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], check=True)
shutil.copy(os.path.join(tmp, f'f{min(n - 1, 60):05d}.jpg'), jpg)
step = max(1, n // 12)
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(tmp, 'f%05d.jpg'), '-vf',
                f"select='not(mod(n\\,{step}))',scale=640:-1,tile=4x3", '-frames:v', '1', os.path.join(OUT, a.name + '_sheet.jpg')], check=True)
shutil.rmtree(tmp, ignore_errors=True)
print(f'{a.name}: {n / FPS:.1f} s, ended {state[0]} with {state[1]} candles out', 'ERRORS ' + '; '.join(errors) if errors else 'ok')
