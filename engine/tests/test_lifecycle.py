"""The 20-year schedules and the scenario sets, with round numbers that are easy to check."""

from __future__ import annotations

import copy

import pytest

from engine import assumptions, lifecycle, meta, schemas
from engine import download as dl
from engine.mappings import contract_enum, load_mappings
from engine.tests.icio_fixture import jsonstat

ROUND = {
    "facility_capex_per_mw.at": 10.0, "liquid_cooling_premium": 1.1,
    "capex_share.electrical.liquid": 0.5, "capex_share.mechanical.liquid": 0.3, "installation_share": 0.25,
    "engineering_share": 0.1, "build_share_year1": 0.4,
    "it_refresh_years.ai": 5, "it_capex_per_mw.ai": 20.0,
    "midlife_refresh_year": 12, "midlife_refresh_share": 0.5,
    "electricity_price.at": 0.1, "it_load_factor.ai": 0.5, "pue.ai": 1.2,
    "staff_per_mw": 2.0, "payroll_per_job.at": 3.0, "maintenance_share": 0.02,
    "heat_pump_capex_per_mw_heat": 1.5, "heat_connection_capex_per_mw": 0.25, "heat_recovery_share": 0.5, "heat_pump_cop": 4.0,
    "heat_recovery_upkeep_share": 0.1,
    "grid_factor.at": 173.0, "contract_factor": 24.0, "heat_displaced_factor": 224.0,
    "cross_border_share.vienna": 0.05, "cross_border_share.lugano": 0.3,
    "facility_capex_per_mw.ch": 12.0, "electricity_price.ch": 0.13, "payroll_per_job.ch": 4.0, "grid_factor.ch": 66.0,
}


def sched(site: str = "vienna", **changes: float) -> dict:
    return lifecycle.schedule(site, "ai", lifecycle.Recorder({**ROUND, **changes}), load_mappings())


def test_the_build_is_split_into_four_categories_over_two_years() -> None:
    s = sched()
    facility = 10.0 * 1.1  # liquid cooling premium (AI sites are liquid-cooled)
    # shell 20% plus a quarter of the electrical and mechanical packages
    assert s["spend"]["construction"][0] + s["spend"]["construction"][1] == pytest.approx(facility * (0.2 + 0.25 * 0.8))
    assert s["spend"]["electrical"][0] == pytest.approx(facility * 0.5 * 0.75 * 0.4)
    assert s["spend"]["engineering"][1] == pytest.approx(facility * 0.1 * 0.6)
    assert s["spend"]["construction"][2] == 0.0


def test_it_is_bought_at_the_first_fit_and_every_refresh() -> None:
    it = sched()["spend"]["it_hardware"]
    assert [y + 1 for y, v in enumerate(it) if v] == [3, 8, 13, 18]
    keys = [(m["year"], m["key"]) for m in sched()["milestones"]]
    assert keys == [(1, "build"), (3, "first_fit"), (8, "it_refresh"), (12, "midlife_refresh"), (13, "it_refresh"), (18, "it_refresh")]


def test_the_midlife_refresh_replaces_a_share_of_the_kit() -> None:
    s = sched()
    assert s["spend"]["cooling"][11] == pytest.approx(11.0 * 0.3 * 0.75 * 0.5)


def test_operations_start_in_year_3() -> None:
    s = sched()
    mwh = 8760 * 0.5 * 1.2
    assert s["electricity_mwh"][:3] == [0.0, 0.0, pytest.approx(mwh)]
    assert s["spend"]["electricity"][19] == pytest.approx(mwh * 0.1)
    assert s["spend"]["maintenance"][2] == pytest.approx(11.0 * 0.02)
    assert s["staff_jobs"][2] == 2.0 and s["spend"]["staff"][2] == pytest.approx(6.0)


def test_heat_recovery_only_where_a_network_exists() -> None:
    with_heat, without = sched("vienna"), sched("lugano")
    # Heat pumps sized on the heat they deliver: 0.5 MW of heat at 1.5 per MW, plus 0.25 for the connection.
    capex = 0.5 * 1.5 + 0.25
    assert lifecycle.heat_recovery_capex(lifecycle.Recorder(dict(ROUND))) == pytest.approx(capex)
    assert with_heat["spend"]["heat_recovery"][1] == 0.0
    assert with_heat["spend"]["heat_recovery"][2] == pytest.approx(capex * 1.1)  # with the first fit, plus upkeep
    assert with_heat["spend"]["heat_recovery"][3] == pytest.approx(capex * 0.1)  # upkeep
    assert with_heat["heat_delivered_mwh"][2] == pytest.approx(8760 * 0.5 * 0.5)
    assert with_heat["heat_pump_mwh"][2] == pytest.approx(8760 * 0.5 * 0.5 / 4.0)
    assert with_heat["heat_pump_spend"][2] == pytest.approx(8760 * 0.5 * 0.5 / 4.0 * 0.1)
    assert not any(without["spend"]["heat_recovery"]) and not any(without["heat_delivered_mwh"])
    assert without["electricity_mwh"][2] == pytest.approx(8760 * 0.5 * 1.2)


