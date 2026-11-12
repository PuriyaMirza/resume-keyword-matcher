import dictionaryJson from "@/data/dictionary.json";
import { validateDictionary } from "./dictionary";
import { createDictionaryExtractor } from "./extractors/dictionary";

export const dictionary = validateDictionary(dictionaryJson);
export const defaultExtractor = createDictionaryExtractor(dictionary.entries);
