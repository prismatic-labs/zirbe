import { HEADING } from "../a11y";
import type { View } from "../model/present";
import { SourceLink } from "./InfoDialog";

function Bars({ title, rows, onOpen }: { title: string; rows: View["panels"]["countries"]["rows"]; onOpen: (id: string) => void }) {
  return (
    <section className="panel">
      <p role="heading" aria-level={HEADING.section} className="section-title">{title}</p>
      <ul>
        {rows.map((row) => (
          <li key={row.id}>
            <span className="row-name">{row.label}</span>
            <SourceLink className="figures" infoId={row.infoId} name={row.label} onOpen={onOpen}>
              <span className="figure is-share">{row.share}</span>
              <span className="figure is-value">{row.value}</span>
            </SourceLink>
            <span className="bar-rail" aria-hidden="true">
              <span className={row.home ? "bar is-home" : "bar"} style={{ width: row.width }} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Tile({
  tile,
  onOpen,
}: {
  tile: View["panels"]["jobs"];
  onOpen: (id: string) => void;
}) {
  return (
    <section className="tile">
      <p role="heading" aria-level={HEADING.section} className="tile-title">{tile.title}</p>
      <p className="tile-figure">
        <SourceLink infoId={tile.figureInfoId} name={tile.figureName} onOpen={onOpen}>{tile.figure}</SourceLink>
      </p>
      <p className="tile-unit">{tile.unit}</p>
      <p className="tile-sentence">
        {tile.pieces.map((piece) => (
          piece.infoId && piece.name
            ? <SourceLink key={piece.key} infoId={piece.infoId} name={piece.name} onOpen={onOpen}>{piece.text}</SourceLink>
            : <span key={piece.key}>{piece.text}</span>
        ))}
      </p>
    </section>
  );
}

/** Value added at home by industry, next to the jobs and pay it supports. */
export function PeoplePanels({ panels, onOpen }: { panels: View["panels"]; onOpen: (id: string) => void }) {
  return (
    <div className="totals">
      <Bars title={panels.industries.title} rows={panels.industries.rows} onOpen={onOpen} />
      <div className="tile-stack">
        <Tile tile={panels.jobs} onOpen={onOpen} />
        <Tile tile={panels.payroll} onOpen={onOpen} />
        {panels.grid ? <Tile tile={panels.grid} onOpen={onOpen} /> : null}
      </div>
    </div>
  );
}

/** Energy and carbon side by side. The switches that change carbon sit beside them. */
export function FootprintPanels({ panels, onOpen }: { panels: View["panels"]; onOpen: (id: string) => void }) {
  return (
    <>
      {panels.energy ? <Tile tile={panels.energy} onOpen={onOpen} /> : null}
      <Tile tile={panels.carbon} onOpen={onOpen} />
    </>
  );
}
