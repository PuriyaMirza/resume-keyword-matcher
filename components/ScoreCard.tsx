import type { AnalysisResult } from "@/lib/analyze";

function label(score: number): string {
  if (score >= 75) return "Strong match";
  if (score >= 50) return "Partial match";
  return "Low match";
}

export function ScoreCard({ result }: { result: AnalysisResult }) {
  const total = result.candidates.length;
  if (result.score === null) {
    return (
      <section className="card" aria-labelledby="score-heading">
        <h3 id="score-heading">No keywords found</h3>
        <p className="muted">
          None of the dictionary&apos;s keywords appear in this job description. Check that you pasted
          the full posting.
        </p>
      </section>
    );
  }
  return (
    <section className="card score-card" aria-labelledby="score-heading">
      <h3 id="score-heading" className="visually-hidden">Match score</h3>
      <p className="score-value">
        {result.score}
        <span className="score-unit">%</span>
      </p>
      <div>
        <p className="score-label">{label(result.score)}</p>
        <p className="muted small">
          {result.matched.length} of {total} keywords found in your resume. Keywords the JD repeats,
          and core PM and technical keywords, count more.
        </p>
      </div>
    </section>
  );
}
