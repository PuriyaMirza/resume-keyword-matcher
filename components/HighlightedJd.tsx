import { buildSegments } from "@/lib/highlight";
import type { AnalysisResult } from "@/lib/analyze";

export function HighlightedJd({ jd, result }: { jd: string; result: AnalysisResult }) {
  const segments = buildSegments(jd, result.matched, result.missing);
  return (
    <section className="card" aria-labelledby="jd-heading">
      <h2 id="jd-heading" className="section-title">Job description, highlighted</h2>
      <p className="legend small">
        <mark className="hl hl-matched">matched</mark> <mark className="hl hl-missing">missing</mark>
      </p>
      <div className="jd-text">
        {segments.map((s, i) =>
          s.kind === "plain" ? (
            s.text
          ) : (
            <mark key={i} className={`hl hl-${s.kind}`} title={`${s.keyword}: ${s.kind}`}>
              {s.text}
              <span className="visually-hidden"> ({s.kind})</span>
            </mark>
          ),
        )}
      </div>
    </section>
  );
}
