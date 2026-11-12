import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ResumePlan } from "@/components/ResumePlan";
import { analyzeJdStructure, classifyJdHeading, detectTitle, sentenceCue } from "@/lib/jdStructure";
import { headingKey } from "@/lib/headings";
import { PLAN_REASONS, dedupeSpans, matchResume, type MatchResult } from "@/lib/match";
import { analyzeResumeStructure, classifyResumeHeading } from "@/lib/resumeStructure";
import { extractor } from "./helpers";

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

describe("M1: key-value lines are never headings", () => {
  const jd =
    "Product Manager\nLocation: Remote (US)\n\nWe need someone with SQL, Python, A/B testing and stakeholder management. You must have roadmap experience.";

  it("does not let 'Location: Remote' swallow the rest of the JD", () => {
    expect(analyzeJdStructure(jd).sections).toEqual([]);
    expect(placementOf(jd, "SQL")).toBe("other");
    expect(placementOf(jd, "Python")).toBe("other");
    expect(placementOf(jd, "A/B testing")).toBe("other");
    expect(placementOf(jd, "roadmap")).toBe("required");
  });

  it.each(["Location: Remote (US)", "Salary: $120k", "Compensation: competitive", "Benefits: health, dental", "**Location:** Remote"])(
    "%s is not a heading (JD or resume)",
    (line) => {
      expect(headingKey(line)).toBeNull();
      expect(classifyJdHeading(line)).toBeNull();
      expect(classifyResumeHeading(line)).toBeNull();
    },
  );

  it("bare benefit words are still headings", () => {
    expect(classifyJdHeading("Location")).toBe("boilerplate");
    expect(classifyJdHeading("Salary:")).toBe("boilerplate");
    expect(classifyJdHeading("Compensation & Benefits")).toBe("boilerplate");
  });
});

describe("M2: neutral intro headings are not company text", () => {
  it.each([
    ["About the job", "other"],
    ["About this job", "other"],
    ["About the position", "other"],
    ["About the opportunity", "other"],
    ["About the team", "other"],
    ["Job description", "other"],
    ["Overview", "other"],
    ["Summary", "other"],
    ["About the role", "responsibilities"],
    ["About this role", "responsibilities"],
    ["The role", "responsibilities"],
    ["Role overview", "responsibilities"],
    ["About us", "boilerplate"],
    ["About the company", "boilerplate"],
    ["About Northwind Parcel", "boilerplate"],
    ["Who we are", "boilerplate"],
    ["Our company", "boilerplate"],
  ])("%s -> %s", (line, kind) => {
    expect(classifyJdHeading(line)).toBe(kind);
  });

  it("uses the line after a leading heading as the title", () => {
    const jd = "About the job\nSenior Product Manager\nWe are looking for a PM who owns the roadmap and knows SQL.\nRequirements\n- A/B testing";
    expect(titleText(jd)).toBe("Senior Product Manager");
    expect(placementOf(jd, "SQL")).toBe("other");
    expect(placementOf(jd, "roadmap")).toBe("other");
    expect(placementOf(jd, "A/B testing")).toBe("required");
  });

  it("no title when the line after the heading fails the title rule", () => {
    expect(titleText("About the job\nWe build things.\nRequirements")).toBeNull();
    expect(titleText("About the job\nRequirements\n- SQL")).toBeNull();
  });
});

describe("M3: prefixed titles", () => {
  it("ignores a long 'Role:' sentence and keeps the first-line title", () => {
    const jd =
      "Senior Product Manager\nAbout the role\nWe build fintech tools.\nRole: You will lead SQL analytics across the org and partner with stakeholders on the roadmap every quarter.\nRequirements\n- Python";
    expect(titleText(jd)).toBe("Senior Product Manager");
    expect(placementOf(jd, "SQL")).not.toBe("title");
  });

  it.each(["Full-time, remote", "Remote", "Part time", "Contract", "On-site", "Onsite", "Hybrid (2 days)", "Internship"])(
    "rejects 'Position: %s' as a title",
    (value) => {
      expect(titleText(`Senior Product Manager\nPosition: ${value}\nWe need SQL.`)).toBe("Senior Product Manager");
    },
  );

  it("accepts 'Role:' / 'Position:' only in the first 5 non-empty lines", () => {
    expect(titleText("Northwind\nRole: Platform PM\nText")).toBe("Platform PM");
    const late = ["Northwind Parcel", "a", "b", "c", "d", "Role: Platform PM"].join("\n");
    expect(titleText(late)).toBe("Northwind Parcel");
  });

  it("accepts 'Job title:' / 'Title:' in the first 15 non-empty lines, ahead of 'Role:'", () => {
    const lines = ["Northwind Parcel", "Role: Platform PM", ...Array.from({ length: 10 }, (_, i) => `Line ${i}`), "Job title: Growth PM"];
    expect(titleText(lines.join("\n"))).toBe("Growth PM");
    const tooLate = ["Northwind Parcel", ...Array.from({ length: 15 }, (_, i) => `Line ${i}`), "Title: Growth PM"];
    expect(titleText(tooLate.join("\n"))).toBe("Northwind Parcel");
  });

  it("applies the length and period rule to the value", () => {
    expect(titleText("Northwind\nJob title: We are hiring a PM.\nMore")).toBe("Northwind");
    expect(titleText(`Northwind\nTitle: ${"x".repeat(81)}`)).toBe("Northwind");
  });
});

