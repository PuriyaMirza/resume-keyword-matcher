/**
 * Works out which resume section each position is in (skills list, summary,
 * experience, or other), using the same short-heading-line rule as the JD.
 * Pure: same text in, same answer out.
 */
import type { TextSpan } from "./extractors/types";
import { classifyKey, findSections, headingKey, inlineHeading, lineSpans, sectionAt, type HeadingPatterns, type Section } from "./headings";

export type ResumePlacement = "skills" | "summary" | "experience" | "other";

export type ResumeSection = Section<ResumePlacement>;

export interface ResumeStructure {
  /** True when at least one section heading was found. */
  hasHeadings: boolean;
  sections: ResumeSection[];
  placementAt(offset: number): ResumePlacement;
}

const exact = (alternatives: string) => new RegExp(`^(?:${alternatives})$`);

const RESUME_HEADINGS: HeadingPatterns<ResumePlacement> = [
  ["skills", exact("skills|technical skills|core competencies|competencies|tools|technologies|tech stack|key skills|areas of expertise|expertise|certifications|languages")],
  ["summary", exact("summary|professional summary|profile|about|about me|objective")],
  ["experience", exact("experience|work experience|professional experience|employment|employment history|career history|projects|work history")],
  ["other", exact("education|awards|honors|honours|achievements|interests|hobbies|volunteering|volunteer work|volunteer experience|publications|references|activities|additional information")],
];

/** Section kind for a resume heading line, or null if it is not a known heading. */
export function classifyResumeHeading(line: string): ResumePlacement | null {
  const key = headingKey(line);
  return key === null ? null : classifyKey(key, RESUME_HEADINGS);
}

/** Skills keys that mean a skills list anywhere, even inside an experience section. */
const ALWAYS_SKILLS = /^(?:skills|technical skills|key skills|core competencies|competencies|areas of expertise)$/;

/**
 * "Skills: SQL, Python, Jira" style lines. Each is a one-line skills section:
 * it does not change which section the following lines belong to.
 * `always` is false for keys like "Tech stack:" that describe a role when they
 * sit inside an experience section.
 */
export function inlineSkillLines(resumeText: string): Array<TextSpan & { always: boolean }> {
  const found: Array<TextSpan & { always: boolean }> = [];
  for (const line of lineSpans(resumeText)) {
    const inline = inlineHeading(resumeText.slice(line.start, line.end));
    if (inline && classifyKey(inline.key, RESUME_HEADINGS) === "skills") {
      found.push({ ...line, always: ALWAYS_SKILLS.test(inline.key) });
    }
  }
  return found;
}

export function analyzeResumeStructure(resumeText: string): ResumeStructure {
  const sections = findSections(resumeText, classifyResumeHeading);
  const inlineSkills = inlineSkillLines(resumeText);
  const hasHeadings = sections.length > 0 || inlineSkills.length > 0;
  return {
    hasHeadings,
    sections,
    placementAt(offset) {
      // Text above the first heading (name, headline) reads like a summary.
      const section = sectionAt(sections, offset)?.kind ?? (hasHeadings ? "summary" : "other");
      const inline = inlineSkills.find((l) => offset >= l.start && offset < l.end);
      if (inline && (inline.always || section !== "experience")) return "skills";
      return section;
    },
  };
}
