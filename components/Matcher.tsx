"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardPaste, ScanSearch, Trash2, TriangleAlert } from "lucide-react";
import { analyze, type AnalysisResult } from "@/lib/analyze";
import { defaultExtractor } from "@/lib/defaultExtractor";
import { RESUME_KEY, loadSaved, remove, save } from "@/lib/storage";
import { ScoreCard } from "./ScoreCard";
import { ResumePlan } from "./ResumePlan";
import { HighlightedJd } from "./HighlightedJd";

export function Matcher() {
  const [jd, setJd] = useState("");
  const [resume, setResume] = useState("");
  const [remember, setRemember] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzedJd, setAnalyzedJd] = useState("");
  const resultsRef = useRef<HTMLHeadingElement>(null);

  // Load a saved resume once, after the page loads in the browser.
  useEffect(() => {
    const saved = loadSaved(RESUME_KEY);
    if (saved) {
      setResume(saved);
      setRemember(true);
      setHasSaved(true);
    }
  }, []);

  // While "Remember" is on, keep the saved copy up to date.
  useEffect(() => {
    if (!remember) return;
    if (resume.trim()) {
      setHasSaved(save(RESUME_KEY, resume));
    } else {
      remove(RESUME_KEY);
      setHasSaved(false);
    }
  }, [remember, resume]);

  useEffect(() => {
    const heading = resultsRef.current;
    if (!result || !heading) return;
    // Bring the score to the top of the screen (phones), then move keyboard focus there.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
    heading.focus({ preventScroll: true });
  }, [result]);

  // Hide the "paste both texts" error as soon as both boxes have text.
  useEffect(() => {
    if (error && jd.trim() && resume.trim()) setError("");
  }, [error, jd, resume]);

  function onRememberChange(checked: boolean) {
    setRemember(checked);
    if (!checked) {
      remove(RESUME_KEY);
      setHasSaved(false);
      setStatus("Your resume is no longer saved on this device.");
    } else {
      setStatus(resume.trim() ? "Resume saved on this device only." : "Your resume will be saved on this device once you paste it.");
    }
  }

  function clearSaved() {
    remove(RESUME_KEY);
    setRemember(false);
    setHasSaved(false);
    setStatus("Saved resume cleared from this device.");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  }

  function onAnalyze(e: React.FormEvent) {
    e.preventDefault();
    const missing = [!jd.trim() && "job description", !resume.trim() && "resume"].filter(Boolean);
    if (missing.length) {
      setError(`Paste both texts to analyze. Missing: ${missing.join(" and ")}.`);
      setResult(null);
      return;
    }
    setError("");
    setAnalyzedJd(jd);
    setResult(analyze(jd, resume, defaultExtractor));
  }

  const jdInvalid = Boolean(error) && !jd.trim();
  const resumeInvalid = Boolean(error) && !resume.trim();

  return (
    <>
      <form className="inputs" onSubmit={onAnalyze} noValidate>
        <div className="field">
          <label htmlFor="jd">Job description</label>
          <textarea
            id="jd"
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            onKeyDown={onKeyDown}
            rows={10}
            placeholder="Paste the full job posting here"
            aria-invalid={jdInvalid}
            aria-describedby={jdInvalid ? "form-error" : undefined}
          />
        </div>
        <div className="field">
          <label htmlFor="resume">Your resume</label>
          <textarea
            id="resume"
            value={resume}
            onChange={(e) => setResume(e.target.value)}
            onKeyDown={onKeyDown}
            rows={10}
            placeholder="Paste your resume as plain text"
            aria-invalid={resumeInvalid}
            aria-describedby={resumeInvalid ? "form-error" : undefined}
          />
          <div className="remember-row">
            <label className="checkbox">
              <input type="checkbox" checked={remember} onChange={(e) => onRememberChange(e.target.checked)} />
              Remember my resume on this device
            </label>
            {hasSaved && (
              <button type="button" className="button button-secondary" onClick={clearSaved}>
                <Trash2 size={18} aria-hidden="true" />
                Clear saved resume
              </button>
            )}
          </div>
          <p className="muted small status" role="status" aria-live="polite">
            {status}
          </p>
        </div>

        <div className="actions">
          <button type="submit" className="button" aria-describedby="shortcut-hint">
            <ScanSearch size={20} aria-hidden="true" />
            Analyze
          </button>
          <p id="shortcut-hint" className="muted small shortcut-hint">
            Tip: press Ctrl+Enter (⌘+Enter on Mac) in either box.
          </p>
          {error && (
            <p id="form-error" className="error" role="alert">
              <TriangleAlert size={18} aria-hidden="true" />
              {error}
            </p>
          )}
        </div>
      </form>

      {result ? (
        <div className="results">
          <h2 ref={resultsRef} tabIndex={-1} className="results-title">
            Results
          </h2>
          <ScoreCard result={result} />
          <ResumePlan result={result} />
          <HighlightedJd jd={analyzedJd} result={result} />
        </div>
      ) : (
        !error && (
          <section className="card empty-state" aria-label="How it works">
            <ClipboardPaste size={32} aria-hidden="true" />
            <div>
              <p className="empty-title">Paste a job description and your resume, then tap Analyze.</p>
              <p className="muted small">
                You&apos;ll get a match score and a resume plan: which keywords to add, which to show more
                clearly, and which you already cover. The ones in the job title and requirements come first.
              </p>
            </div>
          </section>
        )
      )}
    </>
  );
}
