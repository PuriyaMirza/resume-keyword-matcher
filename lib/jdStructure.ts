/**
 * Works out which part of a job description each position is in: the job
 * title, the requirements, the responsibilities, the nice-to-haves, or
 * company/benefits text. Pure: same text in, same answer out.
 */
import { PLACEMENTS, type Placement, type TextSpan } from "./extractors/types";
import { classifyCompoundKey, findSections, headingSplitKey, inlineHeading, isBulletLine, lineSpans, sectionAt, type HeadingPatterns, type Section } from "./headings";
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
  /** True inside the title line or a section heading line (used to clean up snippets). */
  isHeadingLine(offset: number): boolean;
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
  ["preferred", exact("bonus points if you have|bonus if you have|its a plus if you have|it is a plus if you have|nice to have but not required|(?:nice to haves?|preferred|desired|desirable|bonus|good to have)(?: skills| experience| qualifications| requirements)?|bonus points|pluses|a plus|extra credit")],
  ["required", exact("requirements|required qualifications|minimum qualifications|basic qualifications|key qualifications|qualifications|minimum requirements|basic requirements|key requirements|required experience|must haves?|what you will need|what you need|what you bring|what we are looking for|who you are|you have|skills(?: and experience)?|required skills|key skills|about you|experience|knowledge|abilities|ability|education|competencies|expertise|background|credentials")],
  ["responsibilities", exact("responsibilities|key responsibilities|your responsibilities|what you will do|what you will be doing|what you will be responsible for|the role|about the role|about this role|role overview|your role|duties|key duties|day to day|in this role|functions|essential functions|accountabilities|tasks|scope")],
  // Neutral intros: not company text, not a skill list either.
  ["other", exact("about the job|about this job|about the position|about this position|about the opportunity|about the team|job description|overview|job overview|summary")],
  ["boilerplate", exact("about us|about the company|who we are|our company|what we offer|why join us|benefits|perks|compensation|salary|salary range|pay|location|locations|how to apply|equal opportunity(?: employer)?|eeo(?: statement)?|diversity(?: and inclusion| equity and inclusion)?|about .+")],
];

