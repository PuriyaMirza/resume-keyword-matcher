export type Category = "core-pm" | "delivery" | "data" | "technical" | "domain";

export const CATEGORIES: readonly Category[] = ["core-pm", "delivery", "data", "technical", "domain"];

/** "dictionary" today; "tfidf" is reserved for a future extractor. */
export type KeywordSource = "dictionary" | "tfidf";

export interface TextSpan {
  start: number;
  end: number;
}

export interface KeywordCandidate {
  /** Stable id (dictionary entry id for dictionary candidates). */
  id: string;
  /** Display name, e.g. "Go-to-Market". */
  canonical: string;
  /** Which forms were found in the JD, e.g. ["Go-to-Market", "GTM"]. */
  matchedForms: string[];
  /** How many times the JD mentions this keyword (all forms combined). */
  jdCount: number;
  /** Up to 3 JD sentences that contain the keyword. */
  jdSnippets: string[];
  source: KeywordSource;
  /** Optional: a TF-IDF extractor may not know the category. */
  category?: Category;
  /** Every form to look for in the resume (canonical + synonyms). */
  searchForms: string[];
  /** Where each mention sits in the JD text (for highlighting). */
  occurrences: TextSpan[];
}

export interface KeywordExtractor {
  readonly name: string;
  extract(jdText: string): KeywordCandidate[];
}
