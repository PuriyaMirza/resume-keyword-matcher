# Resume Keyword Matcher

Paste a job description (JD) and your resume as plain text. The app shows which
of the JD's keywords your resume covers, which are missing, and a match score.

**Everything runs in your browser.** No backend, no AI calls, no analytics, no
external network requests at runtime.

> Status: v1 complete (milestones 1–5). The keyword dictionary is a draft for review.

## Using it

1. Paste the job posting into **Job description**.
2. Paste your resume (plain text) into **Your resume**.
3. Tap **Analyze** (or press Ctrl+Enter / ⌘+Enter in either box).
4. Read the score, then the **Missing keywords** list. Each one shows the JD
   sentence that uses it, so you can see the context before adding it.
5. Optional: tick **Remember my resume** to keep it in this browser. Tap
   **Clear saved resume** (or untick) to delete it.

## Run it locally

Requires Node.js 20+.

```bash
npm install
npm run dev        # open http://localhost:3000
npm test           # run unit tests (Vitest)
npm run build      # production build, same as Vercel runs
```

## Project layout

| Path | What it is |
| --- | --- |
| `app/` | Next.js App Router pages, layout, and CSS |
| `components/` | UI pieces: inputs, score card, keyword lists, highlighted JD |
| `app/tokens.css` | Theme variables (placeholder values; see below) |
| `lib/normalize.ts` | Lowercasing, quote/dash cleanup, tokens, light stemming |
| `lib/phraseMatcher.ts` | Whole-word and multi-word phrase matching |
| `lib/extractors/` | Keyword extractors (`dictionary.ts` now, TF-IDF later) |
| `lib/match.ts` | Compares JD keywords with the resume |
| `lib/scoring.ts` | Score weights (edit here to tune the score) |
| `data/dictionary.json` | Keyword dictionary (135-term draft, reviewed once) |
| `corpus/` | Reserved for a future TF-IDF extractor |
| `tests/` | Vitest unit tests |

## How the score works

Only keywords from `data/dictionary.json` count. Each one the JD mentions gets a weight:

```
weight = min(times the JD uses it, 3) x category multiplier
score  = matched weight / total weight, as a percent
```

| Category | Multiplier |
| --- | --- |
| core-pm | 1.5 |
| technical | 1.5 |
| delivery, data, domain | 1 |

Worked example. A JD mentions three keywords:

| Keyword | JD mentions | Category | Weight | In resume? |
| --- | --- | --- | --- | --- |
| PM | 5 (capped at 3) | core-pm | 3 x 1.5 = 4.5 | yes |
| SQL | 1 | technical | 1 x 1.5 = 1.5 | no |
| Agile | 2 | delivery | 2 x 1 = 2 | yes |

Score = (4.5 + 2) / (4.5 + 1.5 + 2) = 6.5 / 8 = **81%**.

A keyword counts as found if the resume contains its main term **or any of its
synonyms**, no matter which form the JD used. To change the cap or the
multipliers, edit the numbers in `lib/scoring.ts`.

Labels: 75%+ is "Strong match", 50–74% "Partial match", under 50% "Low match".

## Matching rules

- Case-insensitive, accents ignored, curly quotes and all dash types treated alike.
- Whole words only: "SQL" does not match inside "NoSQL"; "API" not inside "rapid".
- "cross-functional", "cross functional" and "cross–functional" all match.
- Plurals and verb endings match: stakeholders/stakeholder, prioritizing/prioritize.
  This uses a few simple suffix rules instead of a stemming library, because
  libraries like Porter merge unrelated words ("organization" and "organ").
- Special tokens stay whole: C++, C#, .NET, A/B, CI/CD, UI/UX, P&L, R&D.
- Acronyms that are also everyday words or units (PM, IT, US, HR, ML...) only match in
  capitals, so "5 pm" is not "PM". Others (SQL, KPI, OKR) match in any case.
- Very short words like "Go" or "R" never match alone; add a clear synonym
  ("Golang", "R programming") instead.
- Synonyms count toward their main term.
- In the JD, the longest phrase wins: "product roadmap" is not also counted as "roadmap".

## Editing `data/dictionary.json`

The dictionary is a plain JSON file. You can edit it on GitHub in the browser
(open the file, tap the pencil icon). Each keyword is one entry:

