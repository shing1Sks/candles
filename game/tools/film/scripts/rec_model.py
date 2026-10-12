# Record GameNet (v5_M_s2u + the nightmare's brain), a kid bot playing: one model step (0.1 s), then 3 frames of the
# glide to it -> 30 fps at real speed. python rec_model.py NAME BOT SECONDS [seed]
import sys, os, shutil, subprocess, time
from playwright.sync_api import sync_playwright
name, bot, secs = sys.argv[1], sys.argv[2], float(sys.argv[3]); seed = sys.argv[4] if len(sys.argv) > 4 else '11'
with sync_playwright() as p:
    b = p.chromium.launch(headless=False, args=['--enable-unsafe-webgpu'])
    pg = b.new_page(viewport={'width': 1920, 'height': 1080})
    pg.goto(f'http://localhost:5190/?model=v5_M_s2u&bot={bot}&skill=0.9&rec=1&manual=1&nointro=1&dist=3.4&seed={seed}')
    pg.wait_for_function("window.__g && window.__g.dream && window.__g.phase === 'play'", timeout=300000)
    pg.add_style_tag(content='#badge,#prompt,#hints,#corner,#end,#pause{display:none!important}')
    for _ in range(10): pg.evaluate('window.__dreamDraw(1, 0)')
    d = f'frames/{name}'; shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
    k = 0; t0 = time.time(); steps = int(secs * 10)
    for s in range(steps):
        pg.evaluate('window.__dreamStep()')
        for j in (1, 2, 3):
            pg.evaluate(f'window.__dreamDraw({j / 3}, {0.1 / 3})')
            pg.screenshot(path=f'{d}/{k:05d}.jpg', type='jpeg', quality=93); k += 1
        if s % 50 == 0: print(name, s, pg.evaluate('[window.__g.G.state, window.__g.G.candles.filter(c => !c.lit).length, +Math.hypot(window.__g.G.kid.x - window.__g.G.monster.x, window.__g.G.kid.z - window.__g.G.monster.z).toFixed(1)]'), f'{time.time() - t0:.0f}s', flush=True)
        if pg.evaluate('window.__g.G.state') != 'play':
            for j in range(45):  # the catch's flash and darkening
                pg.evaluate(f'window.__dreamDraw(1, {1 / 30})'); pg.screenshot(path=f'{d}/{k:05d}.jpg', type='jpeg', quality=93); k += 1
            break
    print(name, 'end', pg.evaluate('window.__g.G.state'), k, 'frames')
    b.close()
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '30', '-i', f'frames/{name}/%05d.jpg', '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', f'shots/{name}.mp4'], check=True)