describe("m1: more heading spellings", () => {
  it("'Nice to have skills' is a preferred section", () => {
    const jd = "Product Manager\nRequirements\n- SQL\nNice to have skills\n- Python\n- Tableau";
    expect(placementOf(jd, "SQL")).toBe("required");
    expect(placementOf(jd, "Python")).toBe("preferred");
    expect(placementOf(jd, "Tableau")).toBe("preferred");
  });

  it.each([
    ["Nice-to-have experience", "preferred"],
    ["Preferred experience", "preferred"],
    ["Desired skills", "preferred"],
    ["Desirable qualifications", "preferred"],
    ["Bonus skills", "preferred"],
    ["Good to have requirements", "preferred"],
    ["Key qualifications", "required"],
    ["Minimum requirements", "required"],
    ["Required experience", "required"],
    ["Basic requirements", "required"],
    ["Key requirements", "required"],
    ["Your responsibilities", "responsibilities"],
    ["What you'll be responsible for", "responsibilities"],
    ["What you will do", "responsibilities"],
    ["Key duties", "responsibilities"],
  ])("%s -> %s", (line, kind) => {
    expect(classifyJdHeading(line)).toBe(kind);
  });
});

describe("m2: list items are never headings", () => {
  it("bullets under Requirements stay required", () => {
    const jd = "Product Manager\nRequirements\n- SQL\n- Experience\n- Python\n- Benefits\n- Jira\n- Agile";
    for (const word of ["SQL", "Python", "Jira", "Agile"]) expect(placementOf(jd, word)).toBe("required");
    expect(analyzeJdStructure(jd).sections.map((s) => s.heading)).toEqual(["Requirements"]);
  });

  it.each(["- Benefits", "• Experience", "* Skills", "· Perks", "▪ Location", "◦ Salary", "1. Requirements", "2) Skills"])(
    "%s is not a heading",
    (line) => {
      expect(headingKey(line)).toBeNull();
    },
  );

  it("keeps # and **bold** headings", () => {
    expect(classifyJdHeading("**Requirements**")).toBe("required");
    expect(classifyJdHeading("**Requirements:**")).toBe("required");
    expect(classifyJdHeading("### Benefits")).toBe("boilerplate");
  });
});

describe("m3: inline resume skills line", () => {
  const resume = "Skills: SQL, Python, Jira\nExperience\n- Led roadmap.";

  it("is a one-line skills section that counts as a heading", () => {
    const s = analyzeResumeStructure(resume);
    expect(s.hasHeadings).toBe(true);
    expect(s.placementAt(resume.indexOf("SQL"))).toBe("skills");
    expect(s.placementAt(resume.indexOf("roadmap"))).toBe("experience");
  });

  it("does not change the section of the following lines", () => {
    const text = "Experience\n- Led teams.\nSkills: Jira, SQL\n- Shipped roadmap.";
    const s = analyzeResumeStructure(text);
    expect(s.placementAt(text.indexOf("SQL"))).toBe("skills");
    expect(s.placementAt(text.indexOf("roadmap"))).toBe("experience");
  });

  it("makes SQL a 'strengthen' item", () => {
    const r = matchResume(extractor.extract("Requirements\n- Strong SQL.\n- Own the roadmap."), resume);
    const sql = r.plan.strengthen.find((k) => k.id === "sql");
    expect(sql?.planReason).toBe(PLAN_REASONS.skillsOnly);
  });

  it("ignores lines that are not skills headings", () => {
    const s = analyzeResumeStructure("Location: Remote, SQL\nI wrote SQL.");
    expect(s.hasHeadings).toBe(false);
  });
});

