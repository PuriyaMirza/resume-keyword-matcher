import { describe, it, expect } from "vitest";
import { analyze } from "@/lib/analyze";
import { PLAN_REASONS, classifyPlan, dedupeSpans, matchResume, type MatchResult } from "@/lib/match";
import { extractor, fixture } from "./helpers";

function run(jd: string, resume: string): MatchResult {
  return matchResume(extractor.extract(jd), resume);
}

/** Which plan group each keyword landed in. */
function groups(r: MatchResult): Record<string, string> {
  const out: Record<string, string> = {};
  for (const g of ["add", "strengthen", "covered"] as const) for (const k of r.plan[g]) out[k.id] = g;
  return out;
}

const item = (r: MatchResult, id: string) =>
  [...r.plan.add, ...r.plan.strengthen, ...r.plan.covered].find((k) => k.id === id)!;

describe("plan groups", () => {
  it("add: not in the resume", () => {
    const r = run("Requirements\n- Strong SQL.", "Experience\n- Led design reviews.");
    expect(groups(r)).toEqual({ sql: "add" });
    expect(item(r, "sql").planReason).toBeNull();
  });

  it("strengthen rule 1: only in the skills list", () => {
    const r = run("Requirements\n- Agile delivery.", "Experience\n- Led teams.\nSkills\nAgile, Jira");
    expect(item(r, "agile").priority).toBe("medium");
    expect(groups(r)).toEqual({ agile: "strengthen" });
    expect(item(r, "agile").planReason).toBe(PLAN_REASONS.skillsOnly);
  });

  it("rule 1 is checked before rule 2", () => {
    const r = run("Requirements\n- Strong SQL.", "Experience\n- Led teams.\nSkills\nSQL, Jira");
    expect(item(r, "sql").priority).toBe("high");
    expect(item(r, "sql").planReason).toBe(PLAN_REASONS.skillsOnly);
  });

  it("strengthen rule 2: high priority mentioned once", () => {
    const r = run("Requirements\n- Strong SQL.", "Experience\n- Wrote SQL reports.");
    expect(groups(r)).toEqual({ sql: "strengthen" });
    expect(item(r, "sql").planReason).toBe(PLAN_REASONS.mentionedOnce);
    expect(item(r, "sql").resume.snippets).toEqual(["Wrote SQL reports."]);
  });

  it("covered: high priority mentioned twice, or medium mentioned once outside skills", () => {
    const r = run(
      "Requirements\n- Strong SQL.\n- Agile delivery.",
      "Experience\n- Wrote SQL reports.\n- Taught SQL to the team.\n- Ran Agile rituals.",
    );
    expect(groups(r)).toEqual({ sql: "covered", agile: "covered" });
    expect(item(r, "sql").resume.count).toBe(2);
    expect(item(r, "sql").planReason).toBeNull();
  });

  it("low priority is never strengthen", () => {
    const r = run("Nice to have\n- Golang.", "Experience\n- Led teams.\nSkills\nGolang");
    expect(item(r, "golang").priority).toBe("low");
    expect(groups(r)).toEqual({ golang: "covered" });
  });

  it("a resume with no headings never triggers rule 1, but rule 2 still applies", () => {
    const r = run("Requirements\n- Agile delivery.\n- Strong SQL.", "Agile, Jira, SQL, Python");
    expect(groups(r)).toEqual({ agile: "covered", sql: "strengthen" });
    expect(item(r, "sql").planReason).toBe(PLAN_REASONS.mentionedOnce);
  });

  it("classifyPlan works on its own", () => {
    expect(classifyPlan("high", { count: 0, placements: [] }, true).group).toBe("add");
    expect(classifyPlan("medium", { count: 3, placements: ["skills"] }, true).group).toBe("strengthen");
    expect(classifyPlan("medium", { count: 3, placements: ["skills"] }, false).group).toBe("covered");
    expect(classifyPlan("medium", { count: 1, placements: ["experience"] }, true).group).toBe("covered");
    expect(classifyPlan("high", { count: 1, placements: ["experience"] }, true).group).toBe("strengthen");
    expect(classifyPlan("low", { count: 1, placements: ["skills"] }, true).group).toBe("covered");
  });

  it("score counts strengthen items as fully matched", () => {
    const r = run("Requirements\n- Strong SQL.", "Experience\n- Wrote SQL reports.");
    expect(r.score).toBe(100);
    expect(r.matched.map((k) => k.id)).toEqual(["sql"]);
  });
});

describe("resume hit de-duplication", () => {
  it("overlapping forms of one keyword count once", () => {
    // "stakeholder management" also matches the synonym "stakeholders" on the same words.
    const r = run("Requirements\n- Stakeholder management.", "Experience\n- Led stakeholder management.");
    const k = item(r, "stakeholder-management");
    expect(k.resume.count).toBe(1);
    expect(k.group).toBe("strengthen");
  });

  it("separate mentions still count separately", () => {
    const r = run("Requirements\n- Stakeholder management.", "Experience\n- Led stakeholder management.\n- Briefed stakeholders.");
    expect(item(r, "stakeholder-management").resume.count).toBe(2);
    expect(item(r, "stakeholder-management").resume.snippets).toEqual([
      "Led stakeholder management.", "Briefed stakeholders.",
    ]);
  });

  it("dedupeSpans keeps the longest hit at each place", () => {
    const spans = [{ start: 4, end: 16 }, { start: 4, end: 26 }, { start: 30, end: 35 }, { start: 32, end: 34 }];
    expect(dedupeSpans(spans)).toEqual([{ start: 4, end: 26 }, { start: 30, end: 35 }]);
  });
});

describe("plan ordering", () => {
  it("sorts by weight, then JD count, then name", () => {
    // SQL: required 1.5 x 1.5 = 2.25. Agile (0.6 + 0.4) and KPI (1) tie on weight; Agile has more
    // mentions. A/B testing and data science tie on weight and mentions, so A-Z.
    const jd = "KPI matters.\nRequirements\n- Strong SQL.\nNice to have\n- Agile.\n- A/B testing.\n- Data science.\nAbout us\n- Agile lovers.";
    const r = run(jd, "nothing");
    expect(r.plan.add.map((k) => [k.id, k.weight])).toEqual([
      ["sql", 2.25], ["agile", 1], ["kpi", 1], ["ab-testing", 0.6], ["data-science", 0.6],
    ]);
  });

  it("the fixture plan has all three groups, each sorted", () => {
    const r = analyze(fixture("jd-synthetic.txt"), fixture("resume-fake.txt"), extractor);
    expect(r.plan.add.map((k) => k.id)).toEqual([
      "api", "go-to-market", "okr", "product-roadmap", "product-strategy", "golang", "r-language",
    ]);
    expect(r.plan.strengthen.map((k) => [k.id, k.planReason])).toEqual([
      ["cross-functional", PLAN_REASONS.mentionedOnce],
      ["sql", PLAN_REASONS.mentionedOnce],
      ["agile", PLAN_REASONS.skillsOnly],
    ]);
    expect(r.plan.covered[0].id).toBe("product-management");
    expect(r.missing).toEqual(r.plan.add);
  });
});
