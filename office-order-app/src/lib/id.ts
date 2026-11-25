let counter = 0;

/** 本機唯一 ID（不依賴 crypto.randomUUID，舊版 iOS 也能用） */
export function uid(prefix = ""): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
