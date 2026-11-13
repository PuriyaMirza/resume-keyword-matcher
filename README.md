# Resume Keyword Matcher

Paste a job description (JD) and your resume as plain text. The app gives you a
match score and a **resume plan**: a ranked list of the JD's keywords to add, to
show more clearly, and that you already cover.

**Everything runs in your browser.** No backend, no AI calls, no analytics, no
external network requests at runtime.

> Status: v1 complete (milestones 1–5), plus the resume plan. The keyword dictionary is a draft for review.

## Using it

1. Paste the job posting into **Job description**.
2. Paste your resume (plain text) into **Your resume**.
3. Tap **Analyze** (or press Ctrl+Enter / ⌘+Enter in either box).
4. Read the score, then **Your resume plan**. It has three parts, most important
   keyword first in each:
   - **Add if true**: keywords your resume doesn't mention. Only add one if it
     honestly reflects your experience.
   - **Strengthen**: keywords you mention, but only in your skills list, or only
     once when the posting stresses them.
   - **Already covered**: nothing to do.

   Each keyword shows a priority (High / Medium / Low), why it matters ("Listed as
   required", "In the job title"...), and the JD sentence that uses it.
5. Each results section has a small **?** button in its top-right corner. Tap it
   for a short plain-English explanation; tap it again, press Escape, or tap
   elsewhere to close it.
6. Optional: tick **Remember my resume** to keep it in this browser. Tap
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
| `components/` | UI pieces: inputs, score card, resume plan, highlighted JD |
| `app/tokens.css` | Theme variables (placeholder values; see below) |
| `lib/normalize.ts` | Lowercasing, quote/dash cleanup, tokens, light stemming |
| `lib/phraseMatcher.ts` | Whole-word and multi-word phrase matching |
| `lib/extractors/` | Keyword extractors (`dictionary.ts` now, TF-IDF later) |
| `lib/headings.ts` | Finds section heading lines (shared by the JD and resume) |
| `lib/jdStructure.ts` | Tags each part of the JD: title, required, responsibilities, nice-to-have, company text |
| `lib/resumeStructure.ts` | Tags each part of the resume: skills, summary, experience, other |
| `lib/match.ts` | Compares JD keywords with the resume and builds the resume plan |
| `lib/scoring.ts` | Score weights and priority tiers (edit here to tune them) |
| `data/dictionary.json` | Keyword dictionary (135-term draft, reviewed once) |
| `corpus/` | Reserved for a future TF-IDF extractor |
| `tests/` | Vitest unit tests |

## How the score works

Only keywords from `data/dictionary.json` count. Each mention in the JD is worth
more or less depending on **where** it is:

| Where in the JD | Multiplier |
| --- | --- |
| Job title | 2.5 |
| Requirements ("Requirements", "What you bring", "Qualifications", "Key requirements"...) | 1.5 |
| Responsibilities ("What you'll do", "About the role", "Your responsibilities"...) | 1.25 |
| Anywhere else (text before any heading, "About the job", "Overview", "Summary"...) | 1 |
| Nice-to-have ("Nice to have", "Preferred qualifications", "Desired skills", "Bonus"...) | 0.6 |
| Company or benefits text ("About us", "About <company>", "Benefits", "EEO"...) | 0.4 |

A heading is a short line on its own, like "Requirements" or "## What you'll do:".
A heading can also join several known headings with "&", "and", "," or "/", such
as "Knowledge, Skills and Abilities" or "Essential Duties & Responsibilities".
Every part must be a known heading, and the first part decides the placement.
Before a part is checked, leading words that don't change its meaning are dropped:
essential, key, core, main, primary, principal, general, major, specific, your,
our, the, job, position, role-specific and additional. ("Required", "minimum",
"basic", "preferred", "desired" and "nice" are kept, because they change the meaning.)
These are never headings: list items ("- Benefits"), and lines with text after a
colon ("Location: Remote", "Salary: $100k"). A line like "Requirements: 5+ years
of SQL" or "Nice to have: Python" sets the placement for that line only.

The job title is the text after "Job title:" or "Title:" near the top, or after
"Role:" or "Position:" in the first 5 lines (but not "Position: Full-time").
Otherwise it is the first line, or the line after it if the first line is a
heading such as "About the job". A title is at most 80 characters and doesn't end
with a period.

A sentence's own words can override its section: "SQL is a plus" counts as
nice-to-have even under Requirements, and "A/B testing is required" counts as
required even under Nice to have. This never changes the job title, and never
lifts company or benefits text. If one sentence has both kinds of cue ("SQL required,
Tableau a plus."), it is cut into clauses at commas, semicolons, brackets, dashes,
and the words "but", "though", "while" and "although", and each clause gets its
own cue. A clause with no cue of its own takes the cue of the clause before it, or
the one after it if it comes first. "No degree required" counts as nice-to-have, and
"minimum viable product" or "non-essential" are not requirements.

Each keyword gets a weight:

```
weight = category multiplier x (sum of its 3 best mentions)
score  = matched weight / total weight, as a percent
```

| Category | Multiplier |
| --- | --- |
| core-pm | 1.5 |
| technical | 1.5 |
| delivery, data, domain | 1 |

Only the 3 best mentions count, so a word repeated 10 times in the company blurb
can't outweigh one real requirement.

Worked example. This JD:

```
Product Manager
Requirements
- 3+ years as a product manager.
- Strong SQL.
- Agile delivery experience.
Responsibilities
- Run Agile ceremonies.
Nice to have
- OKRs.
About us
We are an Agile company. Agile is in our name.
```

| Keyword | Mentions | Category | Weight | In resume? |
| --- | --- | --- | --- | --- |
| Product Management | title 2.5, required 1.5 | core-pm | (2.5 + 1.5) x 1.5 = 6 | yes |
| SQL | required 1.5 | technical | 1.5 x 1.5 = 2.25 | no |
| Agile | required 1.5, responsibilities 1.25, company 0.4, company 0.4 (best 3 count) | delivery | (1.5 + 1.25 + 0.4) x 1 = 3.15 | yes |
| OKR | nice-to-have 0.6 | core-pm | 0.6 x 1.5 = 0.9 | no |

Score = (6 + 3.15) / (6 + 2.25 + 3.15 + 0.9) = 9.15 / 12.3 = **74%**.

A keyword counts as found if the resume contains its main term **or any of its
synonyms**, no matter which form the JD used. To change any of these numbers,
edit `lib/scoring.ts`.

Labels: 75%+ is "Strong match", 50–74% "Partial match", under 50% "Low match".

## How the plan works

Each keyword gets a priority from its weight: **High** at 2.25 or more,
**Medium** at 1 or more, **Low** below 1. In the example above, Product Management, SQL
and Agile are High and OKR is Low.

Then it goes into one group:

- **Add if true**: the resume doesn't mention it.
- **Strengthen**: the resume mentions it, it is High or Medium, and either
  - it only appears under a skills heading ("Skills", "Tools", "Core
    competencies"...). Show it in an experience bullet instead; or
  - it is High and appears only once. Add it to your summary or a recent role.
- **Already covered**: everything else the resume mentions. Low-priority
  keywords never need strengthening.

The app finds resume sections the same way as JD sections: a short line such as
"Experience", "Skills" or "Summary". A line like "Skills: SQL, Python, Jira" also
counts as a skills list, for that line only. "Tools:", "Tech stack:" or
"Technologies:" lines inside an experience section describe that job, so they
stay experience. If your resume has no headings, the "only
in skills" rule is skipped. Each group is sorted by weight, then by how often
the JD mentions the keyword, then A to Z.

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
- Priorities are written out (High / Medium / Low), not shown by color alone.
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
