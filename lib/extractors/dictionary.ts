import type { DictionaryEntry } from "../dictionary";
import { analyzeJdStructure, placementRank, sortPlacements } from "../jdStructure";
import { tokenize } from "../normalize";
import { compileForm, createMatcher, type CompiledForm } from "../phraseMatcher";
import { sentenceSpans, snippetAt } from "../snippets";
import type { KeywordCandidate, KeywordExtractor, Occurrence, TextSpan } from "./types";

const MAX_SNIPPETS = 3;

/**
 * Up to 3 distinct snippets, taking mentions from the most important part of
 * the JD first (title, then requirements, ...), then in reading order.
 */
function pickSnippets(jdText: string, spans: TextSpan[], occurrences: Occurrence[]): string[] {
  const ordered = [...occurrences].sort(
    (a, b) => placementRank(a.placement) - placementRank(b.placement) || a.start - b.start,
  );
  const snippets: string[] = [];
  for (const o of ordered) {
    if (snippets.length >= MAX_SNIPPETS) break;
    const snippet = snippetAt(jdText, spans, o);
    if (!snippets.includes(snippet)) snippets.push(snippet);
  }
  return snippets;
}

/**
 * Finds dictionary terms and synonyms in a JD.
 * Synonym hits count toward their canonical term.
 * Each mention is tagged with its placement (title, required, ...).
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
      const structure = analyzeJdStructure(jdText);
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
            placements: [],
          };
          grouped.set(entry.id, c);
        }
        c.jdCount++;
        c.occurrences.push({ start: hit.start, end: hit.end, placement: structure.placementAt(hit.start) });
        if (!c.matchedForms.includes(hit.form)) c.matchedForms.push(hit.form);
      }

      for (const c of grouped.values()) {
        c.placements = sortPlacements(c.occurrences.map((o) => o.placement));
        c.jdSnippets = pickSnippets(jdText, spans, c.occurrences);
      }

      return [...grouped.values()].sort(
        (a, b) => b.jdCount - a.jdCount || a.canonical.localeCompare(b.canonical),
      );
    },
  };
}
