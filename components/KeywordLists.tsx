import { CircleCheck, CircleX, Quote } from "lucide-react";
import type { ScoredKeyword } from "@/lib/match";

function timesLabel(n: number) {
  return n === 1 ? "1 mention" : `${n} mentions`;
}

export function MissingList({ items }: { items: ScoredKeyword[] }) {
  return (
    <section className="card" aria-labelledby="missing-heading">
      <h3 id="missing-heading" className="section-title">
        <CircleX size={20} aria-hidden="true" className="icon-missing" />
        Missing keywords ({items.length})
      </h3>
      {items.length === 0 ? (
        <p className="muted">Nothing missing. Your resume covers every keyword found.</p>
      ) : (
        <ul className="keyword-list">
          {items.map((k) => (
            <li key={k.id} className="keyword-item">
              <div className="keyword-head">
                <span className="keyword-name">{k.canonical}</span>
                <span className="badge">{timesLabel(k.jdCount)}</span>
                {k.category && <span className="badge badge-muted">{k.category}</span>}
              </div>
              <ul className="snippets" aria-label={`Where the JD mentions ${k.canonical}`}>
                {k.jdSnippets.map((s) => (
                  <li key={s}>
                    <Quote size={14} aria-hidden="true" className="snippet-icon" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function MatchedList({ items }: { items: ScoredKeyword[] }) {
  return (
    <section className="card" aria-labelledby="matched-heading">
      <h3 id="matched-heading" className="section-title">
        <CircleCheck size={20} aria-hidden="true" className="icon-matched" />
        Matched keywords ({items.length})
      </h3>
      {items.length === 0 ? (
        <p className="muted">No keywords matched yet.</p>
      ) : (
        <ul className="chips">
          {items.map((k) => (
            <li key={k.id} className="chip">
              {k.canonical}
              <span className="chip-count" aria-label={timesLabel(k.jdCount)}>
                ×{k.jdCount}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
