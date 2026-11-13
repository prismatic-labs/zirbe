"""Smallest documents that satisfy each schema. Values are placeholders, not data."""

from __future__ import annotations

from typing import Any

COUNTRY_GROUPS = ["AT", "CH", "DE", "IT", "FR", "EU_OTHER", "UK", "US", "CN", "TW", "KR", "JP", "ROW"]
INDUSTRY_GROUPS = [
    "construction", "electrical_machinery", "electronics", "metals_mining", "energy",
    "transport_logistics", "trade", "business_services", "it_services", "other",
]
CATEGORIES = [
    "construction", "electrical", "cooling", "it_hardware", "engineering",
    "electricity", "maintenance", "heat_recovery", "staff",
]
FINGERPRINT_CATEGORIES = [c for c in CATEGORIES if c != "staff"]
SLIDERS = {"electrical", "cooling", "it_hardware"}
SITES = [
    ("vienna", "AT", "EUR"), ("innsbruck", "AT", "EUR"), ("linz", "AT", "EUR"),
    ("zurich", "CH", "CHF"), ("geneva", "CH", "CHF"), ("lugano", "CH", "CHF"),
]
TIERS = ["0", "1", "2", "3", "4+"]
YEARS = 20
DATASET_ID = "test_table"
ASSUMPTION_ID = "test.value"


def meta() -> dict[str, Any]:
    return {
        "version": "0.0.0",
        "generated_at": "2026-01-01T00:00:00Z",
        "fixture": True,
        "name": "Zirbe",
        "tagline": "Follow the Euro",
        "table": {
            "name": "Test table", "edition": "test", "reference_year": 2000,
            "prices": "basic", "source_id": DATASET_ID,
        },
        "datasets": [
            {
                "id": DATASET_ID, "name": "Test table", "publisher": "Test", "edition": "test",
                "url": "https://example.org/table", "accessed": "2026-01-01", "license": "CC BY 4.0",
            }
        ],
        "price_year": 2000,
        "fx_eur_chf": {"value": 1.0, "source_id": ASSUMPTION_ID},
        "tiers": list(TIERS),
        "country_groups": [{"id": g, "label": g} for g in COUNTRY_GROUPS],
        "industry_groups": [{"id": g, "label": g} for g in INDUSTRY_GROUPS],
        "categories": [
            {"id": c, "label": c, "phase": "capital", "payer": "building", "has_slider": c in SLIDERS}
            for c in CATEGORIES
        ],
        "sites": [
            {
                "id": s, "label": s, "country": country, "currency": currency,
                "lat": 0.0, "lon": 0.0, "heat_available": False, "source_ids": [ASSUMPTION_ID],
            }
            for s, country, currency in SITES
        ],
    }


def tier(tier_id: str) -> dict[str, Any]:
    out: dict[str, Any] = {"tier": tier_id, "va": {"AT": 0.0}, "tax": 0.0}
    if tier_id != "4+":
        out["output"] = {"AT": 0.0}
        out["purchases"] = {"AT": {"AT": 0.0}}
    return out


def fingerprint() -> dict[str, Any]:
    return {
        "tiers": [tier(t) for t in TIERS],
        "va": {"AT": 0.0},
        "tax": 0.0,
        "va_domestic_by_industry": {g: 0.0 for g in INDUSTRY_GROUPS},
        "co2e_kg": {"AT": 0.0},
        "jobs_domestic_per_meur": 0.0,
    }


def category_fingerprints() -> dict[str, Any]:
    return {
        "default_domestic_share": 0.0,
        "domestic_share_low": 0.0,
        "domestic_share_high": 0.0,
        "domestic": fingerprint(),
        "imported": fingerprint(),
        "source_ids": [DATASET_ID],
    }


def fingerprints() -> dict[str, Any]:
    return {p: {c: category_fingerprints() for c in FINGERPRINT_CATEGORIES} for p in ("AT", "CH")}


def series() -> list[float]:
    return [0.0] * YEARS


def schedule() -> dict[str, Any]:
    return {
        "spend": {c: series() for c in CATEGORIES},
        "electricity_mwh": series(),
        "heat_delivered_mwh": series(),
        "heat_pump_mwh": series(),
        "heat_pump_spend": series(),
        "staff_jobs": series(),
        "grid_kgco2e_per_mwh": 0.0,
        "contract_kgco2e_per_mwh": 0.0,
        "heat_displaced_kgco2e_per_mwh": 0.0,
        "cross_border_payroll_share": 0.0,
        "milestones": [{"year": 1, "key": "build"}],
        "source_ids": [ASSUMPTION_ID],
    }


def lifecycle() -> dict[str, Any]:
    return {
        s: {a: {sc: schedule() for sc in ("low_impact", "central", "high_impact")} for a in ("ai", "cloud")}
        for s, _, _ in SITES
    }


def assumption(aid: str = ASSUMPTION_ID) -> dict[str, Any]:
    return {
        "id": aid, "label": "Test", "unit": "unit",
        "low": 0.0, "central": 1.0, "high": 2.0,
        "source": "Test source", "url": "https://example.org/source",
        "source_accessed": "2026-01-01", "source_published": "2025-06",
        "status": "draft",
    }


def assumptions() -> list[dict[str, Any]]:
    return [assumption()]


DOCUMENTS = {
    "meta": meta,
    "fingerprints": fingerprints,
    "lifecycle": lifecycle,
    "assumptions": assumptions,
}
