import type { TextSpan } from "./extractors/types";

/** Split text into sentences: a line break, or . ! ? followed by whitespace. */
export function sentenceSpans(text: string): TextSpan[] {
  const spans: TextSpan[] = [];
  let start = 0;
  const push = (end: number) => {
    if (text.slice(start, end).trim()) spans.push({ start, end });
    start = end;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\n") {
      push(i);
      start = i + 1;
    } else if ((c === "." || c === "!" || c === "?") && (i + 1 === text.length || /\s/.test(text[i + 1]))) {
      push(i + 1);
    }
  }
  push(text.length);
  return spans;
}

const BULLET_PREFIX = /^[\s•·▪◦*\-–—]+/;

/** The cleaned-up sentence containing a match, trimmed to maxLen characters. */
export function snippetAt(text: string, spans: TextSpan[], match: TextSpan, maxLen = 220): string {
  const span = spans.find((s) => match.start >= s.start && match.start < s.end) ?? match;
  let { start, end } = span;
  let prefix = "";
  let suffix = "";
  if (end - start > maxLen) {
    const half = Math.floor((maxLen - (match.end - match.start)) / 2);
    const winStart = Math.max(start, match.start - half);
    const winEnd = Math.min(end, winStart + maxLen);
    if (winStart > start) prefix = "…";
    if (winEnd < end) suffix = "…";
    start = winStart;
    end = winEnd;
  }
  const body = text.slice(start, end).replace(BULLET_PREFIX, "").replace(/\s+/g, " ").trim();
  return prefix + body + suffix;
}
