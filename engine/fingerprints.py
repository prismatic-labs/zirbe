"""The fingerprint of each purchaser, category and origin: the estimated journey of one euro.

For demand y (one unit), the output at tier n is x_n = A^n y. At each tier
v * x_n lands as value added, t * x_n goes to net product taxes and A x_n
moves on as purchases. Tiers 0 to 3 are kept one by one; tier 4+ is the
total v * (L y) minus tiers 0 to 3.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import numpy as np

from engine.icio import Table
from engine.mappings import contract_enum, group_of
from engine.satellites import per_output
from engine.shares import CategoryDemand


@dataclass(frozen=True)
class Context:
    """Everything a fingerprint needs besides its demand vector."""
    table: Table
    groups: list[str]               # country groups, contract order
    group_of_row: np.ndarray        # index into groups, per row
    industry_groups: list[str]      # contract order
    industry_group_of_row: np.ndarray  # index into industry_groups, per row
    co2e_kg_per_unit: np.ndarray    # kg CO2e per table unit of output, per row
    jobs_per_unit: np.ndarray       # persons per table unit of output, per row (purchasers only)
    decimals: int

    def by_group(self, values: np.ndarray) -> np.ndarray:
        return np.bincount(self.group_of_row, weights=values, minlength=len(self.groups))


def make_context(table: Table, m: dict[str, Any], co2e_kg: np.ndarray, persons: np.ndarray) -> Context:
    groups = contract_enum("CountryGroup")
    index = {g: k for k, g in enumerate(groups)}
    group_of_row = np.array([index[group_of(m, e)] for e in table.economy_of_row()])
    industry_groups = contract_enum("IndustryGroupId")
    listed = {ind: g for g, inds in m["industry_groups"].items() for ind in inds}
    other = industry_groups.index("other")
    ind_index = np.array([industry_groups.index(listed[i]) if i in listed else other for i in table.industry_of_row()])
    return Context(table, groups, group_of_row, industry_groups, ind_index,
                   per_output(table, co2e_kg), per_output(table, persons), m["output"]["decimals"])


def _clean(ctx: Context, values: np.ndarray, keep_zero: bool = False, names: list[str] | None = None) -> dict[str, float]:
    names = names or ctx.groups
    out = {}
    for name, v in zip(names, values):
        r = round(float(v), ctx.decimals) + 0.0  # + 0.0 turns -0.0 into 0.0
        if r != 0.0 or keep_zero:
            out[name] = r
    return out


def tier_entries(ctx: Context, y: np.ndarray, total: np.ndarray) -> list[dict[str, Any]]:
    t = ctx.table
    tiers, x = [], y
    kept_va = np.zeros(len(ctx.groups))
    kept_tax = 0.0
    *kept, rest = contract_enum("TierId")
    for tier_id in kept:
        va = ctx.by_group(t.v * x)
        tax = float(t.t @ x)
        purchases = {}
        for b, buyer in enumerate(ctx.groups):
            cols = ctx.group_of_row == b
            if not x[cols].any():
                continue
            sold = ctx.by_group(t.A[:, cols] @ x[cols])
            cleaned = _clean(ctx, sold)
            if cleaned:
                purchases[buyer] = cleaned
        tiers.append({
            "tier": tier_id,
            "output": _clean(ctx, ctx.by_group(x)),
            "va": _clean(ctx, va),
            "tax": round(tax, ctx.decimals) + 0.0,
            "purchases": purchases,
        })
        kept_va += va
        kept_tax += tax
        x = t.A @ x
    later_va = ctx.by_group(t.v * total) - kept_va
    later_tax = float(t.t @ total) - kept_tax
    tiers.append({"tier": rest, "va": _clean(ctx, later_va), "tax": round(later_tax, ctx.decimals) + 0.0})
    return tiers


def fingerprint(ctx: Context, y: np.ndarray, total: np.ndarray, purchaser_economy: str,
                usd_per_eur: float, units: dict[str, float], embodied_carbon: bool) -> dict[str, Any]:
    """Per one EUR of the price year. y is one table unit of demand; total is L y."""
    t = ctx.table
    home = t.rows_of(purchaser_economy)
    va_home = np.zeros(t.n)
    va_home[home] = (t.v * total)[home]
    by_industry = np.bincount(ctx.industry_group_of_row, weights=va_home, minlength=len(ctx.industry_groups))
    # kg per table unit of spend -> kg per EUR: one EUR is usd_per_eur table dollars.
    co2e = ctx.by_group(ctx.co2e_kg_per_unit * total) * usd_per_eur / units["table_currency"]
    jobs = float(ctx.jobs_per_unit[home] @ total[home]) * usd_per_eur * units["jobs_per"] / units["table_currency"]
    return {
        "tiers": tier_entries(ctx, y, total),
        "va": _clean(ctx, ctx.by_group(t.v * total)),
        "tax": round(float(t.t @ total), ctx.decimals) + 0.0,
        "va_domestic_by_industry": _clean(ctx, by_industry, keep_zero=True, names=ctx.industry_groups),
        "co2e_kg": _clean(ctx, co2e) if embodied_carbon else {},
        "jobs_domestic_per_meur": round(jobs, ctx.decimals) + 0.0,
    }


def split(table: Table, d: CategoryDemand) -> tuple[np.ndarray, np.ndarray]:
    """The domestic and imported parts of a demand vector, each scaled to one unit."""
    home = np.zeros(table.n, dtype=bool)
    home[table.rows_of(d.economy)] = True
    domestic, imported = np.where(home, d.y, 0.0), np.where(home, 0.0, d.y)
    if domestic.sum() <= 0 or imported.sum() <= 0:
        raise ValueError(f"{d.purchaser} {d.category}: needs both domestic and imported purchases")
    return domestic / domestic.sum(), imported / imported.sum()


def source_ids(m: dict[str, Any], demands: list[CategoryDemand]) -> dict[tuple[str, str], list[str]]:
    """The datasets and assumptions each category's fingerprints rest on."""
    out = {}
    for d in demands:
        cat = m["categories"][d.category]
        ids = [m["table"]["source_id"]]
        if cat.get("embodied_carbon", True):
            ids.append(m["satellites"]["emissions"]["source_id"])
        ids += [m["satellites"]["employment"]["source_id"], m["prices"]["fx"]["source_id"], m["prices"]["deflator"]["source_id"]]
        if "import_origins" in cat:
            ids += [cat["import_origins"]["source_id"], f"{cat['domestic_share']['assumption']}.{d.purchaser.lower()}"]
        out[(d.purchaser, d.category)] = ids
    return out


