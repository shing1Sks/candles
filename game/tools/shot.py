"""Screenshots of the running game (headed Chromium: headless can't use the real GPU).

usage: python tools/shot.py OUT_DIR [name=query ...]
  each name=query opens /?query, starts the game, waits, and saves OUT_DIR/name.png
  extra query keys understood here (not by the game):
    wait=SECONDS  how long to let it run before the shot (default 1.5)
    keys=W,D      keys to hold during the wait
"""
import os, sys, time
from urllib.parse import parse_qs
from playwright.sync_api import sync_playwright

PORT = os.environ.get('PORT', '5190')

def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(headless=False, args=['--window-position=0,0', '--autoplay-policy=no-user-gesture-required'])
        page = b.new_page(viewport={'width': 1280, 'height': 720})
        errors = []
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e: errors.append(str(e)))
        for spec in sys.argv[2:]:
            name, _, query = spec.partition('=')
            opts = {k: v[0] for k, v in parse_qs(query).items()}
            wait = float(opts.pop('wait', 1.5))
            keys = [k for k in opts.pop('keys', '').split(',') if k]
            game_q = '&'.join(f'{k}={v}' for k, v in opts.items())
            page.goto(f'http://localhost:{PORT}/?{game_q}')
            page.wait_for_function('window.__g && window.__g.G')
            page.keyboard.press('Enter')
            for k in keys: page.keyboard.down(k)
            time.sleep(wait)
            for k in keys: page.keyboard.up(k)
            page.screenshot(path=os.path.join(out, name + '.png'))
            info = page.evaluate('(() => { const G = window.__g.G; return { t: G.t.toFixed(1), kid: [G.kid.x.toFixed(2), G.kid.z.toFixed(2)], mon: [G.monster.x.toFixed(2), G.monster.z.toFixed(2)], mode: G.monster.mode, state: G.state }; })()')
            print(name, info)
        if errors: print('ERRORS:', *errors[:10], sep='\n  ')
        b.close()

if __name__ == '__main__':
    main()
