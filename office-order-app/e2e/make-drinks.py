# 產生三種常見手搖飲菜單版型（測試用，店名、品項、價格全部虛構）
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter
FONT = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"
def f(n): return ImageFont.truetype(FONT, n)
def noise(img, n=40000, seed=2):
    random.seed(seed); px = img.load(); W, H = img.size
    for _ in range(n):
        x, y = random.randrange(W), random.randrange(H); c = px[x, y]; k = random.randint(-14, 14)
        px[x, y] = tuple(max(0, min(255, v + k)) for v in c)
    return img

# A：淺色底表格，右側「中杯 大杯」兩欄價格，分類是深綠色色塊白字，底部有加料與甜度說明
W, H = 1200, 1700
a = Image.new("RGB", (W, H), (250, 247, 238)); d = ImageDraw.Draw(a)
d.text((W // 2, 90), "清心茶飲", font=f(80), fill=(30, 80, 50), anchor="mm")
d.text((W // 2, 160), "TEA HOUSE", font=f(28), fill=(90, 120, 100), anchor="mm")
y = 240
sections = [("原味茶", [("茉莉綠茶", 30, 35), ("阿薩姆紅茶", 30, 35), ("四季春茶", 30, 35), ("高山烏龍", 35, 40)]),
            ("奶茶", [("珍珠奶茶", 50, 60), ("鮮奶紅茶", 55, 65), ("黑糖鮮奶", 60, 70)]),
            ("果茶", [("百香綠茶", 45, 55), ("檸檬紅茶", 40, 50)])]
for sec, rows in sections:
    d.rectangle([(60, y), (W - 60, y + 64)], fill=(46, 104, 72))
    d.text((90, y + 32), sec, font=f(40), fill=(255, 255, 255), anchor="lm")
    d.text((820, y + 32), "中杯", font=f(34), fill=(255, 255, 255), anchor="mm")
    d.text((1000, y + 32), "大杯", font=f(34), fill=(255, 255, 255), anchor="mm")
    y += 90
    for name, m, l in rows:
        d.text((100, y + 28), name, font=f(42), fill=(40, 40, 40), anchor="lm")
        d.text((820, y + 28), str(m), font=f(42), fill=(40, 40, 40), anchor="mm")
        d.text((1000, y + 28), str(l), font=f(42), fill=(40, 40, 40), anchor="mm")
        d.line([(100, y + 62), (W - 100, y + 62)], fill=(220, 214, 200), width=1)
        y += 74
    y += 20
d.text((90, y + 20), "加料：珍珠 +10　椰果 +10　布丁 +15", font=f(36), fill=(40, 40, 40))
d.text((90, y + 90), "甜度冰塊可調整・熱飲另加 5 元", font=f(30), fill=(120, 110, 90))
a = noise(a.rotate(0.8, resample=Image.BICUBIC, fillcolor=(230, 225, 215)).filter(ImageFilter.GaussianBlur(0.7)))
a.save("e2e/fixtures/drink-table-light.jpg", quality=84)

# B：深色底、兩個表格左右並排、表頭用 M / L
W, H = 1500, 1150
b = Image.new("RGB", (W, H), (24, 24, 28)); d = ImageDraw.Draw(b)
d.text((W // 2, 80), "夜貓手搖", font=f(76), fill=(250, 210, 90), anchor="mm")
cols = [(60, [("冬瓜檸檬", 40, 50), ("蜂蜜綠茶", 40, 50), ("多多綠茶", 45, 55), ("鮮榨柳橙", 60, 70)]),
        (780, [("可可歐蕾", 55, 65), ("抹茶拿鐵", 60, 70), ("焦糖奶茶", 55, 65), ("芋頭鮮奶", 65, 75)])]
for x0, rows in cols:
    d.text((x0 + 470, 200), "M", font=f(38), fill=(250, 210, 90), anchor="mm")
    d.text((x0 + 600, 200), "L", font=f(38), fill=(250, 210, 90), anchor="mm")
    y = 270
    for name, m, l in rows:
        d.text((x0 + 20, y), name, font=f(44), fill=(240, 240, 240), anchor="lm")
        d.text((x0 + 470, y), str(m), font=f(44), fill=(240, 240, 240), anchor="mm")
        d.text((x0 + 600, y), str(l), font=f(44), fill=(240, 240, 240), anchor="mm")
        y += 110
d.line([(750, 180), (750, 760)], fill=(250, 210, 90), width=2)
d.text((60, 900), "營業時間 12:00-22:00　電話 02-1111-2222", font=f(32), fill=(200, 200, 200))
b = noise(b.filter(ImageFilter.GaussianBlur(0.6)), seed=3)
b.save("e2e/fixtures/drink-dark-two-tables.jpg", quality=84)

# C：每個品項一行，價格寫成「M50 / L60」或「35/45」
W, H = 1000, 900
c = Image.new("RGB", (W, H), (255, 252, 245)); d = ImageDraw.Draw(c)
d.text((W // 2, 80), "好日飲料", font=f(70), fill=(180, 60, 40), anchor="mm")
rows = [("黃金烏龍", "M35 / L45"), ("青梅綠茶", "M40 / L50"), ("紅茶拿鐵", "50/60"), ("仙草凍奶茶", "55/65")]
y = 200
for name, price in rows:
    d.text((80, y), name, font=f(46), fill=(50, 40, 30), anchor="lm")
    d.text((W - 80, y), price, font=f(46), fill=(50, 40, 30), anchor="rm")
    y += 120
c = noise(c.filter(ImageFilter.GaussianBlur(0.6)), seed=4)
c.save("e2e/fixtures/drink-inline-sizes.jpg", quality=84)
print("ok")
