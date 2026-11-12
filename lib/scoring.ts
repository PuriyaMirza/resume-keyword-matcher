import type { Category } from "./extractors/types";

/**
 * Score weighting (option 2): frequency x category.
 *
 *   weight = min(jdCount, frequencyCap) x categoryMultiplier
 *   score  = round(100 x matched weight / total weight)
 *
 * Edit these numbers to tune the score. No other code needs to change.
 */
export interface ScoringConfig {
  frequencyCap: number;
  categoryMultipliers: Record<Category, number>;
  /** Used when a keyword has no category (e.g. a future TF-IDF keyword). */
  defaultMultiplier: number;
}

export const DEFAULT_SCORING: ScoringConfig = {
  frequencyCap: 3,
  categoryMultipliers: {
    "core-pm": 1.5,
    technical: 1.5,
    delivery: 1,
    data: 1,
    domain: 1,
  },
  defaultMultiplier: 1,
};

export function keywordWeight(
  jdCount: number,
  category: Category | undefined,
  config: ScoringConfig = DEFAULT_SCORING,
): number {
  const freq = Math.min(Math.max(jdCount, 0), config.frequencyCap);
  const mult = category ? config.categoryMultipliers[category] : config.defaultMultiplier;
  return freq * mult;
}

/** 0-100, or null when the JD had no recognizable keywords. */
export function scorePercent(matchedWeight: number, totalWeight: number): number | null {
  if (totalWeight <= 0) return null;
  return Math.round((100 * matchedWeight) / totalWeight);
}
