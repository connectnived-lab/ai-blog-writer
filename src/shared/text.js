// Pure text helpers. No DOM, no network. Shared across the AI mini-project family.
const STOP = new Set(('a an and are as at be but by for from had has have he her his i if in into is it its of on or ' +
  'our she so that the their them then there these they this to was we were what when which who will with you your ' +
  'not no do does did can could should would may might than too very just about over also more most some any all each ' +
  'other such only own same how why where while being been am im its it\'s').split(/\s+/));

export function normalizeSpace(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

export function words(s) {
  return String(s ?? '').toLowerCase().match(/[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}'-]*/gu) || [];
}

export function countWords(s) {
  return words(s).length;
}

export function sentences(s) {
  return String(s ?? '').split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
}

export function paragraphs(s) {
  return String(s ?? '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
}

export function contentWords(s) {
  return words(s).filter((w) => w.length > 2 && !STOP.has(w));
}

export function topKeywords(s, n = 8) {
  const freq = new Map();
  for (const w of contentWords(s)) freq.set(w, (freq.get(w) || 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([w]) => w);
}

export function countPhrase(s, phrase) {
  const p = normalizeSpace(phrase).toLowerCase();
  if (!p) return 0;
  const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|[^\\p{L}\\p{M}\\p{N}])${esc}(?=$|[^\\p{L}\\p{M}\\p{N}])`, 'giu');
  return (String(s ?? '').toLowerCase().match(re) || []).length;
}

export function slugify(s) {
  return normalizeSpace(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function clip(s, max) {
  const t = normalizeSpace(s);
  if (t.length <= max) return t;
  const cut = t.slice(0, Math.max(0, max - 1));
  const at = cut.lastIndexOf(' ');
  const base = at > max * 0.5 ? cut.slice(0, at) : cut;
  return base.replace(/[\s,;:.\-]+$/, '') + '…';
}

export function countSyllables(word) {
  const w = String(word ?? '').toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const core = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = core.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

export function fleschReadingEase(text) {
  const ws = words(text).filter((w) => /[a-z]/.test(w));
  const ss = sentences(text).filter((x) => /[\p{L}]/u.test(x));
  if (ws.length === 0 || ss.length === 0) return 0;
  const syl = ws.reduce((n, w) => n + countSyllables(w), 0);
  const score = 206.835 - 1.015 * (ws.length / ss.length) - 84.6 * (syl / ws.length);
  return Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;
}

export function titleCase(s) {
  return normalizeSpace(s).replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}
