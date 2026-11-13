"""assumptions/assumptions.yaml against the contract."""

from __future__ import annotations

from pathlib import Path

import pytest

from engine import assumptions
from engine.mappings import load_mappings


def test_the_assumptions_file_meets_the_contract() -> None:
    doc = assumptions.load_assumptions()
    assert all(isinstance(a["source_accessed"], str) for a in doc)


def test_every_assumption_the_mappings_name_exists_per_purchaser() -> None:
    m = load_mappings()
    ids = assumptions.by_id(assumptions.load_assumptions())
    for cat in m["categories"].values():
        if "domestic_share" in cat:
            for purchaser in m["purchasers"]:
                assert f"{cat['domestic_share']['assumption']}.{purchaser.lower()}" in ids


def test_unquoted_dates_are_read_as_text(tmp_path: Path) -> None:
    path = tmp_path / "a.yaml"
    path.write_text(
        "- {id: x.y, label: X, unit: u, low: 0, central: 1, high: 2, source: S, "
        "source_accessed: 2026-11-10, status: draft}\n"
    )
    assert assumptions.load_assumptions(path)[0]["source_accessed"] == "2026-11-10"


def test_an_assumption_out_of_order_is_rejected(tmp_path: Path) -> None:
    path = tmp_path / "a.yaml"
    path.write_text(
        "- {id: x.y, label: X, unit: u, low: 3, central: 1, high: 2, source: S, "
        "source_accessed: '2026-11-10', status: draft}\n"
    )
    with pytest.raises(ValueError, match="low <= central <= high"):
        assumptions.load_assumptions(path)
