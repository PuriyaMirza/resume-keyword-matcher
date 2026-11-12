import type { Category, KeywordCandidate, Placement } from "./extractors/types";

/**
 * Score weighting: where the JD mentions a keyword x category.
 *
 *   weight = categoryMultiplier x (sum of the placement multipliers of the
 *            keyword's top `frequencyCap` mentions, highest first)
 *   score  = round(100 x matched weight / total weight)
 *
 * Edit these numbers to tune the score. No other code needs to change.
 */
export type Priority = "high" | "medium" | "low";

export interface ScoringConfig {
  /** Only the best N mentions count, so repeating a word 10 times doesn't dominate. */
  frequencyCap: number;
  categoryMultipliers: Record<Category, number>;
  /** Used when a keyword has no category (e.g. a future TF-IDF keyword). */
  defaultMultiplier: number;
  /** How much one mention counts, by where it sits in the JD. */
  placementMultipliers: Record<Placement, number>;
  /** Weight needed for each priority tier; anything below "medium" is low. */
  priorityThresholds: { high: number; medium: number };
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
  placementMultipliers: {
    title: 2.5,
    required: 1.5,
    responsibilities: 1.25,
    other: 1,
    preferred: 0.6,
    boilerplate: 0.4,
  },
  priorityThresholds: { high: 2.25, medium: 1 },
};

/** Round away float noise (0.6 x 1.5 = 0.8999999...) so tiers and totals are exact. */
const tidy = (n: number) => Math.round(n * 10000) / 10000;

/** Weight from the placement of every JD mention (one entry per mention). */
export function keywordWeight(
  placements: readonly Placement[],
  category: Category | undefined,
  config: ScoringConfig = DEFAULT_SCORING,
): number {
  const best = placements
    .map((p) => config.placementMultipliers[p])
    .sort((a, b) => b - a)
    .slice(0, Math.max(config.frequencyCap, 0));
  const sum = best.reduce((total, m) => total + m, 0);
  const mult = category ? config.categoryMultipliers[category] : config.defaultMultiplier;
  return tidy(sum * mult);
}

export function priorityFor(weight: number, config: ScoringConfig = DEFAULT_SCORING): Priority {
  if (weight >= config.priorityThresholds.high) return "high";
  if (weight >= config.priorityThresholds.medium) return "medium";
  return "low";
}

/** Short plain-English reasons a keyword matters, most important first. */
export function priorityReasons(c: Pick<KeywordCandidate, "jdCount" | "occurrences">): string[] {
  const has = new Set(c.occurrences.map((o) => o.placement));
  const reasons: string[] = [];
  if (has.has("title")) reasons.push("In the job title");
  if (has.has("required")) reasons.push("Listed as required");
  if (has.has("responsibilities")) reasons.push("In the responsibilities");
  const strong = has.has("title") || has.has("required") || has.has("responsibilities");
  if (has.has("preferred") && !strong) reasons.push("Listed as nice-to-have");
  if (has.size === 1 && has.has("boilerplate")) reasons.push("Only in company/benefits text");
  if (c.jdCount >= 2) reasons.push(`Mentioned ${c.jdCount} times`);
  return reasons;
}

/** 0-100, or null when the JD had no recognizable keywords. */
export function scorePercent(matchedWeight: number, totalWeight: number): number | null {
  if (totalWeight <= 0) return null;
  return Math.round((100 * matchedWeight) / totalWeight);
}
