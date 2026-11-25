# 壓縮 PNG 圖示（減少色數），檔案變小、HTML 也跟著變小
from pathlib import Path
from PIL import Image
for f in sorted(Path(__file__).resolve().parent.parent.joinpath("icons").glob("icon-*.png")):
    im = Image.open(f).convert("RGBA").quantize(colors=128, method=Image.FASTOCTREE)
    im.save(f, optimize=True)
    print(f.name, f.stat().st_size, "bytes")
