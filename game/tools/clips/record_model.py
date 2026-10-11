"""Record a game played inside the main model's world (?model=) as a video at real speed: the page runs in manual mode,
each frame is one model step (window.__dreamFrame), screenshotted, then encoded at 20 fps with ffmpeg.

usage: python tools/clips/record_model.py MODEL NAME [--bot sneaker] [--seconds 60] [--seed 7] [--persona hound]
                                          [--query '&mind=1'] [--port 5173]
-> public/clips/NAME.mp4 (and NAME.jpg)
"""
import argparse, os, shutil, subprocess, tempfile
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument('model'); ap.add_argument('name')
ap.add_argument('--bot', default='sneaker'); ap.add_argument('--seconds', type=float, default=60)
ap.add_argument('--seed', type=int, default=7); ap.add_argument('--persona', default='')
ap.add_argument('--query', default=''); ap.add_argument('--port', default='5173')
a = ap.parse_args()
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'clips')
os.makedirs(OUT, exist_ok=True)
FPS, TAIL = 20, 40

with sync_playwright() as p:
    b = p.chromium.launch(headless=False, args=['--window-position=0,0', '--enable-unsafe-webgpu'])
    page = b.new_page(viewport={'width': 1280, 'height': 720})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    persona = f'&persona={a.persona}' if a.persona else ''
    page.goto(f"http://localhost:{a.port}/?model={a.model}&bot={a.bot}&seed={a.seed}{persona}&rec=1&manual=1&zoom=0.4&reveal=1&ep=webgpu{a.query}")
    page.wait_for_function('window.__g && window.__g.dream', timeout=120000)
    tmp = tempfile.mkdtemp(prefix='model-clip-')
    for _ in range(10): page.evaluate('window.__frame(0.05)')  # settle the camera and lights
    n, tail = 0, 0
    while n < a.seconds * FPS and tail < TAIL:
        page.evaluate('window.__dreamFrame()')
        page.screenshot(path=os.path.join(tmp, f'f{n:05d}.jpg'), type='jpeg', quality=85)
        n += 1
        if page.evaluate("window.__g.G.state !== 'play'"): tail += 1
    state = page.evaluate("[window.__g.G.state, window.__g.G.candles.filter((c) => !c.lit).length, +window.__g.G.t.toFixed(1)]")
    b.close()
mp4, jpg = os.path.join(OUT, a.name + '.mp4'), os.path.join(OUT, a.name + '.jpg')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(tmp, 'f%05d.jpg'),
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], check=True)
shutil.copy(os.path.join(tmp, f'f{min(n - 1, 60):05d}.jpg'), jpg)
shutil.rmtree(tmp, ignore_errors=True)
print(f'{a.name}: {n / FPS:.1f} s, ended {state[0]} with {state[1]} candles out at t {state[2]}', 'ERRORS ' + '; '.join(errors) if errors else 'ok')
