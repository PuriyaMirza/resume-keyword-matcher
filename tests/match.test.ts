import { describe, it, expect } from "vitest";
import { analyze } from "@/lib/analyze";
import { matchResume } from "@/lib/match";
import { extractor, fixture } from "./helpers";

const jd = fixture("jd-synthetic.txt");
const resume = fixture("resume-fake.txt");

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

  it("finds the expected missing keywords, heaviest first", () => {
    expect(ids(result.missing)).toEqual(
      ["api", "go-to-market", "golang", "okr", "product-roadmap", "product-strategy", "r-language"].sort(),
    );
    const weightsInOrder = result.missing.map((k) => k.weight);
    expect(weightsInOrder).toEqual([...weightsInOrder].sort((a, b) => b - a));
    // API is listed under "What you bring"; Golang and R only as a "Bonus".
    expect(result.missing[0].id).toBe("api");
    expect(result.missing.slice(-2).map((k) => k.id)).toEqual(["golang", "r-language"]);
  });

  it("computes the weighted score", () => {
    // matched 26.75 of 38.3 weight units -> 70%
    expect(result.matchedWeight).toBe(26.75);
    expect(result.totalWeight).toBe(38.3);
    expect(result.score).toBe(70);
  });

  it("weights the job title highest", () => {
    const pm = result.matched.find((k) => k.id === "product-management")!;
    expect(pm.placements).toEqual(["title", "required", "responsibilities"]);
    expect(pm.weight).toBe((2.5 + 1.5 + 1.25) * 1.5);
    expect(pm.reasons[0]).toBe("In the job title");
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
  const readmeJd = [
    "Product Manager",
    "Requirements",
    "- 3+ years as a product manager.",
    "- Strong SQL.",
    "- Agile delivery experience.",
    "Responsibilities",
    "- Run Agile ceremonies.",
    "Nice to have",
    "- OKRs.",
    "About us",
    "We are an Agile company. Agile is in our name.",
  ].join("\n");

  it("title + required Product Management (found), SQL (missing), Agile x4 (found), OKR (missing) scores 74%", () => {
    const r = matchResume(extractor.extract(readmeJd), "Product manager. Agile coach.");
    const w = Object.fromEntries([...r.matched, ...r.missing].map((k) => [k.id, k.weight]));
    expect(w).toEqual({ "product-management": 6, sql: 2.25, agile: 3.15, okr: 0.9 });
    expect(r.matchedWeight).toBe(9.15);
    expect(r.totalWeight).toBe(12.3);
    expect(r.score).toBe(74);
  });
});