```json
{
  "id": "go-to-market",
  "term": "Go-to-Market",
  "synonyms": ["GTM", "go to market"],
  "category": "core-pm"
}
```

| Field | Rules |
| --- | --- |
| `id` | Unique, lowercase, words joined by dashes (`a-z`, `0-9`, `-`). Never shown in the app. |
| `term` | The name shown in the app. Also matched. |
| `synonyms` | Other spellings that count as the same keyword. Use `[]` for none. |
| `category` | One of `core-pm`, `delivery`, `data`, `technical`, `domain`. Sets the score multiplier. |

**To add a keyword:** copy an existing entry, paste it inside the `"entries": [ ... ]`
list, change all four fields, and make sure entries are separated by commas.

**To remove one:** delete the whole `{ ... }` block and the comma next to it.

Tips:
- You don't need plural or verb forms: "roadmap" already matches "roadmaps" and
  "roadmapping"; "prioritize" matches "prioritizing" and "prioritized".
- Hyphens and spaces are interchangeable: "cross-functional" matches "cross functional".
- Write acronyms in CAPITALS (`"PM"`, `"SQL"`). See *Matching rules* for which ones
  must also be capitalized in the text.
- Words of 1–2 letters ("Go", "R") are ignored unless written as a capitalized
  acronym, so add a longer synonym ("Golang", "R programming").
- Avoid single everyday words that have non-PM meanings ("safe", "excel", "rest").
- The same word can't belong to two entries. If it does, the app tells you which.
- `reviewNotes` is a free-form place for your own notes; the app ignores it.

**Check your edit:** run `npm test`. If something is wrong, the test output lists
each problem, e.g. `entry #12 ("sql"): duplicate id`. On Vercel, a broken
dictionary makes the build fail, so a bad edit never reaches the live site.

## Accessibility

- All inputs have visible labels; errors are announced to screen readers.
- Every button and checkbox is at least 44px tall.
- Text colors meet WCAG AA contrast; missing keywords use a dashed underline,
  not just color.
- Full keyboard support with a visible focus ring. After Analyze, focus moves to
  the results.
- Checked with axe-core (0 issues) at 375px width.

## Theme tokens (placeholders)

All colors, fonts, and spacing live in `app/tokens.css`. The current values are
**placeholders** for the "Neutral" gray + teal theme. To use your real tokens,
replace that file's values (keep the variable names, or tell me the new names).

| Variable | Placeholder | Used for |
| --- | --- | --- |
| `--color-bg` | `#f7f8f8` | Page background |
| `--color-surface` | `#ffffff` | Cards, inputs |
| `--color-border` | `#d4d8da` | Borders |
| `--color-text` | `#1f2629` | Body text |
| `--color-text-muted` | `#525c61` | Secondary text |
| `--color-primary` | `#0f766e` | Buttons, accents (teal) |
| `--color-primary-hover` | `#115e59` | Button hover |
| `--color-on-primary` | `#ffffff` | Text on primary |
| `--color-focus` | `#0d9488` | Keyboard focus ring |
| `--color-match-bg` / `--color-match-text` | `#ccfbf1` / `#134e4a` | Matched keyword highlight |
| `--color-missing-bg` / `--color-missing-text` | `#fde8d8` / `#7c2d12` | Missing keyword highlight |
| `--color-error` | `#b42318` | Validation messages |
| `--font-sans` | Manrope, then system fonts | All text |
| `--touch-target` | `44px` | Minimum button/tap size |

Spacing (`--space-*`), radius, and font sizes are also in that file.

**Font:** Manrope is loaded with `next/font/google`. It downloads at build
time and is served from this site, so visitors' browsers never contact Google.

## Deploying

The repo is connected to Vercel. Every pull request gets a preview URL; merging
to `main` deploys production. No environment variables are needed.

## Privacy and safety

- Resume text never leaves your browser.
- "Remember my resume" is off by default. When on, the resume is kept in this
  browser's localStorage only. "Clear saved resume" (or unticking the box) deletes it.
- Test fixtures use synthetic, fake text only. Never commit a real resume.
- Job description text is treated as untrusted data. It is displayed as plain
  text only, never run as code or HTML. A test checks that instructions written
  inside a JD do not change the result.
