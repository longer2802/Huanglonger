// 名單：依換行、逗號、頓號切分姓名，清除首尾空白，找出同名。

export function splitNames(text: string): string[] {
  return text
    .split(/[\r\n,，、;；]+/)
    .map((s) => s.trim().replace(/^\d{1,3}[.、)）]\s*/, ""))
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 0 && !/^[\d\s.)）]+$/.test(s))
    .map((s) => s.slice(0, 20));
}

export interface NameDraft {
  key: string;
  name: string;
  tag: string;
}

/** 回傳每個草稿是否與「既有名單或同批其他人」同名同標記 */
export function duplicateKeys(drafts: NameDraft[], existing: { name: string; tag: string }[]): Set<string> {
  const dup = new Set<string>();
  const ident = (n: string, t: string) => `${n.trim()}\u0000${t.trim()}`;
  const existingSet = new Set(existing.map((p) => ident(p.name, p.tag)));
  const seen = new Map<string, string>();
  for (const d of drafts) {
    const id = ident(d.name, d.tag);
    if (existingSet.has(id)) dup.add(d.key);
    const first = seen.get(id);
    if (first) {
      dup.add(first);
      dup.add(d.key);
    } else seen.set(id, d.key);
  }
  return dup;
}

/** 同名但已加標記的人（提示用：名字一樣，靠標記區分） */
export function sameNameCount(name: string, people: { name: string }[]): number {
  return people.filter((p) => p.name.trim() === name.trim()).length;
}
