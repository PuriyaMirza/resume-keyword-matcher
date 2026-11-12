import type { KeywordCandidate, TextSpan } from "./extractors/types";
import { tokenize } from "./normalize";
import { compileForm, createMatcher, type CompiledForm, type PhraseHit } from "./phraseMatcher";
import { analyzeResumeStructure, type ResumePlacement } from "./resumeStructure";
import {
  DEFAULT_SCORING,
  keywordWeight,
  priorityFor,
  priorityReasons,
  scorePercent,
  type Priority,
  type ScoringConfig,
} from "./scoring";
import { sentenceSpans, snippetAt } from "./snippets";

const MAX_RESUME_SNIPPETS = 2;

export type PlanGroup = "add" | "strengthen" | "covered";

/** Where (and how often) the resume mentions a keyword. */
export interface ResumeHits {
  /** Distinct mentions: overlapping hits of different forms count once. */
  count: number;
  spans: Array<TextSpan & { placement: ResumePlacement }>;
  /** Distinct sections the mentions are in. */
  placements: ResumePlacement[];
  /** Up to 2 resume sentences that contain the keyword. */
  snippets: string[];
}

export interface ScoredKeyword extends KeywordCandidate {
  weight: number;
  priority: Priority;
  /** Why it matters, e.g. ["Listed as required", "Mentioned 2 times"]. */
  reasons: string[];
  resume: ResumeHits;
  group: PlanGroup;
  /** For "strengthen" items: what to do about it. */
  planReason: string | null;
}

export type PlanItem = ScoredKeyword;

export interface ResumePlan {
  /** Not in the resume. */
  add: PlanItem[];
  /** In the resume, but only weakly for how much the posting stresses it. */
  strengthen: PlanItem[];
  /** In the resume, nothing to do. */
  covered: PlanItem[];
}

export interface MatchResult {
  /** 0-100, or null when the JD had no recognizable keywords. */
  score: number | null;
  matchedWeight: number;
  totalWeight: number;
  /** Found in the resume (covered + strengthen), most important first. */
  matched: ScoredKeyword[];
  /** Not found in the resume (same as plan.add), most important first. */
  missing: ScoredKeyword[];
  plan: ResumePlan;
}

export const PLAN_REASONS = {
  skillsOnly: "Only in your skills list. Show it in an experience bullet.",
  mentionedOnce: "Mentioned once, but this posting stresses it. Add it to your summary or a recent role.",
} as const;

/** Heaviest first, then most mentioned, then A-Z. */
export const byPriority = (a: ScoredKeyword, b: ScoredKeyword) =>
  b.weight - a.weight || b.jdCount - a.jdCount || a.canonical.localeCompare(b.canonical);

/**
 * Collapse overlapping hits into one. The resume matcher checks every form
 * separately, so "product roadmap" can hit both "product roadmap" and "roadmap"
 * for the same keyword; that is one mention, not two.
 */
export function dedupeSpans<T extends TextSpan>(hits: readonly T[]): T[] {
  const sorted = [...hits].sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: T[] = [];
  let reach = -1;
  for (const h of sorted) {
    if (h.start < reach) {
      reach = Math.max(reach, h.end);
      continue;
    }
    kept.push(h);
    reach = h.end;
  }
  return kept;
}

/** Which plan group a keyword belongs in, and the advice for "strengthen". */
export function classifyPlan(
  priority: Priority,
  hits: Pick<ResumeHits, "count" | "placements">,
  resumeHasHeadings: boolean,
): { group: PlanGroup; planReason: string | null } {
  if (hits.count === 0) return { group: "add", planReason: null };
  if (priority !== "low") {
    const onlySkills = hits.placements.length === 1 && hits.placements[0] === "skills";
    if (resumeHasHeadings && onlySkills) return { group: "strengthen", planReason: PLAN_REASONS.skillsOnly };
    if (priority === "high" && hits.count === 1) return { group: "strengthen", planReason: PLAN_REASONS.mentionedOnce };
  }
  return { group: "covered", planReason: null };
}

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
  const hitsByKey = new Map<string, PhraseHit[]>();
  for (const h of hits) hitsByKey.set(h.key, [...(hitsByKey.get(h.key) ?? []), h]);

  const structure = analyzeResumeStructure(resumeText);
  const sentences = sentenceSpans(resumeText);

  function resumeHits(id: string): ResumeHits {
    const spans = dedupeSpans(hitsByKey.get(id) ?? []).map((h) => ({
      start: h.start,
      end: h.end,
      placement: structure.placementAt(h.start),
    }));
    const snippets: string[] = [];
    for (const s of spans) {
      if (snippets.length >= MAX_RESUME_SNIPPETS) break;
      const snippet = snippetAt(resumeText, sentences, s);
      if (!snippets.includes(snippet)) snippets.push(snippet);
    }
    return { count: spans.length, spans, placements: [...new Set(spans.map((s) => s.placement))], snippets };
  }

  const all: ScoredKeyword[] = candidates.map((c) => {
    const weight = keywordWeight(c.occurrences.map((o) => o.placement), c.category, config);
    const priority = priorityFor(weight, config);
    const resume = resumeHits(c.id);
    return {
      ...c,
      weight,
      priority,
      reasons: priorityReasons(c),
      resume,
      ...classifyPlan(priority, resume, structure.hasHeadings),
    };
  });
  all.sort(byPriority);

  const plan: ResumePlan = {
    add: all.filter((k) => k.group === "add"),
    strengthen: all.filter((k) => k.group === "strengthen"),
    covered: all.filter((k) => k.group === "covered"),
  };
  const matched = all.filter((k) => k.group !== "add");
  const sum = (list: ScoredKeyword[]) => Math.round(list.reduce((t, k) => t + k.weight, 0) * 10000) / 10000;
  const matchedWeight = sum(matched);
  const totalWeight = sum(all);
  return {
    score: scorePercent(matchedWeight, totalWeight),
    matchedWeight,
    totalWeight,
    matched,
    missing: plan.add,
    plan,
  };
}
