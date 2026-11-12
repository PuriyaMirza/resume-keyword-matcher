/**
 * Word-boundary phrase matching on token sequences.
 * Because we compare whole tokens, "sql" never matches inside "nosql" and
 * "api" never matches inside "rapid".
 */
import { tokenize, type Token, type TokenizedText } from "./normalize";

export interface FormToken {
  stem: string;
  /** Text token must be ALL CAPS (e.g. "PM" so "5 pm" is ignored). */
  requireUpper: boolean;
}

export interface CompiledForm {
  /** Which keyword this form belongs to. */
  key: string;
  /** The form as written in the dictionary. */
  form: string;
  tokens: FormToken[];
}

export interface PhraseHit {
  key: string;
  form: string;
  start: number;
  end: number;
}

/**
 * Acronyms whose lowercase spelling is an everyday word or abbreviation.
 * These only match when written in capitals: "PM" yes, "5 pm" no; "IT" yes, "it" no.
 * Other acronyms (SQL, KPI, OKR, GTM) match in any case.
 */
const CASE_SENSITIVE_ACRONYMS = new Set([
  "am", "pm", "it", "us", "as", "or", "an", "on", "in", "at", "do", "go", "no", "so", "hr", "ok",
]);

function isAcronym(t: Token): boolean {
  return !t.isProtected && t.upper && /^\p{L}{2,5}$/u.test(t.text);
}

/**
 * Turn a dictionary form into a matchable token pattern.
 * Returns null for forms that are too ambiguous to match on their own:
 * a single short word (1-2 letters) that is not a capitalized acronym,
 * e.g. "Go" or "R". Such entries need a longer synonym ("Golang", "R programming").
 */
export function compileForm(form: string, key: string): CompiledForm | null {
  const { tokens } = tokenize(form);
  if (tokens.length === 0) return null;
  if (tokens.length === 1) {
    const t = tokens[0];
    if (!t.isProtected && t.norm.length <= 2 && !isAcronym(t)) return null;
  }
  return {
    key,
    form,
    tokens: tokens.map((t) => ({
      stem: t.stem,
      requireUpper: isAcronym(t) && CASE_SENSITIVE_ACRONYMS.has(t.norm),
    })),
  };
}

/** Text allowed between two words of one phrase: spaces, hyphens, slashes, at most one line break. */
const GAP_RE = /^[ \t\-/]*(?:\r?\n[ \t\-/]*)?$/;

export interface Matcher {
  /**
   * allowOverlap=false: longest match wins and consumes its words (used for the JD,
   *   so "product roadmap" is not also counted as "roadmap").
   * allowOverlap=true: every form is checked independently (used for the resume).
   */
  find(doc: TokenizedText, opts: { allowOverlap: boolean }): PhraseHit[];
}

export function createMatcher(forms: CompiledForm[]): Matcher {
  const byFirstStem = new Map<string, CompiledForm[]>();
  const seen = new Set<string>();
  for (const f of forms) {
    const sig = f.key + "|" + f.tokens.map((t) => `${t.stem}:${t.requireUpper}`).join(" ");
    if (seen.has(sig)) continue; // "go-to-market" and "go to market" compile identically
    seen.add(sig);
    const first = f.tokens[0].stem;
    const list = byFirstStem.get(first) ?? [];
    list.push(f);
    byFirstStem.set(first, list);
  }
  for (const list of byFirstStem.values()) list.sort((a, b) => b.tokens.length - a.tokens.length);

  function matchesAt(doc: TokenizedText, i: number, form: CompiledForm): boolean {
    const { tokens, normalized } = doc;
    if (i + form.tokens.length > tokens.length) return false;
    for (let k = 0; k < form.tokens.length; k++) {
      const t = tokens[i + k];
      const ft = form.tokens[k];
      if (t.stem !== ft.stem) return false;
      if (ft.requireUpper && !t.upper) return false;
      if (k > 0 && !GAP_RE.test(normalized.slice(tokens[i + k - 1].end, t.start))) return false;
    }
    return true;
  }

  return {
    find(doc, { allowOverlap }) {
      const hits: PhraseHit[] = [];
      const { tokens } = doc;
      let i = 0;
      while (i < tokens.length) {
        const candidates = byFirstStem.get(tokens[i].stem);
        let consumed = 1;
        if (candidates) {
          for (const form of candidates) {
            if (!matchesAt(doc, i, form)) continue;
            const last = tokens[i + form.tokens.length - 1];
            hits.push({ key: form.key, form: form.form, start: tokens[i].start, end: last.end });
            if (!allowOverlap) {
              consumed = form.tokens.length;
              break;
            }
          }
        }
        i += consumed;
      }
      return hits;
    },
  };
}
