import { describe, it, expect } from "vitest";
import { analyzeJdStructure, classifyJdHeading, detectTitle, sentenceCue } from "@/lib/jdStructure";
import { extractor, fixture } from "./helpers";

/** Placement of the first occurrence of `needle` in `text`. */
function placementOf(text: string, needle: string) {
  const at = text.indexOf(needle);
  if (at < 0) throw new Error(`"${needle}" not in text`);
  return analyzeJdStructure(text).placementAt(at);
}

const titleText = (text: string) => {
  const span = detectTitle(text);
  return span ? text.slice(span.start, span.end) : null;
};

describe("job title", () => {
  it("uses the text after a 'Job title:' style prefix on any line", () => {
    expect(titleText("Northwind Parcel\nJob title: Senior PM\nMore text.")).toBe("Senior PM");
    expect(titleText("Position:   Data Product Manager  ")).toBe("Data Product Manager");
    expect(titleText("ROLE: Platform PM\n")).toBe("Platform PM");
    expect(titleText("Title: Product Lead")).toBe("Product Lead");
  });

  it("otherwise uses the first non-empty line if short and not a sentence", () => {
    expect(titleText("\n\n  Senior Product Manager, Payments  \nAbout us")).toBe("Senior Product Manager, Payments");
  });

  it("skips a first line that ends with a period, is too long, or is a heading", () => {
    expect(titleText("We are hiring a product manager.\nMore")).toBeNull();
    expect(titleText("x".repeat(81))).toBeNull();
    expect(titleText("Requirements\n- SQL")).toBeNull();
    expect(titleText("")).toBeNull();
  });

  it("title placement covers the title only", () => {
    const jd = "Job title: SQL Analyst\nWe use SQL daily";
    expect(placementOf(jd, "SQL Analyst")).toBe("title");
    expect(placementOf(jd, "Job title")).toBe("other");
    expect(placementOf(jd, "SQL daily")).toBe("other");
  });
});

describe("section headings", () => {
  it.each([
    ["Requirements", "required"],
    ["Minimum Qualifications:", "required"],
    ["Basic qualifications", "required"],
    ["Qualifications", "required"],
    ["Must-haves", "required"],
    ["What You’ll Need", "required"],
    ["What we're looking for:", "required"],
    ["Skills & Experience", "required"],
    ["About you", "required"],
    ["Experience", "required"],
    ["Responsibilities", "responsibilities"],
    ["## What you will be doing", "responsibilities"],
    ["**About the role**", "responsibilities"],
    ["Day-to-day", "responsibilities"],
    ["In this role:", "responsibilities"],
    ["Nice to haves", "preferred"],
    ["Preferred Qualifications", "preferred"],
    ["Bonus points", "preferred"],
    ["Desirable:", "preferred"],
    ["About us", "boilerplate"],
    ["About Northwind Parcel", "boilerplate"],
    ["Benefits & perks", "boilerplate"],
    ["Equal Opportunity Employer", "boilerplate"],
    ["EEO statement", "boilerplate"],
    ["How to apply", "boilerplate"],
    ["Why join us?", "boilerplate"],
    ["Location", "boilerplate"],
  ])("%s -> %s", (line, kind) => {
    expect(classifyJdHeading(line)).toBe(kind);
  });

  it("'preferred qualifications' is preferred, plain 'qualifications' is required", () => {
    expect(classifyJdHeading("Preferred qualifications")).toBe("preferred");
    expect(classifyJdHeading("Qualifications")).toBe("required");
  });

  it("ignores long lines and ordinary sentences", () => {
    expect(classifyJdHeading("Requirements for this role include strong SQL and many other things")).toBeNull();
    expect(classifyJdHeading("- Bonus: exposure to R programming.")).toBeNull();
    expect(classifyJdHeading("Strong SQL")).toBeNull();
  });

  it("text belongs to the section above it; text before any heading is other", () => {
    const jd = fixture("jd-sections.txt");
    const s = analyzeJdStructure(jd);
    expect(s.sections.map((x) => [x.kind, x.heading])).toEqual([
      ["boilerplate", "## About us"],
      ["responsibilities", "**Key Responsibilities:**"],
      ["required", "Minimum qualifications"],
      ["preferred", "Preferred Qualifications:"],
      ["boilerplate", "Benefits & perks"],
    ]);
    expect(placementOf(jd, "Growth Product Manager")).toBe("title");
    expect(placementOf(jd, "Northwind Parcel (fictional")).toBe("other");
    expect(placementOf(jd, "runs Agile")).toBe("boilerplate");
    expect(placementOf(jd, "product roadmap")).toBe("responsibilities");
    expect(placementOf(jd, "SQL")).toBe("required");
    expect(placementOf(jd, "Golang")).toBe("preferred");
    expect(placementOf(jd, "Learning budget")).toBe("boilerplate");
  });

  it("everything is other when there are no headings (after the title)", () => {
    const jd = "Senior PM\nWe need SQL. Agile helps.";
    expect(analyzeJdStructure(jd).sections).toEqual([]);
    expect(placementOf(jd, "SQL")).toBe("other");
  });
});

describe("sentence cues", () => {
  it("detects whole-word cues, preferred before required", () => {
    expect(sentenceCue("SQL is a plus.")).toBe("preferred");
    expect(sentenceCue("Ideally you know Golang")).toBe("preferred");
    expect(sentenceCue("A degree is not required")).toBe("preferred");
    expect(sentenceCue("Nice-to-have: R")).toBe("preferred");
    expect(sentenceCue("SQL is required")).toBe("required");
    expect(sentenceCue("You must know SQL")).toBe("required");
    expect(sentenceCue("At least 3 years of SQL")).toBe("required");
    expect(sentenceCue("Strong SQL")).toBeNull();
    expect(sentenceCue("Unpreferred and requiredness")).toBeNull();
  });

  it("overrides the section for that sentence only", () => {
    const jd = fixture("jd-sections.txt");
    expect(placementOf(jd, "stakeholders")).toBe("responsibilities");
    expect(placementOf(jd, "OKRs")).toBe("preferred");
    expect(placementOf(jd, "A/B testing")).toBe("required");
  });

  it("never upgrades boilerplate and never overrides the title", () => {
    const jd = fixture("jd-sections.txt");
    expect(placementOf(jd, "Data science")).toBe("boilerplate");
    expect(placementOf("Product Manager (SQL preferred)\nRest", "SQL")).toBe("title");
    expect(placementOf("About us\nSQL is required here.", "SQL")).toBe("boilerplate");
  });
});

describe("extractor placements and snippets", () => {
  const byId = Object.fromEntries(extractor.extract(fixture("jd-sections.txt")).map((c) => [c.id, c]));

  it("tags each occurrence and lists distinct placements best first", () => {
    expect(byId["agile"].occurrences.map((o) => o.placement)).toEqual(["boilerplate", "boilerplate", "boilerplate"]);
    expect(byId["agile"].placements).toEqual(["boilerplate"]);
    expect(byId["product-management"].placements).toEqual(["title"]);
    expect(byId["ab-testing"].placements).toEqual(["required"]);
  });

  it("orders snippets by placement value, then reading order", () => {
    const jd = "About us\nWe track KPIs for fun.\nRequirements\n- Own KPIs for growth.\nResponsibilities\n- Report KPIs weekly.";
    const [kpi] = extractor.extract(jd);
    expect(kpi.jdSnippets).toEqual(["Own KPIs for growth.", "Report KPIs weekly.", "We track KPIs for fun."]);
    expect(kpi.placements).toEqual(["required", "responsibilities", "boilerplate"]);
  });
});
