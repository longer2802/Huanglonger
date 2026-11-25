import { describe, expect, it } from "vitest";
import { chineseOnly, layoutMenuText, priceOf, type OcrSegment } from "../lib/ocrLayout";
import { FLAG, parseMenuText } from "../lib/menuParser";

const seg = (text: string, x0: number, y0: number, x1: number, y1: number, conf = 92): OcrSegment => ({ text, x0, y0, x1, y1, conf });

// 模擬海報式菜單：兩欄、每個品項是「中文品名／英文副標／價格」上下三行
const poster: OcrSegment[] = [
  seg("便當 大 爺", 480, 140, 1330, 400, 81), // 店名（字很大）
  seg("全 品 項 +20 升 級 魯肉 飯", 520, 500, 1215, 565, 73), // 促銷標語
  seg("大 爺 排 骨 便 當", 118, 834, 417, 872, 88),
  seg("Boss Pork Chop Bento", 146, 884, 385, 899, 82),
  seg("100", 234, 932, 297, 961),
  seg("滷 豬 腳 便當", 142, 1000, 387, 1040, 70), // 信心偏低
  seg("Braised Pork Knuckle", 116, 1050, 412, 1064, 48),
  seg("120", 234, 1100, 297, 1129),
  seg("大 爺 粹 魯 便 當", 118, 1180, 417, 1218, 87),
  seg("Minced Pork Bento", 167, 1236, 365, 1249, 58),
  seg("(使用 鬍 鬚 張 魯肉 )", 157, 1262, 373, 1299, 52), // 附註
  seg("95", 243, 1308, 285, 1336, 89),
  seg("炸 雞 腿 便當", 550, 826, 798, 885, 91),
  seg("Fried Chicken Leg Bento", 543, 881, 807, 897, 60),
  seg("115", 646, 928, 708, 957, 92),
  seg("蜜 汁 雞 腿 便當", 526, 1000, 826, 1040, 92),
  seg("1156", 644, 1100, 706, 1128, 91), // 多讀一位
  seg("和 hawi Beef Curfy Ben", 970, 1052, 1186, 1067, 68), // 英文雜訊
  seg("@ 地 址 : 範 例 市 範 例 路 1 號", 799, 2324, 1636, 2391, 91),
  seg("電話 :02-0000-0000", 322, 2334, 681, 2373, 92),
];

describe("海報式菜單依位置整理", () => {
  const text = layoutMenuText(poster);
  const r = parseMenuText(text, "meal");
  const byName = Object.fromEntries(r.items.map((i) => [i.name, i]));
  it("每個中文品名配到正下方的價格，英文、店名、標語、地址電話都不進來", () => {
    expect(r.items.map((i) => [i.name, i.variants[0].price])).toEqual([
      ["大爺排骨便當", 100],
      ["滷豬腳便當", 120],
      ["大爺粹魯便當", 95],
      ["炸雞腿便當", 115],
      ["蜜汁雞腿便當", 115],
    ]);
  });
  it("括號附註不搶走品名的價格", () => {
    expect(byName["大爺粹魯便當"].variants[0].price).toBe(95);
  });
  it("多讀的尾數依字寬修正並標待確認", () => {
    expect(byName["蜜汁雞腿便當"].flags).toContain(FLAG.lowConf);
  });
  it("信心偏低的品名標待確認", () => {
    expect(byName["滷豬腳便當"].flags).toContain(FLAG.lowConf);
    expect(byName["大爺排骨便當"].flags).toEqual([]);
  });
});

describe("同一列「品名 …… 價格」也能配對", () => {
  it("價格在右邊", () => {
    const t = layoutMenuText([seg("雞 腿 便當", 180, 500, 420, 560), seg("110", 1170, 505, 1290, 560), seg("排骨 便當", 180, 640, 420, 700), seg("95", 1205, 645, 1290, 700)]);
    expect(parseMenuText(t, "meal").items.map((i) => [i.name, i.variants[0].price])).toEqual([
      ["雞腿便當", 110],
      ["排骨便當", 95],
    ]);
  });
});

describe("分類標題", () => {
  it("【便當類】即使在第一個品項上方也保留成分類，店名不保留", () => {
    const t = layoutMenuText([seg("幸福 便當", 674, 80, 1105, 191, 80), seg("【 便 當 類 】", 189, 431, 466, 507), seg("雞腿 便當", 195, 569, 491, 648), seg("110 元", 1405, 544, 1607, 633)]);
    const r = parseMenuText(t, "meal");
    expect(r.items.map((i) => [i.category, i.name, i.variants[0].price])).toEqual([["便當類", "雞腿便當", 110]]);
  });
});

describe("工具函式", () => {
  it("只留中文", () => {
    expect(chineseOnly("炸 雞 腿 便當 Fried")).toBe("炸雞腿便當");
  });
  it("價格判斷", () => {
    expect(priceOf("1 2 0")).toBe(120);
    expect(priceOf("$95元")).toBe(95);
    expect(priceOf("Bento")).toBeNull();
    expect(priceOf("02-2345")).toBeNull();
  });
});
