import { describe, it, expect } from "vitest";
import { validateDictionary } from "@/lib/dictionary";
import { dictionary } from "@/lib/defaultExtractor";

const entry = (over: Record<string, unknown> = {}) => ({
  id: "sql", term: "SQL", synonyms: [], category: "technical", ...over,
});

describe("validateDictionary", () => {
  it("accepts a valid file", () => {
    expect(validateDictionary({ status: "draft", entries: [entry()] }).entries).toHaveLength(1);
  });

  it("rejects duplicate ids", () => {
    expect(() => validateDictionary({ entries: [entry(), entry({ term: "Structured Query Language" })] })).toThrow(/duplicate id/);
  });

  it("rejects unknown categories", () => {
    expect(() => validateDictionary({ entries: [entry({ category: "misc" })] })).toThrow(/category/);
  });

  it("rejects empty terms and bad synonyms", () => {
    expect(() => validateDictionary({ entries: [entry({ term: " " })] })).toThrow(/term/);
    expect(() => validateDictionary({ entries: [entry({ synonyms: [""] })] })).toThrow(/synonyms/);
  });

  it("rejects the same form in two entries (plural-insensitive)", () => {
    const bad = { entries: [entry({ id: "a", term: "stakeholders" }), entry({ id: "b", term: "stakeholder" })] };
    expect(() => validateDictionary(bad)).toThrow(/also used by "a"/);
  });

  it("rejects a file without entries", () => {
    expect(() => validateDictionary({})).toThrow(/entries/);
  });
});

describe("data/dictionary.json", () => {
  it("is valid", () => {
    expect(dictionary.entries.length).toBeGreaterThan(0);
  });
});
