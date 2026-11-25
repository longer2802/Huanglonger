import { useSyncExternalStore } from "react";

// 預設分類（所有使用者共用，寫在程式裡）
// keywords：出現在「買了什麼／做了什麼」時加 3 分；出現在商家名稱裡只加 1 分
// 使用者自訂的分類存在這支手機（localStorage），啟動時插入在「其他支出／其他收入」前面。

export const EXPENSE_CATEGORIES = [
  {
    id: "food",
    name: "飲食",
    icon: "🍜",
    keywords: [
      "早餐", "午餐", "晚餐", "宵夜", "早午餐", "下午茶", "點心", "火鍋", "便當", "飲料", "咖啡", "奶茶",
      "手搖", "珍奶", "餐廳", "蛋餅", "麥當勞", "肯德基", "摩斯", "星巴克", "路易莎", "拉麵", "牛肉麵",
      "麵", "飯", "小吃", "水果", "麵包", "蛋糕", "吃飯", "聚餐", "外送", "Uber Eats", "熊貓", "吃",
      "喝", "鍋貼", "滷味", "鹹酥雞", "雞排", "壽司", "披薩", "牛排", "燒肉", "早點", "豆漿", "飯糰",
    ],
  },
  {
    id: "transport",
    name: "交通",
    icon: "🚗",
    keywords: [
      "加油", "油錢", "停車", "停車費", "計程車", "小黃", "高鐵", "台鐵", "火車", "公車", "客運", "捷運",
      "Uber", "悠遊卡", "一卡通", "YouBike", "機票", "過路費", "etag", "eTag", "ETC", "洗車", "保養",
      "車資", "車票",
    ],
  },
  {
    id: "shopping",
    name: "購物",
    icon: "🛍️",
    keywords: [
      "衣服", "褲子", "裙子", "外套", "鞋子", "鞋", "包包", "服飾", "飾品", "網購", "蝦皮", "momo",
      "淘寶", "手機", "電腦", "耳機", "家電", "化妝品", "保養品", "百貨", "購物", "Uniqlo", "優衣庫",
    ],
  },
  {
    id: "entertainment",
    name: "娛樂",
    icon: "🎬",
    keywords: [
      "電影", "看電影", "KTV", "唱歌", "遊樂園", "演唱會", "表演", "展覽", "遊戲", "旅遊", "旅行",
      "門票", "Netflix", "訂閱", "電影院", "影城", "健身房", "運動",
    ],
  },
  {
    id: "home",
    name: "居家",
    icon: "🏠",
    keywords: [
      "房租", "租金", "水費", "電費", "瓦斯費", "瓦斯", "管理費", "網路費", "電話費", "手機費", "第四台",
      "家具", "修理", "裝潢",
    ],
  },
  {
    id: "daily",
    name: "生活用品",
    icon: "🧻",
    keywords: [
      "衛生紙", "洗衣精", "洗髮精", "沐浴乳", "牙膏", "牙刷", "清潔劑", "垃圾袋", "日用品", "生活用品",
      "全聯", "家樂福", "大潤發", "好市多", "屈臣氏", "康是美", "寶雅", "超商", "便利商店", "7-11",
      "711", "全家", "萊爾富", "OK超商",
    ],
  },
  {
    id: "health",
    name: "醫療健康",
    icon: "💊",
    keywords: [
      "看診", "掛號", "看醫生", "看病", "看牙", "牙醫", "藥局", "藥", "醫療費", "醫院", "診所", "健檢",
      "復健", "眼鏡",
    ],
  },
  {
    id: "education",
    name: "教育學習",
    icon: "📚",
    keywords: ["學費", "補習", "補習費", "書", "課程", "上課", "講座", "文具", "學雜費"],
  },
  {
    id: "finance",
    name: "保險金融",
    icon: "🛡️",
    keywords: ["保費", "保險", "手續費", "貸款", "房貸", "車貸", "信用卡費", "卡費", "利息支出"],
  },
  {
    id: "gift",
    name: "人情禮金",
    icon: "🧧",
    keywords: ["紅包", "禮金", "禮物", "白包", "奠儀", "包紅包", "喜酒", "送禮", "孝親費"],
  },
  { id: "other-expense", name: "其他支出", icon: "📦", keywords: [] },
];

export const INCOME_CATEGORIES = [
  { id: "salary", name: "薪資", icon: "💼", keywords: ["薪水", "薪資", "月薪", "工資", "薪"] },
  { id: "bonus", name: "獎金", icon: "🎁", keywords: ["獎金", "年終", "紅利", "分紅", "三節"] },
  { id: "investment", name: "投資收入", icon: "📈", keywords: ["股利", "股息", "配息", "利息", "投資", "股票"] },
  { id: "rent", name: "租金收入", icon: "🏘️", keywords: ["租金", "房租", "收租"] },
  { id: "other-income", name: "其他收入", icon: "💰", keywords: [] },
];

export const TRANSFER_CATEGORY = { id: "transfer", name: "轉帳", icon: "🔁", keywords: [] };

export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, TRANSFER_CATEGORY];

// ---- 自訂分類 ----

export const CUSTOM_KEY = "yijuhua-custom-categories-v1";
export const CUSTOM_ICONS = ["🐶", "🐱", "👶", "🎮", "⛽", "☕", "🍺", "🎨", "💇", "🏋️", "✈️", "🎓", "💻", "📱", "🧸", "🌱", "🎵", "🙏", "🏥", "🛒", "🎁", "💡", "🔧", "⭐"];
export const MAX_CUSTOM = 30;
export const MAX_NAME = 8;

