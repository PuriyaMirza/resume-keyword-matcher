/**
 * Text normalization and tokenization.
 *
 * Design rule: normalizeText() is LENGTH-PRESERVING (one output char per input
 * char). That keeps token offsets valid in the ORIGINAL text, which the UI
 * needs for highlighting and snippets.
 */

/** Look-alike characters folded to plain ASCII (each maps 1 char -> 1 char). */
const CHAR_MAP: Record<string, string> = {
  // quotes and apostrophes
  "‘": "'", "’": "'", "‚": "'", "‛": "'", "′": "'", "`": "'",
  "“": '"', "”": '"', "„": '"', "‟": '"', "″": '"',
  // dashes and hyphens (hyphen, non-breaking hyphen, figure, en, em, bar, minus...)
  "‐": "-", "‑": "-", "‒": "-", "–": "-", "—": "-",
  "―": "-", "−": "-", "﹘": "-", "﹣": "-", "－": "-",
  // slashes
  "⁄": "/", "∕": "/", "／": "/",
  // odd spaces
  " ": " ", " ": " ", " ": " ", "​": " ",
  // full-width plus / hash
  "＋": "+", "＃": "#",
};

/** Lowercase, fold accents (é -> e), and unify quotes/dashes/slashes. */
export function normalizeText(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const mapped = CHAR_MAP[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    const folded = ch.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    out += folded.length === 1 ? folded : ch;
  }
  return out;
}

/**
 * Special tokens kept whole, so "c++" is not read as "c" and "a/b" is not
 * split into "a" and "b". Matched case-insensitively on normalized text.
 */
export const PROTECTED_TOKENS = [
  "c++", "c#", "f#", ".net", "node.js", "a/b", "ci/cd", "ui/ux", "p&l", "r&d",
] as const;
const PROTECTED_SET = new Set<string>(PROTECTED_TOKENS);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const TOKEN_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${PROTECTED_TOKENS.map(escapeRe).join("|")})(?![\\p{L}\\p{N}])` +
    `|[\\p{L}\\p{N}]+(?:'[\\p{L}\\p{N}]+)*`,
  "gu",
);

export interface Token {
  /** Exact text as it appears in the original input. */
  text: string;
  /** Lowercased, accent-folded, possessive removed. */
  norm: string;
  /** Light-stemmed form used for matching. */
  stem: string;
  start: number;
  end: number;
  /** True for all-caps words like "PM" or "KPIs" (used for acronym rules). */
  upper: boolean;
  isProtected: boolean;
}

export interface TokenizedText {
  original: string;
  normalized: string;
  tokens: Token[];
}

export function isProtectedToken(norm: string): boolean {
  return PROTECTED_SET.has(norm);
}

export function tokenize(raw: string): TokenizedText {
  const normalized = normalizeText(raw);
  const tokens: Token[] = [];
  for (const m of normalized.matchAll(TOKEN_RE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const text = raw.slice(start, end);
    const isProtected = PROTECTED_SET.has(m[0]);
    let norm = m[0];
    let upper = false;
    if (!isProtected) {
      norm = norm.replace(/'s$/, "").replace(/'/g, "");
      // "KPIs" -> core "KPI": an all-caps word with a lowercase plural "s".
      const noPossessive = text.replace(/['’]s$/, "");
      const pluralAcronym = /^\p{Lu}{2,}s$/u.test(noPossessive);
      const core = pluralAcronym ? noPossessive.slice(0, -1) : noPossessive;
      upper = core.length >= 2 && /\p{Lu}/u.test(core) && !/\p{Ll}/u.test(core);
      if (pluralAcronym) norm = norm.slice(0, -1);
    }
    tokens.push({ text, norm, stem: isProtected ? norm : stem(norm), start, end, upper, isProtected });
  }
  return { original: raw, normalized, tokens };
}

const HAS_VOWEL = /[aeiouy]/;

/**
 * Light suffix stemmer: plurals and -ing/-ed verb endings only.
 *
 * Why not a library (e.g. Porter)? Porter is aggressive: "organization" and
 * "organ" both become "organ", which would cause false matches. These rules
 * only need to make the JD, resume and dictionary agree with each other,
 * because all three go through the same function.
 *
 *   stakeholders -> stakeholder   strategies -> strategy
 *   prioritizing / prioritized / prioritize -> prioritiz
 *   roadmapping -> roadmap        launches -> launch
 */
export function stem(word: string): string {
  if (word.length <= 3 || !/^[a-z]+$/.test(word)) return word;
  let w = word;

  // Plurals
  if (w.endsWith("ies") && w.length > 4) w = w.slice(0, -3) + "y";
  else if (w.endsWith("sses")) w = w.slice(0, -2);
  else if (/(?:x|z|ch|sh)es$/.test(w)) w = w.slice(0, -2);
  else if (w.endsWith("s") && !/(?:ss|us|is)$/.test(w)) w = w.slice(0, -1);

  // Verb endings
  const suffix = w.endsWith("ing") ? 3 : w.endsWith("ed") && !w.endsWith("eed") ? 2 : 0;
  if (suffix) {
    const base = w.slice(0, -suffix);
    if (base.length >= 3 && HAS_VOWEL.test(base)) {
      w = base;
      // shipp -> ship, but keep install, process, buzz
      if (/([b-df-hj-np-tv-z])\1$/.test(w) && !/(?:ll|ss|zz)$/.test(w)) w = w.slice(0, -1);
    }
  }

  // manage / managing / managed -> manag
  if (w.length > 3 && w.endsWith("e") && !w.endsWith("ee")) w = w.slice(0, -1);
  return w;
}
