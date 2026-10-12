# contact sheet: N frames of a video in a grid -> probe/NAME_sheet.jpg
import sys, subprocess, os
from PIL import Image
v = sys.argv[1]; n = int(sys.argv[2]) if len(sys.argv) > 2 else 8
dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', v], capture_output=True, text=True).stdout)
ims = []
for k in range(n):
    t = dur * (k + 0.5) / n; f = f'probe/_f{k}.jpg'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t:.2f}', '-i', v, '-frames:v', '1', '-vf', 'scale=480:-1', f], check=True)
    ims.append(Image.open(f))
W, H = ims[0].size; cols = 4; rows = (n + cols - 1) // cols
c = Image.new('RGB', (W * cols, H * rows))
for k, im in enumerate(ims): c.paste(im, ((k % cols) * W, (k // cols) * H))
out = 'probe/' + os.path.basename(v).rsplit('.', 1)[0] + '_sheet.jpg'; c.save(out, quality=85); print(out)
