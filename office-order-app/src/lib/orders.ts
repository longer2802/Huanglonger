import { uid } from "./id";
import { isValidPrice, orderableVariants } from "./pricing";
import type { Addon, Kind, Menu, MenuItem, Order, OrderLine, Person, VendorSection } from "./types";

export function todayISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function emptySection(enabled: boolean): VendorSection {
  return { enabled, vendorName: "", menu: { items: [], addons: [] }, photoIds: [] };
}

export function newOrder(): Order {
  const now = Date.now();
  return {
    id: uid("o"),
    title: "午餐",
    date: todayISO(),
    meal: emptySection(true),
    drink: emptySection(false),
    people: [],
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

export function newPerson(name: string, tag = ""): Person {
  return { id: uid("p"), name: name.trim(), tag: tag.trim(), skip: false, paid: false, lines: [] };
}

export function newItem(category = ""): MenuItem {
  return { id: uid("i"), category, name: "", variants: [{ id: uid("v"), label: "", price: null }], flags: [] };
}

export function cloneMenu(menu: Menu): Menu {
  // 新 ID：模板載入後再修改，不會影響其他訂單
  return {
    items: menu.items.map((it) => ({ ...it, id: uid("i"), flags: [...it.flags], variants: it.variants.map((v) => ({ ...v, id: uid("v") })) })),
    addons: menu.addons.map((a) => ({ ...a, id: uid("a") })),
  };
}

export function sectionOf(order: Order, kind: Kind): VendorSection {
  return kind === "meal" ? order.meal : order.drink;
}

export function vendorLabel(order: Order, kind: Kind): string {
  const s = sectionOf(order, kind);
  return s.vendorName.trim() || (kind === "meal" ? "餐點店家" : "飲料店家");
}

export function activeKinds(order: Order): Kind[] {
  return (["meal", "drink"] as Kind[]).filter((k) => sectionOf(order, k).enabled);
}

/** 可點的品項：至少有一個有價規格（缺價規格不會出現在點餐選單） */
export function orderableItems(menu: Menu): MenuItem[] {
  return menu.items.filter((it) => it.name.trim() && orderableVariants(it).length > 0);
}

export function usableAddons(menu: Menu): Addon[] {
  return menu.addons.filter((a) => a.name.trim() && isValidPrice(a.price));
}

export function menuProblems(menu: Menu) {
  const missing = menu.items.filter((it) => !it.name.trim() || it.variants.length === 0 || it.variants.some((v) => !isValidPrice(v.price)));
  const flagged = menu.items.filter((it) => it.flags.length > 0);
  const addonMissing = menu.addons.filter((a) => !isValidPrice(a.price) || !a.name.trim());
  return { missing, flagged, addonMissing };
}

export function makeLine(kind: Kind, item: MenuItem, variantId: string, extra: Partial<OrderLine> = {}): OrderLine {
  const v = item.variants.find((x) => x.id === variantId) ?? orderableVariants(item)[0];
  if (!v || !isValidPrice(v.price)) throw new Error("這個品項還沒有價格，請先到菜單補價");
  return {
    id: uid("l"),
    kind,
    itemId: item.id,
    variantId: v.id,
    snapshot: { name: item.name.trim(), variantLabel: v.label.trim(), unitPrice: v.price },
    qty: 1,
    sweetness: "",
    ice: "",
    addons: [],
    note: "",
    ...extra,
  };
}

export function safeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|\s]+/g, "").slice(0, 40) || "未命名";
}

// ---- 範例資料（畫面上明確標示「範例」）----

export function sampleOrder(): Order {
  const o = newOrder();
  o.title = "範例：午餐＋飲料";
  o.sample = true;
  o.meal = {
    enabled: true,
    vendorName: "範例便當店",
    photoIds: [],
    menu: {
      items: [
        { id: uid("i"), category: "便當", name: "雞腿便當", variants: [{ id: uid("v"), label: "", price: 110 }], flags: [] },
        { id: uid("i"), category: "便當", name: "排骨便當", variants: [{ id: uid("v"), label: "", price: 95 }], flags: [] },
        { id: uid("i"), category: "便當", name: "素食便當", variants: [{ id: uid("v"), label: "", price: 90 }], flags: [] },
      ],
      addons: [],
    },
  };
  o.drink = {
    enabled: true,
    vendorName: "範例飲料店",
    photoIds: [],
    menu: {
      items: [
        { id: uid("i"), category: "奶茶", name: "鮮奶茶", variants: [{ id: uid("v"), label: "中杯", price: 50 }, { id: uid("v"), label: "大杯", price: 55 }], flags: [] },
        { id: uid("i"), category: "茶", name: "紅茶", variants: [{ id: uid("v"), label: "中杯", price: 40 }, { id: uid("v"), label: "大杯", price: 45 }], flags: [] },
      ],
      addons: [
        { id: uid("a"), name: "珍珠", price: 10 },
        { id: uid("a"), name: "椰果", price: 10 },
      ],
    },
  };
  const [chicken, pork] = o.meal.menu.items;
  const [milkTea, blackTea] = o.drink.menu.items;
  const pearl = o.drink.menu.addons[0];
  const rong = newPerson("阿榮");
  rong.lines = [
    makeLine("meal", chicken, chicken.variants[0].id),
    makeLine("drink", milkTea, milkTea.variants[1].id, { sweetness: "半糖", ice: "少冰", addons: [{ id: pearl.id, name: pearl.name, price: pearl.price as number }] }),
  ];
  const yu = newPerson("小妤");
  yu.lines = [
    makeLine("meal", pork, pork.variants[0].id, { qty: 2, note: "一份不要辣" }),
    makeLine("drink", blackTea, blackTea.variants[0].id, { sweetness: "無糖", ice: "去冰" }),
  ];
  const chen = newPerson("小陳");
  chen.skip = true;
  o.people = [rong, yu, chen];
  return o;
}
