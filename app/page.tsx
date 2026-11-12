import { FileSearch } from "lucide-react";
import { Matcher } from "@/components/Matcher";

export default function Home() {
  return (
    <main className="container">
      <header className="header">
        <FileSearch size={28} aria-hidden="true" />
        <h1>Resume Keyword Matcher</h1>
      </header>
      <p className="muted intro">
        Everything runs in your browser. Nothing you paste is uploaded.
      </p>
      <Matcher />
    </main>
  );
}
