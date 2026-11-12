import type { DictionaryEntry } from "../dictionary";
import { tokenize } from "../normalize";
import { compileForm, createMatcher, type CompiledForm } from "../phraseMatcher";
import { sentenceSpans, snippetAt } from "../snippets";
import type { KeywordCandidate, KeywordExtractor } from "./types";

const MAX_SNIPPETS = 3;

/**
 * Finds dictionary terms and synonyms in a JD.
 * Synonym hits count toward their canonical term.
 */
export function createDictionaryExtractor(entries: DictionaryEntry[]): KeywordExtractor {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const forms: CompiledForm[] = [];
  for (const e of entries) {
    for (const f of [e.term, ...e.synonyms]) {
      const compiled = compileForm(f, e.id);
      if (compiled) forms.push(compiled);
    }
  }
  const matcher = createMatcher(forms);

  return {
    name: "dictionary",
    extract(jdText: string): KeywordCandidate[] {
      const doc = tokenize(jdText);
      const hits = matcher.find(doc, { allowOverlap: false });
      if (hits.length === 0) return [];
      const spans = sentenceSpans(jdText);
      const grouped = new Map<string, KeywordCandidate>();

      for (const hit of hits) {
        const entry = byId.get(hit.key)!;
        let c = grouped.get(entry.id);
        if (!c) {
          c = {
            id: entry.id,
            canonical: entry.term,
            matchedForms: [],
            jdCount: 0,
            jdSnippets: [],
            source: "dictionary",
            category: entry.category,
            searchForms: [entry.term, ...entry.synonyms],
            occurrences: [],
          };
          grouped.set(entry.id, c);
        }
        c.jdCount++;
        c.occurrences.push({ start: hit.start, end: hit.end });
        if (!c.matchedForms.includes(hit.form)) c.matchedForms.push(hit.form);
        if (c.jdSnippets.length < MAX_SNIPPETS) {
          const snippet = snippetAt(jdText, spans, hit);
          if (!c.jdSnippets.includes(snippet)) c.jdSnippets.push(snippet);
        }
      }

      return [...grouped.values()].sort(
        (a, b) => b.jdCount - a.jdCount || a.canonical.localeCompare(b.canonical),
      );
    },
  };
}
