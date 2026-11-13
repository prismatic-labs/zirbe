"""meta.json: the table, the datasets, labels, categories and sites."""

from __future__ import annotations

from typing import Any

from engine import eurostat
from engine.mappings import contract_enum


def generated_at(manifest: dict[str, dict[str, Any]]) -> str:
    """The newest download in the manifest, so the same inputs give the same file."""
    return max(entry["downloaded_at"] for entry in manifest.values())


def datasets(sources: dict[str, Any], manifest: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for s in sources["sources"]:
        entry = manifest[s["id"]]
        out.append({
            "id": s["id"], "name": s["name"], "publisher": s["publisher"], "edition": s["edition"],
            "url": s["page"], "accessed": entry["downloaded_at"][:10], "license": s["license"],
        })
    return out


def site_source_ids(site_id: str, site: dict[str, Any]) -> list[str]:
    """The assumptions that make this site differ from the others in its country."""
    ids = [f"cross_border_share.{site_id}"]
    if site["heat_available"]:
        ids += ["heat_recovery_share", "heat_displaced_factor"]
    return ids


def build(m: dict[str, Any], sources: dict[str, Any], manifest: dict[str, dict[str, Any]],
          table_year: int, fx_doc: dict[str, Any]) -> dict[str, Any]:
    cfg = m["meta"]
    table_source = next(s for s in sources["sources"] if s["id"] == m["table"]["source_id"])
    currency = {p: v["currency"] for p, v in m["prices"]["purchasers"].items()}
    return {
        "version": cfg["version"],
        "generated_at": generated_at(manifest),
        "fixture": False,
        "name": cfg["name"],
        "tagline": cfg["tagline"],
        "table": {
            "name": table_source["name"], "edition": table_source["edition"], "reference_year": table_year,
            "prices": "basic", "source_id": table_source["id"],
        },
        "datasets": datasets(sources, manifest),
        "price_year": m["prices"]["year"],
        "fx_eur_chf": {
            "value": eurostat.value(fx_doc, currency="CHF", time=str(m["prices"]["year"])),
            "source_id": m["prices"]["fx"]["source_id"],
        },
        "tiers": contract_enum("TierId"),
        "country_groups": [{"id": g, "label": cfg["country_groups"][g]} for g in contract_enum("CountryGroup")],
        "industry_groups": [{"id": g, "label": cfg["industry_groups"][g]} for g in contract_enum("IndustryGroupId")],
        "categories": [
            {"id": c, "label": cfg["categories"][c], "phase": m["categories"][c]["phase"], "payer": m["categories"][c]["payer"], "has_slider": c in cfg["sliders"]}
            for c in contract_enum("CategoryId")
        ],
        "sites": [
            {
                "id": s, "label": m["sites"][s]["label"], "country": m["sites"][s]["country"],
                "currency": currency[m["sites"][s]["country"]], "lat": m["sites"][s]["lat"], "lon": m["sites"][s]["lon"],
                "heat_available": m["sites"][s]["heat_available"], "source_ids": site_source_ids(s, m["sites"][s]),
            }
            for s in contract_enum("SiteId")
        ],
    }
