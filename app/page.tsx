import { FileSearch } from "lucide-react";

export default function Home() {
  return (
    <main className="container">
      <header className="header">
        <FileSearch size={28} aria-hidden="true" />
        <h1>Resume Keyword Matcher</h1>
      </header>
      <p className="muted">
        Paste a job description and your resume to see which keywords you cover.
        Everything runs in your browser. Nothing is uploaded.
      </p>
      <section className="card" aria-label="Status">
        <p>Scaffold is live. The matcher arrives in upcoming milestones.</p>
      </section>
    </main>
  );
}
