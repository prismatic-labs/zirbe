"""Import origins from CEPII BACI (UN Comtrade, reconciled), mapped onto the table's economies."""

from __future__ import annotations

import fnmatch
import zipfile
from collections import defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd


@dataclass(frozen=True)
class Flows:
    year: int
    values: dict[tuple[int, int], float]  # (importer code, exporter code) -> value, summed over the products
    iso3: dict[int, str]                  # BACI country code -> ISO alpha-3, or Comtrade's own code (S19)


def _member(z: zipfile.ZipFile, pattern: str) -> str:
    found = fnmatch.filter(z.namelist(), pattern)
    if len(found) != 1:
        raise ValueError(f"expected one file like {pattern}, found {found}")
    return found[0]


def read_baci(path: Path, cfg: dict[str, Any], year: int, importers: Iterable[int]) -> Flows:
    """The year's imports of cfg['products'] by the given importers, by exporter."""
    importers = set(importers)
    products = set(cfg["products"])
    sums: dict[tuple[int, int], float] = defaultdict(float)
    with zipfile.ZipFile(path) as z:
        with z.open(_member(z, cfg["member"].format(year=year))) as f:
            chunks = pd.read_csv(f, usecols=["i", "j", "k", "v"], dtype={"i": "int32", "j": "int32", "k": "int32", "v": "float64"},
                                 chunksize=cfg["read_chunk_rows"])
            for chunk in chunks:
                keep = chunk[chunk["j"].isin(importers) & chunk["k"].isin(products)]
                for (j, i), v in keep.groupby(["j", "i"])["v"].sum().items():
                    sums[(int(j), int(i))] += float(v)
        with z.open(_member(z, cfg["country_codes"])) as f:
            codes = pd.read_csv(f, dtype=str, keep_default_na=False)
    iso3 = {int(c): iso for c, iso in zip(codes["country_code"], codes["country_iso3"])}
    return Flows(year, dict(sorted(sums.items())), iso3)


def import_origins(flows: Flows, importer: int, own_economy: str, economies: Sequence[str], partners_cfg: dict[str, Any]) -> dict[str, float]:
    """Share of the importer's imports by table economy. Imports from itself are
    left out; exporters the table does not have go to its rest-of-world economy."""
    aliases = partners_cfg["aliases"]
    totals: dict[str, float] = defaultdict(float)
    for (j, i), v in flows.values.items():
        if j != importer:
            continue
        code = flows.iso3.get(i, "")
        code = aliases.get(code, code)
        economy = code if code in economies else partners_cfg["fallback_economy"]
        if economy != own_economy:
            totals[economy] += v
    total = sum(totals.values())
    if total <= 0:
        raise ValueError(f"no imports for importer {importer} in the trade data")
    return {e: totals[e] / total for e in sorted(totals)}


def import_total(flows: Flows, importer: int) -> float:
    """The importer's imports from every exporter, in the data's own unit."""
    return sum(v for (j, _), v in flows.values.items() if j == importer)
