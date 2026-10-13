# Render a drawn segment of film.html (head | grid | rules | card) frame by frame -> shots/SEG.mp4
#   python rec_film.py SEG [fps=30] [--preview N]: preview keeps every Nth frame as probe/SEG_kkk.jpg instead
import sys, os, shutil, subprocess, time
from playwright.sync_api import sync_playwright
seg = sys.argv[1]; fps = int(sys.argv[2]) if len(sys.argv) > 2 and not sys.argv[2].startswith('--') else 30
prev = int(sys.argv[sys.argv.index('--preview') + 1]) if '--preview' in sys.argv else 0
with sync_playwright() as p:
    b = p.chromium.launch(headless=False)
    pg = b.new_page(viewport={'width': 1920, 'height': 1080})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto('http://localhost:5190/film.html'); pg.wait_for_function('window.__film')
    pg.evaluate('window.__film.ready'); pg.evaluate(f"window.__film.start('{seg}')")
    d = f'frames/f_{seg}'; shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
    k = 0; t0 = time.time()
    while True:
        more = pg.evaluate(f'window.__film.frame({1 / fps})')
        if prev:
            if k % prev == 0: pg.screenshot(path=f'probe/{seg}_{k:04d}.jpg', type='jpeg', quality=85)
        else: pg.screenshot(path=f'{d}/{k:05d}.jpg', type='jpeg', quality=94)
        k += 1
        if not more: break
    print(seg, k, 'frames', f'{time.time() - t0:.0f} s', errs[:5])
    b.close()
    if not prev: subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(fps), '-i', f'{d}/%05d.jpg', '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', f'shots/{seg}.mp4'], check=True)
