"""Fingerprints on a table small enough to check by hand."""

from __future__ import annotations

import numpy as np
import pytest

from engine import checks, fingerprints
from engine.mappings import contract_enum, load_mappings
from engine.shares import CategoryDemand
from engine.tests.icio_fixture import two_economies

UNITS = {"table_currency": 1.0e6, "jobs_per": 1.0e6}
TOL = {"va_plus_tax": 0.005, "tiers": 1e-6, "flows": 1e-9}


def context(tax_rate: float = 0.0) -> fingerprints.Context:
    table = two_economies(tax_rate)
    # 1 kg per unit of output in AUT (output 150), 2 in DEU (output 117.5);
    # 1 person per unit of output in AUT; none counted in DEU.
    return fingerprints.make_context(table, load_mappings(), np.array([150.0, 235.0]), np.array([150.0, 0.0]))


def one_unit_of_austrian_x(ctx: fingerprints.Context) -> tuple[np.ndarray, np.ndarray]:
    y = np.array([1.0, 0.0])
    return y, ctx.table.leontief_apply(y)


def test_the_journey_of_one_unit_by_hand() -> None:
    ctx = context()
    y, total = one_unit_of_austrian_x(ctx)
    fp = fingerprints.fingerprint(ctx, y, total, "AUT", 0.9, UNITS, embodied_carbon=True)
    t0, t1, t2, t3, later = fp["tiers"]
    assert [t["tier"] for t in fp["tiers"]] == contract_enum("TierId")
    assert t0 == {"tier": "0", "output": {"AT": 1.0}, "va": {"AT": 0.75}, "tax": 0.0, "purchases": {"AT": {"DE": 0.25}}}
    assert t1 == {"tier": "1", "output": {"DE": 0.25}, "va": {"DE": 0.25}, "tax": 0.0, "purchases": {}}
    assert t2["output"] == t3["output"] == {}
    assert later == {"tier": "4+", "va": {}, "tax": 0.0}
    assert fp["va"] == {"AT": 0.75, "DE": 0.25}
    # kg per EUR: (1 kg x 1 unit at home + 2 kg x 0.25 abroad) per table unit, x 0.9 USD per EUR / 1e6.
    assert fp["co2e_kg"] == {"AT": pytest.approx(0.9e-6), "DE": pytest.approx(0.45e-6)}
    assert fp["jobs_domestic_per_meur"] == pytest.approx(0.9)
    assert fp["va_domestic_by_industry"] == {g: (0.75 if g == "other" else 0.0) for g in contract_enum("IndustryGroupId")}
    assert checks.fingerprint_errors("test", fp, TOL) == []


def test_taxes_and_value_added_still_add_up_to_one() -> None:
    ctx = context(tax_rate=0.05)
    y, total = one_unit_of_austrian_x(ctx)
    fp = fingerprints.fingerprint(ctx, y, total, "AUT", 0.9, UNITS, embodied_carbon=True)
    assert fp["va"] == {"AT": pytest.approx(0.70), "DE": pytest.approx(0.2375)}
    assert fp["tax"] == pytest.approx(0.0625)
    assert checks.fingerprint_errors("test", fp, TOL) == []


def test_a_category_without_embodied_carbon_has_none() -> None:
    ctx = context()
    y, total = one_unit_of_austrian_x(ctx)
    assert fingerprints.fingerprint(ctx, y, total, "AUT", 0.9, UNITS, embodied_carbon=False)["co2e_kg"] == {}


def test_build_splits_demand_into_domestic_and_imported() -> None:
    ctx = context()
    m = load_mappings()
    d = CategoryDemand("AT", "construction", "AUT", np.array([3.0, 1.0]), "GFCF", 4.0)
    doc = fingerprints.build(ctx, m, [d], {"AT": 0.9}, {("AT", "construction"): ["oecd_icio"]})
    c = doc["AT"]["construction"]
    assert c["default_domestic_share"] == 0.75
    assert c["domestic_share_low"] == c["domestic_share_high"] == 0.75  # from the table: no range
    assert c["domestic"]["va"] == {"AT": 0.75, "DE": 0.25}
    assert c["imported"]["va"] == {"DE": 1.0}
    assert c["source_ids"] == ["oecd_icio"]
    with pytest.raises(ValueError, match="needs both domestic and imported"):
        fingerprints.split(ctx.table, CategoryDemand("AT", "construction", "AUT", np.array([1.0, 0.0]), "GFCF", 1.0))


def test_source_ids_follow_what_each_category_uses() -> None:
    m = load_mappings()
    y = np.zeros(2)
    demands = [CategoryDemand("AT", c, "AUT", y, "x", 0.0) for c in ("construction", "electricity", "it_hardware")]
    ids = fingerprints.source_ids(m, demands)
    assert ids[("AT", "construction")] == ["oecd_icio", "oecd_ghgfp", "oecd_tim", "eurostat_fx", "eurostat_deflator"]
    assert "oecd_ghgfp" not in ids[("AT", "electricity")]
    assert ids[("AT", "it_hardware")][-2:] == ["cepii_baci", "it_hardware.domestic_share.at"]


def test_summary_blends_the_two_origins_at_the_default_share() -> None:
    ctx = context()
    d = CategoryDemand("AT", "construction", "AUT", np.array([3.0, 1.0]), "GFCF", 4.0)
    doc = fingerprints.build(ctx, load_mappings(), [d], {"AT": 0.9}, {("AT", "construction"): ["oecd_icio"]})
    c = doc["AT"]["construction"]
    assert fingerprints.blended(c, lambda fp: fp["va"].get("AT", 0.0)) == pytest.approx(0.75 * 0.75)
    lines = fingerprints.summary_lines(doc)
    assert len(lines) == 2 and lines[1].startswith("AT    construction")
