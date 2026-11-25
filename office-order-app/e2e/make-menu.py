# 產生一張「拍照風格」的繁體中文便當菜單（測試用，內容虛構）
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter
FONT = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"
W, H = 1600, 2100
img = Image.new("RGB", (W, H), (250, 246, 236))
d = ImageDraw.Draw(img)
big = ImageFont.truetype(FONT, 96)
mid = ImageFont.truetype(FONT, 64)
body = ImageFont.truetype(FONT, 66)
d.text((W//2, 120), "幸福便當", font=big, fill=(120, 30, 20), anchor="mm")
d.text((W//2, 230), "電話 02-2345-6789", font=mid, fill=(90, 90, 90), anchor="mm")
y = 360
rows = [("【便當類】", None), ("雞腿便當", "110元"), ("排骨便當", "95元"), ("控肉便當", "100元"), ("魚排便當", "105元"), ("素食便當", "90元"),
        ("【麵食類】", None), ("牛肉麵", "150元"), ("炸醬麵", "80元"), ("滷肉飯", None)]
for name, price in rows:
    if price is None and name.startswith("【"):
        d.text((140, y), name, font=mid, fill=(150, 40, 20)); y += 120; continue
    d.text((180, y), name, font=body, fill=(30, 30, 30))
    if price: d.text((W - 180, y), price, font=body, fill=(30, 30, 30), anchor="ra")
    y += 130
img = img.rotate(1.2, resample=Image.BICUBIC, fillcolor=(235, 230, 220), expand=False)
img = img.filter(ImageFilter.GaussianBlur(0.8))
px = img.load()
random.seed(1)
for _ in range(60000):
    x, yy = random.randrange(W), random.randrange(H)
    r, g, b = px[x, yy]; n = random.randint(-18, 18)
    px[x, yy] = (max(0, min(255, r+n)), max(0, min(255, g+n)), max(0, min(255, b+n)))
img.save("e2e/fixtures/menu-bento.jpg", quality=85)
print("ok", img.size)
