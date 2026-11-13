/**
 * The text of each "?" help popup. Edit the wording here.
 * `name` finishes the button label "What is <name>?". In `text`, a blank
 * line starts a new paragraph.
 */
export type HelpTopic = "score" | "plan" | "add" | "strengthen" | "covered" | "highlighted";

export const HELP_TEXT: Record<HelpTopic, { name: string; text: string }> = {
  score: {
    name: "the match score",
    text: `The app looks for keywords from its built-in list in the job posting, then checks your resume for each one.

Each keyword has a weight. It counts more if the posting repeats it or puts it in the job title or requirements, and less if it is a nice-to-have.

The score is the weight of the keywords found in your resume, divided by the weight of all keywords in the posting. It is not a simple count.`,
  },
  plan: {
    name: "the resume plan",
    text: `Every keyword from the posting is placed in one of three groups: Add if true, Strengthen, or Already covered.

High, Medium and Low show how much the posting stresses a keyword. A short reason, such as “Listed as required” or “Mentioned 2 times”, appears when one applies.

Only keywords in the app's built-in list are recognised, so a tool or term outside that list will not appear.`,
  },
  add: {
    name: "Add if true",
    text: `Keywords the posting uses that your resume does not, most important first.

The quote under each one is the posting sentence that uses it. The wording can differ and still count as the same keyword, for example “feedback loop” for customer feedback.

Only add a keyword if it is true for you.`,
  },
  strengthen: {
    name: "Strengthen",
    text: `Keywords your resume has, but weakly. Either it is only in your skills list, or you mention it once while the posting stresses it.

Each item shows the posting sentences first, then where your resume mentions it.

Work the keyword into your summary or an experience bullet.`,
  },
  covered: {
    name: "Already covered",
    text: "Keywords your resume already shows well enough. Nothing to do here.",
  },
  highlighted: {
    name: "the highlighted job description",
    text: `The full posting with every recognised keyword marked. One style shows keywords found in your resume, the other shows missing ones.

Use it to see each keyword in context.`,
  },
};
