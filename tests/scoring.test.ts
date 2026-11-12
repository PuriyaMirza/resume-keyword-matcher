import { describe, it, expect } from "vitest";
import type { Placement } from "@/lib/extractors/types";
import { matchResume } from "@/lib/match";
import { DEFAULT_SCORING, keywordWeight, priorityFor, priorityReasons, scorePercent } from "@/lib/scoring";
import { extractor, fixture } from "./helpers";

const occ = (...placements: Placement[]) => placements.map((placement, i) => ({ start: i, end: i + 1, placement }));

describe("keywordWeight (placement x category)", () => {
  it("sums placement multipliers, times the category multiplier", () => {
    expect(keywordWeight(["required"], "delivery")).toBe(1.5);
    expect(keywordWeight(["title"], "core-pm")).toBe(3.75);
    expect(keywordWeight(["responsibilities", "other"], "data")).toBe(2.25);
    expect(keywordWeight(["preferred"], "technical")).toBe(0.9);
    expect(keywordWeight(["boilerplate"], undefined)).toBe(0.4 * DEFAULT_SCORING.defaultMultiplier);
    expect(keywordWeight([], "delivery")).toBe(0);
  });

  it("counts only the top 3 mentions, picking the highest placements", () => {
    // Order of mentions does not matter: title, required, responsibilities win.
    const p: Placement[] = ["boilerplate", "preferred", "responsibilities", "boilerplate", "title", "required"];
    expect(keywordWeight(p, "delivery")).toBe(2.5 + 1.5 + 1.25);
    expect(keywordWeight(["other", "other", "other", "other", "other"], "delivery")).toBe(3);
  });

  it("has no float noise", () => {
    expect(keywordWeight(["preferred", "preferred", "preferred"], "core-pm")).toBe(2.7);
  });

  it("uses the config numbers", () => {
    const config = { ...DEFAULT_SCORING, frequencyCap: 1 };
    expect(keywordWeight(["required", "title"], "delivery", config)).toBe(2.5);
  });
});

describe("priority tiers", () => {
  it("high >= 2.25, medium >= 1, low below", () => {
    expect(priorityFor(2.25)).toBe("high");
    expect(priorityFor(2.2499)).toBe("medium");
    expect(priorityFor(1)).toBe("medium");
    expect(priorityFor(0.9)).toBe("low");
  });

  it("one required core-pm mention is high; one nice-to-have is low", () => {
    expect(priorityFor(keywordWeight(["required"], "core-pm"))).toBe("high");
    expect(priorityFor(keywordWeight(["preferred"], "core-pm"))).toBe("low");
  });
});

describe("priority reasons", () => {
  it("lists the reasons that apply, in order", () => {
    expect(priorityReasons({ jdCount: 3, occurrences: occ("responsibilities", "title", "required") })).toEqual([
      "In the job title", "Listed as required", "In the responsibilities", "Mentioned 3 times",
    ]);
  });

  it("nice-to-have only when there is no stronger placement", () => {
    expect(priorityReasons({ jdCount: 1, occurrences: occ("preferred") })).toEqual(["Listed as nice-to-have"]);
    expect(priorityReasons({ jdCount: 2, occurrences: occ("preferred", "required") })).toEqual([
      "Listed as required", "Mentioned 2 times",
    ]);
  });

  it("flags keywords found only in company/benefits text", () => {
    expect(priorityReasons({ jdCount: 2, occurrences: occ("boilerplate", "boilerplate") })).toEqual([
      "Only in company/benefits text", "Mentioned 2 times",
    ]);
    expect(priorityReasons({ jdCount: 2, occurrences: occ("boilerplate", "other") })).toEqual(["Mentioned 2 times"]);
  });
});

describe("score", () => {
  it("is a rounded percent, null with nothing to score", () => {
    expect(scorePercent(1, 3)).toBe(33);
    expect(scorePercent(0, 0)).toBeNull();
  });

  it("a keyword once under Requirements outranks one 3 times under About us", () => {
    const r = matchResume(extractor.extract(fixture("jd-sections.txt")), "I like painting.");
    const kpi = r.missing.find((k) => k.id === "kpi")!;
    const agile = r.missing.find((k) => k.id === "agile")!;
    expect(kpi.jdCount).toBe(1);
    expect(agile.jdCount).toBe(3);
    expect(kpi.weight).toBe(1.5); // required 1.5 x data 1
    expect(agile.weight).toBe(1.2); // 3 x boilerplate 0.4 x delivery 1
    const order = r.plan.add.map((k) => k.id);
    expect(order.indexOf("kpi")).toBeLessThan(order.indexOf("agile"));
  });
});
