/**
 * Section heading detection, shared by the JD and resume structure modules.
 *
 * A heading is a short line ("Requirements", "## What you'll do", "**Skills:**")
 * whose cleaned-up text matches a known pattern. Everything after it, up to the
 * next heading, belongs to that section.
 */
import type { TextSpan } from "./extractors/types";
import { normalizeText } from "./normalize";

const MAX_HEADING_CHARS = 60;
const MAX_HEADING_WORDS = 8;

/** Every line of the text, as offsets (line breaks not included). */
export function lineSpans(text: string): TextSpan[] {
  const spans: TextSpan[] = [];
  let start = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === "\n") {
      const end = i > start && text[i - 1] === "\r" ? i - 1 : i;
      spans.push({ start, end });
      start = i + 1;
    }
  }
  return spans;
}

/** A list item: a bullet marker or "1." / "1)" followed by a space. Never a heading. */
const BULLET_LINE = /^(?:[-•·▪◦*–—]|\(?\d{1,2}[.)])\s/;

export const isBulletLine = (line: string) => BULLET_LINE.test(line.trim());

/** Strip "#" and **bold** / __bold__ wrapping, then a final ":". */
function stripHeadingMarks(line: string): string {
  let s = line.trim().replace(/^#{1,6}\s*/, "");
  s = s.replace(/:\s*$/, "");
  s = s.replace(/^(\*\*|__)(.+)\1$/, "$2");
  return s.replace(/:\s*$/, "").trim();
}

/** Lowercase and unify "&"/"and", "you'll"/"you will", apostrophes and punctuation. */
function toKey(s: string): string | null {
  const key = normalizeText(s)
    .replace(/&/g, " and ")
    .replace(/\byou'll\b/g, "you will")
    .replace(/\bwe're\b/g, "we are")
    .replace(/\byou're\b/g, "you are")
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!key || key.split(" ").length > MAX_HEADING_WORDS) return null;
  return key;
}

/**
 * The comparable "key" of a heading-shaped line, or null if the line can't be
 * a heading. Strips "#", **bold** and a final ":", then normalizes.
 *   "## What You’ll Do:" -> "what you will do"
 * Never a heading: lines over 60 characters, list items ("- Benefits"), and
 * key-value lines with text after a colon ("Location: Remote").
 */
export function headingKey(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > MAX_HEADING_CHARS || BULLET_LINE.test(trimmed)) return null;
  const s = stripHeadingMarks(trimmed);
  if (s.includes(":")) return null;
  return toKey(s);
}

/**
 * For "Skills: SQL, Python" style lines: the key of the part before the colon
 * and where the text after it starts. Null for anything else.
 */
export function inlineHeading(line: string): { key: string; valueStart: number } | null {
  const trimmed = line.trim();
  if (!trimmed || BULLET_LINE.test(trimmed)) return null;
  const m = /^((?:#{1,6}\s*)?(?:\*\*|__)?([^:]{1,40}?)(?:\*\*|__)?\s*:(?:\*\*|__)?\s*)\S/.exec(line.replace(/^\s+/, ""));
  if (!m) return null;
  const key = toKey(m[2]);
  if (!key) return null;
  return { key, valueStart: line.length - line.replace(/^\s+/, "").length + m[1].length };
}

export type HeadingPatterns<K> = ReadonlyArray<readonly [K, RegExp]>;

/**
 * Match a heading key against ordered patterns (first match wins, so put the
 * more specific ones first). "Benefits & perks" style headings are split on
 * "and"; if every part is known, the first part decides.
 */
export function classifyKey<K>(key: string, patterns: HeadingPatterns<K>): K | null {
  const whole = patterns.find(([, re]) => re.test(key));
  if (whole) return whole[0];
  const parts = key.split(" and ");
  if (parts.length < 2) return null;
  const kinds = parts.map((p) => patterns.find(([, re]) => re.test(p))?.[0]);
  return kinds.every((k) => k !== undefined) ? (kinds[0] as K) : null;
}

export interface Section<K> {
  kind: K;
  /** The heading line as written. */
  heading: string;
  /** From the start of the heading line to the start of the next heading (or the end). */
  start: number;
  end: number;
}

/**
 * Split text into sections by heading lines. `classify` returns the section
 * kind for a heading line, or null for ordinary lines. Lines in `skip` are
 * never headings (e.g. the job title line).
 */
export function findSections<K>(
  text: string,
  classify: (line: string) => K | null,
  skip: TextSpan | null = null,
): Section<K>[] {
  const sections: Section<K>[] = [];
  for (const line of lineSpans(text)) {
    if (skip && line.start <= skip.start && skip.start <= line.end) continue;
    const raw = text.slice(line.start, line.end);
    const kind = classify(raw);
    if (kind === null) continue;
    const prev = sections[sections.length - 1];
    if (prev) prev.end = line.start;
    sections.push({ kind, heading: raw.trim(), start: line.start, end: text.length });
  }
  return sections;
}

/** The section containing an offset, or null when it comes before any heading. */
export function sectionAt<K>(sections: Section<K>[], offset: number): Section<K> | null {
  for (let i = sections.length - 1; i >= 0; i--) {
    if (offset >= sections[i].start) return sections[i];
  }
  return null;
}
