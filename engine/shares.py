"""Step 3: what each purchaser buys for each spend category, and where it comes from.

For a capital category the demand vector y is the purchaser's gross fixed
capital formation of the category's products; for an operating category it is
the intermediate purchases of the purchaser's IT services industry.
The default domestic share s is the domestic part of that same y.

A category can override both: its domestic share then comes from an
assumption and its import origins from trade data (it_hardware, whose table
product C26 also holds instruments and watches).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np

from engine import trade
from engine.icio import Table
from engine.mappings import contract_enum, group_of


@dataclass(frozen=True)
class CategoryDemand:
    purchaser: str
    category: str
    economy: str
    y: np.ndarray     # purchases by seller row, not yet scaled to one unit
    basis: str        # where y comes from: the table column, or "trade"
    base_usd_m: float  # what the shares were measured on, USD million
    share_range: tuple[float, float] | None = None  # low and high domestic share, if an assumption gives them

    @property
    def total(self) -> float:
        return float(self.y.sum())

    def domestic_share_range(self, table: Table) -> tuple[float, float]:
        """Low and high domestic share: the assumption's, or the default when the share comes from the table."""
        if self.share_range is not None:
            return self.share_range
        s = self.domestic_share(table)
        return s, s

    @property
    def from_table(self) -> bool:
        return self.basis != "trade"

    def domestic_share(self, table: Table) -> float:
        return float(self.y[table.rows_of(self.economy)].sum() / self.y.sum())

    def by_group(self, table: Table, m: dict[str, Any]) -> dict[str, float]:
        """Share of all purchases by the seller's country group, in contract order."""
        groups = {g: 0.0 for g in contract_enum("CountryGroup")}
        sellers = table.economy_of_row()
        for economy in table.economies:
            groups[group_of(m, economy)] += float(self.y[sellers == economy].sum())
        return {g: v / self.total for g, v in groups.items()}

    def import_mix(self, table: Table, m: dict[str, Any]) -> dict[str, float]:
        """Share of imported purchases by country group; the purchaser's own group is left out."""
        shares = self.by_group(table, m)
        domestic = shares.pop(self.purchaser)
        return {g: v / (1 - domestic) for g, v in shares.items()} if domestic < 1 else {g: 0.0 for g in shares}

    def by_product(self, table: Table) -> dict[str, float]:
        products = table.industry_of_row()
        used = [p for p in table.industries if self.y[products == p].any()]
        return {p: float(self.y[products == p].sum()) / self.total for p in used}


def demand_column(table: Table, m: dict[str, Any], economy: str, phase: str) -> np.ndarray:
    spec = m["demand"][phase]
    if spec["kind"] == "final_use":
        return table.F[:, table.final_use_col(economy, spec["code"])]
    if spec["kind"] == "industry":
        return table.Z[:, table.row(economy, spec["code"])]
    raise ValueError(f"unknown demand kind {spec['kind']!r}")


@dataclass(frozen=True)
class Override:
    """A domestic share and import origins that replace the table's for one purchaser and category."""
    domestic_share: float
    origins: dict[str, float]  # table economy -> share of imports
    base_usd_m: float
    share_range: tuple[float, float] | None = None


def build_overrides(
    table: Table,
    m: dict[str, Any],
    assumptions: dict[str, dict[str, Any]],
    flows: trade.Flows,
) -> dict[tuple[str, str], Override]:
    """Overrides for every category that names a domestic share assumption and trade data."""
    cfg = m["trade"]
    if flows.year != table.year:
        raise ValueError(f"trade data is for {flows.year}, but the table year is {table.year}")
    overrides = {}
    for purchaser, economy in m["purchasers"].items():
        for category, cat in m["categories"].items():
            if "domestic_share" not in cat:
                continue
            if cat["import_origins"]["source_id"] != cfg["source_id"]:
                raise ValueError(f"{category}: import origins need {cat['import_origins']['source_id']}")
            importer = cfg["importers"][economy]
            a = assumptions[f"{cat['domestic_share']['assumption']}.{purchaser.lower()}"]
            overrides[(purchaser, category)] = Override(
                domestic_share=a["central"],
                origins=trade.import_origins(flows, importer, economy, table.economies, cfg["partners"]),
                base_usd_m=trade.import_total(flows, importer) * cfg["value_unit"] / m["units"]["table_currency"],
                share_range=(a["low"], a["high"]),
            )
    return overrides


def category_demand(
    table: Table,
    m: dict[str, Any],
    purchaser: str,
    category: str,
    overrides: dict[tuple[str, str], Override] | None = None,
) -> CategoryDemand:
    cat = m["categories"][category]
    economy = m["purchasers"][purchaser]
    if "domestic_share" in cat:
        if not overrides or (purchaser, category) not in overrides:
            raise ValueError(f"{purchaser} {category} needs its domestic share assumption and trade data")
        o = overrides[(purchaser, category)]
        (product,) = cat["products"]
        y = np.zeros(table.n)
        y[table.row(economy, product)] = o.domestic_share
        for origin, share in o.origins.items():
            y[table.row(origin, product)] += (1 - o.domestic_share) * share
        return CategoryDemand(purchaser, category, economy, y, "trade", o.base_usd_m, o.share_range)
    column = demand_column(table, m, economy, cat["phase"])
    y = np.where(np.isin(table.industry_of_row(), cat["products"]), column, 0.0)
    if (y < 0).any():
        raise ValueError(f"{purchaser} {category}: the table has negative purchases")
    if y.sum() <= 0:
        raise ValueError(f"{purchaser} buys none of {cat['products']} for {category} in the table")
    return CategoryDemand(purchaser, category, economy, y, m["demand"][cat["phase"]]["code"], float(y.sum()))


def report_lines(table: Table, m: dict[str, Any], demands: list[CategoryDemand], top: int) -> list[str]:
    """A plain table for review: domestic share, base, product mix and the largest import origins."""
    lines = [f"{'buyer':5} {'category':13} {'source':7} {'base USD m':>11} {'domestic':>8}  products / largest import origins (share of imports)"]
    for d in demands:
        products = " ".join(f"{p} {v:.0%}" for p, v in d.by_product(table).items())
        origins = sorted(d.import_mix(table, m).items(), key=lambda kv: -kv[1])[:top]
        imports = " ".join(f"{g} {v:.0%}" for g, v in origins)
        lines.append(f"{d.purchaser:5} {d.category:13} {d.basis:7} {d.base_usd_m:11,.0f} {d.domestic_share(table):8.1%}  {products} | {imports}")
    if any(not d.from_table for d in demands):
        lines.append("trade: domestic share from assumptions.yaml (central), import origins from CEPII BACI; base = imports")
    return lines


def all_demands(
    table: Table, m: dict[str, Any], overrides: dict[tuple[str, str], Override] | None = None
) -> list[CategoryDemand]:
    """Every purchaser and category that has products (all but staff), in contract order."""
    return [
        category_demand(table, m, purchaser, category, overrides)
        for purchaser in contract_enum("Purchaser")
        for category, cat in m["categories"].items()
        if cat["products"]
    ]
