"use client";

import { useState } from "react";
import { CircleCheck, CirclePlus, FileText, ListChecks, Quote, TrendingUp } from "lucide-react";
import type { MatchResult, PlanItem } from "@/lib/match";
import type { Priority } from "@/lib/scoring";
import { HelpTip } from "./HelpTip";
import type { HelpTopic } from "./helpText";

/** How many "add" items show before the "Show all" button. */
const ADD_PREVIEW = 10;

const PRIORITY_LABEL: Record<Priority, string> = { high: "High", medium: "Medium", low: "Low" };

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`badge badge-${priority}`}>
      {PRIORITY_LABEL[priority]}
      <span className="visually-hidden"> priority</span>
    </span>
  );
}

function Snippets({ label, items, resume = false }: { label: string; items: string[]; resume?: boolean }) {
  if (items.length === 0) return null;
  const Icon = resume ? FileText : Quote;
  return (
    <ul className={`snippets${resume ? " snippets-resume" : ""}`} aria-label={label}>
      {items.map((s) => (
        <li key={s}>
          <Icon size={14} aria-hidden="true" className="snippet-icon" />
          <span>{s}</span>
        </li>
      ))}
    </ul>
  );
}

/** One ranked keyword: name, priority, why it matters, and where it appears. */
function PlanEntry({ item }: { item: PlanItem }) {
  return (
    <li className="plan-item">
      <div className="keyword-head">
        <span className="keyword-name">{item.canonical}</span>
        <PriorityBadge priority={item.priority} />
      </div>
      {item.reasons.length > 0 && (
        <ul className="reasons" aria-label={`Why ${item.canonical} matters`}>
          {item.reasons.map((r) => (
            <li key={r} className="reason">
              {r}
            </li>
          ))}
        </ul>
      )}
      {item.planReason && <p className="plan-reason">{item.planReason}</p>}
      <Snippets label={`Where the job description mentions ${item.canonical}`} items={item.jdSnippets} />
      {item.group === "strengthen" && item.resume.snippets.length > 0 && (
        <>
          <p className="snippet-label small">In your resume:</p>
          <Snippets label={`Where your resume mentions ${item.canonical}`} items={item.resume.snippets} resume />
        </>
      )}
    </li>
  );
}

function GroupHeading({ id, icon, title, count, help }: { id: string; icon: React.ReactNode; title: string; count: number; help: HelpTopic }) {
  return (
    <div className="help-row">
      <h4 id={id} className="plan-group-title">
        {icon}
        {title} ({count})
      </h4>
      <HelpTip topic={help} />
    </div>
  );
}

export function ResumePlan({ result }: { result: MatchResult }) {
  const plan = result.plan;
  // Remember which "add" list was expanded, so a new analysis starts collapsed.
  const [expandedFor, setExpandedFor] = useState<PlanItem[] | null>(null);
  const showAll = expandedFor === plan.add;
  const addItems = showAll ? plan.add : plan.add.slice(0, ADD_PREVIEW);
  const nothingMatched = plan.strengthen.length === 0 && plan.covered.length === 0;
  // No keywords in the JD: the score card already says so, and a plan would be empty.
  if (result.score === null) return null;

  return (
    <section className="card" aria-labelledby="plan-heading">
      <div className="help-row">
        <h3 id="plan-heading" className="section-title">
          <ListChecks size={20} aria-hidden="true" className="icon-matched" />
          Your resume plan
        </h3>
        <HelpTip topic="plan" />
      </div>
      <p className="muted small">Most important first, based on where and how often the posting mentions each keyword.</p>

      <div className="plan-group" role="group" aria-labelledby="plan-add-heading">
        <GroupHeading
          id="plan-add-heading"
          icon={<CirclePlus size={18} aria-hidden="true" className="icon-missing" />}
          title="Add if true"
          help="add"
          count={plan.add.length}
        />
        <p className="plan-note small">Only add a keyword if it honestly reflects your experience.</p>
        {plan.add.length === 0 ? (
          <p className="muted">Nothing to add. Your resume mentions every keyword found.</p>
        ) : (
          <>
            <ol id="plan-add-list" className="plan-list">
              {addItems.map((k) => (
                <PlanEntry key={k.id} item={k} />
              ))}
            </ol>
            {plan.add.length > ADD_PREVIEW && (
              <button
                type="button"
                className="button button-secondary show-all"
                aria-expanded={showAll}
                aria-controls="plan-add-list"
                onClick={() => setExpandedFor(showAll ? null : plan.add)}
              >
                {showAll ? "Show fewer" : `Show all (${plan.add.length})`}
              </button>
            )}
          </>
        )}
      </div>

      <div className="plan-group" role="group" aria-labelledby="plan-strengthen-heading">
        <GroupHeading
          id="plan-strengthen-heading"
          icon={<TrendingUp size={18} aria-hidden="true" className="icon-matched" />}
          title="Strengthen"
          help="strengthen"
          count={plan.strengthen.length}
        />
        {plan.strengthen.length === 0 ? (
          <p className="muted">
            {nothingMatched
              ? "Nothing matched yet, so there is nothing to strengthen."
              : "Nothing to strengthen. Your key matches already show up well."}
          </p>
        ) : (
          <ol className="plan-list">
            {plan.strengthen.map((k) => (
              <PlanEntry key={k.id} item={k} />
            ))}
          </ol>
        )}
      </div>

      <div className="plan-group" role="group" aria-labelledby="plan-covered-heading">
        <GroupHeading
          id="plan-covered-heading"
          icon={<CircleCheck size={18} aria-hidden="true" className="icon-matched" />}
          title="Already covered"
          help="covered"
          count={plan.covered.length}
        />
        {plan.covered.length === 0 ? (
          <p className="muted">
            {plan.add.length === 0
              ? "Nothing fully covered yet. Work through the Strengthen list above."
              : "Nothing covered yet. Start with the keywords above."}
          </p>
        ) : (
          <ul className="chips">
            {plan.covered.map((k) => (
              <li key={k.id} className="chip">
                {k.canonical}
                <span className="chip-count">
                  <span aria-hidden="true">· </span>
                  {PRIORITY_LABEL[k.priority]}
                  <span className="visually-hidden"> priority</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
