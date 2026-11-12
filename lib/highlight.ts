import type { KeywordCandidate } from "./extractors/types";

export type SegmentKind = "plain" | "matched" | "missing";

export interface Segment {
  text: string;
  kind: SegmentKind;
  /** Keyword display name, for matched/missing segments. */
  keyword?: string;
}

/**
 * Split the JD into plain and highlighted pieces.
 * Returns plain strings only: the UI renders them as React text, never as HTML,
 * so markup pasted into a JD can't run.
 */
export function buildSegments(
  text: string,
  matched: KeywordCandidate[],
  missing: KeywordCandidate[],
): Segment[] {
  const spans = [
    ...matched.flatMap((c) => c.occurrences.map((o) => ({ ...o, kind: "matched" as const, keyword: c.canonical }))),
    ...missing.flatMap((c) => c.occurrences.map((o) => ({ ...o, kind: "missing" as const, keyword: c.canonical }))),
  ].sort((a, b) => a.start - b.start || b.end - a.end);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const s of spans) {
    if (s.start < cursor) continue; // skip overlaps
    if (s.start > cursor) segments.push({ text: text.slice(cursor, s.start), kind: "plain" });
    segments.push({ text: text.slice(s.start, s.end), kind: s.kind, keyword: s.keyword });
    cursor = s.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), kind: "plain" });
  return segments;
}
