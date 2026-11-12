import { describe, it, expect } from "vitest";
import { normalizeText, stem, tokenize } from "@/lib/normalize";

const norms = (s: string) => tokenize(s).tokens.map((t) => t.norm);
const stems = (s: string) => tokenize(s).tokens.map((t) => t.stem);

describe("normalizeText", () => {
  it("lowercases and unifies curly quotes, dashes, slashes", () => {
    expect(normalizeText("“Go–To—Market” A∕B team’s")).toBe('"go-to-market" a/b team\'s');
  });

  it("folds accents", () => {
    expect(normalizeText("Résumé Café")).toBe("resume cafe");
  });

  it("keeps the same length so offsets stay valid", () => {
    const s = "Résumé “quoted” — A∕B   KPIs";
    expect(normalizeText(s)).toHaveLength(s.length);
  });
});

describe("tokenize", () => {
  it("protects special tokens", () => {
    expect(norms("C++, C#, .NET and A/B testing; CI/CD")).toEqual(["c++", "c#", ".net", "and", "a/b", "testing", "ci/cd"]);
    expect(stems("A/B testing")).toEqual(["a/b", "test"]);
  });

  it("splits hyphenated words so both spellings line up", () => {
    expect(stems("cross-functional")).toEqual(stems("cross functional"));
  });

  it("drops possessives (straight and curly)", () => {
    expect(norms("team's team’s")).toEqual(["team", "team"]);
  });

  it("handles plural acronyms", () => {
    const [kpi] = tokenize("KPIs").tokens;
    expect(kpi.norm).toBe("kpi");
    expect(kpi.upper).toBe(true);
    expect(tokenize("OKRs").tokens[0].norm).toBe("okr");
    expect(tokenize("Kpis").tokens[0].upper).toBe(false);
  });

  it("offsets point at the original text", () => {
    const raw = "Our “Go‑to‑Market” résumé";
    for (const t of tokenize(raw).tokens) expect(raw.slice(t.start, t.end)).toBe(t.text);
  });
});

describe("stem", () => {
  it.each([
    ["stakeholders", "stakeholder"],
    ["strategies", "strategy"],
    ["roadmaps", "roadmap"],
    ["roadmapping", "roadmap"],
    ["launches", "launch"],
    ["processes", "process"],
    ["processing", "process"],
    ["installing", "install"],
    ["shipped", "ship"],
    ["needs", "need"],
    ["metrics", "metric"],
    ["status", "status"],
    ["analysis", "analysis"],
    ["business", "business"],
    ["sql", "sql"],
  ])("%s -> %s", (input, expected) => {
    expect(stem(input)).toBe(expected);
  });

  it("verb forms share a stem", () => {
    const forms = ["prioritize", "prioritizes", "prioritizing", "prioritized"].map(stem);
    expect(new Set(forms).size).toBe(1);
    const manage = ["manage", "managed", "managing", "manages"].map(stem);
    expect(new Set(manage).size).toBe(1);
  });

  it("does not merge manager and management", () => {
    expect(stem("manager")).not.toBe(stem("management"));
  });
});
