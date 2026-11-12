import { describe, it, expect } from "vitest";
import { buildSegments } from "@/lib/highlight";
import { matchResume } from "@/lib/match";
import { extractor } from "./helpers";

describe("buildSegments", () => {
  it("splits the JD into plain, matched and missing pieces that rebuild the original", () => {
    const jd = "Strong SQL and Agile.\nNice: OKRs.";
    const r = matchResume(extractor.extract(jd), "SQL expert");
    const segs = buildSegments(jd, r.matched, r.missing);
    expect(segs.map((s) => s.text).join("")).toBe(jd);
    expect(segs.filter((s) => s.kind !== "plain").map((s) => [s.text, s.kind])).toEqual([
      ["SQL", "matched"],
      ["Agile", "missing"],
      ["OKRs", "missing"],
    ]);
  });

  it("returns one plain segment when nothing is found", () => {
    expect(buildSegments("hello", [], [])).toEqual([{ text: "hello", kind: "plain" }]);
  });

  it("keeps HTML as plain text", () => {
    const jd = "<b>SQL</b>";
    const r = matchResume(extractor.extract(jd), "SQL");
    expect(buildSegments(jd, r.matched, r.missing).map((s) => s.text)).toEqual(["<b>", "SQL", "</b>"]);
  });
});
