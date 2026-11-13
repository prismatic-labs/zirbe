import type { View } from "../model/present";

/** Austria and Switzerland with the six sites. Clicking a site picks it. */
export function SiteMap({
  map,
  label,
  onSite,
}: {
  map: View["controls"]["map"];
  label: string;
  onSite: (id: View["controls"]["sites"][number]["id"]) => void;
}) {
  return (
    <svg className="map" viewBox={map.viewBox} role="group" aria-label={label}>
      {map.paths.map((shape) => <path key={shape.id} className={shape.kind} d={shape.d} />)}
      {map.labels.map((mark) => (
        <text key={mark.id} className="map-name" x={mark.x} y={mark.y} textAnchor={mark.anchor}>{mark.text}</text>
      ))}
      {map.sites.map((site) => (
        <g
          key={site.id}
          className={site.selected ? "site is-selected" : "site"}
          transform={`translate(${site.x} ${site.y})`}
          role="button"
          tabIndex={site.tabIndex}
          aria-label={site.label}
          aria-pressed={site.selected}
          onClick={() => onSite(site.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSite(site.id);
            }
          }}
        >
          <circle className="hit" r={site.hit} />
          {site.ring ? <path className="ring" d={site.ring} /> : null}
          <path className="dot" d={site.mark} />
          <text className="dot-name" x={site.nameX} y={site.nameY} textAnchor={site.nameAnchor}>{site.name}</text>
        </g>
      ))}
    </svg>
  );
}
