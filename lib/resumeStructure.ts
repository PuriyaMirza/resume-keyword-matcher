/**
 * Works out which resume section each position is in (skills list, summary,
 * experience, or other), using the same short-heading-line rule as the JD.
 * Pure: same text in, same answer out.
 */
import { classifyKey, findSections, headingKey, sectionAt, type HeadingPatterns, type Section } from "./headings";

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

export function analyzeResumeStructure(resumeText: string): ResumeStructure {
  const sections = findSections(resumeText, classifyResumeHeading);
  const hasHeadings = sections.length > 0;
  return {
    hasHeadings,
    sections,
    // Text above the first heading (name, headline) reads like a summary.
    placementAt: (offset) => sectionAt(sections, offset)?.kind ?? (hasHeadings ? "summary" : "other"),
  };
}