describe("m4: plan empty states", () => {
  const render = (r: MatchResult) => renderToStaticMarkup(createElement(ResumePlan, { result: r }));
  const msgs = {
    nothingToAdd: "Nothing to add.",
    nothingMatched: "Nothing matched yet, so there is nothing to strengthen.",
    strengthenFine: "Nothing to strengthen.",
    nothingCovered: "Nothing covered yet.",
  };

  it("renders nothing when the JD has no keywords", () => {
    const r = matchResume(extractor.extract("Barista wanted\nMake coffee and smile."), "I make coffee.");
    expect(r.score).toBeNull();
    expect(render(r)).toBe("");
  });

  it("nothing matched: no 'already show up well' message", () => {
    const html = render(matchResume(extractor.extract("Requirements\n- Strong SQL."), "I like painting."));
    expect(html).toContain(msgs.nothingMatched);
    expect(html).toContain(msgs.nothingCovered);
    expect(html).not.toContain(msgs.strengthenFine);
    expect(html).not.toContain(msgs.nothingToAdd);
  });

  it("everything matched: no 'nothing matched' message", () => {
    const html = render(matchResume(extractor.extract("Requirements\n- Strong SQL."), "SQL daily. SQL weekly."));
    expect(html).toContain(msgs.nothingToAdd);
    expect(html).toContain(msgs.strengthenFine);
    expect(html).not.toContain(msgs.nothingMatched);
    expect(html).not.toContain(msgs.nothingCovered);
  });

  it("everything matched but all to strengthen: covered message points at Strengthen", () => {
    const html = render(matchResume(extractor.extract("Requirements\n- Strong SQL."), "Wrote SQL once."));
    expect(html).toContain(msgs.nothingToAdd);
    expect(html).toContain("Work through the Strengthen list above.");
    expect(html).not.toContain("Start with the keywords above.");
  });
});

describe("m5: cue edge cases", () => {
  it("'minimum viable' is not a required cue", () => {
    expect(sentenceCue("Ship a minimum viable product with SQL.")).toBeNull();
    expect(sentenceCue("Minimum 3 years of SQL.")).toBe("required");
  });

  it("hyphens at the edges block a cue, hyphens inside a phrase join it", () => {
    expect(sentenceCue("SQL is non-essential.")).toBeNull();
    expect(sentenceCue("A mission-essential system.")).toBeNull();
    expect(sentenceCue("SQL is a must-have.")).toBe("required");
    expect(sentenceCue("Golang is nice-to-have.")).toBe("preferred");
    expect(sentenceCue("SQL is essential.")).toBe("required");
  });

  it("'no ... required' is a preferred cue", () => {
    expect(sentenceCue("No degree required.")).toBe("preferred");
    expect(sentenceCue("No prior experience required, SQL helps.")).toBe("preferred");
    expect(placementOf("Requirements\n- No prior SQL experience required.", "SQL")).toBe("preferred");
  });
});

describe("n1: dedupeSpans compares with the last kept span", () => {
  it("keeps {0,10} and {12,20}", () => {
    expect(dedupeSpans([{ start: 0, end: 10 }, { start: 5, end: 15 }, { start: 12, end: 20 }])).toEqual([
      { start: 0, end: 10 },
      { start: 12, end: 20 },
    ]);
  });
});

describe("n2: markdown titles", () => {
  it("leaves out '# ' and '**' from the title", () => {
    expect(titleText("# Senior Product Manager\nText")).toBe("Senior Product Manager");
    expect(titleText("**Senior Product Manager**\nText")).toBe("Senior Product Manager");
    expect(titleText("**Job title:** Growth PM\nText")).toBe("Growth PM");
  });

  it("snippets of markdown heading lines show no '#' or '**'", () => {
    const [pm] = extractor.extract("# Senior Product Manager\nWe ship.");
    expect(pm.jdSnippets).toEqual(["Senior Product Manager"]);
    expect(pm.placements).toEqual(["title"]);
    const [sql] = extractor.extract("Intro\n**SQL analytics**\nMore");
    expect(sql.jdSnippets).toEqual(["SQL analytics"]);
  });
});

describe("n4: no dead badge rule", () => {
  it("globals.css has no .badge-muted rule", () => {
    const css = readFileSync(path.join(__dirname, "..", "app", "globals.css"), "utf8");
    expect(css).not.toContain(".badge-muted");
  });
});

describe("round 3 N1: tighter 'no ... required' cue", () => {
  it.each([
    "Experience with no-code tools required.",
    "Experience with low-code or no-code platforms is required.",
    "There is no question SQL is required.",
  ])("%s -> required", (s) => {
    expect(sentenceCue(s)).toBe("required");
  });

  it.each(["No degree required.", "no prior experience required", "No prior experience required, SQL helps."])(
    "%s -> preferred",
    (s) => {
      expect(sentenceCue(s)).toBe("preferred");
    },
  );

  it("'required' must end the clause", () => {
    expect(sentenceCue("No travel required for SQL work.")).toBe("required");
  });
});

