import { useEffect, useState } from "react";
import { HEADING } from "../a11y";
import { loadData } from "../data/load";
import type { Dataset } from "../data/types";
import { t } from "../i18n";
import { compute } from "../model/compute";
import { EARLIER, LATER, levelHash, readLevel, stepLevel } from "../model/level";
import { present } from "../model/present";
import {
  defaultState,
  restartIfEnded,
  stepPlay,
  withArchetype,
  withCurrency,
  withElectricity,
  withHeat,
  withServers,
  withShare,
  withSite,
  withSize,
  withYear,
  yearBounds,
  type ViewState,
} from "../model/state";
import { Controls } from "./Controls";
import { InfoDialog, SourceLink } from "./InfoDialog";
import { FootprintPanels, PeoplePanels } from "./Panels";
import { SiteMap } from "./SiteMap";
import { Spine } from "./Spine";
import { Ladder, Lead, Picture, Years } from "./Stage";
import { useReducedMotion } from "./useReducedMotion";

function Parts({
  parts,
  onOpen,
}: {
  parts: { key: string; text: string; infoId: string | null; name: string | null }[];
  onOpen: (id: string) => void;
}) {
  return parts.map((part) => (
    part.infoId && part.name
      ? <SourceLink key={part.key} infoId={part.infoId} name={part.name} onOpen={onOpen}>{part.text}</SourceLink>
      : <span key={part.key}>{part.text}</span>
  ));
}

