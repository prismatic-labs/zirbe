"""The TiVA check: domestic value added share of gross exports, on hand-checkable tables."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from engine import checks, icio
from engine.tests.icio_fixture import TABLE_CFG, Fixture, write_zip

TIVA_CFG = {
    "member": "EXGR_DVASH.csv",
    "filter": {"MEASURE": "EXGR_DVA", "ACTIVITY": "_T", "COUNTERPART_AREA": "W"},
}


def two_economies(tmp_path: Path, imported_input: float, tax_rate: float) -> icio.Table:
    """AUT and DEU with one industry each. AUT sells 100 to DEU households and
    buys `imported_input` from DEU; DEU buys nothing."""
    fx = Fixture(["AUT", "DEU"], ["X"], ["HFCE", "GFCF"], np.zeros((2, 2)), np.zeros((2, 4)), tax_rate)
    fx.Z[fx.row("DEU", "X"), fx.row("AUT", "X")] = imported_input
    fx.F[fx.row("AUT", "X"), fx.fd_col("DEU", "HFCE")] = 100.0
    fx.F[fx.row("AUT", "X"), fx.fd_col("AUT", "HFCE")] = 50.0  # home sales are not exports
    fx.F[fx.row("DEU", "X"), fx.fd_col("DEU", "HFCE")] = 80.0
    return icio.read_table(write_zip(tmp_path / "t.zip", {"2022_SML.csv": fx.csv()}), TABLE_CFG)


def test_exports_leave_out_home_sales(tmp_path: Path) -> None:
    table = two_economies(tmp_path, imported_input=0.0, tax_rate=0.0)
    assert checks.gross_exports(table, "AUT").tolist() == [100.0, 0.0]


def test_no_imported_inputs_means_all_value_added_is_domestic(tmp_path: Path) -> None:
    table = two_economies(tmp_path, imported_input=0.0, tax_rate=0.0)
    assert checks.dva_share_of_exports(table, "AUT") == pytest.approx(100.0)


def test_imported_inputs_lower_the_share_and_home_taxes_count_as_domestic(tmp_path: Path) -> None:
    # AUT output is 150 and it imports 37.5 of inputs: 25% of every unit.
    for tax_rate in (0.0, 0.05):
        table = two_economies(tmp_path, imported_input=37.5, tax_rate=tax_rate)
        assert checks.dva_share_of_exports(table, "AUT") == pytest.approx(75.0)


def test_read_tiva_keeps_matching_rows_only(tmp_path: Path) -> None:
    csv_text = "\n".join([
        "DATAFLOW,MEASURE,REF_AREA,ACTIVITY,COUNTERPART_AREA,TIME_PERIOD,OBS_VALUE",
        "x,EXGR_DVA,AUT,_T,W,2022,66.667",
        "x,EXGR_DVA,AUT,C26,W,2022,59.0",
        "x,EXGR_DVA,CHE,_T,W,2021,75.399",
        "x,EXGR_DVA,CHE,_T,W,2022,",
        "x,OTHER,CHE,_T,W,2022,1.0",
    ])
    path = write_zip(tmp_path / "tiva.zip", {"EXGR_DVASH.csv": "﻿" + csv_text + "\n"})
    assert checks.read_tiva(path, TIVA_CFG) == {("AUT", 2022): 66.667, ("CHE", 2021): 75.399}


def valid_fingerprint() -> dict:
    return {"va": {"AT": 0.75, "DE": 0.25}, "tax": 0.0, "tiers": [
        {"tier": "0", "output": {"AT": 1.0}, "va": {"AT": 0.75}, "tax": 0.0, "purchases": {"AT": {"DE": 0.25}}},
        {"tier": "1", "output": {"DE": 0.25}, "va": {"DE": 0.25}, "tax": 0.0, "purchases": {}},
        {"tier": "2", "output": {}, "va": {}, "tax": 0.0, "purchases": {}},
        {"tier": "3", "output": {}, "va": {}, "tax": 0.0, "purchases": {}},
        {"tier": "4+", "va": {}, "tax": 0.0},
    ]}


FP_TOL = {"va_plus_tax": 0.005, "tiers": 1e-6, "flows": 1e-9}


def test_a_consistent_fingerprint_passes_checks_1_to_3() -> None:
    assert checks.fingerprint_errors("x", valid_fingerprint(), FP_TOL) == []


def test_each_broken_identity_is_named() -> None:
    fp = valid_fingerprint()
    fp["va"]["AT"] = 0.70  # totals no longer 1, and tiers no longer add up to it
    errors = checks.fingerprint_errors("x", fp, FP_TOL)
    assert any("check 1" in e for e in errors) and any("AT value added" in e for e in errors)
    fp = valid_fingerprint()
    fp["tiers"][1]["output"]["DE"] = 0.3  # tier 0 bought 0.25 from DE
    assert checks.fingerprint_errors("x", fp, FP_TOL) == [
        "x: tier 1 output of DE differs from tier 0 purchases (check 3)"
    ]


def test_employment_must_match_the_reference_within_tolerance() -> None:
    assert checks.employment_errors({"AUT": 101.0}, {"AUT": 100.0}, 0.02) == []
    assert checks.employment_errors({"AUT": 103.0}, {"AUT": 100.0}, 0.02) == ["employment of AUT: TiM 103 against Eurostat 100"]


def test_the_check_fails_beyond_the_tolerance(tmp_path: Path) -> None:
    table = two_economies(tmp_path, imported_input=37.5, tax_rate=0.0)
    near, far = (checks.tiva_check(table, ["AUT"], {("AUT", 2022): v}, 2)[0] for v in (76.5, 78.0))
    assert near.ok and near.gap == pytest.approx(-1.5)
    assert not far.ok
    with pytest.raises(KeyError, match="no value for AUT in 2022"):
        checks.tiva_check(table, ["AUT"], {}, 2)
