"""Check 5: the engine's domestic value added share of gross exports against OECD TiVA."""

from __future__ import annotations

import csv
import io
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from engine.icio import Table


def read_tiva(path: Path, cfg: dict[str, Any]) -> dict[tuple[str, int], float]:
    """(economy, year) -> value, for the rows that match cfg['filter']."""
    wanted = cfg["filter"]
    with zipfile.ZipFile(path) as z, z.open(cfg["member"]) as f:
        rows = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
        return {
            (r["REF_AREA"], int(r["TIME_PERIOD"])): float(r["OBS_VALUE"])
            for r in rows
            if all(r[k] == v for k, v in wanted.items()) and r["OBS_VALUE"]
        }


def gross_exports(table: Table, economy: str) -> np.ndarray:
    """Sales of the economy's industries to other economies' industries and final users."""
    rows = table.rows_of(economy)
    uses = len(table.final_uses)
    first = table.economies.index(economy) * uses
    to_industries = table.Z[rows].sum(axis=1) - table.Z[rows, rows].sum(axis=1)
    to_final = table.F[rows].sum(axis=1) - table.F[rows, first : first + uses].sum(axis=1)
    e = np.zeros(table.n)
    e[rows] = to_industries + to_final
    return e


def dva_share_of_exports(table: Table, economy: str) -> float:
    """Domestic value added in gross exports, in percent, defined as TiVA's EXGR_DVA.

    TiVA counts the net product taxes that industries pay at home as domestic
    value added, and it uses the global Leontief inverse, so value added that
    leaves and comes back in imported inputs is included. With both, the engine
    matches TiVA 2025 for Austria and Switzerland to 0.01 points (2016 to 2022).
    The page itself keeps value added and taxes apart.
    """
    e = gross_exports(table, economy)
    x = table.leontief_apply(e)
    rows = table.rows_of(economy)
    return float(100 * (table.v[rows] + table.t[rows]) @ x[rows] / e.sum())


@dataclass(frozen=True)
class TivaResult:
    economy: str
    year: int
    engine: float
    tiva: float
    tolerance: float

    @property
    def gap(self) -> float:
        return self.engine - self.tiva

    @property
    def ok(self) -> bool:
        return abs(self.gap) <= self.tolerance


def fingerprint_errors(where: str, fp: dict[str, Any], tol: dict[str, float]) -> list[str]:
    """Checks 1 to 3 for one fingerprint, on the numbers as written."""
    errors = []
    total = sum(fp["va"].values()) + fp["tax"]
    if abs(total - 1) > tol["va_plus_tax"]:
        errors.append(f"{where}: value added plus taxes is {total:.4f}, not 1 (check 1)")
    tiers = fp["tiers"]
    for group in set(fp["va"]) | {g for tier in tiers for g in tier["va"]}:
        summed = sum(tier["va"].get(group, 0.0) for tier in tiers)
        if abs(summed - fp["va"].get(group, 0.0)) > tol["tiers"]:
            errors.append(f"{where}: tiers of {group} value added do not add up (check 2)")
    if abs(sum(tier["tax"] for tier in tiers) - fp["tax"]) > tol["tiers"]:
        errors.append(f"{where}: tiers of taxes do not add up (check 2)")
    with_output = [tier for tier in tiers if "output" in tier]
    for this, nxt in zip(with_output, with_output[1:]):
        sold: dict[str, float] = {}
        for row in this["purchases"].values():
            for seller, v in row.items():
                sold[seller] = sold.get(seller, 0.0) + v
        for seller in set(sold) | set(nxt["output"]):
            if abs(sold.get(seller, 0.0) - nxt["output"].get(seller, 0.0)) > tol["flows"]:
                errors.append(f"{where}: tier {nxt['tier']} output of {seller} differs from tier {this['tier']} purchases (check 3)")
    return errors


def employment_errors(totals: dict[str, float], reference: dict[str, float], tolerance_share: float) -> list[str]:
    """TiM's total employment against Eurostat's, per economy."""
    return [
        f"employment of {e}: TiM {totals[e]:,.0f} against Eurostat {reference[e]:,.0f}"
        for e in sorted(totals)
        if abs(totals[e] - reference[e]) > tolerance_share * reference[e]
    ]


def tiva_check(table: Table, economies: list[str], tiva: dict[tuple[str, int], float], tolerance: float) -> list[TivaResult]:
    results = []
    for economy in economies:
        key = (economy, table.year)
        if key not in tiva:
            raise KeyError(f"TiVA has no value for {economy} in {table.year}")
        results.append(TivaResult(economy, table.year, dva_share_of_exports(table, economy), tiva[key], tolerance))
    return results
