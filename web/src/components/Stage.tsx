import type { StageModel, StagePart } from "../model/stage";
import { SourceLink } from "./InfoDialog";

function Parts({ parts, onOpen }: { parts: StagePart[]; onOpen: (id: string) => void }) {
  return parts.map((part) => (
    part.infoId && part.name
      ? <SourceLink key={part.key} infoId={part.infoId} name={part.name} onOpen={onOpen}>{part.text}</SourceLink>
      : <span key={part.key}>{part.text}</span>
  ));
}

export function Ladder({
  stage,
  onLevel,
}: {
  stage: StageModel;
  onLevel: (level: number) => void;
}) {
  return (
    <ol className="ladder">
      {stage.steps.map((step) => (
        <li key={step.id}>
          <button
            type="button"
            aria-current={step.current ? "step" : undefined}
            className={step.done ? "is-done" : step.current ? undefined : "is-ahead"}
            onClick={() => onLevel(Number(step.mark))}
          >
            <span className="dia" aria-hidden="true" />
            <span className="step-kicker">{step.kicker}</span>
            <span className="step-name">{step.name}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

export function Picture({ stage, onOpen }: { stage: StageModel; onOpen: (id: string) => void }) {
  return (
    <div className={["chart", stage.legend.some((item) => item.id === "pass") ? "" : stage.summary ? "is-summary" : "is-whole"].filter(Boolean).join(" ")}>
      <ul className="legend">
        {stage.legend.map((item) => (
          <li key={item.id}><span className={item.className} aria-hidden="true" />{item.label}</li>
        ))}
      </ul>
      <div className="cent-chart">
        {stage.homeNote.length || stage.abroadNote.length ? (
          <div className="cent-row notes-row">
            <span />
            <div className="notes">
              <span><Parts parts={stage.homeNote} onOpen={onOpen} /></span>
              <span><Parts parts={stage.abroadNote} onOpen={onOpen} /></span>
            </div>
            <span className="kept-head">{stage.keptHead}</span>
          </div>
        ) : null}
        {stage.rows.map((row) => (
          <div key={row.id} className={row.id === "sum" ? "cent-row is-sum" : "cent-row"}>
            <p className="cent-label">{row.label}<small>{row.hint}</small></p>
            <div className="cent-bar">
              {row.segments.map((segment) => (
                <button
                  key={segment.key}
                  type="button"
                  className={segment.className}
                  style={{ left: segment.left, width: segment.width }}
                  aria-label={segment.name}
                  onClick={() => onOpen(segment.infoId)}
                />
              ))}
            </div>
            {row.kept && row.keptInfoId && row.keptName ? (
              <SourceLink className="kept" infoId={row.keptInfoId} name={row.keptName} onOpen={onOpen}>{row.kept}</SourceLink>
            ) : <span className="kept" />}
          </div>
        ))}
        {stage.abroadLine.length ? (
          <p className="abroad-line">
            <Parts parts={stage.abroadLine} onOpen={onOpen} />
            {stage.compareLine.length ? <span className="compare"><Parts parts={stage.compareLine} onOpen={onOpen} /></span> : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function Lead({ stage, onOpen }: { stage: StageModel; onOpen: (id: string) => void }) {
  return <p className="lead"><Parts parts={stage.sentence} onOpen={onOpen} /></p>;
}

/** The figure at the top across the twenty years. Its x scale matches the year slider below it. */
export function Years({ stage }: { stage: StageModel }) {
  const years = stage.years;
  if (!years) return null;
  return (
    <figure className="years">
      <figcaption className="quiet">{years.caption}</figcaption>
      <div className="years-plot" role="img" aria-label={years.label}>
        {years.grid.map((guide) => (
          <span key={guide.id} className="years-guide" style={{ top: guide.top }}>
            <span>{years.guideLabels[guide.id]}</span>
          </span>
        ))}
        <svg viewBox={years.viewBox} preserveAspectRatio="none" aria-hidden="true">
          <path className="years-band" d={years.band} />
          <path className="years-line" d={years.line} />
        </svg>
        <span className="years-now" style={{ left: years.now.left }} aria-hidden="true" />
        {years.marks.map((mark) => (
          <span key={mark.id} className="years-mark" style={{ left: mark.left, top: mark.top }} aria-hidden="true" />
        ))}
        <span className="years-dot" style={{ left: years.now.left, top: years.now.top }} aria-hidden="true" />
      </div>
    </figure>
  );
}
