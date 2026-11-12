import { describe, it, expect } from "vitest";
import { validateDictionary } from "@/lib/dictionary";
import { defaultExtractor, dictionary } from "@/lib/defaultExtractor";

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

describe("draft dictionary content", () => {
  it("has 120-150 entries across all 5 categories and is marked draft", () => {
    expect(dictionary.entries.length).toBeGreaterThanOrEqual(120);
    expect(dictionary.entries.length).toBeLessThanOrEqual(150);
    expect(dictionary.status).toBe("draft");
    const cats = new Set(dictionary.entries.map((e) => e.category));
    expect([...cats].sort()).toEqual(["core-pm", "data", "delivery", "domain", "technical"]);
  });

  it("does not fire on everyday words that look like keywords", () => {
    const offTopic =
      "We excel at service. The rest of the team leaves at 5 pm. Keep it safe. Add 50 ml of water. " +
      "Join us in the US office? No: go home. The chef owns the vision for the kitchen.";
    expect(defaultExtractor.extract(offTopic).map((c) => c.id)).toEqual([]);
  });
});
