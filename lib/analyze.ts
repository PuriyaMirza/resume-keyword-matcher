import type { KeywordCandidate, KeywordExtractor } from "./extractors/types";
import { matchResume, type MatchResult } from "./match";
import { DEFAULT_SCORING, type ScoringConfig } from "./scoring";

export interface AnalysisResult extends MatchResult {
  candidates: KeywordCandidate[];
}

/**
 * Run an extractor on the JD, then match against the resume.
 * The JD is treated purely as data: nothing in it is ever executed or obeyed.
 */
export function analyze(
  jdText: string,
  resumeText: string,
  extractor: KeywordExtractor,
  config: ScoringConfig = DEFAULT_SCORING,
): AnalysisResult {
  const candidates = extractor.extract(jdText);
  return { ...matchResume(candidates, resumeText, config), candidates };
}
