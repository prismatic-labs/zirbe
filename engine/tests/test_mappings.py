"""engine/mappings.yaml against the contract."""

from __future__ import annotations

import copy
from pathlib import Path

from engine import icio, mappings
from engine.tests.icio_fixture import TABLE_CFG, random_fixture, write_zip


def test_the_mappings_file_is_consistent_with_the_contract() -> None:
    assert mappings.mapping_errors(mappings.load_mappings()) == []


def test_eu_other_is_the_rest_of_the_eu_in_2022() -> None:
    groups = mappings.load_mappings()["country_groups"]
    eu27 = groups["AT"] + groups["DE"] + groups["IT"] + groups["FR"] + groups["EU_OTHER"]
    assert len(set(eu27)) == 27
    assert "GBR" not in eu27 and "CHE" not in eu27


def test_an_economy_in_two_groups_is_reported() -> None:
    m = copy.deepcopy(mappings.load_mappings())
    m["country_groups"]["ROW"] = ["DEU"]
    assert "DEU is in both DE and ROW" in mappings.mapping_errors(m)


def test_a_purchaser_outside_its_own_group_is_reported() -> None:
    m = copy.deepcopy(mappings.load_mappings())
    m["purchasers"]["AT"] = "DEU"
    assert "purchaser AT (DEU) must sit in country group AT" in mappings.mapping_errors(m)


def test_categories_must_follow_the_contract() -> None:
    m = copy.deepcopy(mappings.load_mappings())
    del m["categories"]["heat_recovery"]
    m["categories"]["staff"]["products"] = ["J62_63"]
    errors = mappings.mapping_errors(m)
    assert "categories must list every CategoryId, in contract order" in errors
    assert "staff: only staff has no products" in errors


def test_an_override_needs_both_parts_and_one_product() -> None:
    m = copy.deepcopy(mappings.load_mappings())
    del m["categories"]["it_hardware"]["import_origins"]
    m["categories"]["it_hardware"]["products"] = ["C26", "C27"]
    errors = mappings.mapping_errors(m)
    assert "it_hardware: domestic_share and import_origins go together" in errors
    assert "it_hardware: an override needs exactly one product" in errors


def test_industry_groups_follow_the_contract_and_do_not_overlap() -> None:
    m = copy.deepcopy(mappings.load_mappings())
    m["industry_groups"]["other"] = ["F"]
    assert "F is in both construction and other" in mappings.mapping_errors(m)
    del m["industry_groups"]["trade"]
    assert "industry_groups must list every IndustryGroupId, in contract order" in mappings.mapping_errors(m)


def test_numbers_that_yaml_reads_as_text_are_reported() -> None:
    m = copy.deepcopy(mappings.load_mappings())
    m["units"]["jobs_per"] = "1.0e6"
    assert "mappings.units.jobs_per is text, not a number: '1.0e6'" in mappings.mapping_errors(m)
    assert mappings.numbers_as_text({"a": ["J62_63", "C24A", "_T", "{year}_SML.csv"]}) == []


def test_codes_missing_from_the_table_are_reported(tmp_path: Path) -> None:
    table = icio.read_table(write_zip(tmp_path / "t.zip", {"2022_SML.csv": random_fixture().csv()}), TABLE_CFG)
    errors = mappings.table_errors(mappings.load_mappings(), table)
    assert "economy FRA is not in the table" in errors
    assert "industry F is not in the table" in errors
    assert "economy AUT is not in the table" not in errors
    assert "industry J62_63 is not in the table" not in errors


def test_unlisted_economies_are_rest_of_world() -> None:
    m = mappings.load_mappings()
    assert mappings.group_of(m, "TWN") == "TW"
    assert mappings.group_of(m, "HKG") == "ROW"
    assert mappings.group_of(m, "ROW") == "ROW"
