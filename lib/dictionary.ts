import { CATEGORIES, type Category } from "./extractors/types";
import { compileForm } from "./phraseMatcher";

export interface DictionaryEntry {
  id: string;
  term: string;
  synonyms: string[];
  category: Category;
}

export interface Dictionary {
  status: string;
  entries: DictionaryEntry[];
}

/**
 * Check dictionary.json and return typed entries.
 * Throws one error listing every problem, so a bad edit is easy to fix.
 */
export function validateDictionary(data: unknown): Dictionary {
  const problems: string[] = [];
  const obj = data as { status?: unknown; entries?: unknown };
  if (!obj || typeof obj !== "object" || !Array.isArray(obj.entries)) {
    throw new Error('dictionary.json must be an object with an "entries" array');
  }
  const ids = new Set<string>();
  const formOwner = new Map<string, string>();
  const entries: DictionaryEntry[] = [];

  obj.entries.forEach((raw, i) => {
    const e = raw as Partial<DictionaryEntry>;
    const where = `entry #${i + 1}${typeof e?.id === "string" ? ` ("${e.id}")` : ""}`;
    if (typeof e?.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(e.id)) {
      problems.push(`${where}: "id" must be lowercase-with-dashes`);
      return;
    }
    if (ids.has(e.id)) problems.push(`${where}: duplicate id`);
    ids.add(e.id);
    if (typeof e.term !== "string" || !e.term.trim()) problems.push(`${where}: "term" must be a non-empty string`);
    if (!Array.isArray(e.synonyms) || e.synonyms.some((s) => typeof s !== "string" || !s.trim())) {
      problems.push(`${where}: "synonyms" must be an array of non-empty strings`);
    }
    if (!CATEGORIES.includes(e.category as Category)) {
      problems.push(`${where}: "category" must be one of ${CATEGORIES.join(", ")}`);
    }
    if (typeof e.term !== "string" || !Array.isArray(e.synonyms)) return;

    // The same form in two entries would make counts ambiguous.
    for (const form of [e.term, ...e.synonyms]) {
      const compiled = compileForm(String(form), e.id);
      if (!compiled) continue;
      const sig = compiled.tokens.map((t) => t.stem).join(" ");
      const owner = formOwner.get(sig);
      if (owner && owner !== e.id) problems.push(`${where}: form "${form}" is also used by "${owner}"`);
      else formOwner.set(sig, e.id);
    }
    entries.push({ id: e.id, term: e.term, synonyms: e.synonyms as string[], category: e.category as Category });
  });

  if (problems.length) throw new Error("dictionary.json has problems:\n- " + problems.join("\n- "));
  return { status: typeof obj.status === "string" ? obj.status : "unknown", entries };
}