def blended(c: dict[str, Any], value: Callable[[dict[str, Any]], float]) -> float:
    """A fingerprint value at the default domestic share: s * domestic + (1 - s) * imported."""
    s = c["default_domestic_share"]
    return s * value(c["domestic"]) + (1 - s) * value(c["imported"])


def summary_lines(doc: dict[str, Any]) -> list[str]:
    """Per purchaser and category, at the default domestic share: value added at
    home per euro (and for each origin), net taxes, kg CO2e per euro, jobs per million euro."""
    lines = [f"{'buyer':5} {'category':13} {'domestic':>8} {'VA home':>7} {'(dom':>5} {'imp)':>5} {'taxes':>6} {'kg CO2e':>7} {'jobs/MEUR':>9}"]
    for purchaser, categories in doc.items():
        def home(fp: dict[str, Any]) -> float:
            return fp["va"].get(purchaser, 0.0)

        for category, c in categories.items():
            lines.append(
                f"{purchaser:5} {category:13} {c['default_domestic_share']:8.1%} {blended(c, home):7.3f} "
                f"{home(c['domestic']):5.2f} {home(c['imported']):5.2f} {blended(c, lambda fp: fp['tax']):6.3f} "
                f"{blended(c, lambda fp: sum(fp['co2e_kg'].values())):7.3f} "
                f"{blended(c, lambda fp: fp['jobs_domestic_per_meur']):9.2f}"
            )
    return lines


def build(ctx: Context, m: dict[str, Any], demands: list[CategoryDemand], usd_per_eur: dict[str, float],
          source_ids: dict[tuple[str, str], list[str]]) -> dict[str, Any]:
    """The Fingerprints document: purchaser -> category -> CategoryFingerprints."""
    t = ctx.table
    parts = [split(t, d) for d in demands]
    Y = np.column_stack([v for pair in parts for v in pair])
    totals = t.leontief_apply(Y)
    doc: dict[str, Any] = {}
    for k, d in enumerate(demands):
        cat = m["categories"][d.category]
        carbon = cat.get("embodied_carbon", True)
        fps = [
            fingerprint(ctx, parts[k][j], totals[:, 2 * k + j], d.economy, usd_per_eur[d.purchaser], m["units"], carbon)
            for j in (0, 1)
        ]
        doc.setdefault(d.purchaser, {})[d.category] = {
            "default_domestic_share": round(d.domestic_share(t), ctx.decimals) + 0.0,
            "domestic_share_low": round(d.domestic_share_range(t)[0], ctx.decimals) + 0.0,
            "domestic_share_high": round(d.domestic_share_range(t)[1], ctx.decimals) + 0.0,
            "domestic": fps[0],
            "imported": fps[1],
            "source_ids": source_ids[(d.purchaser, d.category)],
        }
    return doc
