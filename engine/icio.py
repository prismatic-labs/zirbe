"""Read one year of the OECD ICIO table from its zip and derive the model's coefficients.

The CSV is a square block of intermediate use (seller rows, buyer columns, both
labelled ECONOMY_INDUSTRY), then final use columns (ECONOMY_USE) and an output
column, then three rows: net product taxes, value added and output. Values are
USD million at basic prices.
"""

from __future__ import annotations

import re
import zipfile
from dataclasses import dataclass
from functools import cached_property
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


class TableError(ValueError):
    """The table file does not have the layout or balance the engine expects."""


@dataclass(frozen=True)
class Table:
    year: int
    economies: tuple[str, ...]
    industries: tuple[str, ...]
    final_uses: tuple[str, ...]
    Z: np.ndarray            # intermediate use, n x n
    F: np.ndarray            # final use, n x (economies x final uses)
    taxes: np.ndarray        # net product taxes paid by each buyer column, n
    value_added: np.ndarray  # n
    output: np.ndarray       # n, from the output row

    @property
    def n(self) -> int:
        return len(self.economies) * len(self.industries)

    def row(self, economy: str, industry: str) -> int:
        return self.economies.index(economy) * len(self.industries) + self.industries.index(industry)

    def rows_of(self, economy: str) -> slice:
        start = self.economies.index(economy) * len(self.industries)
        return slice(start, start + len(self.industries))

    def economy_of_row(self) -> np.ndarray:
        return np.repeat(np.array(self.economies), len(self.industries))

    def industry_of_row(self) -> np.ndarray:
        return np.tile(np.array(self.industries), len(self.economies))

    def final_use_col(self, economy: str, use: str) -> int:
        return self.economies.index(economy) * len(self.final_uses) + self.final_uses.index(use)

    def _per_output(self, values: np.ndarray) -> np.ndarray:
        out = np.zeros_like(values, dtype=float)
        np.divide(values, self.output, out=out, where=self.output != 0)
        return out

    @cached_property
    def A(self) -> np.ndarray:
        """Technical coefficients: purchases per unit of the buyer's output."""
        return self._per_output(self.Z)

    @cached_property
    def v(self) -> np.ndarray:
        """Value added per unit of output."""
        return self._per_output(self.value_added)

    @cached_property
    def t(self) -> np.ndarray:
        """Net product taxes per unit of output."""
        return self._per_output(self.taxes)

    def leontief_apply(self, y: np.ndarray) -> np.ndarray:
        """L y, the total output that demand y requires, without forming L."""
        return np.linalg.solve(np.eye(self.n) - self.A, y)


def split_label(label: str) -> tuple[str, str]:
    economy, sep, code = label.partition("_")
    if not sep or not economy or not code:
        raise TableError(f"label {label!r} is not ECONOMY_CODE")
    return economy, code


def years_in_zip(path: Path, member: str) -> list[int]:
    pattern = re.compile(re.escape(member).replace(re.escape("{year}"), r"(\d{4})"))
    with zipfile.ZipFile(path) as z:
        return sorted(int(m.group(1)) for name in z.namelist() if (m := pattern.fullmatch(name)))


def read_frame(path: Path, member: str) -> pd.DataFrame:
    with zipfile.ZipFile(path) as z, z.open(member) as f:
        return pd.read_csv(f, index_col=0, engine="c")


def parse(frame: pd.DataFrame, cfg: dict[str, Any], year: int) -> Table:
    """Turn the table's frame into arrays, checking every label is where it should be."""
    tail = cfg["tail_rows"]
    tail_labels = [tail["taxes"], tail["value_added"], tail["output"]]
    rows = [str(r) for r in frame.index]
    if rows[-3:] != tail_labels:
        raise TableError(f"last rows are {rows[-3:]}, expected {tail_labels}")
    body = rows[:-3]
    economies = tuple(dict.fromkeys(split_label(r)[0] for r in body))
    industries = tuple(split_label(r)[1] for r in body if split_label(r)[0] == economies[0])
    expected = [f"{e}_{i}" for e in economies for i in industries]
    if body != expected:
        raise TableError("seller rows are not every economy x the same industries, in order")
    uses = tuple(cfg["final_uses"])
    fd_cols = [f"{e}_{u}" for e in economies for u in uses]
    columns = expected + fd_cols + [cfg["output_column"]]
    missing = [c for c in columns if c not in frame.columns]
    extra = [c for c in frame.columns if c not in set(columns)]
    if missing or extra:
        raise TableError(f"columns differ from the layout: missing {missing[:5]}, extra {extra[:5]}")
    try:
        values = frame.loc[:, columns].to_numpy(dtype=float)
    except ValueError as err:
        raise TableError(f"the table has a non-numeric cell: {err}") from err
    n = len(expected)
    if not np.isfinite(values).all():
        raise TableError("the table has empty cells")
    return Table(
        year=year,
        economies=economies,
        industries=industries,
        final_uses=uses,
        Z=np.ascontiguousarray(values[:n, :n]),
        F=np.ascontiguousarray(values[:n, n : n + len(fd_cols)]),
        taxes=values[n, :n].copy(),
        value_added=values[n + 1, :n].copy(),
        output=values[n + 2, :n].copy(),
    )


def balance_errors(table: Table, tolerance: dict[str, float]) -> list[str]:
    """Columns and rows that miss both the absolute and the relative limit."""
    limit = np.maximum(tolerance["usd_million"], tolerance["share_of_output"] * np.abs(table.output))
    by_column = table.Z.sum(axis=0) + table.taxes + table.value_added - table.output
    by_row = table.Z.sum(axis=1) + table.F.sum(axis=1) - table.output
    errors = []
    for name, gap in (("column", by_column), ("row", by_row)):
        excess = np.abs(gap) - limit
        worst = int(np.argmax(excess))
        if excess[worst] > 0:
            econ, ind = table.economy_of_row()[worst], table.industry_of_row()[worst]
            count = int((excess > 0).sum())
            errors.append(f"{count} {name}(s) miss, worst {econ}_{ind} by {gap[worst]:.4f}")
    return errors


def read_table(path: Path, cfg: dict[str, Any], year: int | None = None) -> Table:
    """Read one year (the latest by default) and check that it balances."""
    years = years_in_zip(path, cfg["member"])
    if not years:
        raise TableError(f"no member like {cfg['member']} in {path.name}")
    year = years[-1] if year is None else year
    if year not in years:
        raise TableError(f"{year} is not in {path.name}; it has {years}")
    table = parse(read_frame(path, cfg["member"].format(year=year)), cfg, year)
    errors = balance_errors(table, cfg["balance_tolerance"])
    if errors:
        raise TableError("the table does not balance: " + "; ".join(errors))
    return table
