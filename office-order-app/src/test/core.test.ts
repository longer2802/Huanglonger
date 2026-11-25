import { describe, expect, it } from "vitest";
import { aggregateLines, isValidPrice, lineTotal, orderTotals, parsePriceInput, parseQtyInput, personTotals, vendorTotal } from "../lib/pricing";
import { sampleOrder } from "../lib/orders";
import { parseMenuText, FLAG } from "../lib/menuParser";
import { duplicateKeys, splitNames } from "../lib/names";

describe("驗收金額（範例訂單）", () => {
  const o = sampleOrder();
  const [rong, yu, chen] = o.people;
  it("阿榮 110 便當 + 55 飲料 + 加料 10 = 175", () => {
    expect(personTotals(rong)).toEqual({ meal: 110, drink: 65, due: 175 });
  });
  it("小妤 95×2 + 40 = 230", () => {
    expect(personTotals(yu)).toEqual({ meal: 190, drink: 40, due: 230 });
  });
  it("第三人不訂", () => {
    expect(chen.skip).toBe(true);
    expect(personTotals(chen).due).toBe(0);
  });
  it("店家合計與全單", () => {
    expect(vendorTotal(o, "meal")).toBe(300);
    expect(vendorTotal(o, "drink")).toBe(105);
    expect(orderTotals(o).total).toBe(405);
  });
  it("阿榮已收 → 已收 175、待收 230", () => {
    rong.paid = true;
    const t = orderTotals(o);
    expect(t.paid).toBe(175);
    expect(t.unpaid).toBe(230);
  });
  it("品項小計 =（單價＋每份加價）× 數量", () => {
    const l = { ...rong.lines[1], qty: 3 };
    expect(lineTotal(l)).toBe((55 + 10) * 3);
  });
});

describe("彙總不合併不同做法", () => {
  it("甜度不同就分開", () => {
    const o = sampleOrder();
    const [rong, yu] = o.people;
    const base = rong.lines[1];
    yu.lines = [{ ...base, id: "x1", sweetness: "無糖" }, { ...base, id: "x2" }];
    const rows = aggregateLines(o, "drink");
    expect(rows.length).toBe(2);
    expect(rows.find((r) => r.detail.includes("半糖"))!.qty).toBe(2);
  });
});

describe("價格與數量驗證", () => {
  it("拒絕空白、負數、小數", () => {
    expect(parsePriceInput("").error).toBe("缺價");
    expect(parsePriceInput("-5").error).toBeTruthy();
    expect(parsePriceInput("12.5").error).toBeTruthy();
    expect(parsePriceInput("abc").error).toBeTruthy();
    expect(parsePriceInput("０").value).toBe(0);
    expect(parsePriceInput("110元").value).toBe(110);
    expect(isValidPrice(0)).toBe(true);
    expect(isValidPrice(null)).toBe(false);
  });
  it("數量必須是正整數", () => {
    expect(parseQtyInput("0")).toBeNull();
    expect(parseQtyInput("1.5")).toBeNull();
    expect(parseQtyInput("-1")).toBeNull();
    expect(parseQtyInput("2")).toBe(2);
  });
});

describe("菜單規則解析", () => {
  it("便當與分類", () => {
    const r = parseMenuText("【便當類】\n雞腿便當 110元\n排骨便當 $95\n滷肉飯\n電話 02-2345-6789", "meal");
    expect(r.items.map((i) => [i.category, i.name, i.variants[0].price])).toEqual([
      ["便當類", "雞腿便當", 110],
      ["便當類", "排骨便當", 95],
      ["便當類", "滷肉飯", null],
    ]);
    expect(r.items[2].flags).toContain(FLAG.missing);
    expect(r.skipped.length).toBe(1);
  });
  it("大小杯拆成規格", () => {
    const r = parseMenuText("紅茶 M30 L35\n綠茶 中25 大30\n奶茶 40 50", "drink");
    expect(r.items[0].variants.map((v) => [v.label, v.price])).toEqual([["M", 30], ["L", 35]]);
    expect(r.items[1].variants.map((v) => [v.label, v.price])).toEqual([["中", 25], ["大", 30]]);
    expect(r.items[2].variants.map((v) => v.label)).toEqual(["中杯", "大杯"]);
    expect(r.items[2].flags).toContain(FLAG.sizes);
  });
  it("表頭規格", () => {
    const r = parseMenuText("中杯 大杯\n冬瓜茶 25 30", "drink");
    expect(r.items[0].variants.map((v) => v.label)).toEqual(["中杯", "大杯"]);
    expect(r.items[0].flags).toEqual([]);
  });
  it("多欄、模糊數字、套價、加料", () => {
    const r = parseMenuText("紅茶 30 綠茶 30\n奶綠 4O\n牛肉麵 150 套餐+50\n加料區\n珍珠 10", "drink");
    expect(r.items[0].flags).toContain(FLAG.multiCol);
    expect(r.items[1].name).toBe("綠茶");
    const milk = r.items.find((i) => i.name === "奶綠")!;
    expect(milk.variants[0].price).toBe(40);
    expect(milk.flags).toContain(FLAG.fuzzy);
    expect(r.items.find((i) => i.name === "牛肉麵")!.flags).toContain(FLAG.combo);
    expect(r.addons).toEqual([expect.objectContaining({ name: "珍珠", price: 10 })]);
  });
  it("小數價格當缺價", () => {
    const r = parseMenuText("鬆餅 45.5", "meal");
    expect(r.items[0].variants[0].price).toBeNull();
    expect(r.items[0].flags).toContain(FLAG.fuzzy);
  });
  it("只有價格的行配到上一個缺價品項", () => {
    const r = parseMenuText("招牌炒飯\n85", "meal");
    expect(r.items.length).toBe(1);
    expect(r.items[0].variants[0].price).toBe(85);
    expect(r.items[0].flags).toContain(FLAG.pairing);
  });
});

describe("OCR 欄位分離", () => {
  it("品名串與價格串依序配對並標配對不明", () => {
    const r = parseMenuText("【便當類】\n雞腿便當\n排骨便當\n滷肉飯\n1107T\n95元\n90元", "meal");
    expect(r.items.map((i) => [i.name, i.variants[0].price])).toEqual([["雞腿便當", 110], ["排骨便當", 95], ["滷肉飯", 90]]);
    expect(r.items.every((i) => i.flags.includes(FLAG.pairing))).toBe(true);
  });
  it("元 的誤認", () => {
    expect(parseMenuText("雞腿便當 110TC", "meal").items[0].variants[0].price).toBe(110);
  });
});

describe("名單", () => {
  it("換行、逗號、頓號切分", () => {
    expect(splitNames(" 阿榮\n小妤，小陳、 王 大明 ,\n\n1. 阿美")).toEqual(["阿榮", "小妤", "小陳", "王 大明", "阿美"]);
  });
  it("同名提示", () => {
    const dup = duplicateKeys([{ key: "a", name: "阿榮", tag: "" }, { key: "b", name: "小妤", tag: "" }, { key: "c", name: "小妤", tag: "" }], [{ name: "阿榮", tag: "" }]);
    expect([...dup].sort()).toEqual(["a", "b", "c"]);
    expect(duplicateKeys([{ key: "b", name: "小妤", tag: "業務" }, { key: "c", name: "小妤", tag: "" }], []).size).toBe(0);
  });
});