describe("round 3 N2: dash-attached cues", () => {
  it.each([
    ["SQL—preferred", "preferred"],
    ["Tableau—a plus", "preferred"],
    ["SQL–required", "required"],
    ["SQL – required", "required"],
  ])("%s -> %s", (s, cue) => {
    expect(sentenceCue(s)).toBe(cue);
  });

  it("hyphenated words still block cues", () => {
    expect(sentenceCue("SQL is non-essential.")).toBeNull();
    expect(sentenceCue("A mission-essential system.")).toBeNull();
    expect(sentenceCue("SQL is a must-have.")).toBe("required");
  });

  it("works through the JD placement", () => {
    expect(placementOf("Product Manager\nWe use SQL—preferred.", "SQL")).toBe("preferred");
  });
});

describe("round 3 N3: inline tools lines inside experience", () => {
  const resume = "Experience\nAcme PM 2020-2024\n- Shipped a pricing engine.\nTech stack: SQL, Python";

  it("stay experience", () => {
    const s = analyzeResumeStructure(resume);
    expect(s.placementAt(resume.indexOf("SQL"))).toBe("experience");
    expect(s.placementAt(resume.indexOf("Python"))).toBe("experience");
  });

  it("give no 'Only in your skills list' advice", () => {
    const r = matchResume(extractor.extract("Requirements\n- Strong SQL.\n- Strong SQL reporting."), resume);
    const sql = [...r.plan.strengthen, ...r.plan.covered].find((k) => k.id === "sql")!;
    expect(sql.resume.placements).toEqual(["experience"]);
    expect(sql.planReason).not.toBe(PLAN_REASONS.skillsOnly);
  });

  it("'Tools:' outside experience and 'Skills:' anywhere are skills", () => {
    const text = "Summary\nTools: SQL\nExperience\n- Led teams.\nKey skills: Python\nTechnologies: Jira";
    const s = analyzeResumeStructure(text);
    expect(s.placementAt(text.indexOf("SQL"))).toBe("skills");
    expect(s.placementAt(text.indexOf("Python"))).toBe("skills");
    expect(s.placementAt(text.indexOf("Jira"))).toBe("experience");
  });
});

describe("round 3 N4: inline JD heading lines", () => {
  it("set the placement for that line only", () => {
    const jd = "Product Manager\nResponsibilities\n- Own the roadmap.\nRequirements: 5+ years of SQL and Python.\n- Agile";
    expect(placementOf(jd, "SQL")).toBe("required");
    expect(placementOf(jd, "Python")).toBe("required");
    expect(placementOf(jd, "Agile")).toBe("responsibilities");
    expect(analyzeJdStructure(jd).sections.map((s) => s.heading)).toEqual(["Responsibilities"]);
  });

  it.each([
    ["Responsibilities: own the roadmap", "roadmap", "responsibilities"],
    ["Nice to have: Python", "Python", "preferred"],
    ["Qualifications: SQL and Agile", "SQL", "required"],
  ])("%s", (line, needle, kind) => {
    expect(placementOf(`Intro text\n${line}\nMore SQL`, needle)).toBe(kind);
  });

  it("never for company text keys or title prefixes", () => {
    const jd = "Product Manager\nRequirements\n- SQL\nLocation: Remote, Python team\nBenefits: Agile coaching";
    expect(placementOf(jd, "Python")).toBe("required");
    expect(placementOf(jd, "Agile")).toBe("required");
    expect(placementOf("Product Manager\nAbout us\nSalary: SQL bonus\n", "SQL")).toBe("boilerplate");
    expect(placementOf("Intro\nRole: SQL Analyst\nMore", "SQL")).toBe("title");
  });

  it("sentence cues still apply on top", () => {
    expect(placementOf("Intro\nRequirements: SQL. Python is a plus.\n", "Python")).toBe("preferred");
  });
});

describe("round 3 N5: more preferred headings", () => {
  it.each(["Bonus points if you have:", "Bonus if you have", "It's a plus if you have", "Nice to have but not required"])(
    "%s -> preferred",
    (line) => {
      expect(classifyJdHeading(line)).toBe("preferred");
    },
  );
});

describe("round 3 nit: '#' is kept unless the line is a markdown heading", () => {
  it("keeps '# of users' in a snippet", () => {
    const sql = extractor.extract("Product Manager\nAbout the role\n# of users grew with SQL.").find((c) => c.id === "sql")!;
    expect(sql.jdSnippets).toEqual(["# of users grew with SQL."]);
  });

  it("still strips the marks on heading and title lines", () => {
    const [pm] = extractor.extract("# Senior Product Manager\nWe ship.");
    expect(pm.jdSnippets).toEqual(["Senior Product Manager"]);
  });
});
