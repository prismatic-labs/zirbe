import { useEffect, useRef, type ReactNode } from "react";
import { HEADING } from "../a11y";
import { t } from "../i18n";
import type { Explained, SourceCard } from "../model/present";

export function InfoDialog({ explained, onClose }: { explained: Explained | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!explained) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [explained, onClose]);
  if (!explained) return null;
  const data = explained.sources.filter((source) => source.kind === "data");
  const assumptions = explained.sources.filter((source) => source.kind === "assumption");
  return (
    <div className="dialog" role="dialog" aria-modal="true" aria-label={explained.title}>
      <div className="dialog-head">
        <p role="heading" aria-level={HEADING.section} className="section-title">{explained.title}</p>
        <button ref={closeRef} type="button" onClick={onClose}>{t("close")}</button>
      </div>
      <p className="dialog-what">{explained.what}</p>
      <ul className="dialog-chips">
        <li>{explained.structure}</li>
        <li>{explained.tableLine}</li>
        <li>{explained.priceLine}</li>
        {explained.averageNote ? <li>{explained.averageNote}</li> : null}
      </ul>
      {assumptions.length ? <p className="dialog-group">{t("sourcesAssumptions")}</p> : null}
      {assumptions.length ? <div className="sources">{assumptions.map((source) => <Card key={source.key} source={source} />)}</div> : null}
      {data.length ? <p className="dialog-group">{t("sourcesData")}</p> : null}
      {data.length ? <div className="sources">{data.map((source) => <Card key={source.key} source={source} />)}</div> : null}
    </div>
  );
}

function Card({ source }: { source: SourceCard }) {
  return (
    <section className="source-card">
      <p role="heading" aria-level={HEADING.source} className="source-title">
        {source.title}
        {source.draft ? <span className="draft">{t("draft")}</span> : null}
      </p>
      {source.range ? (
        <div className="range">
          <span className="range-central"><b>{source.range.central}</b> {source.range.unit}</span>
          <div className="range-rail" aria-hidden="true"><span className="range-at" style={{ left: source.range.at }} /></div>
          <div className="range-ends">
            <span>{t("low")} {source.range.low}</span>
            <span>{t("high")} {source.range.high}</span>
          </div>
        </div>
      ) : null}
      {source.lines.map((line) => <p key={line.key}>{line.text}</p>)}
      {source.note ? (
        <details>
          <summary>{t("sourceNote")}</summary>
          <p>{source.note}</p>
        </details>
      ) : null}
      {source.url ? <a href={source.url}>{source.linkLabel}</a> : null}
    </section>
  );
}

export function SourceLink({
  infoId,
  name,
  onOpen,
  className,
  children,
}: {
  infoId: string;
  name: string;
  onOpen: (id: string) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={className ? `source-link ${className}` : "source-link"}
      aria-label={t("sourceFor", { name })}
      onClick={() => onOpen(infoId)}
    >
      {children}
    </button>
  );
}
