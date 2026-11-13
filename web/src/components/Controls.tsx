import type { ViewState } from "../model/state";
import type { View } from "../model/present";
import { SourceLink } from "./InfoDialog";

export function Controls({
  controls,
  onSite,
  onArchetype,
  onSize,
  onShare,
  onHeat,
  onElectricity,
  onCurrency,
  onServers,
  onOpen,
  part,
}: {
  controls: View["controls"];
  onSite: (id: View["controls"]["sites"][number]["id"]) => void;
  onArchetype: (id: ViewState["archetype"]) => void;
  onSize: (raw: string) => void;
  onShare: (id: View["controls"]["sliders"][number]["id"], raw: string) => void;
  onHeat: () => void;
  onElectricity: (id: ViewState["electricityView"]) => void;
  onCurrency: (id: ViewState["currency"]) => void;
  onServers?: (id: ViewState["servers"]) => void;
  onOpen: (id: string) => void;
  part: "sites" | "type" | "size" | "carbon" | "case";
}) {
  if (part === "sites") return (
    <div className="picks setup">
      <span>{controls.setupLead}</span>
      <select
        aria-label={controls.siteLabel}
        value={controls.sites.find((site) => site.selected)?.id}
        onChange={(event) => onSite(event.target.value as View["controls"]["sites"][number]["id"])}
      >
        {controls.sites.map((site) => (
          <option key={site.id} value={site.id}>{site.label}</option>
        ))}
      </select>
      <span>{controls.setupTail}</span>
    </div>
  );
  if (part === "type") return (
    <div className="picks">
      <span>{controls.typeLead}</span>
      <div className="seg-btns" role="group" aria-label={controls.archetypeLabel}>
        {controls.archetypes.map((item) => (
          <button key={item.id} type="button" aria-pressed={item.selected} onClick={() => onArchetype(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <span className="quiet setup-note">{controls.archetypes.find((item) => item.selected)?.note}</span>
    </div>
  );
  if (part === "size") return (
    <div className="size">
      <p className="size-line">
        <span>{controls.size.lead}</span>
        <input
          id="size-input"
          type="number"
          min={controls.size.min}
          step={controls.size.step}
          value={controls.size.value}
          aria-label={controls.size.label}
          onChange={(event) => onSize(event.target.value)}
        />
        <span>{controls.size.unit}</span>
      </p>
      <p className="quiet">{controls.size.note}</p>
    </div>
  );
  if (part === "carbon") return (
    <div className="controls carbon-controls">
      <div className="heat-row">
        <SourceLink infoId={controls.heat.infoId} name={controls.heat.label} onOpen={onOpen}>{controls.heat.label}</SourceLink>
        <button type="button" aria-pressed={controls.heat.on} disabled={!controls.heat.enabled} onClick={onHeat}>
          {controls.heat.on ? controls.heat.onLabel : controls.heat.offLabel}
        </button>
      </div>
      {controls.heat.reason ? <p className="quiet">{controls.heat.reason}</p> : null}
      {controls.heat.note ? <p className="quiet">{controls.heat.note}</p> : null}
      <div>
        <p className="control-label">{controls.electricity.label}</p>
        <div className="switch-row" role="group" aria-label={controls.electricity.label}>
          {controls.electricity.options.map((option) => (
            <button key={option.id} type="button" aria-pressed={option.selected} onClick={() => onElectricity(option.id)}>
              <span>{option.label}</span>
              <small>{option.note}</small>
            </button>
          ))}
        </div>
        <p className="quiet">{controls.electricity.note}</p>
      </div>
    </div>
  );
  return (
    <div className="controls case-controls">
      <div>
        <p className="control-label">{controls.sourcing}</p>
        <p className="quiet">{controls.sourcingNote}</p>
      </div>
      <div className="sliders">
        {controls.sliders.map((slider) => (
          <div key={slider.id} className="slider">
            <span>{slider.label}</span>
            <SourceLink infoId={slider.infoId} name={slider.label} onOpen={onOpen}>{slider.display}</SourceLink>
            <span className="slider-rail">
            <span className="slider-mark" style={{ left: slider.mark }} aria-hidden="true" />
            <input
              type="range"
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={slider.value}
              aria-label={slider.label}
              aria-valuetext={slider.display}
              onChange={(event) => onShare(slider.id, event.target.value)}
            />
            </span>
          </div>
        ))}
      </div>
      <div className="picks servers">
        <span>{controls.servers.lead}</span>
        <div className="seg-btns" role="group" aria-label={controls.servers.label}>
          {controls.servers.options.map((option) => (
            <button key={option.id} type="button" aria-pressed={option.selected} onClick={() => onServers?.(option.id)}>
              {option.label}
            </button>
          ))}
        </div>
        <span className="quiet setup-note">{controls.servers.note}</span>
      </div>
      <div className="currency">
        <div className="seg-btns" role="group" aria-label={controls.currency.note}>
          {controls.currency.options.map((option) => (
            <button key={option.id} type="button" aria-pressed={option.selected} onClick={() => onCurrency(option.id)}>
              {option.label}
            </button>
          ))}
        </div>
        <p className="quiet">{controls.currency.note}</p>
      </div>
    </div>
  );
}
