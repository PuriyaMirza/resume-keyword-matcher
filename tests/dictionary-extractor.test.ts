import { describe, it, expect } from "vitest";
import { counts, extractor, fixture } from "./helpers";

describe("acronyms", () => {
  it("matches PM, GTM, KPI, OKR, SQL including plurals", () => {
    const c = counts("Senior PM. Own GTM. Track KPIs and OKRs. Write SQL.");
    expect(c).toMatchObject({ "product-management": 1, "go-to-market": 1, kpi: 1, okr: 1, sql: 1 });
  });

  it("ignores lowercase 'pm' (a time) but keeps lowercase sql/kpi", () => {
    expect(counts("Standup at 5 pm daily")).toEqual({});
    expect(counts("strong sql and kpi skills")).toMatchObject({ sql: 1, kpi: 1 });
  });

  it("IT only matches in capitals", () => {
    expect(counts("translate it into a plan")).toEqual({});
    expect(counts("Work with IT and information technology teams")).toEqual({ it: 2 });
  });
});

describe("A/B testing", () => {
  it.each(["A/B testing", "a/b tests", "AB testing", "A∕B testing", "split testing"])("matches %s", (s) => {
    expect(counts(`We do ${s}.`)).toEqual({ "ab-testing": 1 });
  });
});

describe("hyphenation variants", () => {
  it.each([
    "cross-functional",
    "cross functional",
    "cross‑functional",
    "cross–functional",
    "crossfunctional",
    "Cross-Functional",
  ])("matches %s", (s) => {
    expect(counts(`Lead ${s} teams.`)).toEqual({ "cross-functional": 1 });
  });

  it("matches a phrase broken across one line (PDF copy-paste)", () => {
    expect(counts("Lead cross-\nfunctional teams")).toEqual({ "cross-functional": 1 });
  });
});

describe("plurals and verb endings", () => {
  it("matches singular/plural and verb forms", () => {
    expect(counts("Align stakeholders. Build roadmaps. Prioritizing work. Product strategies.")).toEqual({
      "stakeholder-management": 1,
      roadmap: 1,
      prioritization: 1,
      "product-strategy": 1,
    });
  });
});

describe("word boundaries", () => {
  it("does not match inside other words", () => {
    expect(counts("NoSQL stores, rapid iteration, roadmapper-ish, capital")).toEqual({});
  });

  it("does not match a phrase across a sentence boundary or comma", () => {
    expect(counts("We love big data. Science matters too.")).toEqual({});
    expect(counts("data, science")).toEqual({});
    expect(counts("Background in data science.")).toEqual({ "data-science": 1 });
  });
});

describe("short ambiguous terms", () => {
  it("never matches bare 'go' or 'R'", () => {
    expect(counts("We go fast. R is a letter. Grade: R. R&D budget.")).toEqual({});
  });

  it("matches them through an unambiguous synonym", () => {
    expect(counts("Golang services, R programming, RStudio")).toEqual({ golang: 1, "r-language": 2 });
  });

  it("matches C++ without matching C", () => {
    expect(counts("C++ and C experience")).toEqual({ cpp: 1 });
  });
});

describe("synonyms and phrases", () => {
  it("synonyms count toward the canonical term", () => {
    const [gtm] = extractor.extract("Own go-to-market. Drive GTM. Go to market fast.");
    expect(gtm.canonical).toBe("Go-to-Market");
    expect(gtm.jdCount).toBe(3);
    expect(gtm.matchedForms.sort()).toEqual(["GTM", "Go-to-Market"]);
  });

  it("longest phrase wins in the JD", () => {
    expect(counts("Own the product roadmap.")).toEqual({ "product-roadmap": 1 });
  });

  it("sorts candidates by JD count", () => {
    const ids = extractor.extract("SQL. Agile. SQL. SQL. Agile. KPI.").map((c) => c.id);
    expect(ids).toEqual(["sql", "agile", "kpi"]);
  });
});

describe("snippets and offsets", () => {
  const jd = fixture("jd-synthetic.txt");
  const byId = Object.fromEntries(extractor.extract(jd).map((c) => [c.id, c]));

  it("returns the JD sentence, with bullets stripped", () => {
    expect(byId["go-to-market"].jdSnippets).toEqual([
      "Lead go-to-market planning with marketing and sales for each launch.",
    ]);
  });

  it("keeps at most 3 unique snippets", () => {
    for (const c of Object.values(byId)) {
      expect(c.jdSnippets.length).toBeLessThanOrEqual(3);
      expect(new Set(c.jdSnippets).size).toBe(c.jdSnippets.length);
    }
  });

  it("occurrences point at the matched text in the original JD", () => {
    const texts = byId["product-management"].occurrences.map((o) => jd.slice(o.start, o.end));
    expect(texts).toEqual(["Product Manager", "PM", "product manager"]);
  });

  it("truncates very long sentences with an ellipsis", () => {
    const long = "word ".repeat(80) + "SQL " + "word ".repeat(80);
    const [sql] = extractor.extract(long);
    expect(sql.jdSnippets[0].length).toBeLessThanOrEqual(222);
    expect(sql.jdSnippets[0]).toContain("SQL");
    expect(sql.jdSnippets[0].startsWith("…")).toBe(true);
  });
});

describe("edge inputs", () => {
  it("empty or keyword-free JD gives no candidates", () => {
    expect(extractor.extract("")).toEqual([]);
    expect(extractor.extract("Hello there, nice weather.")).toEqual([]);
  });
});