const BUILTIN_EXPENSE = EXPENSE_CATEGORIES.slice();
const BUILTIN_INCOME = INCOME_CATEGORIES.slice();
const BUILTIN_NAMES = new Set([...BUILTIN_EXPENSE, ...BUILTIN_INCOME, TRANSFER_CATEGORY].map((c) => c.name).concat("帳戶轉移"));

let custom = [];
let version = 0;
const listeners = new Set();

function cleanKeywords(list) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const k = String(raw ?? "").trim().slice(0, 20);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= 20) break;
  }
  return out;
}

export function splitKeywords(text) {
  return cleanKeywords(String(text || "").split(/[,，、\s]+/));
}

function cleanCategory(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name ?? "").trim().slice(0, MAX_NAME);
  const type = raw.type === "income" ? "income" : raw.type === "expense" ? "expense" : null;
  if (!name || !type || BUILTIN_NAMES.has(name)) return null;
  const icon = String(raw.icon ?? "").trim().slice(0, 8) || "🏷️";
  const id = /^custom-[\w-]{1,40}$/.test(raw.id) ? raw.id : `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return { id, name, icon, type, keywords: cleanKeywords(raw.keywords), custom: true };
}

// 把自訂分類放進共用清單（原地修改，讓解析器與各頁面都讀得到），「其他」維持在最後一個
function apply() {
  const exp = custom.filter((c) => c.type === "expense").map((c) => ({ ...c, keywords: [c.name, ...c.keywords] }));
  const inc = custom.filter((c) => c.type === "income").map((c) => ({ ...c, keywords: [c.name, ...c.keywords] }));
  EXPENSE_CATEGORIES.splice(0, EXPENSE_CATEGORIES.length, ...BUILTIN_EXPENSE.slice(0, -1), ...exp, BUILTIN_EXPENSE.at(-1));
  INCOME_CATEGORIES.splice(0, INCOME_CATEGORIES.length, ...BUILTIN_INCOME.slice(0, -1), ...inc, BUILTIN_INCOME.at(-1));
  ALL_CATEGORIES.splice(0, ALL_CATEGORIES.length, ...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, TRANSFER_CATEGORY);
  version += 1;
  listeners.forEach((fn) => fn());
}

function persist() {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
  } catch {
    throw new Error("手機儲存空間無法寫入，分類沒有存起來");
  }
}

export function loadCustomCategories() {
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
  } catch {
    list = [];
  }
  const names = new Set();
  custom = (Array.isArray(list) ? list : [])
    .map(cleanCategory)
    .filter((c) => c && !names.has(c.name) && names.add(c.name))
    .slice(0, MAX_CUSTOM);
  apply();
}

export function getCustomCategories() {
  return custom.slice();
}

export function addCustomCategory(input) {
  const name = String(input?.name ?? "").trim();
  if (!name) throw new Error("請輸入分類名稱");
  if (name.length > MAX_NAME) throw new Error(`分類名稱最多 ${MAX_NAME} 個字`);
  if (BUILTIN_NAMES.has(name) || custom.some((c) => c.name === name)) throw new Error(`已經有「${name}」這個分類`);
  if (custom.length >= MAX_CUSTOM) throw new Error(`自訂分類最多 ${MAX_CUSTOM} 個`);
  const item = cleanCategory({ ...input, name, id: undefined });
  if (!item) throw new Error("分類資料不完整");
  const before = custom;
  custom = [...custom, item];
  try {
    persist();
  } catch (error) {
    custom = before;
    throw error;
  }
  apply();
  return item;
}

export function updateCustomCategory(id, patch) {
  const current = custom.find((c) => c.id === id);
  if (!current) throw new Error("找不到這個分類");
  const item = cleanCategory({ ...current, icon: patch?.icon ?? current.icon, keywords: patch?.keywords ?? current.keywords });
  const before = custom;
  custom = custom.map((c) => (c.id === id ? item : c));
  try {
    persist();
  } catch (error) {
    custom = before;
    throw error;
  }
  apply();
  return item;
}

export function removeCustomCategory(id) {
  const before = custom;
  custom = custom.filter((c) => c.id !== id);
  try {
    persist();
  } catch (error) {
    custom = before;
    throw error;
  }
  apply();
}

// 匯入備份時，帳目用到但這支手機沒有的分類自動補成自訂分類；回傳補了幾個
export function restoreMissingCategories(records) {
  let added = 0;
  for (const r of records || []) {
    if (r?.type !== "expense" && r?.type !== "income") continue;
    const name = String(r.categoryName ?? "").trim();
    if (!name || name.length > MAX_NAME || findCategory(name)) continue;
    if (custom.length >= MAX_CUSTOM) break;
    try {
      addCustomCategory({ name, type: r.type, icon: "🏷️", keywords: [] });
      added += 1;
    } catch {
      // 名稱不合規就略過，帳目仍保留原本的分類名稱
    }
  }
  return added;
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// React：自訂分類變動時重新繪製
export function useCategoriesVersion() {
  return useSyncExternalStore(subscribe, () => version, () => 0);
}

if (typeof window !== "undefined") {
  loadCustomCategories();
  window.addEventListener("storage", (event) => {
    if (event.key === CUSTOM_KEY) loadCustomCategories();
  });
}

export function categoriesForType(type) {
  if (type === "income") return INCOME_CATEGORIES;
  if (type === "transfer") return [TRANSFER_CATEGORY];
  return EXPENSE_CATEGORIES;
}

export function findCategory(name) {
  const target = name === "帳戶轉移" ? "轉帳" : name; // 舊名稱相容
  return ALL_CATEGORIES.find((c) => c.name === target) || null;
}

export function categoryIcon(name) {
  return findCategory(name)?.icon || "📦";
}

export const TYPE_LABELS = { expense: "支出", income: "收入", transfer: "轉帳" };

export const PAYMENT_METHODS = ["現金", "信用卡", "銀行轉帳"];
