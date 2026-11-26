#!/usr/bin/env python3
"""產生「合成」基準測試菜單圖與標準答案（虛構店家）。

只用來驗證基準測試流程與解析規則，不可用來宣稱真實菜單準確率。
需要 Pillow 與一套繁體中文字型：
    python3 -m pip install pillow
    python3 Benchmarks/tools/make_synthetic.py [--font /path/to/font.ttc]
macOS 預設使用 PingFang（/System/Library/Fonts/PingFang.ttc），Linux 預設使用文泉驛正黑。
"""
import argparse
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_CANDIDATES = [
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/STHeiti Medium.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
]


class Menu:
    def __init__(self, name, layout, split, size=(1200, 1600), bg="white"):
        self.name, self.layout, self.split = name, layout, split
        self.img = Image.new("RGB", size, bg)
        self.d = ImageDraw.Draw(self.img)
        self.answers = []  # (品名, 規格, 價格)

    def text(self, x, y, s, size=52, fill="black"):
        self.d.text((x, y), s, font=font(size), fill=fill)

    def item(self, x, y, name, prices, cols, size=52):
        """prices 與 cols 對齊；cols 為 [(x, 規格)]，價格 None 表示空白，"—" 表示未供應。"""
        self.text(x, y, name, size)
        for p, (cx, label) in zip(prices, cols):
            if p is None:
                continue
            self.text(cx, y, str(p), size)
            if p != "—":
                self.answers.append((name, label, int(p)))

    def save(self, blur=0.0, rotate=0.0, noise=False):
        img = self.img
        if rotate:
            img = img.rotate(rotate, expand=True, fillcolor="white")
        if noise:
            rnd = random.Random(42)
            px = img.load()
            for _ in range(img.size[0] * img.size[1] // 60):
                x, y = rnd.randrange(img.size[0]), rnd.randrange(img.size[1])
                v = rnd.randrange(170, 235)
                px[x, y] = (v, v, v)
        if blur:
            img = img.filter(ImageFilter.GaussianBlur(blur))
        img.save(os.path.join(ROOT, "menus", self.name + ".png"))
        with open(os.path.join(ROOT, "answers", self.name + ".csv"), "w", encoding="utf-8-sig", newline="") as f:
            f.write("品名,規格,價格\r\n")
            for n, s, p in self.answers:
                f.write(f"{n},{s},{p}\r\n")


_fonts = {}
FONT_PATH = None


def font(size):
    if size not in _fonts:
        _fonts[size] = ImageFont.truetype(FONT_PATH, size)
    return _fonts[size]


def bento():
    m = Menu("合成-01-便當單價", "單欄單價（便當）", "調整")
    m.text(60, 50, "【合成】好日子便當（虛構）", 64)
    items = [("雞腿便當", 110), ("排骨便當", 100), ("滷肉飯", 45), ("控肉便當", 95), ("鯖魚便當", 105), ("素食便當", 90), ("貢丸湯", 30)]
    for i, (n, p) in enumerate(items):
        m.item(80, 220 + i * 120, n, [p], [(900, "單一")])
    m.text(80, 1150, "電話：02-0000-1234", 40, "#444")
    m.text(80, 1210, "地址：台北市中正區虛構路一段1號", 40, "#444")
    return m


def two_columns():
    m = Menu("合成-02-飲料雙欄同價", "雙欄（中杯／大杯）", "調整", size=(1600, 1200))
    m.text(60, 40, "【合成】森森茶舖（虛構）", 60)
    for base, items in [(60, [("紅茶", 30, 35), ("綠茶", 30, 35), ("青茶", 30, 35), ("烏龍茶", 35, 40)]),
                        (830, [("奶茶", 40, 50), ("鮮奶茶", 50, 60), ("可可", 45, 55), ("紅茶拿鐵", 55, 65)])]:
        cols = [(base + 420, "中杯"), (base + 580, "大杯")]
        m.text(cols[0][0], 170, "中杯", 48)
        m.text(cols[1][0], 170, "大杯", 48)
        for i, (n, a, b) in enumerate(items):
            m.item(base, 270 + i * 120, n, [a, b], cols, 50)
    return m


def reversed_header():
    m = Menu("合成-03-大杯在前缺杯型", "大杯在前、缺杯型、品名換行", "調整")
    m.text(60, 50, "【合成】果果鮮飲（虛構）", 60)
    m.text(60, 190, "鮮果系列", 56)
    cols = [(760, "大杯"), (960, "中杯")]
    m.text(760, 190, "大杯", 50)
    m.text(960, 190, "中杯", 50)
    m.item(60, 320, "芒果冰沙", ["—", 70], cols)
    m.item(60, 440, "柳橙綠", [60, 50], cols)
    m.item(60, 560, "葡萄柚綠", [65, None], cols)  # 中杯空白
    # 品名換行：第二行接在下方
    m.text(60, 680, "百香果多多", 52)
    m.text(60, 740, "綠茶", 52)
    m.text(760, 680, "65", 52)
    m.text(960, 680, "55", 52)
    m.answers += [("百香果多多綠茶", "大杯", 65), ("百香果多多綠茶", "中杯", 55)]
    m.item(60, 880, "檸檬紅茶", [50, 40], cols)
    return m


def inline_sizes():
    m = Menu("合成-04-行內ML與容量", "行內 M／L、容量欄", "保留")
    m.text(60, 50, "【合成】小島手作飲（虛構）", 60)
    rows = [("蜂蜜檸檬", 55, 65), ("冬瓜檸檬", 50, 60), ("金桔檸檬", 55, 65)]
    for i, (n, a, b) in enumerate(rows):
        m.text(60, 200 + i * 110, f"{n}   M{a}   L{b}", 50)
        m.answers += [(n, "M", a), (n, "L", b)]
    m.text(60, 600, "鮮奶系列", 56)
    cols = [(760, "500ml"), (960, "700ml")]
    m.text(760, 600, "500ml", 46)
    m.text(960, 600, "700ml", 46)
    for i, (n, a, b) in enumerate([("鮮奶茶", 55, 65), ("黑糖鮮奶", 65, 75), ("抹茶鮮奶", 70, 80)]):
        m.item(60, 720 + i * 110, n, [a, b], cols, 50)
    return m


def noisy():
    m = Menu("合成-05-雜訊與促銷", "雜訊（甜度表、促銷、電話）", "保留")
    m.text(60, 50, "【合成】日日茶飲（虛構）", 60)
    cols = [(760, "中杯"), (960, "大杯")]
    m.text(760, 190, "中杯", 50)
    m.text(960, 190, "大杯", 50)
    for i, (n, a, b) in enumerate([("無糖綠茶", 30, 35), ("熱可可", 45, 55), ("冰淇淋紅茶", 50, 60), ("珍珠奶茶", 50, 60)]):
        m.item(60, 300 + i * 115, n, [a, b], cols)
    m.text(60, 820, "加料：珍珠 +10　椰果 +10", 44, "#333")
    m.text(60, 890, "第二杯半價（限中杯）", 44, "#333")
    m.text(60, 960, "甜度：正常 少糖 半糖 微糖 無糖", 42, "#555")
    m.text(60, 1020, "冰塊：正常冰 少冰 微冰 去冰 熱", 42, "#555")
    m.text(60, 1100, "訂購專線 0912-000-000　營業時間 10:00-21:00", 40, "#555")
    return m


def photo_like():
    m = Menu("合成-06-模糊傾斜", "模擬手機實拍（模糊、傾斜、雜點）", "保留", bg="#f4efe6")
    m.text(60, 50, "【合成】阿姨麵店（虛構）", 60)
    for i, (n, p) in enumerate([("乾麵", 40), ("餛飩麵", 70), ("牛肉麵", 160), ("酸辣湯", 40), ("燙青菜", 35), ("滷蛋", 15)]):
        m.item(80, 220 + i * 120, n, [p], [(880, "單一")])
    m.saved_effects = dict(blur=1.2, rotate=2.5, noise=True)
    return m


def main():
    global FONT_PATH
    ap = argparse.ArgumentParser()
    ap.add_argument("--font")
    a = ap.parse_args()
    FONT_PATH = a.font or next((p for p in FONT_CANDIDATES if os.path.exists(p)), None)
    if not FONT_PATH:
        sys.exit("找不到中文字型，請用 --font 指定")
    os.makedirs(os.path.join(ROOT, "menus"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "answers"), exist_ok=True)

    menus = [bento(), two_columns(), reversed_header(), inline_sizes(), noisy(), photo_like()]
    manifest = ["檔名,版型,用途,來源"]
    for m in menus:
        m.save(**getattr(m, "saved_effects", {}))
        manifest.append(f"{m.name}.png,{m.layout},{m.split},合成")
        print(f"{m.name}.png  標準答案 {len(m.answers)} 筆")

    path = os.path.join(ROOT, "manifest.csv")
    existing = []
    if os.path.exists(path):
        with open(path, encoding="utf-8-sig") as f:
            existing = [l.rstrip("\r\n") for l in f if l.strip() and not l.startswith("合成-") and not l.startswith("檔名,")]
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        f.write("\r\n".join(manifest + existing) + "\r\n")
    print(f"字型：{FONT_PATH}")


if __name__ == "__main__":
    main()
