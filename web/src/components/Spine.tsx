import type { View } from "../model/present";
import { t } from "../i18n";
import { SourceLink } from "./InfoDialog";

export function Spine({
  year,
  play,
  onYear,
  onPlay,
  onOpen,
}: {
  year: View["year"];
  play: View["play"];
  onYear: (raw: string) => void;
  onPlay: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="spine">
      <div className="spine-top">
        <SourceLink infoId={year.infoId} name={year.name} onOpen={onOpen}>{year.label}</SourceLink>
        <button type="button" className="play" aria-pressed={play.playing} onClick={onPlay}>{play.label}</button>
        <span className="quiet">{t("spineHint")}</span>
      </div>
      <div className="year-rail">
        <span className="year-marks">
          {year.marks.map((mark) => (
            <span key={mark.id} className={mark.crowd ? `mark is-${mark.place} is-crowd` : `mark is-${mark.place}`} style={{ left: mark.left }}>
              <span className="diamond" aria-hidden="true" />
              {mark.label}
            </span>
          ))}
        </span>
        <input
          id="year-slider"
          type="range"
          min={year.min}
          max={year.max}
          value={year.value}
          aria-label={year.name}
          aria-valuetext={year.label}
          onChange={(event) => onYear(event.target.value)}
        />
      </div>
    </div>
  );
}
