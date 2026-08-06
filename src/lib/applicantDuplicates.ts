// Shared duplicate-matching logic, used by both the import tool (skip/merge on
// upload) and the duplicate cleanup tool (review/archive existing records).
// Keeping one definition ensures the two tools always agree on what counts as
// a duplicate.

interface DupMatchable {
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  desired_position?: string | null;
}

// Every key requires `pos` (desired_position) — matching the tool's own stated
// rule "الاسم + الجوال/الإيميل + الوظيفة" (name + phone/email + job). Previously
// two keys (name+phone, name+email) omitted job title, which folded the same
// person's applications to two DIFFERENT jobs into one "duplicate" group —
// inflating the flagged count and risking archiving a real, distinct application.
// Phone-number normalization strips non-digits only (no leading-zero/country-code
// collapsing), so e.g. "0501234567" and "+966501234567" are NOT treated as equal —
// this under-matches rather than over-matches, which is the safer failure mode here.
export const dupKeys = (r: DupMatchable): string[] => {
  const n = String(r.full_name || "").trim().toLowerCase().replace(/\s+/g, " ");
  const p = String(r.phone || "").replace(/\D/g, "");
  const e = String(r.email || "").trim().toLowerCase();
  const pos = String(r.desired_position || "").trim().toLowerCase();
  const keys: string[] = [];
  if (n && p && e && pos) keys.push(`all:${n}|${p}|${e}|${pos}`);
  if (n && p && pos) keys.push(`name_phone_pos:${n}|${p}|${pos}`);
  if (n && e && pos) keys.push(`name_email_pos:${n}|${e}|${pos}`);
  return keys;
};

export const richness = (r: Record<string, unknown>): number =>
  Object.values(r).filter(v => v != null && String(v).trim() !== "").length;

// Groups records that share at least one dup key, transitively (union-find),
// so A~B and B~C end up in the same group even if A and C share no key directly.
export function groupDuplicates<T extends { id: string }>(records: T[]): T[][] {
  const parent = new Map<string, string>();
  records.forEach(r => parent.set(r.id, r.id));

  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    while (parent.get(x) !== root) { const next = parent.get(x)!; parent.set(x, root); x = next; }
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const byKey = new Map<string, string[]>();
  records.forEach(r => {
    dupKeys(r as unknown as DupMatchable).forEach(k => {
      const arr = byKey.get(k);
      if (arr) arr.push(r.id); else byKey.set(k, [r.id]);
    });
  });
  byKey.forEach(ids => { for (let i = 1; i < ids.length; i++) union(ids[0], ids[i]); });

  const groups = new Map<string, T[]>();
  records.forEach(r => {
    const root = find(r.id);
    const arr = groups.get(root);
    if (arr) arr.push(r); else groups.set(root, [r]);
  });
  return Array.from(groups.values()).filter(g => g.length > 1);
}
