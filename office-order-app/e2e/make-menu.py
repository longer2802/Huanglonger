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

# 第二張：深色底、金色字、三欄、每個品項下面有英文副標（海報式菜單，內容虛構）
W2, H2 = 1300, 1500
img2 = Image.new("RGB", (W2, H2), (28, 30, 34))
d2 = ImageDraw.Draw(img2)
gold = (214, 182, 112)
title = ImageFont.truetype(FONT, 110)
name_f = ImageFont.truetype(FONT, 46)
en_f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18) if __import__("os").path.exists("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") else ImageFont.truetype(FONT, 18)
price_f = ImageFont.truetype(FONT, 44)
d2.text((W2 // 2, 120), "好運便當", font=title, fill=gold, anchor="mm")
d2.text((W2 // 2, 230), "LUCKY BENTO", font=ImageFont.truetype(FONT, 40), fill=gold, anchor="mm")
cols = [
    [("招牌排骨便當", "Signature Pork Chop", "105"), ("香酥雞排便當", "Crispy Chicken Cutlet", "110"), ("紅燒牛腩便當", "Braised Beef Brisket", "135")],
    [("蔥爆豬肉便當", "Scallion Pork", "100"), ("三杯雞便當", "Three Cup Chicken", "115")],
    [("鹽烤鯖魚便當", "Grilled Mackerel", "125"), ("素食蔬菜便當", "Vegetarian Bento", "90")],
]
for ci, col in enumerate(cols):
    x = 230 + ci * 420
    y = 380
    for name, en, price in col:
        d2.text((x, y), name, font=name_f, fill=gold, anchor="mm")
        d2.text((x, y + 46), en, font=en_f, fill=(190, 170, 130), anchor="mm")
        d2.text((x, y + 100), price, font=price_f, fill=(240, 230, 210), anchor="mm")
        y += 220
    if ci < 2:
        d2.line([(x + 210, 340), (x + 210, 1050)], fill=gold, width=2)
d2.ellipse([(880, 1100), (1240, 1440)], fill=(170, 110, 60))  # 假裝是食物照片
d2.text((80, 1380), "營業時間 11:00~14:00　電話 02-0000-0000", font=ImageFont.truetype(FONT, 34), fill=gold)
img2 = img2.filter(ImageFilter.GaussianBlur(0.6))
img2.save("e2e/fixtures/menu-poster-dark.jpg", quality=82)
print("ok poster")
