"""Step 3 demand vectors and domestic shares, on a tiny table."""

from __future__ import annotations

import copy
from pathlib import Path
from typing import Any

import numpy as np
import pytest

from engine import icio, shares, trade
from engine.mappings import load_mappings
from engine.tests.icio_fixture import TABLE_CFG, random_fixture, write_zip


def mappings_for_fixture() -> dict[str, Any]:
    """The real mappings, with categories cut down to the fixture's industries."""
    m = copy.deepcopy(load_mappings())
    m["categories"] = {
        "it_hardware": {"phase": "capital", "products": ["C26"]},
        "maintenance": {"phase": "operating", "products": ["C26", "N"]},
        "staff": {"phase": "operating", "products": []},
    }
    return m


@pytest.fixture
def table(tmp_path: Path) -> icio.Table:
    fx = random_fixture()
    gfcf = fx.fd_col("AUT", "GFCF")
    fx.F[:, gfcf] = 0.0
    for economy, value in (("AUT", 30.0), ("CHE", 10.0), ("DEU", 40.0), ("XYZ", 20.0)):
        fx.F[fx.row(economy, "C26"), gfcf] = value
    fx.F[fx.row("AUT", "N"), gfcf] = 99.0  # not a product of it_hardware, so ignored
    path = write_zip(tmp_path / "t.zip", {"2022_SML.csv": fx.csv()})
    return icio.read_table(path, TABLE_CFG)


def test_capital_category_is_the_purchasers_gfcf_of_its_products(table: icio.Table) -> None:
    m = mappings_for_fixture()
    d = shares.category_demand(table, m, "AT", "it_hardware")
    assert d.total == pytest.approx(100.0)
    assert d.domestic_share(table) == pytest.approx(0.3)
    assert d.by_product(table) == {"C26": pytest.approx(1.0)}
    mix = d.import_mix(table, m)
    assert "AT" not in mix
    assert mix["CH"] == pytest.approx(1 / 7) and mix["DE"] == pytest.approx(4 / 7)
    assert mix["ROW"] == pytest.approx(2 / 7)  # XYZ is in no listed group
    assert sum(mix.values()) == pytest.approx(1.0)
    assert sum(d.by_group(table, m).values()) == pytest.approx(1.0)


def test_operating_category_is_the_it_services_industrys_purchases(table: icio.Table) -> None:
    m = mappings_for_fixture()
    d = shares.category_demand(table, m, "CH", "maintenance")
    column = table.Z[:, table.row("CHE", "J62_63")]
    keep = np.isin(table.industry_of_row(), ["C26", "N"])
    np.testing.assert_array_equal(d.y, np.where(keep, column, 0.0))
    weights = d.by_product(table)
    n_rows = table.industry_of_row() == "N"
    assert weights["N"] == pytest.approx(column[n_rows].sum() / column[keep].sum())
    assert sum(weights.values()) == pytest.approx(1.0)


def test_a_category_with_no_purchases_is_an_error(table: icio.Table) -> None:
    m = mappings_for_fixture()
    m["categories"]["it_hardware"]["products"] = ["J62_63"]
    table.F[:, table.final_use_col("AUT", "GFCF")] = 0.0
    with pytest.raises(ValueError, match="buys none"):
        shares.category_demand(table, m, "AT", "it_hardware")


def test_an_override_replaces_the_domestic_share_and_the_import_origins(table: icio.Table) -> None:
    m = mappings_for_fixture()
    m["categories"]["it_hardware"] |= {
        "domestic_share": {"assumption": "it_hardware.domestic_share"},
        "import_origins": {"source_id": "cepii_baci"},
    }
    overrides = {("AT", "it_hardware"): shares.Override(0.1, {"DEU": 0.75, "XYZ": 0.25}, 1234.0, (0.0, 0.3))}
    d = shares.category_demand(table, m, "AT", "it_hardware", overrides)
    assert d.total == pytest.approx(1.0)
    assert d.domestic_share(table) == pytest.approx(0.1)
    assert d.domestic_share_range(table) == (0.0, 0.3)
    assert d.y[table.row("DEU", "C26")] == pytest.approx(0.675)
    assert d.y[table.row("XYZ", "C26")] == pytest.approx(0.225)
    assert d.import_mix(table, m)["DE"] == pytest.approx(0.75)
    assert (d.basis, d.base_usd_m, d.from_table) == ("trade", 1234.0, False)
    with pytest.raises(ValueError, match="CH it_hardware needs"):
        shares.category_demand(table, m, "CH", "it_hardware", overrides)


def test_overrides_are_built_from_assumptions_and_trade_data(table: icio.Table) -> None:
    m = mappings_for_fixture()
    m["categories"]["it_hardware"] |= {
        "domestic_share": {"assumption": "it_hardware.domestic_share"},
        "import_origins": {"source_id": "cepii_baci"},
    }
    m["trade"] |= {"partners": {"aliases": {}, "fallback_economy": "XYZ"}, "value_unit": 1000}
    # Each importer buys 3 from Germany and 1 from China (not in the table: XYZ), in thousand USD.
    flows = trade.Flows(2022, {(j, i): v for j in (40, 757) for i, v in ((276, 3.0), (156, 1.0))}, {276: "DEU", 156: "CHN"})
    values = {
        "it_hardware.domestic_share.at": {"low": 0.0, "central": 0.02, "high": 0.1},
        "it_hardware.domestic_share.ch": {"low": 0.01, "central": 0.05, "high": 0.2},
    }
    overrides = shares.build_overrides(table, m, values, flows)
    assert overrides[("CH", "it_hardware")] == shares.Override(0.05, {"DEU": 0.75, "XYZ": 0.25}, 0.004, (0.01, 0.2))
    with pytest.raises(ValueError, match="table year is 2022"):
        shares.build_overrides(table, m, values, trade.Flows(2021, flows.values, flows.iso3))


def test_every_purchaser_and_category_but_staff_is_listed(table: icio.Table) -> None:
    m = mappings_for_fixture()
    demands = shares.all_demands(table, m)
    assert [(d.purchaser, d.category) for d in demands] == [
        ("AT", "it_hardware"), ("AT", "maintenance"), ("CH", "it_hardware"), ("CH", "maintenance"),
    ]
    lines = shares.report_lines(table, m, demands, top=2)
    assert len(lines) == 1 + len(demands)
    assert "30.0%" in lines[1] and "DE 57% ROW 29%" in lines[1]
