"""Tiny ICIO-shaped tables for tests. They balance by construction."""

from __future__ import annotations

import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from engine import icio

TABLE_CFG: dict[str, Any] = {
    "source_id": "oecd_icio",
    "member": "{year}_SML.csv",
    "tail_rows": {"taxes": "TLS", "value_added": "VA", "output": "OUT"},
    "output_column": "OUT",
    "final_uses": ["HFCE", "GFCF"],
    "balance_tolerance": {"usd_million": 0.5, "share_of_output": 0.0002},
}


@dataclass
class Fixture:
    economies: list[str]
    industries: list[str]
    uses: list[str]
    Z: np.ndarray
    F: np.ndarray
    tax_rate: float = 0.0

    @property
    def labels(self) -> list[str]:
        return [f"{e}_{i}" for e in self.economies for i in self.industries]

    @property
    def fd_labels(self) -> list[str]:
        return [f"{e}_{u}" for e in self.economies for u in self.uses]

    @property
    def output(self) -> np.ndarray:
        return self.Z.sum(axis=1) + self.F.sum(axis=1)

    @property
    def taxes(self) -> np.ndarray:
        return self.tax_rate * self.output

    @property
    def value_added(self) -> np.ndarray:
        return self.output - self.Z.sum(axis=0) - self.taxes

    def row(self, economy: str, industry: str) -> int:
        return self.labels.index(f"{economy}_{industry}")

    def fd_col(self, economy: str, use: str) -> int:
        return self.fd_labels.index(f"{economy}_{use}")

    def csv(self, tail: tuple[str, str, str] = ("TLS", "VA", "OUT"), drop_column: str | None = None) -> str:
        header = ["V1", *self.labels, *self.fd_labels, "OUT"]
        n, m = len(self.labels), len(self.fd_labels)
        rows = [[*self.Z[i], *self.F[i], self.output[i]] for i in range(n)]
        rows.append([*self.taxes, *np.ones(m), 0.0])
        rows.append([*self.value_added, *np.zeros(m), 0.0])
        rows.append([*self.output, *np.zeros(m), 0.0])
        names = [*self.labels, *tail]
        keep = [k for k, h in enumerate(header) if h != drop_column]
        lines = [",".join(header[k] for k in keep)]
        for name, values in zip(names, rows):
            cells = [name, *(repr(float(v)) for v in values)]
            lines.append(",".join(cells[k] for k in keep))
        return "\n".join(lines) + "\n"


def random_fixture(
    economies: tuple[str, ...] = ("AUT", "CHE", "DEU", "XYZ"),
    industries: tuple[str, ...] = ("C26", "J62_63", "N"),
    uses: tuple[str, ...] = ("HFCE", "GFCF"),
    seed: int = 0,
    tax_rate: float = 0.03,
) -> Fixture:
    rng = np.random.default_rng(seed)
    n = len(economies) * len(industries)
    Z = rng.uniform(0, 10, (n, n))
    F = rng.uniform(0, 20, (n, len(economies) * len(uses)))
    return Fixture(list(economies), list(industries), list(uses), Z, F, tax_rate)


def table_from(fx: Fixture, year: int = 2022) -> icio.Table:
    """The fixture as a Table, without writing a CSV."""
    return icio.Table(year, tuple(fx.economies), tuple(fx.industries), tuple(fx.uses),
                      fx.Z, fx.F, fx.taxes, fx.value_added, fx.output)


def two_economies(tax_rate: float = 0.0) -> icio.Table:
    """AUT and DEU with one industry X each. AUT's output is 150 and it buys 37.5
    (a quarter) from DEU; DEU buys nothing. Output of DEU is 117.5."""
    fx = Fixture(["AUT", "DEU"], ["X"], ["HFCE", "GFCF"], np.zeros((2, 2)), np.zeros((2, 4)), tax_rate)
    fx.Z[fx.row("DEU", "X"), fx.row("AUT", "X")] = 37.5
    fx.F[fx.row("AUT", "X"), fx.fd_col("DEU", "HFCE")] = 100.0
    fx.F[fx.row("AUT", "X"), fx.fd_col("AUT", "GFCF")] = 50.0
    fx.F[fx.row("DEU", "X"), fx.fd_col("DEU", "HFCE")] = 80.0
    return table_from(fx)


def jsonstat(dims: dict[str, list[str]], values: dict[tuple[str, ...], float], label: str = "test") -> dict[str, Any]:
    """A Eurostat JSON-stat document with the given dimensions and values."""
    ids = list(dims)
    sizes = [len(dims[d]) for d in ids]
    flat = {}
    for key, v in values.items():
        position, stride = 0, 1
        for d, code in reversed(list(zip(ids, key))):
            position += dims[d].index(code) * stride
            stride *= len(dims[d])
        flat[str(position)] = v
    return {
        "label": label, "id": ids, "size": sizes, "value": flat,
        "dimension": {d: {"category": {"index": {c: i for i, c in enumerate(dims[d])}}} for d in ids},
    }


def write_zip(path: Path, members: dict[str, str]) -> Path:
    with zipfile.ZipFile(path, "w") as z:
        for name, text in members.items():
            z.writestr(name, text)
    return path
