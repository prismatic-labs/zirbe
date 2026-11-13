"""How many table dollars one euro of the price year is worth, per purchaser."""

from __future__ import annotations

from typing import Any

from engine import eurostat


def table_usd_per_eur(m: dict[str, Any], fx_doc: dict[str, Any], deflator_doc: dict[str, Any], table_year: int) -> dict[str, float]:
    """USD of the table year per EUR of the price year (see engine/mappings.yaml, prices)."""
    cfg = m["prices"]
    price_year, base_year = str(cfg["year"]), str(table_year)

    def per_eur(currency: str, year: str) -> float:
        return 1.0 if currency == "EUR" else eurostat.value(fx_doc, currency=currency, time=year)

    usd_per_eur = per_eur(cfg["fx"]["usd"], base_year)
    out = {}
    for purchaser, p in cfg["purchasers"].items():
        deflator = eurostat.value(deflator_doc, geo=p["geo"], time=price_year) / eurostat.value(deflator_doc, geo=p["geo"], time=base_year)
        out[purchaser] = per_eur(p["currency"], price_year) / deflator * usd_per_eur / per_eur(p["currency"], base_year)
    return out
