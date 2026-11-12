import { readFileSync } from "node:fs";
import path from "node:path";
import { validateDictionary } from "@/lib/dictionary";
import { createDictionaryExtractor } from "@/lib/extractors/dictionary";

export const fixture = (name: string) =>
  readFileSync(path.join(__dirname, "fixtures", name), "utf8");

export const testDictionary = validateDictionary(JSON.parse(fixture("test-dictionary.json")));
export const extractor = createDictionaryExtractor(testDictionary.entries);

/** Map of keyword id -> jdCount for a JD string. */
export function counts(jd: string): Record<string, number> {
  return Object.fromEntries(extractor.extract(jd).map((c) => [c.id, c.jdCount]));
}
