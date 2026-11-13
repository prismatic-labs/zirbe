"""Emissions and employment by table row, from OECD series downloaded through DBnomics."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np

from engine.icio import Table


def read_series(path: Path, year: int) -> dict[tuple[str, str], float]:
    """(REF_AREA, ACTIVITY) -> value in the given year, for series that have one."""
    doc = json.loads(path.read_text(encoding="utf-8"))
    out: dict[tuple[str, str], float] = {}
    for s in doc["series"]:
        values = dict(zip(s["period"], s["value"]))
        v = values.get(str(year))
        if v is not None and v != "NA":
            d = s["dimensions"]
            out[(d["REF_AREA"], d["ACTIVITY"])] = float(v)
    return out


def _by_row(table: Table, values: dict[tuple[str, str], float], economies: list[str], cfg: dict[str, Any]) -> np.ndarray:
    aliases = cfg.get("aliases", {})
    rows = np.zeros(table.n)
    missing = []
    for economy in economies:
        for k, industry in enumerate(table.industries):
            i = table.row(economy, industry)
            v = values.get((economy, aliases.get(industry, industry)))
            if v is None:
                if table.output[i] > 0:
                    missing.append(f"{economy}_{industry}")
                continue
            rows[i] = v * cfg["unit"]
    if missing:
        raise ValueError(f"{cfg['source_id']}: no value for {len(missing)} industries with output, e.g. {missing[:5]}")
    return rows


def emissions_kg(table: Table, values: dict[tuple[str, str], float], cfg: dict[str, Any]) -> np.ndarray:
    """kg CO2e emitted by each table row. The rest of the world is the world total
    minus every other economy, industry by industry."""
    rest = cfg["rest_of_world"]
    named = [e for e in table.economies if e != rest["economy"]]
    rows = _by_row(table, values, named, cfg)
    aliases = cfg.get("aliases", {})
    for industry in table.industries:
        world = values.get((rest["from"], aliases.get(industry, industry)))
        if world is None:
            raise ValueError(f"{cfg['source_id']}: no world total for {industry}")
        others = sum(rows[table.row(e, industry)] for e in named)
        remainder = world * cfg["unit"] - others
        if remainder < -rest["tolerance_share"] * world * cfg["unit"]:
            raise ValueError(f"{cfg['source_id']}: the economies add up to more than the world for {industry}")
        rows[table.row(rest["economy"], industry)] = max(remainder, 0.0)
    return rows


def employment_persons(table: Table, values: dict[tuple[str, str], float], economies: list[str], cfg: dict[str, Any]) -> np.ndarray:
    """Persons employed in each row of the given economies; zero elsewhere."""
    return _by_row(table, values, economies, cfg)


def per_output(table: Table, rows: np.ndarray) -> np.ndarray:
    """Per USD million of output; zero where output is zero."""
    out = np.zeros(table.n)
    np.divide(rows, table.output, out=out, where=table.output > 0)
    return out