/** Section placement for a heading line, or null if it is not a known heading. */
export function classifyJdHeading(line: string): SectionPlacement | null {
  const key = headingSplitKey(line);
  return key === null ? null : classifyCompoundKey(key, JD_HEADINGS);
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

/** Whole-word, case-insensitive cue list. Hyphens join words inside a phrase ("nice-to-have").
 *  At the edges, a hyphen joined to a letter makes it part of another word, so
 *  "non-essential" is not "essential"; "SQL—preferred" (a dash) still matches. */
const phrase = (p: string) => p.split(" ").join("[\\s-]+");
const cueRegex = (body: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}]|[\\p{L}\\p{N}]-)(?:${body})(?![\\p{L}\\p{N}]|-[\\p{L}\\p{N}])`, "u");

const PREFERRED_CUE = cueRegex(
  [
    ...["nice to have", "preferred", "a plus", "is a plus", "bonus", "ideally", "desirable", "good to have", "not required", "optional"].map(phrase),
  ].join("|"),
);
/**
 * "No degree required", "no prior experience required": "no", up to 3 words
 * (not "is"/"are"), then "required" ending the clause. Not "no-code tools
 * required" or "there is no question SQL is required".
 */
const NO_X_REQUIRED =
  /(?<![\p{L}\p{N}-])no\s+(?:(?!(?:is|are)\s)[\p{L}\p{N}]+\s+){0,3}required(?=\s*(?:[.,;)]|$))/mu;
const REQUIRED_CUE = cueRegex(
  [
    ...["required", "must have", "must be", "you must", "essential", "mandatory", "at least"].map(phrase),
    "minimum(?![\\s-]+viable)", // "minimum viable product" is not a requirement
  ].join("|"),
);

type Cue = "preferred" | "required";

/** Normalized text for cue matching. normalizeText turns every dash into "-"; only a
 *  real hyphen joins words, so em/en dashes become spaces here. */
function cueText(sentence: string): string {
  const norm = normalizeText(sentence);
  let s = "";
  for (let i = 0; i < norm.length; i++) s += norm[i] === "-" && sentence[i] !== "-" ? " " : norm[i];
  return s;
}

/** Which kinds of cue a text contains. */
function cueKinds(text: string): { preferred: boolean; required: boolean } {
  const s = cueText(text);
  return { preferred: PREFERRED_CUE.test(s) || NO_X_REQUIRED.test(s), required: REQUIRED_CUE.test(s) };
}

/** A sentence's own cue, if any. A preferred cue beats a required one ("not required"). */
export function sentenceCue(sentence: string): Cue | null {
  const { preferred, required } = cueKinds(sentence);
  return preferred ? "preferred" : required ? "required" : null;
}

/** Where a sentence breaks into clauses: , ; ( ) but/though/while/although, dashes, " - ". */
const CLAUSE_BREAK = /[,;()—–]|\s-\s|\s(?:but|though|while|although)\s/giu;

/**
 * Per-clause cues for a sentence that has both a required and a nice-to-have
 * cue, as spans covering the whole sentence. A clause with no cue takes the
 * nearest earlier clause's cue, or else the nearest later one. Returns null
 * when the sentence has only one kind of cue (the whole sentence then uses it).
 */
export function clauseCues(sentence: string, offset = 0): Array<TextSpan & { cue: Cue | null }> | null {
  const kinds = cueKinds(sentence);
  if (!kinds.preferred || !kinds.required) return null;
  // Clause content spans, skipping blank pieces.
  const pieces: TextSpan[] = [];
  let from = 0;
  const add = (end: number) => {
    if (sentence.slice(from, end).trim()) pieces.push({ start: from, end });
  };
  for (const m of sentence.matchAll(CLAUSE_BREAK)) {
    add(m.index);
    from = m.index + m[0].length;
  }
  add(sentence.length);
  if (pieces.length < 2) return null;
  const own = pieces.map((p) => sentenceCue(sentence.slice(p.start, p.end)));
  return pieces.map((p, i) => {
    const before = own.slice(0, i + 1).reverse().find((c) => c !== null);
    const after = own.slice(i).find((c) => c !== null);
    return {
      // Each clause runs up to the start of the next one (separators go with the earlier clause).
      start: offset + (i === 0 ? 0 : p.start),
      end: offset + (i + 1 < pieces.length ? pieces[i + 1].start : sentence.length),
      cue: before ?? after ?? null,
    };
  });
}

export function analyzeJdStructure(jdText: string): JdStructure {
  const titleSpan = detectTitle(jdText);
  const sections = findSections(jdText, classifyJdHeading, titleSpan);
  const sentences = sentenceSpans(jdText).map((s) => {
    const text = jdText.slice(s.start, s.end);
    return { ...s, cue: sentenceCue(text), clauses: clauseCues(text, s.start) };
  });
  const lines = lineSpans(jdText);
  const lineAt = (offset: number) => lines.find((l) => offset >= l.start && offset <= l.end);
  const inlineLines = inlineJdHeadings(jdText, lines, titleSpan);

  function placementAt(offset: number): Placement {
    if (titleSpan && offset >= titleSpan.start && offset < titleSpan.end) return "title";
    // "Requirements: 5+ years of SQL" sets the placement for that line only.
    const inline = inlineLines.find((l) => offset >= l.start && offset < l.end);
    const section = inline?.kind ?? sectionAt(sections, offset)?.kind ?? "other";
    // Cues never change company/benefits text: "a plus" there is not a skill ask.
    if (section === "boilerplate") return section;
    const sentence = sentences.find((s) => offset >= s.start && offset < s.end);
    // A sentence with both kinds of cue is judged clause by clause.
    const clause = sentence?.clauses?.find((c) => offset >= c.start && offset < c.end);
    return (clause ? clause.cue : sentence?.cue) ?? section;
  }

  function isHeadingLine(offset: number): boolean {
    const line = lineAt(offset);
    if (!line) return false;
    if (titleSpan && titleSpan.start >= line.start && titleSpan.start <= line.end) return true;
    return sections.some((s) => s.start === line.start);
  }

  return { titleSpan, sections, placementAt, isHeadingLine };
}

/** Inline heading kinds that can set a line's placement (never company text or the title). */
const INLINE_KINDS = new Set<SectionPlacement>(["required", "responsibilities", "preferred"]);

/** "Requirements: ...", "Nice to have: ..." lines, with the placement each sets. */
function inlineJdHeadings(text: string, lines: TextSpan[], titleSpan: TextSpan | null) {
  const found: Array<TextSpan & { kind: SectionPlacement }> = [];
  for (const line of lines) {
    if (titleSpan && titleSpan.start >= line.start && titleSpan.start <= line.end) continue;
    const inline = inlineHeading(text.slice(line.start, line.end));
    if (!inline || /^(?:job title|title|position|role)$/.test(inline.key)) continue;
    const kind = classifyCompoundKey(inline.splitKey, JD_HEADINGS);
    if (kind && INLINE_KINDS.has(kind)) found.push({ ...line, kind });
  }
  return found;
}
