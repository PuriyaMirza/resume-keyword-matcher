/**
 * Works out which part of a job description each position is in: the job
 * title, the requirements, the responsibilities, the nice-to-haves, or
 * company/benefits text. Pure: same text in, same answer out.
 */
import { PLACEMENTS, type Placement, type TextSpan } from "./extractors/types";
import { classifyKey, findSections, headingKey, isBulletLine, lineSpans, sectionAt, type HeadingPatterns, type Section } from "./headings";
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
 * and "about the role"/"about the job" over the catch-all "about ..." (company text).
 */
const JD_HEADINGS: HeadingPatterns<SectionPlacement> = [
  ["preferred", exact("(?:nice to haves?|preferred|desired|desirable|bonus|good to have)(?: skills| experience| qualifications| requirements)?|bonus points|pluses|a plus|extra credit")],
  ["required", exact("requirements|required qualifications|minimum qualifications|basic qualifications|key qualifications|qualifications|minimum requirements|basic requirements|key requirements|required experience|must haves?|what you will need|what you need|what you bring|what we are looking for|who you are|you have|skills(?: and experience)?|required skills|key skills|about you|experience")],
  ["responsibilities", exact("responsibilities|key responsibilities|your responsibilities|what you will do|what you will be doing|what you will be responsible for|the role|about the role|about this role|role overview|your role|duties|key duties|day to day|in this role")],
  // Neutral intros: not company text, not a skill list either.
  ["other", exact("about the job|about this job|about the position|about this position|about the opportunity|about the team|job description|overview|job overview|summary")],
  ["boilerplate", exact("about us|about the company|who we are|our company|what we offer|why join us|benefits|perks|compensation|salary|salary range|pay|location|locations|how to apply|equal opportunity(?: employer)?|eeo(?: statement)?|diversity(?: and inclusion| equity and inclusion)?|about .+")],
];

/** Section placement for a heading line, or null if it is not a known heading. */
export function classifyJdHeading(line: string): SectionPlacement | null {
  const key = headingKey(line);
  return key === null ? null : classifyKey(key, JD_HEADINGS);
}

const MAX_TITLE_CHARS = 80;
/** "Job title:" / "Title:" are trusted further down the posting than "Role:" / "Position:". */
const STRONG_PREFIX = /^(?:job title|title)$/i;
const STRONG_PREFIX_LINES = 15;
const WEAK_PREFIX_LINES = 5;
const PREFIXED = /^(?:#{1,6}\s*)?(?:\*\*|__)?(job title|title|position|role)\s*:(?:\*\*|__)?\s*(.*)$/i;
/** "Position: Full-time, remote" describes the job type, not the title. */
const JOB_TYPE = /^(?:full[\s-]?time|part[\s-]?time|contract|temporary|permanent|remote|hybrid|on[\s-]?site|internship)(?![\p{L}\p{N}])/iu;

/**
 * The span of a title value inside the text, without markdown marks
 * ("# ", "**"), or null if it fails the title rule (<= 80 chars, no final period).
 */
function titleValue(text: string, start: number, end: number): TextSpan | null {
  let s = start;
  let e = end;
  const trim = () => {
    while (s < e && /\s/.test(text[s])) s++;
    while (e > s && /\s/.test(text[e - 1])) e--;
  };
  trim();
  const hashes = /^#{1,6}\s*/.exec(text.slice(s, e));
  if (hashes) s += hashes[0].length;
  const v = text.slice(s, e);
  const bold = /^(\*\*|__)(.+)\1$/.exec(v) ?? /^()(.+?)(\*\*|__)$/.exec(v);
  if (bold) {
    s += bold[1].length;
    e = s + bold[2].length;
  }
  trim();
  const value = text.slice(s, e);
  if (!value || value.length > MAX_TITLE_CHARS || value.endsWith(".")) return null;
  return { start: s, end: e };
}

/**
 * The job title:
 * 1. text after "Job title:" / "Title:" in the first 15 non-empty lines;
 * 2. else text after "Role:" / "Position:" in the first 5, unless it is a job type ("Full-time");
 * 3. else the first non-empty line, or the next one if the first is a section heading.
 * Every value must be <= 80 characters and not end with a period; a plain title line
 * must not be a heading or a list item.
 */
export function detectTitle(text: string): TextSpan | null {
  const lines = lineSpans(text).filter((l) => text.slice(l.start, l.end).trim());
  const prefixed = (strong: boolean, limit: number) => {
    for (const line of lines.slice(0, limit)) {
      const raw = text.slice(line.start, line.end);
      const lead = raw.length - raw.trimStart().length;
      const m = PREFIXED.exec(raw.trimStart());
      if (!m || STRONG_PREFIX.test(m[1]) !== strong) continue;
      if (!strong && JOB_TYPE.test(m[2].trim())) continue;
      const valueStart = line.start + lead + m[0].length - m[2].length;
      const span = titleValue(text, valueStart, line.end);
      if (span) return span;
    }
    return null;
  };
  const fromPrefix = prefixed(true, STRONG_PREFIX_LINES) ?? prefixed(false, WEAK_PREFIX_LINES);
  if (fromPrefix) return fromPrefix;

  const plain = (i: number) => {
    const line = lines[i];
    if (!line) return null;
    const raw = text.slice(line.start, line.end);
    if (classifyJdHeading(raw) || isBulletLine(raw) || PREFIXED.test(raw.trim())) return null;
    return titleValue(text, line.start, line.end);
  };
  if (lines[0] && classifyJdHeading(text.slice(lines[0].start, lines[0].end))) return plain(1);
  return plain(0);
}

/** Whole-word, case-insensitive cue list. Hyphens join words inside a phrase ("nice-to-have")
 *  but count as part of the word at the edges, so "non-essential" is not "essential". */
const phrase = (p: string) => p.split(" ").join("[\\s-]+");
const cueRegex = (body: string) => new RegExp(`(?<![\\p{L}\\p{N}-])(?:${body})(?![\\p{L}\\p{N}-])`, "u");

const PREFERRED_CUE = cueRegex(
  [
    ...["nice to have", "preferred", "a plus", "is a plus", "bonus", "ideally", "desirable", "good to have", "not required", "optional"].map(phrase),
    // "No degree required", "no prior experience required"
    "no(?:[\\s-]+[\\p{L}\\p{N}]+){0,3}?[\\s-]+required",
  ].join("|"),
);
const REQUIRED_CUE = cueRegex(
  [
    ...["required", "must have", "must be", "you must", "essential", "mandatory", "at least"].map(phrase),
    "minimum(?![\\s-]+viable)", // "minimum viable product" is not a requirement
  ].join("|"),
);

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
