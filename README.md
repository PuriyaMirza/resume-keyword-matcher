# Resume Keyword Matcher

Paste a job description (JD) and your resume as plain text. The app shows which
of the JD's keywords your resume covers, which are missing, and a match score.

**Everything runs in your browser.** No backend, no AI calls, no analytics, no
external network requests at runtime.

> Status: milestone 2 (matching engine). The full dictionary and UI arrive in
> later milestones.

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
| `app/tokens.css` | Theme variables (placeholder values; see below) |
| `lib/normalize.ts` | Lowercasing, quote/dash cleanup, tokens, light stemming |
| `lib/phraseMatcher.ts` | Whole-word and multi-word phrase matching |
| `lib/extractors/` | Keyword extractors (`dictionary.ts` now, TF-IDF later) |
| `lib/match.ts` | Compares JD keywords with the resume |
| `lib/scoring.ts` | Score weights (edit here to tune the score) |
| `data/dictionary.json` | Keyword dictionary (starter draft; full draft in milestone 3) |
| `corpus/` | Reserved for a future TF-IDF extractor |
| `tests/` | Vitest unit tests |

## How the score works

Each keyword found in the JD gets a weight:

```
weight = min(times the JD uses it, 3) x category multiplier
score  = matched weight / total weight, as a percent
```

| Category | Multiplier |
| --- | --- |
| core-pm | 1.5 |
| technical | 1.5 |
| delivery, data, domain | 1 |

Example: "PM" used 3 times (core-pm) weighs 3 x 1.5 = 4.5; "Agile" used once
(delivery) weighs 1. Change the numbers in `lib/scoring.ts`.

## Matching rules

- Case-insensitive, accents ignored, curly quotes and all dash types treated alike.
- Whole words only: "SQL" does not match inside "NoSQL"; "API" not inside "rapid".
- "cross-functional", "cross functional" and "cross–functional" all match.
- Plurals and verb endings match: stakeholders/stakeholder, prioritizing/prioritize.
  This uses a few simple suffix rules instead of a stemming library, because
  libraries like Porter merge unrelated words ("organization" and "organ").
- Special tokens stay whole: C++, C#, .NET, A/B, CI/CD, UI/UX, P&L, R&D.
- Acronyms that are also everyday words (PM, IT, US, HR...) only match in
  capitals, so "5 pm" is not "PM". Others (SQL, KPI, OKR) match in any case.
- Very short words like "Go" or "R" never match alone; add a clear synonym
  ("Golang", "R programming") instead.
- Synonyms count toward their main term.
- In the JD, the longest phrase wins: "product roadmap" is not also counted as "roadmap".

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
- Test fixtures use synthetic, fake text only. Never commit a real resume.
- Job description text is treated as untrusted data. It is displayed as plain
  text only, never run as code or HTML. A test checks that instructions written
  inside a JD do not change the result.