export function Screen({ onMethod }: { onMethod: () => void }) {
  const reduced = useReducedMotion();
  const [data, setData] = useState<Dataset | null>(null);
  const [failed, setFailed] = useState(false);
  const [state, setState] = useState<ViewState | null>(null);
  const [playing, setPlaying] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");
  const [level, setLevel] = useState(() => readLevel(window.location.hash));

  useEffect(() => {
    loadData()
      .then((loaded) => {
        setData(loaded);
        setState(defaultState(loaded));
        document.title = loaded.meta.name;
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    // Only level links move the ladder; the skip link and #method leave it where it is.
    const onHash = () => {
      if (!window.location.hash.startsWith("#level-")) return;
      setPlaying(false);
      setLevel(readLevel(window.location.hash));
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // The year belongs to the reader: it opens at the build and, once moved, stays put at every level.
  const goLevel = (next: number) => {
    setPlaying(false);
    setLevel(next);
    // A hosted viewer may refuse history changes; the level still changes, only the link does not.
    try {
      window.history.replaceState(null, "", levelHash(next));
    } catch {
      /* keep going without updating the address */
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (openId) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      if (event.key === "ArrowRight") goLevel(stepLevel(level, LATER));
      if (event.key === "ArrowLeft") goLevel(stepLevel(level, EARLIER));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [level, openId]);

  const view = data && state ? present(data, state, compute(data, state), { playing, reduced, level }) : null;

  const playEveryMs = view?.playEveryMs;
  useEffect(() => {
    if (!playing || !data || playEveryMs === undefined) return;
    const timer = window.setInterval(() => {
      setState((current) => (current ? stepPlay(current, data) : current));
    }, playEveryMs);
    return () => window.clearInterval(timer);
  }, [playing, data, playEveryMs]);

  useEffect(() => {
    if (!playing || !data || !state) return;
    const bounds = yearBounds(data.lifecycle[state.site][state.archetype][state.scenario].spend.construction.length);
    if (state.year >= bounds.max) setPlaying(false);
  }, [playing, data, state]);

  if (failed) return <p className="status">{t("error")}</p>;
  if (!data || !state || !view) return <p className="status">{t("loading")}</p>;

  return (
    <>
      <a className="skip" href="#picture">{t("skip")}</a>
      <main className="screen">
        <header className="top">
          {view.banner ? <p className="banner">{view.banner}</p> : null}
          <div className="identity">
            <p role="heading" aria-level={HEADING.page} className="name">{view.name}</p>
            <p className="tagline">{view.tagline}</p>
            <span className="beta">{t("beta")}</span>
          </div>
          <a className="top-link" href="#method" onClick={(event) => { event.preventDefault(); onMethod(); }}>{view.footer.method}</a>
        </header>
        <section className="headline">
          <div className="headline-text">
            <Controls
              part="sites"
              controls={view.controls}
              onOpen={setOpenId}
              onSite={(id) => {
                setPlaying(false);
                setState(withSite(state, data, id));
              }}
              onArchetype={() => undefined}
              onSize={() => undefined}
              onShare={() => undefined}
              onHeat={() => undefined}
              onElectricity={() => undefined}
              onCurrency={() => undefined}
            />
            <p className="answer" aria-live="polite">
              {view.headlineCents ? (
                <SourceLink className="cents" infoId={view.headlineInfoId} name={view.headline} onOpen={setOpenId}>{view.headlineCents}</SourceLink>
              ) : null}
              {view.headlineRest}
            </p>
            <p className="rest"><Parts parts={view.restParts} onOpen={setOpenId} /></p>
            <div className="rest-bar" aria-hidden="true">
              <span className="home" style={{ width: view.restBar.home }} />
              <span className="abroad" style={{ width: view.restBar.abroad }} />
              <span className="tax" style={{ width: view.restBar.tax }} />
            </div>
            <p className="sub">
              <span><Parts parts={view.bandParts} onOpen={setOpenId} /></span>
              <span>{view.structure}</span>
            </p>
          </div>
        </section>
        <Ladder stage={view.stage} onLevel={goLevel} />
        <section id="picture" className="stage" aria-labelledby="stage-title">
          <div className="stage-head">
            <p id="stage-title" role="heading" aria-level={HEADING.section} className="section-title">{view.stage.title}</p>
          </div>
          <div className={view.stage.showMap ? "stage-intro has-map" : "stage-intro"}>
            <div className="stage-words">
              <Lead stage={view.stage} onOpen={setOpenId} />
              <p className="hint">{view.stage.hint}</p>
            </div>
          {view.stage.showMap ? (
                <SiteMap
                map={view.controls.map}
                label={t("mapPick")}
                onSite={(id) => {
                  setPlaying(false);
                  setState(withSite(state, data, id));
                }}
                />
              ) : null}
          </div>
          {view.stage.summary ? null : <Picture stage={view.stage} onOpen={setOpenId} />}
          {view.stage.showYear ? (
            <Controls
              part="type"
              controls={view.controls}
              onOpen={setOpenId}
              onSite={() => undefined}
              onArchetype={(id) => setState(withArchetype(state, id))}
              onSize={() => undefined}
              onShare={() => undefined}
              onHeat={() => undefined}
              onElectricity={() => undefined}
              onCurrency={() => undefined}
            />
          ) : null}
          <Years stage={view.stage} />
          {view.stage.showYear ? (
            <Spine
              year={view.year}
              play={view.play}
              onOpen={setOpenId}
              onPlay={() => {
                if (playing) {
                  setPlaying(false);
                  return;
                }
                setState((current) => (current ? restartIfEnded(current, data) : current));
                setPlaying(true);
              }}
              onYear={(raw) => {
                setPlaying(false);
                const bounds = yearBounds(data.lifecycle[state.site][state.archetype][state.scenario].spend.construction.length);
                setState(withYear(state, raw, bounds));
              }}
            />
          ) : null}
          {view.stage.showTotals ? (
            <>
              <Controls
                part="size"
                controls={view.controls}
                onOpen={setOpenId}
                onSite={() => undefined}
                onArchetype={() => undefined}
                onSize={(raw) => setState(withSize(state, raw))}
                onShare={() => undefined}
                onHeat={() => undefined}
                onElectricity={() => undefined}
                onCurrency={() => undefined}
              />
              {view.stage.showCase ? (
                <Controls
                  part="case"
                  controls={view.controls}
                  onOpen={setOpenId}
                  onSite={() => undefined}
                  onArchetype={() => undefined}
                  onSize={() => undefined}
                  onShare={(id, raw) => setState(withShare(state, id, raw))}
                  onServers={(id) => setState(withServers(state, id))}
                  onHeat={() => undefined}
                  onElectricity={() => undefined}
                  onCurrency={(id) => setState(withCurrency(state, id))}
                />
              ) : null}
              <PeoplePanels panels={view.panels} onOpen={setOpenId} />
              <div className="footprint">
                <FootprintPanels panels={view.panels} onOpen={setOpenId} />
                <Controls
                  part="carbon"
                  controls={view.controls}
                  onOpen={setOpenId}
                  onSite={() => undefined}
                  onArchetype={() => undefined}
                  onSize={() => undefined}
                  onShare={() => undefined}
                  onHeat={() => setState(withHeat(state, data, !state.heat))}
                  onElectricity={(id) => setState(withElectricity(state, id))}
                  onCurrency={() => undefined}
                />
              </div>
            </>
          ) : null}
          <div className="nav">
            <button type="button" disabled={!view.stage.canBack} onClick={() => goLevel(stepLevel(level, EARLIER))}>{view.stage.back}</button>
            <button type="button" className="primary" disabled={!view.stage.canNext} onClick={() => goLevel(stepLevel(level, LATER))}>{view.stage.next}</button>
            {view.stage.showCase ? (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(view.summary.text).then(() => setCopyState("copied"), () => setCopyState("manual"));
                }}
              >
                {view.summary.label}
              </button>
            ) : null}
            <p className="quiet tap">{view.stage.tap}</p>
          </div>
          {view.stage.showCase && copyState === "copied" ? <p className="quiet" role="status">{view.summary.copied}</p> : null}
          {view.stage.showCase && copyState === "manual" ? (
            <>
              <p className="quiet" role="status">{view.summary.fallback}</p>
              <textarea className="summary-text" readOnly value={view.summary.text} onFocus={(event) => event.target.select()} />
            </>
          ) : null}
        </section>
        <footer>
          <p>{view.footer.credit}</p>
          <a href="#method" onClick={(event) => { event.preventDefault(); onMethod(); }}>{view.footer.method}</a>
        </footer>
      </main>
      {openId ? <button type="button" className="backdrop" aria-label={t("close")} onClick={() => setOpenId(null)} /> : null}
      <InfoDialog explained={openId ? view.explanations[openId] ?? null : null} onClose={() => setOpenId(null)} />
    </>
  );
}
