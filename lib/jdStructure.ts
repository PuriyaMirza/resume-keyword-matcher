/**
 * Works out which part of a job description each position is in: the job
 * title, the requirements, the responsibilities, the nice-to-haves, or
 * company/benefits text. Pure: same text in, same answer out.
 */
import { PLACEMENTS, type Placement, type TextSpan } from "./extractors/types";
import { classifyKey, findSections, headingKey, lineSpans, sectionAt, type HeadingPatterns, type Section } from "./headings";
import { normalizeText } from "./normalize";
import { sentenceSpans } from "./snippets";

export type { Placement } from "./extractors/types";

/** Placements a section heading can set (the title is found separately). */
export type SectionPlacement = Exclude<Placement, "title">;

export type JdSection = Section<SectionPlacement>;

export interface JdStructure {
  titleSpan: TextSpan | null;
  sections: JdSection[];
  placementAt(offset: number): Placement;
}

/** Lower number = more important. */
export const placementRank = (p: Placement) => PLACEMENTS.indexOf(p);

/** Distinct placements, most important first. */
export function sortPlacements(list: Placement[]): Placement[] {
  return [...new Set(list)].sort((a, b) => placementRank(a) - placementRank(b));
}

const exact = (alternatives: string) => new RegExp(`^(?:${alternatives})$`);

/**
 * Heading patterns, matched against the cleaned-up heading key (see headingKey).
 * Order matters: "preferred qualifications" must win over "qualifications",
 * and "about the role"/"about you" over the catch-all "about ...".
 */
const JD_HEADINGS: HeadingPatterns<SectionPlacement> = [
  ["preferred", exact("nice to haves?|preferred qualifications|preferred skills|preferred|bonus(?: points)?|pluses|a plus|desirable|good to have|extra credit")],
  ["required", exact("requirements|required qualifications|minimum qualifications|basic qualifications|qualifications|must haves?|what you will need|what you need|what you bring|what we are looking for|who you are|you have|skills(?: and experience)?|required skills|key skills|about you|experience")],
  ["responsibilities", exact("responsibilities|key responsibilities|what you will do|what you will be doing|the role|about the role|your role|duties|day to day|in this role")],
  ["boilerplate", /^(?:about us|about the company|who we are|our company|what we offer|why join us|(?:equal opportunity|eeo|diversity|benefits|perks|compensation|salary|how to apply|location)\b.*|about (?!the role$|you$).+)$/],
];

/** Section placement for a heading line, or null if it is not a known heading. */
export function classifyJdHeading(line: string): SectionPlacement | null {
  const key = headingKey(line);
  return key === null ? null : classifyKey(key, JD_HEADINGS);
}

const TITLE_PREFIX = /^[ \t]*(?:job title|title|position|role)[ \t]*:[ \t]*(\S(?:.*\S)?)[ \t]*$/i;
const MAX_TITLE_CHARS = 80;

/**
 * The job title: text after "Job title:", "Title:", "Position:" or "Role:" on
 * any line; otherwise the first non-empty line, if it is short, does not end
 * with a period and is not a section heading.
 */
export function detectTitle(text: string): TextSpan | null {
  const lines = lineSpans(text);
  for (const line of lines) {
    const raw = text.slice(line.start, line.end);
    const m = TITLE_PREFIX.exec(raw);
    if (m) {
      const start = line.start + raw.indexOf(m[1], raw.indexOf(":") + 1);
      return { start, end: start + m[1].length };
    }
  }
  const first = lines.find((l) => text.slice(l.start, l.end).trim());
  if (!first) return null;
  const raw = text.slice(first.start, first.end);
  const trimmed = raw.trim();
  if (trimmed.length > MAX_TITLE_CHARS || trimmed.endsWith(".") || classifyJdHeading(raw)) return null;
  const start = first.start + raw.indexOf(trimmed);
  return { start, end: start + trimmed.length };
}

/** Whole-word, case-insensitive phrase list; hyphens count as spaces ("nice-to-have"). */
function cueRegex(phrases: string[]): RegExp {
  const body = phrases.map((p) => p.split(" ").join("[\\s-]+")).join("|");
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, "u");
}

const PREFERRED_CUE = cueRegex([
  "nice to have", "preferred", "a plus", "is a plus", "bonus", "ideally", "desirable", "good to have", "not required", "optional",
]);
const REQUIRED_CUE = cueRegex([
  "required", "must have", "must be", "you must", "minimum", "essential", "mandatory", "at least",
]);

/** A sentence's own cue, if any. A preferred cue beats a required one ("not required"). */
export function sentenceCue(sentence: string): "preferred" | "required" | null {
  const s = normalizeText(sentence);
  if (PREFERRED_CUE.test(s)) return "preferred";
  if (REQUIRED_CUE.test(s)) return "required";
  return null;
}

export function analyzeJdStructure(jdText: string): JdStructure {
  const titleSpan = detectTitle(jdText);
  const sections = findSections(jdText, classifyJdHeading, titleSpan);
  const sentences = sentenceSpans(jdText).map((s) => ({ ...s, cue: sentenceCue(jdText.slice(s.start, s.end)) }));

  function placementAt(offset: number): Placement {
    if (titleSpan && offset >= titleSpan.start && offset < titleSpan.end) return "title";
    const section = sectionAt(sections, offset)?.kind ?? "other";
    // Cues never change company/benefits text: "a plus" there is not a skill ask.
    if (section === "boilerplate") return section;
    const sentence = sentences.find((s) => offset >= s.start && offset < s.end);
    return sentence?.cue ?? section;
  }

  return { titleSpan, sections, placementAt };
}
