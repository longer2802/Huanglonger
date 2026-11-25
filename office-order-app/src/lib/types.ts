export type Kind = "meal" | "drink";

export const KIND_LABEL: Record<Kind, string> = { meal: "餐點", drink: "飲料" };

/** 一個品項的某個規格（例如中杯／大杯）。price 為 null 代表缺價，0 代表主揪確認的 0 元。 */
export interface Variant {
  id: string;
  label: string;
  price: number | null;
}

export interface MenuItem {
  id: string;
  category: string;
  name: string;
  variants: Variant[];
  /** 待確認原因（多欄、套價、模糊數字、配對不明…）；空陣列代表已確認 */
  flags: string[];
}

/** 加料／會影響價格的選項，必須有明確金額 */
export interface Addon {
  id: string;
  name: string;
  price: number | null;
}

export interface Menu {
  items: MenuItem[];
  addons: Addon[];
}

export interface VendorSection {
  enabled: boolean;
  vendorName: string;
  menu: Menu;
  photoIds: string[];
}

export interface LineSnapshot {
  name: string;
  variantLabel: string;
  unitPrice: number;
}

export interface OrderLine {
  id: string;
  kind: Kind;
  itemId: string;
  variantId: string;
  snapshot: LineSnapshot;
  qty: number;
  /** 飲料 */
  sweetness: string;
  ice: string;
  addons: { id: string; name: string; price: number }[];
  /** 餐點客製備註或飲料備註 */
  note: string;
}

export interface Person {
  id: string;
  name: string;
  /** 同名時的辨識標記，例如「業務部」 */
  tag: string;
  skip: boolean;
  paid: boolean;
  lines: OrderLine[];
}

export type OrderStatus = "draft" | "confirmed";

export interface Order {
  id: string;
  title: string;
  date: string;
  meal: VendorSection;
  drink: VendorSection;
  people: Person[];
  status: OrderStatus;
  sample?: boolean;
  createdAt: number;
  updatedAt: number;
  confirmedAt?: number;
}

export interface VendorTemplate {
  id: string;
  kind: Kind;
  vendorName: string;
  menu: Menu;
  savedAt: number;
}

export interface StoredPhoto {
  id: string;
  orderId: string;
  kind: Kind;
  name: string;
  blob: Blob;
}

export const SWEETNESS = ["", "正常甜", "少糖", "半糖", "微糖", "一分糖", "無糖"];
export const ICE = ["", "正常冰", "少冰", "微冰", "去冰", "常溫", "溫", "熱"];
