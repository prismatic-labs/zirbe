"""Import origins from a BACI-shaped zip."""

from __future__ import annotations

from pathlib import Path

import pytest

from engine import trade
from engine.tests.icio_fixture import write_zip

CFG = {
    "member": "BACI_HS22_Y{year}_*.csv",
    "country_codes": "country_codes_*.csv",
    "products": [847150, 851762],
    "read_chunk_rows": 2,  # small, so the test crosses chunk borders
}
PARTNERS = {"aliases": {"S19": "TWN"}, "fallback_economy": "ROW"}
ECONOMIES = ("AUT", "CHE", "CHN", "DEU", "TWN", "ROW")
CODES = "\n".join([
    "country_code,country_name,country_iso2,country_iso3",
    "40,Austria,AT,AUT", "156,China,CN,CHN", "276,Germany,DE,DEU",
    '490,"Other Asia, nes",,S19', "834,Tanzania,TZ,TZA", "757,Switzerland,CH,CHE",
]) + "\n"


def baci_zip(tmp_path: Path) -> Path:
    rows = [
        "t,i,j,k,v,q",
        "2022,156,757,847150,50.0,1",
        "2022,276,757,847150,15.0,1",
        "2022,276,757,851762,5.0,1",    # second product, same pair: summed
        "2022,490,757,851762,20.0,1",   # Taiwan, as Comtrade codes it
        "2022,834,757,847150,10.0,1",   # not in the table: rest of the world
        "2022,757,757,847150,30.0,1",   # re-imports: left out of the shares
        "2022,156,757,300490,99.0,1",   # another product: left out
        "2022,156,40,847150,80.0,1",    # another importer
        "2022,156,276,847150,70.0,1",   # an importer not asked for
    ]
    return write_zip(tmp_path / "baci.zip", {
        "BACI_HS22_Y2022_V202601.csv": "\n".join(rows) + "\n",
        "BACI_HS22_Y2023_V202601.csv": "t,i,j,k,v,q\n",
        "country_codes_V202601.csv": CODES,
    })


def test_reads_the_year_for_the_importers_and_products_asked(tmp_path: Path) -> None:
    flows = trade.read_baci(baci_zip(tmp_path), CFG, 2022, [757, 40])
    assert flows.year == 2022
    assert flows.values == {(40, 156): 80.0, (757, 156): 50.0, (757, 276): 20.0, (757, 490): 20.0, (757, 757): 30.0, (757, 834): 10.0}
    assert flows.iso3[490] == "S19"


def test_origins_are_shares_of_imports_by_table_economy(tmp_path: Path) -> None:
    flows = trade.read_baci(baci_zip(tmp_path), CFG, 2022, [757])
    origins = trade.import_origins(flows, 757, "CHE", ECONOMIES, PARTNERS)
    assert origins == {"CHN": pytest.approx(0.5), "DEU": pytest.approx(0.2), "ROW": pytest.approx(0.1), "TWN": pytest.approx(0.2)}
    assert trade.import_total(flows, 757) == 130.0


def test_a_missing_year_or_importer_is_an_error(tmp_path: Path) -> None:
    path = baci_zip(tmp_path)
    with pytest.raises(ValueError, match="expected one file like BACI_HS22_Y2021"):
        trade.read_baci(path, CFG, 2021, [757])
    flows = trade.read_baci(path, CFG, 2022, [757])
    with pytest.raises(ValueError, match="no imports for importer 40"):
        trade.import_origins(flows, 40, "AUT", ECONOMIES, PARTNERS)
