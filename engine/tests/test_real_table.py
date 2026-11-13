"""The real ICIO and TiVA files, when they are in data/raw/. Skipped otherwise; never uses the network."""

from __future__ import annotations

import pytest

from engine import assumptions, checks, icio, mappings, pipeline, shares, trade
from engine import download as dl


def _raw(source_id: str):
    try:
        return dl.raw_file(source_id)
    except FileNotFoundError:
        return None


ICIO, TIVA, BACI = _raw("oecd_icio"), _raw("oecd_tiva"), _raw("cepii_baci")
pytestmark = pytest.mark.skipif(None in (ICIO, TIVA, BACI), reason="raw ICIO, TiVA or BACI file not in data/raw/")


@pytest.fixture(scope="module")
def setup():
    m = mappings.load_mappings()
    return m, icio.read_table(ICIO, m["table"])


@pytest.fixture(scope="module")
def demands(setup):
    m, table = setup
    values = assumptions.by_id(assumptions.load_assumptions())
    flows = trade.read_baci(BACI, m["trade"], table.year, m["trade"]["importers"].values())
    overrides = shares.build_overrides(table, m, values, flows)
    return shares.all_demands(table, m, overrides)


def test_the_mappings_fit_the_table(setup) -> None:
    m, table = setup
    assert mappings.table_errors(m, table) == []


def test_tiva_check_passes(setup) -> None:
    m, table = setup
    cfg = m["checks"]["tiva"]
    results = checks.tiva_check(table, list(m["purchasers"].values()), checks.read_tiva(TIVA, cfg), cfg["tolerance_pp"])
    assert [r.economy for r in results] == ["AUT", "CHE"]
    assert all(r.ok for r in results), results


def test_every_default_domestic_share_is_between_0_and_1(setup, demands) -> None:
    _, table = setup  # check 4
    for d in demands:
        assert 0 <= d.domestic_share(table) <= 1, (d.purchaser, d.category)


@pytest.fixture(scope="module")
def outputs():
    return pipeline.build_outputs(pipeline.load_inputs())


@pytest.fixture(scope="module")
def built(outputs):
    docs, errors = outputs
    return docs["fingerprints"], errors


def test_all_four_files_pass_every_check_the_schemas_and_each_other(outputs) -> None:
    docs, errors = outputs
    assert errors == []
    assert list(docs["fingerprints"]) == ["AT", "CH"]
    assert docs["meta"]["table"]["reference_year"] == 2022 and docs["meta"]["price_year"] == 2025


def test_fingerprint_rules_from_the_spec_hold(built) -> None:
    doc, _ = built
    for purchaser, categories in doc.items():
        assert categories["electricity"]["domestic"]["co2e_kg"] == {}  # carbon comes from the grid factor
        assert categories["heat_recovery"] == categories["cooling"]  # same product, same phase
        assert "staff" not in categories


def test_it_hardware_uses_trade_origins_with_taiwan_as_its_own_economy(setup, demands) -> None:
    m, table = setup
    hardware = [d for d in demands if d.category == "it_hardware"]
    assert [d.basis for d in hardware] == ["trade", "trade"]
    for d in hardware:
        assert d.import_mix(table, m)["TW"] > 0.02, d.purchaser