def test_lookups_record_what_was_used_and_reject_the_unknown() -> None:
    v = lifecycle.Recorder(dict(ROUND))
    lifecycle.schedule("lugano", "ai", v, load_mappings())
    assert "heat_recovery_share" not in v.used and "staff_per_mw" in v.used
    with pytest.raises(KeyError, match="nope"):
        v("nope")
    with pytest.raises(ValueError, match="whole number"):
        sched(**{"it_refresh_years.ai": 4.5})


def test_the_headline_is_value_added_over_spend_so_far() -> None:
    s = {"spend": {"construction": [2.0, 0.0], "staff": [0.0, 1.0], "heat_recovery": [1.0, 0.0]}, "heat_pump_spend": [0.0, 1.0]}
    va = {"construction": 0.5, "staff": 1.0, "heat_recovery": 0.2, "electricity": 0.4}
    assert lifecycle.headline(s, va, heat_on=False, through_year=1) == pytest.approx(0.5)
    assert lifecycle.headline(s, va, heat_on=False, through_year=2) == pytest.approx(2.0 / 3.0)
    assert lifecycle.headline(s, va, heat_on=True, through_year=2) == pytest.approx((1.0 + 1.0 + 0.2 + 0.4) / 5.0)


def test_scenario_sets_follow_each_assumptions_effect_on_the_headline() -> None:
    a = {k: {"low": v, "central": v, "high": v} for k, v in ROUND.items()}
    a["it_capex_per_mw.ai"] = {"low": 10.0, "central": 20.0, "high": 30.0}  # more IT lowers the headline
    a["staff_per_mw"] = {"low": 1.0, "central": 2.0, "high": 3.0}           # more payroll raises it
    a["grid_factor.at"] = {"low": 100.0, "central": 173.0, "high": 250.0}   # carbon only
    va = {c: 0.5 for c in contract_enum("CategoryId")} | {"it_hardware": 0.02, "staff": 1.0}
    sets = lifecycle.scenario_sets("vienna", "ai", a, va, load_mappings())
    assert sets["low_impact"]["it_capex_per_mw.ai"] == 30.0 and sets["high_impact"]["it_capex_per_mw.ai"] == 10.0
    assert sets["low_impact"]["staff_per_mw"] == 1.0 and sets["high_impact"]["staff_per_mw"] == 3.0
    assert sets["low_impact"]["grid_factor.at"] == sets["high_impact"]["grid_factor.at"] == 173.0


def _ranges(**moved: tuple[float, float, float]) -> dict[str, dict]:
    values = {**ROUND, "it_hardware.domestic_share.at": 0.02}
    a = {k: {"id": k, "low": v, "central": v, "high": v} for k, v in values.items()}
    for aid, (low, central, high) in moved.items():
        a[aid.replace("__", ".")] = {"id": aid.replace("__", "."), "low": low, "central": central, "high": high}
    return a


def test_variants_list_only_what_one_assumption_changes() -> None:
    a = _ranges(
        electricity_price__at=(0.05, 0.1, 0.2),               # electricity, and the heat pumps' electricity
        staff_per_mw=(2.0, 2.0, 3.0),                         # low equals central: nothing to list at that end
        grid_factor__at=(100.0, 173.0, 250.0),                # carbon only: left out
        it_hardware__domestic_share__at=(0.0, 0.02, 0.1),     # a share, not a spend
    )
    central = {aid: x["central"] for aid, x in a.items()}
    found = lifecycle.variants("vienna", "ai", a, central, load_mappings())
    assert set(found) == {"electricity_price.at", "staff_per_mw", "it_hardware.domestic_share.at"}
    low = found["electricity_price.at"]["low"]
    assert set(low) == {"spend", "heat_pump_spend"} and set(low["spend"]) == {"electricity"}
    assert low["spend"]["electricity"][19] == pytest.approx(8760 * 0.5 * 1.2 * 0.05)
    assert low["heat_pump_spend"][19] == pytest.approx(8760 * 0.5 * 0.5 / 4.0 * 0.05)
    assert found["staff_per_mw"]["low"] == {}
    assert found["staff_per_mw"]["high"]["spend"]["staff"][2] == pytest.approx(3.0 * 3.0)
    assert found["it_hardware.domestic_share.at"] == {
        "low": {"domestic_share": {"it_hardware": 0.0}}, "high": {"domestic_share": {"it_hardware": 0.1}},
    }


