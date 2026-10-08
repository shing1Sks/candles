"""Throwaway: serve the concept sheet and save exported cards to assets/art/.

python spike/concepts/serve.py [port]   (default 5180)
"""
import base64
import http.server
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ART = ROOT.parents[1] / "assets" / "art"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        m = re.fullmatch(r"/save/((?:[a-z0-9_\-]+/)?[a-z0-9_\-]+)\.png", self.path)
        if not m:
            self.send_error(404)
            return
        data = self.rfile.read(int(self.headers["Content-Length"])).decode()
        ART.mkdir(parents=True, exist_ok=True)
        out = ART / f"{m[1]}.png"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(base64.b64decode(data.split(",", 1)[1]))
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")


port = int(sys.argv[1]) if len(sys.argv) > 1 else 5180
http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
