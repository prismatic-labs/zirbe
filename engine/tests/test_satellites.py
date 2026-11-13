"""Emissions and employment by table row."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from engine import satellites
from engine.tests.icio_fixture import random_fixture, table_from

CFG = {
    "source_id": "test_ghg",
    "unit": 1000.0,
    "aliases": {"Y": "Y_ALT"},
    "rest_of_world": {"economy": "ROW", "from": "W", "tolerance_share": 0.001},
}


@pytest.fixture
def table():
    return table_from(random_fixture(economies=("AUT", "DEU", "ROW"), industries=("X", "Y")))


def values(**overrides: float) -> dict[tuple[str, str], float]:
    base = {
        ("AUT", "X"): 1.0, ("AUT", "Y_ALT"): 2.0,
        ("DEU", "X"): 3.0, ("DEU", "Y_ALT"): 4.0,
        ("W", "X"): 10.0, ("W", "Y_ALT"): 7.0,
    }
    base.update({tuple(k.split("__")): v for k, v in overrides.items()})
    return base


def test_read_series_keeps_the_year_and_skips_gaps(tmp_path: Path) -> None:
    doc = {"series": [
        {"dimensions": {"REF_AREA": "AUT", "ACTIVITY": "X"}, "period": ["2021", "2022"], "value": [1.0, 2.0]},
        {"dimensions": {"REF_AREA": "DEU", "ACTIVITY": "X"}, "period": ["2022"], "value": ["NA"]},
    ]}
    path = tmp_path / "s.json"
    path.write_text(json.dumps(doc))
    assert satellites.read_series(path, 2022) == {("AUT", "X"): 2.0}


def test_emissions_use_aliases_units_and_the_world_remainder(table) -> None:
    rows = satellites.emissions_kg(table, values(), CFG)
    assert rows[table.row("AUT", "Y")] == 2000.0  # Y is read as Y_ALT, in units of 1000 kg
    assert rows[table.row("ROW", "X")] == pytest.approx(6000.0)  # 10 - 1 - 3
    assert rows[table.row("ROW", "Y")] == pytest.approx(1000.0)  # 7 - 2 - 4


def test_economies_above_the_world_total_are_an_error(table) -> None:
    with pytest.raises(ValueError, match="more than the world for X"):
        satellites.emissions_kg(table, values(W__X=3.9), CFG)


def test_a_missing_value_with_output_is_an_error(table) -> None:
    v = values()
    del v[("DEU", "X")]
    with pytest.raises(ValueError, match="DEU_X"):
        satellites.emissions_kg(table, v, CFG)


def test_employment_only_fills_the_given_economies(table) -> None:
    persons = satellites.employment_persons(table, values(), ["AUT"], CFG)
    assert persons[table.rows_of("AUT")].tolist() == [1000.0, 2000.0]
    assert not persons[table.rows_of("DEU")].any()
    per = satellites.per_output(table, persons)
    assert per[0] == pytest.approx(1000.0 / table.output[0])
    assert np.isfinite(per).all()
