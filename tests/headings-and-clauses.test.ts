import { describe, it, expect } from "vitest";
import { analyzeJdStructure, classifyJdHeading } from "@/lib/jdStructure";
import { classifyResumeHeading } from "@/lib/resumeStructure";

/** Placement of the first occurrence of `needle` in `text`. */
function placementOf(text: string, needle: string) {
  const at = text.indexOf(needle);
  if (at < 0) throw new Error(`"${needle}" not in text`);
  return analyzeJdStructure(text).placementAt(at);
}

describe("compound and modified JD headings", () => {
  it.each([
    ["ESSENTIAL DUTIES & RESPONSIBILITIES", "responsibilities"],
    ["EXPERIENCE, SKILLS & KNOWLEDGE", "required"],
    ["Knowledge, Skills and Abilities", "required"],
    ["Education & Experience", "required"],
    ["Key Duties and Accountabilities:", "responsibilities"],
    ["Skills / Experience", "required"],
    ["Essential Functions", "responsibilities"],
    ["Core Competencies", "required"],
    ["Scope", "responsibilities"],
    ["Tasks", "responsibilities"],
    ["Preferred qualifications", "preferred"],
    ["Compensation & Benefits", "boilerplate"],
    // Existing patterns keep working when a modifier word is part of them.
    ["The role", "responsibilities"],
    ["Your role", "responsibilities"],
    ["Job description", "other"],
    ["Key qualifications", "required"],
    ["Key skills", "required"],
    ["Key responsibilities", "responsibilities"],
    ["Key duties", "responsibilities"],
    ["About the job", "other"],
  ])("%s -> %s", (line, kind) => {
    expect(classifyJdHeading(line)).toBe(kind);
  });

  it("the first part decides the placement", () => {
    expect(classifyJdHeading("Duties and Skills")).toBe("responsibilities");
    expect(classifyJdHeading("Skills and Duties")).toBe("required");
  });

  it.each([
    "Experience with SQL and Python",
    "Experience and passion for great products.",
    "Skills, SQL and Python",
    "- Skills and Experience",
    "Skills and Experience: SQL, Python",
    "Required, Optional",
  ])("%s is not a heading", (line) => {
    expect(classifyJdHeading(line)).toBeNull();
  });

  it("does not strip meaningful words", () => {
    expect(classifyJdHeading("Required")).toBeNull();
    expect(classifyJdHeading("Basic")).toBeNull();
  });

  it("a posting with only compound headings gets sections", () => {
    const jd = "Analyst\nESSENTIAL DUTIES & RESPONSIBILITIES\nBuild dashboards.\nEXPERIENCE, SKILLS & KNOWLEDGE\nStrong SQL.";
    expect(analyzeJdStructure(jd).sections.map((s) => s.kind)).toEqual(["responsibilities", "required"]);
    expect(placementOf(jd, "dashboards")).toBe("responsibilities");
    expect(placementOf(jd, "SQL")).toBe("required");
  });

  it("an inline compound heading sets that line only", () => {
    expect(placementOf("Intro\nKnowledge, Skills & Abilities: SQL and Python\nMore SQL", "SQL and")).toBe("required");
  });

  it("resume headings are unchanged", () => {
    expect(classifyResumeHeading("Skills / Tools")).toBeNull();
    expect(classifyResumeHeading("Skills and Tools")).toBe("skills");
    expect(classifyResumeHeading("Skills, Tools")).toBeNull();
    expect(classifyResumeHeading("Essential Skills")).toBeNull();
    expect(classifyResumeHeading("Work Experience")).toBe("experience");
  });
});

describe("a sentence with both a required and a nice-to-have cue", () => {
  const p = placementOf;

  it("SQL and roadmap required, Tableau a plus", () => {
    const jd = "SQL and roadmap experience required, Tableau experience a plus.";
    expect(p(jd, "SQL")).toBe("required");
    expect(p(jd, "roadmap")).toBe("required");
    expect(p(jd, "Tableau")).toBe("preferred");
  });

  it("Tableau is a plus, but SQL is required", () => {
    const jd = "Tableau is a plus, but SQL is required.";
    expect(p(jd, "Tableau")).toBe("preferred");
    expect(p(jd, "SQL")).toBe("required");
  });

  it("nice to have but not required stays preferred", () => {
    expect(p("Agile experience is nice to have but not required.", "Agile")).toBe("preferred");
  });

  it("splits at semicolons, and a clause without a cue follows the earlier one", () => {
    const jd = "You must have SQL, Python and Jira; Tableau preferred.";
    for (const word of ["SQL", "Python", "Jira"]) expect(p(jd, word)).toBe("required");
    expect(p(jd, "Tableau")).toBe("preferred");
  });

  it("a clause with no cue before any cue takes the next one", () => {
    const jd = "Tableau (a plus) and SQL required.";
    expect(p(jd, "Tableau")).toBe("preferred");
    expect(p(jd, "SQL")).toBe("required");
  });

  it("splits at dashes and spaced hyphens in the original text", () => {
    expect(p("SQL required — Tableau a plus.", "Tableau")).toBe("preferred");
    expect(p("SQL required — Tableau a plus.", "SQL")).toBe("required");
    expect(p("SQL required - Tableau a plus.", "Tableau")).toBe("preferred");
    expect(p("Tableau a plus – SQL required.", "SQL")).toBe("required");
  });

  it("splits at though / while / although", () => {
    expect(p("SQL is required while Tableau is a plus.", "Tableau")).toBe("preferred");
    expect(p("Tableau is a plus although SQL is required.", "SQL")).toBe("required");
    expect(p("Tableau is a plus though SQL is required.", "SQL")).toBe("required");
  });

  it("a single kind of cue still covers the whole sentence", () => {
    const jd = "SQL, Python and Jira experience is a plus.";
    expect(p(jd, "SQL")).toBe("preferred");
    expect(p(jd, "Jira")).toBe("preferred");
    const req = "SQL, Python; Jira required.";
    expect(p(req, "SQL")).toBe("required");
  });

  it("cues never change the title or boilerplate", () => {
    const jd = "SQL Analyst\nAbout us\nSQL required, Tableau a plus.";
    expect(p(jd, "SQL Analyst")).toBe("title");
    expect(p(jd, "Tableau")).toBe("boilerplate");
    expect(p(jd, "SQL required")).toBe("boilerplate");
  });

  it("hyphenated words and 'minimum viable' do not trigger", () => {
    expect(p("Intro\nRequirements\nA non-essential tool, SQL a plus.", "non-essential")).toBe("preferred");
    expect(p("Intro\nRequirements\nMinimum viable product, SQL a plus.", "product")).toBe("preferred");
    expect(p("Intro\nRequirements\nMinimum viable product, SQL.", "SQL")).toBe("required");
    expect(p("Intro\nResponsibilities\nSQL, non-essential tools; Tableau.", "SQL")).toBe("responsibilities");
  });

  it("inline heading lines still work with cues on top", () => {
    const jd = "Intro\nRequirements: SQL required, Python; Tableau a plus.\nMore Excel";
    expect(p(jd, "SQL")).toBe("required");
    expect(p(jd, "Python")).toBe("required");
    expect(p(jd, "Tableau")).toBe("preferred");
    expect(p(jd, "Excel")).toBe("other");
  });

  it("no degree required stays nice-to-have", () => {
    expect(p("Intro\nRequirements\nNo degree required, SQL required.", "degree")).toBe("preferred");
    expect(p("Intro\nRequirements\nNo degree required, SQL required.", "SQL")).toBe("required");
  });
});
