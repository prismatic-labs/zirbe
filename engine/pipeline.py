"""Load the raw files once and run the model steps the commands share."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from engine import (
    assumptions, checks, eurostat, fingerprints, icio, lifecycle, mappings, meta, prices, satellites, schemas, shares, trade,
)
from engine import download as dl


@dataclass
class Inputs:
    m: dict[str, Any]
    sources: dict[str, Any]
    table: icio.Table
    demands: list[shares.CategoryDemand]

    def source(self, source_id: str) -> dict[str, Any]:
        return next(s for s in self.sources["sources"] if s["id"] == source_id)

    def raw(self, source_id: str) -> Path:
        return dl.raw_file(source_id, self.sources)

    def json(self, source_id: str) -> Any:
        return json.loads(self.raw(source_id).read_text(encoding="utf-8"))


class InputError(ValueError):
    """The mappings, assumptions or raw files do not fit together."""


def load_inputs() -> Inputs:
    m = mappings.load_mappings()
    errors = mappings.mapping_errors(m)
    if errors:
        raise InputError("; ".join(errors))
    sources = dl.load_sources()
    table = icio.read_table(dl.raw_file(m["table"]["source_id"], sources), m["table"])
    errors = mappings.table_errors(m, table)
    if errors:
        raise InputError("; ".join(errors))
    inp = Inputs(m, sources, table, [])
    cfg = m["trade"]
    flows = trade.read_baci(inp.raw(cfg["source_id"]), cfg, table.year, cfg["importers"].values())
    overrides = shares.build_overrides(table, m, assumptions.by_id(assumptions.load_assumptions()), flows)
    inp.demands = shares.all_demands(table, m, overrides)
    return inp


def tiva_results(inp: Inputs) -> list[checks.TivaResult]:
    cfg = inp.m["checks"]["tiva"]
    tiva = checks.read_tiva(inp.raw(cfg["source_id"]), cfg)
    return checks.tiva_check(inp.table, list(inp.m["purchasers"].values()), tiva, cfg["tolerance_pp"])


def employment(inp: Inputs) -> tuple[Any, list[str]]:
    """Persons by row for the purchasers, and TiM's totals checked against Eurostat."""
    cfg = inp.m["satellites"]["employment"]
    values = satellites.read_series(inp.raw(cfg["source_id"]), inp.table.year)
    economies = list(inp.m["purchasers"].values())
    persons = satellites.employment_persons(inp.table, values, economies, cfg)
    check = inp.m["checks"]["employment"]
    reference_doc = inp.json(check["source_id"])
    geo = {inp.m["purchasers"][p]: v["geo"] for p, v in inp.m["prices"]["purchasers"].items()}
    totals = {e: values[(e, cfg["total_code"])] * cfg["unit"] for e in economies}
    reference = {
        e: eurostat.value(reference_doc, geo=geo[e], time=str(inp.table.year), **check["select"]) * check["unit"]
        for e in economies
    }
    return persons, checks.employment_errors(totals, reference, check["tolerance_share"])


def build_fingerprints(inp: Inputs) -> tuple[dict[str, Any], list[str]]:
    """The fingerprints document and every check problem found in it."""
    m, table = inp.m, inp.table
    ecfg = m["satellites"]["emissions"]
    co2e = satellites.emissions_kg(table, satellites.read_series(inp.raw(ecfg["source_id"]), table.year), ecfg)
    persons, errors = employment(inp)
    usd_per_eur = prices.table_usd_per_eur(
        m, inp.json(m["prices"]["fx"]["source_id"]), inp.json(m["prices"]["deflator"]["source_id"]), table.year
    )
    ctx = fingerprints.make_context(table, m, co2e, persons)
    doc = fingerprints.build(ctx, m, inp.demands, usd_per_eur, fingerprints.source_ids(m, inp.demands))
    tol = m["checks"]["fingerprints"]
    for purchaser, categories in doc.items():
        for category, c in categories.items():
            for origin in ("domestic", "imported"):
                errors += checks.fingerprint_errors(f"{purchaser} {category} {origin}", c[origin], tol)
    errors += schemas.contract_errors("fingerprints", doc)
    return doc, errors


def build_outputs(inp: Inputs) -> tuple[dict[str, Any], list[str]]:
    """All four output documents, keyed by schema name, and every problem found in them."""
    m = inp.m
    fp_doc, errors = build_fingerprints(inp)
    assumption_doc = assumptions.load_assumptions()
    by_id = assumptions.by_id(assumption_doc)
    life = lifecycle.build(m, by_id, lifecycle.va_home_per_euro(fp_doc, m))
    meta_doc = meta.build(m, inp.sources, dl.read_manifest(dl.RAW_DIR), inp.table.year, inp.json(m["prices"]["fx"]["source_id"]))
    docs = {"meta": meta_doc, "fingerprints": fp_doc, "lifecycle": life, "assumptions": assumption_doc}
    errors += [e for e in schemas.validate_docs(docs) if e not in errors]
    return docs, errors


def write_json(path: Path, doc: Any) -> None:
    """Compact, key order as built, so the same inputs give the same bytes."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
