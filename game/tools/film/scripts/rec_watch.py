# Record Classic shots: ?watch=film:i (the nightmare), frame by frame at 30 fps, no overlays -> shots/NAME.mp4
import sys, os, json, time, subprocess, shutil
from playwright.sync_api import sync_playwright
SHOTS = json.loads(open(sys.argv[1]).read())  # [{name, i, from, seconds, intro?, w?, h?}]
FPS = 30
os.makedirs('shots', exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(headless=False, args=['--window-position=0,0'])
    for s in SHOTS:
        w, h = s.get('w', 1920), s.get('h', 1080)
        pg = b.new_page(viewport={'width': w, 'height': h})
        q = f"seedpolicy=1&watch=film:{s['i']}&persona=nightmare&rec=1&manual=1&from={s['from']}" + ('' if s.get('intro') else '&nointro=1') + f"&dist={s.get('dist', 3.4)}"
        pg.goto(f'http://localhost:5190/?{q}')
        pg.wait_for_function("window.__g && window.__g.phase === 'play'", timeout=60000)
        pg.add_style_tag(content='#badge,#prompt,#hints,#corner,#end,#pause{display:none!important}')
        # the policy has loaded now: replay the game from its start so it is the one simulated in Node
        pg.evaluate('window.__g.newGame(); window.__g.begin()')
        for _ in range(20): pg.evaluate('window.__frame(0)')  # settle the camera
        d = f"frames/{s['name']}"; shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
        n = int(s['seconds'] * FPS)
        for k in range(n):
            pg.evaluate(f'window.__frame({1 / FPS})')
            pg.screenshot(path=f'{d}/{k:05d}.jpg', type='jpeg', quality=93)
        info = pg.evaluate('[window.__g.ep.rows, window.__g.G.state]')
        pg.close()
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(FPS), '-i', f'{d}/%05d.jpg', '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', f"shots/{s['name']}.mp4"], check=True)
        print(s['name'], 'rows', info[0], info[1], flush=True)
    b.close()