def test_a_variant_laid_over_the_central_schedule_is_the_moved_schedule() -> None:
    a = _ranges(it_refresh_years__ai=(4, 5, 6), facility_capex_per_mw__at=(8.0, 10.0, 14.0))
    central = {aid: x["central"] for aid, x in a.items()}
    m = load_mappings()
    base = lifecycle.schedule("vienna", "ai", lifecycle.Recorder(central), m)
    found = lifecycle.variants("vienna", "ai", a, central, m)
    for aid, end in (("it_refresh_years.ai", "high"), ("facility_capex_per_mw.at", "low")):
        moved = lifecycle.schedule("vienna", "ai", lifecycle.Recorder({**central, aid: a[aid][end]}), m)
        laid = {**base["spend"], **found[aid][end]["spend"]}
        for category, series in moved["spend"].items():
            assert laid[category] == pytest.approx(series), (aid, category)
    assert set(found["it_refresh_years.ai"]["high"]["spend"]) == {"it_hardware"}


def test_the_real_assumptions_give_a_lifecycle_that_meets_the_contract() -> None:
    m = load_mappings()
    by_id = assumptions.by_id(assumptions.load_assumptions())
    va = {p: {c: 0.5 for c in contract_enum("CategoryId")} for p in contract_enum("Purchaser")}
    doc = lifecycle.build(m, by_id, va)
    assert schemas.contract_errors("lifecycle", doc) == []
    vienna = doc["vienna"]["ai"]
    assert vienna["central"]["source_ids"][0] == "facility_capex_per_mw.at"
    assert set(vienna["low_impact"]["source_ids"]) == set(vienna["central"]["source_ids"])
    assert all(i in by_id for s in doc.values() for a in s.values() for x in a.values() for i in x["source_ids"])
    assert "variants" not in vienna["low_impact"] and "variants" not in vienna["high_impact"]
    moved = vienna["central"]["variants"]
    assert set(moved) <= set(by_id) and "it_capex_per_mw.ai" in moved and "it_hardware.domestic_share.at" in moved
    assert "grid_factor.at" not in moved and "cross_border_share.vienna" not in moved


def test_meta_meets_the_contract_and_its_date_comes_from_the_inputs() -> None:
    m = load_mappings()
    sources = dl.load_sources()
    manifest = {s["id"]: {"downloaded_at": f"2026-01-0{k % 9 + 1}T00:00:00+00:00"} for k, s in enumerate(sources["sources"])}
    fx = jsonstat({"currency": ["CHF", "USD"], "time": ["2025"]}, {("CHF", "2025"): 0.937, ("USD", "2025"): 1.13})
    doc = meta.build(m, sources, manifest, 2022, fx)
    assert schemas.contract_errors("meta", doc) == []
    assert doc["generated_at"] == max(e["downloaded_at"] for e in manifest.values())
    assert doc["fx_eur_chf"] == {"value": 0.937, "source_id": "eurostat_fx"}
    assert [c["id"] for c in doc["categories"] if c["has_slider"]] == ["electrical", "cooling", "it_hardware"]
    assert {s["id"]: s["heat_available"] for s in doc["sites"]}["lugano"] is False


def test_heat_sites_follow_the_mappings() -> None:
    m = copy.deepcopy(load_mappings())
    m["sites"]["lugano"]["heat_available"] = True
    s = lifecycle.schedule("lugano", "ai", lifecycle.Recorder(dict(ROUND)), m)
    assert any(s["heat_delivered_mwh"])


def test_cloud_sites_use_the_air_cooled_shares_without_the_premium() -> None:
    values = {**ROUND, "it_refresh_years.cloud": 6, "it_capex_per_mw.cloud": 15.0, "it_load_factor.cloud": 0.6,
              "pue.cloud": 1.25, "capex_share.electrical.air": 0.54, "capex_share.mechanical.air": 0.22}
    s = lifecycle.schedule("vienna", "cloud", lifecycle.Recorder(values), load_mappings())
    assert s["spend"]["electrical"][0] == pytest.approx(10.0 * 0.54 * 0.75 * 0.4)
