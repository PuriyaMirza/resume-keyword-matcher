import { describe, it, expect } from "vitest";
import { analyzeResumeStructure, classifyResumeHeading } from "@/lib/resumeStructure";
import { fixture } from "./helpers";

const placementOf = (text: string, needle: string) => analyzeResumeStructure(text).placementAt(text.indexOf(needle));

describe("resume headings", () => {
  it.each([
    ["Skills", "skills"],
    ["TECHNICAL SKILLS", "skills"],
    ["Core competencies:", "skills"],
    ["Tools & Technologies", "skills"],
    ["Tech stack", "skills"],
    ["Certifications", "skills"],
    ["Languages", "skills"],
    ["Summary", "summary"],
    ["## Professional Summary", "summary"],
    ["About me", "summary"],
    ["Objective", "summary"],
    ["Experience", "experience"],
    ["**Work Experience**", "experience"],
    ["Employment history", "experience"],
    ["Projects", "experience"],
    ["Education", "other"],
    ["Awards", "other"],
    ["Interests", "other"],
    ["Product Manager", null],
    ["- Wrote SQL to size opportunities.", null],
  ])("%s -> %s", (line, kind) => {
    expect(classifyResumeHeading(line)).toBe(kind);
  });
});

describe("resume sections", () => {
  const resume = fixture("resume-fake.txt");

  it("splits the fake resume into its sections", () => {
    const s = analyzeResumeStructure(resume);
    expect(s.hasHeadings).toBe(true);
    expect(s.sections.map((x) => x.kind)).toEqual(["summary", "experience", "skills"]);
  });

  it("text before the first heading counts as summary", () => {
    expect(placementOf(resume, "Alex Example")).toBe("summary");
    expect(placementOf(resume, "owned the roadmap")).toBe("summary");
    expect(placementOf(resume, "Wrote SQL")).toBe("experience");
    expect(placementOf(resume, "Agile, Jira")).toBe("skills");
  });

  it("education and the like are other", () => {
    expect(placementOf("Experience\nLed SQL work\nEducation\nSQL course", "SQL course")).toBe("other");
  });

  it("everything is other when no headings are found", () => {
    const plain = "Product manager. I wrote SQL and ran Agile teams.";
    expect(analyzeResumeStructure(plain).hasHeadings).toBe(false);
    expect(placementOf(plain, "SQL")).toBe("other");
  });
});
