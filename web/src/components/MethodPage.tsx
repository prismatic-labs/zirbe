import { useEffect, useState } from "react";
import { HEADING } from "../a11y";
import { loadMethod } from "../data/load";
import { t } from "../i18n";
import { renderMarkdown } from "../method/markdown";

export function MethodPage({ onBack }: { onBack: () => void }) {
  const [docs, setDocs] = useState<{ method: string; sources: string } | null>(null);
  useEffect(() => {
    loadMethod().then(setDocs).catch(() => setDocs({ method: "", sources: "" }));
  }, []);
  const methodHtml = docs ? renderMarkdown(docs.method) : "";
  const sourcesHtml = docs ? renderMarkdown(docs.sources) : "";
  const empty = docs !== null && docs.method.trim() === "" && docs.sources.trim() === "";
  return (
    <main className="method-page">
      <a href="#" onClick={(event) => { event.preventDefault(); onBack(); }}>{t("back")}</a>
      <p role="heading" aria-level={HEADING.page} className="page-title">{t("methodTitle")}</p>
      <p>{t("methodStanding")}</p>
      {empty ? <p className="quiet">{t("methodMissing")}</p> : null}
      <article dangerouslySetInnerHTML={{ __html: methodHtml }} />
      <p role="heading" aria-level={HEADING.section} className="section-title">{t("sourcesTitle")}</p>
      <article dangerouslySetInnerHTML={{ __html: sourcesHtml }} />
    </main>
  );
}
