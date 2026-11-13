"""The ICIO reader, on tiny tables written to a zip. No network, no data/raw."""

from __future__ import annotations

from dataclasses import replace
from pathlib import Path

import numpy as np
import pytest

from engine import icio
from engine.tests.icio_fixture import TABLE_CFG, random_fixture, write_zip


def set_cell(text: str, line: int, cell: int, value: str) -> str:
    lines = text.split("\n")
    cells = lines[line].split(",")
    cells[cell] = value
    lines[line] = ",".join(cells)
    return "\n".join(lines)


def read(tmp_path: Path, text: str, year: int = 2022) -> icio.Table:
    path = write_zip(tmp_path / "t.zip", {f"{year}_SML.csv": text})
    return icio.read_table(path, TABLE_CFG)


def test_reads_the_latest_year_with_its_values(tmp_path: Path) -> None:
    old, new = random_fixture(seed=1), random_fixture(seed=2)
    path = write_zip(tmp_path / "t.zip", {"2021_SML.csv": old.csv(), "2022_SML.csv": new.csv(), "ReadMe.txt": "x"})
    assert icio.years_in_zip(path, TABLE_CFG["member"]) == [2021, 2022]
    table = icio.read_table(path, TABLE_CFG)
    assert table.year == 2022
    assert table.economies == ("AUT", "CHE", "DEU", "XYZ")
    assert table.industries == ("C26", "J62_63", "N")
    np.testing.assert_array_equal(table.Z, new.Z)
    np.testing.assert_array_equal(table.F, new.F)
    np.testing.assert_allclose(table.output, new.output)
    assert icio.read_table(path, TABLE_CFG, 2021).year == 2021


def test_a_year_not_in_the_zip_is_an_error(tmp_path: Path) -> None:
    path = write_zip(tmp_path / "t.zip", {"2022_SML.csv": random_fixture().csv()})
    with pytest.raises(icio.TableError, match="2019 is not in"):
        icio.read_table(path, TABLE_CFG, 2019)


def test_coefficients_add_up_to_one_per_column(tmp_path: Path) -> None:
    table = read(tmp_path, random_fixture().csv())
    np.testing.assert_allclose(table.A.sum(axis=0) + table.v + table.t, 1.0, rtol=1e-12)
    assert table.t == pytest.approx(np.full(table.n, 0.03))


def test_zero_output_industry_gets_zero_coefficients(tmp_path: Path) -> None:
    fx = random_fixture()
    j = fx.row("XYZ", "N")
    fx.Z[j, :] = fx.Z[:, j] = 0.0
    fx.F[j, :] = 0.0
    table = read(tmp_path, fx.csv())
    assert table.output[j] == 0
    assert not table.A[:, j].any() and table.v[j] == 0 and table.t[j] == 0
    assert np.isfinite(table.A).all()


def test_leontief_apply_solves_the_system(tmp_path: Path) -> None:
    table = read(tmp_path, random_fixture().csv())
    y = np.arange(table.n, dtype=float)
    x = table.leontief_apply(y)
    np.testing.assert_allclose(x - table.A @ x, y, atol=1e-9)


def test_lookups_follow_the_table_order(tmp_path: Path) -> None:
    table = read(tmp_path, random_fixture().csv())
    assert table.row("CHE", "N") == 5
    assert table.rows_of("DEU") == slice(6, 9)
    assert table.final_use_col("CHE", "GFCF") == 3
    assert list(table.economy_of_row()[:4]) == ["AUT", "AUT", "AUT", "CHE"]
    assert list(table.industry_of_row()[:4]) == ["C26", "J62_63", "N", "C26"]


@pytest.mark.parametrize(
    ("change", "message"),
    [
        (lambda fx: fx.csv(tail=("VA", "TLS", "OUT")), "last rows"),
        (lambda fx: fx.csv(drop_column="CHE_GFCF"), "missing \\['CHE_GFCF'\\]"),
        (lambda fx: fx.csv().replace("\nAUT_N,", "\nAUT_X,", 1), "seller rows"),
        (lambda fx: fx.csv().replace("\nAUT_N,", "\nAUTN,", 1), "not ECONOMY_CODE"),
        (lambda fx: set_cell(fx.csv(), line=3, cell=2, value="12;5"), "non-numeric"),
        (lambda fx: set_cell(fx.csv(), line=3, cell=2, value=""), "empty cells"),
    ],
)
def test_layout_problems_are_reported(tmp_path: Path, change, message: str) -> None:
    with pytest.raises(icio.TableError, match=message):
        read(tmp_path, change(random_fixture()))


def test_a_column_and_row_that_do_not_balance_are_reported(tmp_path: Path) -> None:
    fx = random_fixture()
    i, j = fx.row("AUT", "C26"), fx.row("CHE", "N")
    text = set_cell(fx.csv(), line=1 + i, cell=1 + j, value=repr(float(fx.Z[i, j]) + 5.0))
    with pytest.raises(icio.TableError) as err:
        read(tmp_path, text)
    assert "1 column(s) miss, worst CHE_N by 5.0000" in str(err.value)
    assert "1 row(s) miss, worst AUT_C26 by 5.0000" in str(err.value)


def test_a_gap_within_rounding_passes(tmp_path: Path) -> None:
    table = read(tmp_path, random_fixture().csv())
    Z = table.Z.copy()
    Z[0, 1] += 0.1  # row 0 and column 1 now miss by 0.1, under the 0.5 limit
    assert icio.balance_errors(replace(table, Z=Z), TABLE_CFG["balance_tolerance"]) == []
    Z[0, 1] += 1.0
    assert len(icio.balance_errors(replace(table, Z=Z), TABLE_CFG["balance_tolerance"])) == 2
