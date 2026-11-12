import type { KeywordCandidate } from "./extractors/types";
import { tokenize } from "./normalize";
import { compileForm, createMatcher, type CompiledForm } from "./phraseMatcher";
import { DEFAULT_SCORING, keywordWeight, scorePercent, type ScoringConfig } from "./scoring";

export interface ScoredKeyword extends KeywordCandidate {
  weight: number;
}

export interface MatchResult {
  /** 0-100, or null when the JD had no recognizable keywords. */
  score: number | null;
  matchedWeight: number;
  totalWeight: number;
  matched: ScoredKeyword[];
  /** Sorted by how often the JD uses them (most first). */
  missing: ScoredKeyword[];
}

const byImportance = (a: ScoredKeyword, b: ScoredKeyword) =>
  b.jdCount - a.jdCount || b.weight - a.weight || a.canonical.localeCompare(b.canonical);

/** Pure function: same inputs always give the same result. */
export function matchResume(
  candidates: KeywordCandidate[],
  resumeText: string,
  config: ScoringConfig = DEFAULT_SCORING,
): MatchResult {
  const forms: CompiledForm[] = [];
  for (const c of candidates) {
    for (const f of c.searchForms) {
      const compiled = compileForm(f, c.id);
      if (compiled) forms.push(compiled);
    }
  }
  const hits = createMatcher(forms).find(tokenize(resumeText), { allowOverlap: true });
  const found = new Set(hits.map((h) => h.key));

  const matched: ScoredKeyword[] = [];
  const missing: ScoredKeyword[] = [];
  let matchedWeight = 0;
  let totalWeight = 0;
  for (const c of candidates) {
    const scored = { ...c, weight: keywordWeight(c.jdCount, c.category, config) };
    totalWeight += scored.weight;
    if (found.has(c.id)) {
      matched.push(scored);
      matchedWeight += scored.weight;
    } else {
      missing.push(scored);
    }
  }
  matched.sort(byImportance);
  missing.sort(byImportance);
  return { score: scorePercent(matchedWeight, totalWeight), matchedWeight, totalWeight, matched, missing };
}
