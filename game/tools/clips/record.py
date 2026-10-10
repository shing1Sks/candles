"""Record the picked clips (manifest.json) as videos: each moment is replayed in the game's own renderer (the whole board
revealed), one exact 50 ms frame at a time (the page runs in manual mode and is screenshotted every frame), then
encoded to mp4 at 20 fps (real speed) with ffmpeg.

usage: python tools/clips/record.py [port=5173]    (the dev server must be running)
"""
import json, os, shutil, subprocess, sys, tempfile
from playwright.sync_api import sync_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else '5173'
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'clips')
FPS, TAIL = 20, 30  # frames per second (one game step each); frames kept after the clip ends
man = json.load(open(os.path.join(OUT, 'manifest.json')))

with sync_playwright() as p:
    b = p.chromium.launch(headless=False, args=['--window-position=0,0'])
    page = b.new_page(viewport={'width': 1280, 'height': 720})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    for c in man['clips']:
        errors.clear()
        tmp = tempfile.mkdtemp(prefix='clip-')
        url = f"http://localhost:{PORT}/?watch={man['batch']}:{c['episode']}&from={c['from']}&to={c['to']}&rec=1&manual=1&zoom=0.4&reveal=1"
        page.goto(url)
        page.wait_for_function("window.__g && window.__g.ep && window.__g.phase !== 'title'", timeout=60000)
        for _ in range(10): page.evaluate('window.__frame(0.05)')  # settle the camera and lights on the first moment
        n, tail = 0, 0
        while n < 600 and tail < TAIL:
            page.evaluate('window.__frame(0.05)')
            page.screenshot(path=os.path.join(tmp, f'f{n:05d}.jpg'), type='jpeg', quality=85)
            n += 1
            if page.evaluate("window.__clipDone || window.__g.G.state !== 'play'"): tail += 1
        mp4, jpg = os.path.join(OUT, c['name'] + '.mp4'), os.path.join(OUT, c['name'] + '.jpg')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(tmp, 'f%05d.jpg'),
                        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], check=True)
        shutil.copy(os.path.join(tmp, f'f{min(n - 1, 30):05d}.jpg'), jpg)
        shutil.rmtree(tmp, ignore_errors=True)
        c['video'], c['poster'], c['seconds'] = c['name'] + '.mp4', c['name'] + '.jpg', round(n / FPS, 1)
        print(f"{c['name']:12s} {n / FPS:5.1f} s  {'ERRORS ' + '; '.join(errors) if errors else 'ok'}", flush=True)
    b.close()
json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
print('done')
