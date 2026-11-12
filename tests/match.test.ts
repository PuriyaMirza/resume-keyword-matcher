import { describe, it, expect } from "vitest";
import { analyze } from "@/lib/analyze";
import { matchResume } from "@/lib/match";
import { DEFAULT_SCORING, keywordWeight, scorePercent } from "@/lib/scoring";
import { extractor, fixture } from "./helpers";

const jd = fixture("jd-synthetic.txt");
const resume = fixture("resume-fake.txt");

describe("scoring weights (frequency x category)", () => {
  it("caps frequency at 3", () => {
    expect(keywordWeight(1, "delivery")).toBe(1);
    expect(keywordWeight(3, "delivery")).toBe(3);
    expect(keywordWeight(10, "delivery")).toBe(3);
  });

  it("applies category multipliers", () => {
    expect(keywordWeight(2, "core-pm")).toBe(3);
    expect(keywordWeight(2, "technical")).toBe(3);
    expect(keywordWeight(2, "data")).toBe(2);
    expect(keywordWeight(2, undefined)).toBe(2 * DEFAULT_SCORING.defaultMultiplier);
  });

  it("score is a rounded percent, null with nothing to score", () => {
    expect(scorePercent(1, 3)).toBe(33);
    expect(scorePercent(0, 0)).toBeNull();
  });
});

describe("fixture JD vs fake resume", () => {
  const result = analyze(jd, resume, extractor);
  const ids = (list: { id: string }[]) => list.map((k) => k.id).sort();

  it("finds the expected matched keywords", () => {
    expect(ids(result.matched)).toEqual(
      [
        "ab-testing", "agile", "cross-functional", "kpi", "logistics", "prioritization",
        "product-management", "roadmap", "sql", "stakeholder-management",
      ].sort(),
    );
  });

  it("finds the expected missing keywords, most-used first", () => {
    expect(ids(result.missing)).toEqual(
      ["api", "go-to-market", "golang", "okr", "product-roadmap", "product-strategy", "r-language"].sort(),
    );
    const countsInOrder = result.missing.map((k) => k.jdCount);
    expect(countsInOrder).toEqual([...countsInOrder].sort((a, b) => b - a));
  });

  it("computes the weighted score", () => {
    // matched 18.5 of 29 weight units -> 64%
    expect(result.matchedWeight).toBe(18.5);
    expect(result.totalWeight).toBe(29);
    expect(result.score).toBe(64);
  });

  it("does not count 'rapid' as API", () => {
    expect(result.missing.find((k) => k.id === "api")).toBeDefined();
  });
});

describe("matchResume behaviour", () => {
  it("resume can match through a different synonym than the JD used", () => {
    const r = matchResume(extractor.extract("Drive GTM."), "Led go-to-market for 3 launches.");
    expect(r.score).toBe(100);
  });

  it("resume matching allows overlap (product roadmap also counts as roadmap)", () => {
    const r = matchResume(extractor.extract("Own the roadmap."), "Owned the product roadmap.");
    expect(r.matched.map((k) => k.id)).toEqual(["roadmap"]);
  });

  it("0 when nothing matches, null when JD has no keywords", () => {
    expect(matchResume(extractor.extract("SQL and Agile"), "I like painting.").score).toBe(0);
    expect(matchResume([], "anything").score).toBeNull();
  });

  it("is pure: same input, same output, inputs untouched", () => {
    const candidates = extractor.extract(jd);
    const snapshot = JSON.stringify(candidates);
    expect(matchResume(candidates, resume)).toEqual(matchResume(candidates, resume));
    expect(JSON.stringify(candidates)).toBe(snapshot);
  });
});

describe("untrusted JD text", () => {
  it("instructions inside the JD have no effect on the result", () => {
    const withoutInjection = jd.replace(/^Ignore all previous instructions.*$/m, "");
    expect(analyze(jd, resume, extractor)).toEqual(analyze(withoutInjection, resume, extractor));
  });

  it("HTML in the JD is just text", () => {
    const r = analyze('<script>alert("x")</script> Strong SQL <img src=x onerror=alert(1)>', "SQL", extractor);
    expect(r.score).toBe(100);
    expect(r.matched[0].jdSnippets[0]).toContain("<script>");
  });
});

describe("README worked example", () => {
  it("PM x5 (found), SQL x1 (missing), Agile x2 (found) scores 81%", () => {
    const r = matchResume(extractor.extract("PM PM PM PM PM. SQL. Agile and Agile."), "PM with Agile");
    expect(r.matchedWeight).toBe(6.5);
    expect(r.totalWeight).toBe(8);
    expect(r.score).toBe(81);
  });
});
