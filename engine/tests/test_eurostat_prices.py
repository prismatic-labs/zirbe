"""Eurostat JSON-stat lookups and the conversion from table dollars to euros of the price year."""

from __future__ import annotations

import pytest

from engine import eurostat, prices
from engine.tests.icio_fixture import jsonstat

FX = jsonstat(
    {"freq": ["A"], "currency": ["CHF", "USD"], "time": ["2022", "2025"]},
    {("A", "USD", "2022"): 1.05, ("A", "CHF", "2022"): 1.0, ("A", "CHF", "2025"): 0.9, ("A", "USD", "2025"): 1.2},
)
DEFLATOR = jsonstat(
    {"geo": ["AT", "CH"], "time": ["2022", "2025"]},
    {("AT", "2022"): 100.0, ("AT", "2025"): 110.0, ("CH", "2022"): 100.0, ("CH", "2025"): 102.0},
)
M = {"prices": {
    "year": 2025,
    "fx": {"usd": "USD"},
    "purchasers": {"AT": {"currency": "EUR", "geo": "AT"}, "CH": {"currency": "CHF", "geo": "CH"}},
}}


def test_value_finds_a_cell_and_skips_single_category_dimensions() -> None:
    assert eurostat.value(FX, currency="CHF", time="2025") == 0.9
    assert eurostat.value(DEFLATOR, geo="CH", time="2022") == 100.0


def test_value_says_what_is_missing() -> None:
    with pytest.raises(KeyError, match="no currency=JPY"):
        eurostat.value(FX, currency="JPY", time="2022")
    with pytest.raises(KeyError, match="time has 2 categories"):
        eurostat.value(FX, currency="USD")
    sparse = jsonstat({"time": ["2022", "2023"]}, {("2022",): 1.0})
    with pytest.raises(KeyError, match="no value at"):
        eurostat.value(sparse, time="2023")


def test_one_euro_of_the_price_year_in_table_dollars() -> None:
    factors = prices.table_usd_per_eur(M, FX, DEFLATOR, 2022)
    # Austria: deflate by 110/100, then 1.05 USD per EUR in 2022.
    assert factors["AT"] == pytest.approx(1.05 / 1.10)
    # Switzerland: 0.9 CHF per EUR in 2025, deflate CHF by 102/100, then
    # 1.05 USD per EUR over 1.0 CHF per EUR in 2022.
    assert factors["CH"] == pytest.approx(0.9 / 1.02 * 1.05 / 1.0)
