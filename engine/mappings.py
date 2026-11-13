"""Load engine/mappings.yaml and check it against the contract and the table."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml

from engine import schemas
from engine.icio import Table
from engine.schemas import ROOT

MAPPINGS_FILE = ROOT / "engine" / "mappings.yaml"


def load_mappings(path: Path = MAPPINGS_FILE) -> dict[str, Any]:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def contract_enum(name: str) -> list[str]:
    """A string union from the contract, as the schemas in schema/ define it."""
    for schema_name in schemas.OUTPUT_FILES.values():
        defs = schemas.load_schema(schema_name).get("$defs", {})
        if name in defs:
            return list(defs[name]["enum"])
    raise KeyError(f"no schema defines {name}")


def mapping_errors(m: dict[str, Any]) -> list[str]:
    """Problems with the mappings on their own, before any table is read."""
    errors = []
    if list(m["country_groups"]) != contract_enum("CountryGroup"):
        errors.append("country_groups must list every CountryGroup, in contract order")
    seen: dict[str, str] = {}
    for group, members in m["country_groups"].items():
        for economy in members:
            if economy in seen:
                errors.append(f"{economy} is in both {seen[economy]} and {group}")
            seen[economy] = group
    if sorted(m["purchasers"]) != sorted(contract_enum("Purchaser")):
        errors.append("purchasers must be exactly the contract's Purchaser values")
    for purchaser, economy in m["purchasers"].items():
        if seen.get(economy) != purchaser:
            errors.append(f"purchaser {purchaser} ({economy}) must sit in country group {purchaser}")
    if list(m["categories"]) != contract_enum("CategoryId"):
        errors.append("categories must list every CategoryId, in contract order")
    for cid, cat in m["categories"].items():
        if cat["phase"] not in m["demand"]:
            errors.append(f"{cid}: phase {cat['phase']!r} has no demand source")
        if (cid == "staff") != (not cat["products"]):
            errors.append(f"{cid}: only staff has no products")
        if ("domestic_share" in cat) != ("import_origins" in cat):
            errors.append(f"{cid}: domestic_share and import_origins go together")
        if "domestic_share" in cat and len(cat["products"]) != 1:
            errors.append(f"{cid}: an override needs exactly one product")
    if list(m["industry_groups"]) != contract_enum("IndustryGroupId"):
        errors.append("industry_groups must list every IndustryGroupId, in contract order")
    placed: dict[str, str] = {}
    for group, industries in m["industry_groups"].items():
        for industry in industries:
            if industry in placed:
                errors.append(f"{industry} is in both {placed[industry]} and {group}")
            placed[industry] = group
    errors += [f"{where} is text, not a number: {value!r}" for where, value in numbers_as_text(m)]
    return errors


NUMBER_LIKE = re.compile(r"[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?")


def numbers_as_text(node: Any, where: str = "mappings") -> list[tuple[str, str]]:
    """Strings that look like numbers. PyYAML reads 1.0e9 as text (it wants 1.0e+9)."""
    if isinstance(node, dict):
        return [hit for k, v in node.items() for hit in numbers_as_text(v, f"{where}.{k}")]
    if isinstance(node, list):
        return [hit for i, v in enumerate(node) for hit in numbers_as_text(v, f"{where}[{i}]")]
    if isinstance(node, str) and NUMBER_LIKE.fullmatch(node):
        return [(where, node)]
    return []


def table_errors(m: dict[str, Any], table: Table) -> list[str]:
    """Codes in the mappings that the table does not have."""
    errors = []
    listed = [e for members in m["country_groups"].values() for e in members]
    errors += [f"economy {e} is not in the table" for e in listed if e not in table.economies]
    products = {p for cat in m["categories"].values() for p in cat["products"]}
    products |= {d["code"] for d in m["demand"].values() if d["kind"] == "industry"}
    products |= {i for industries in m["industry_groups"].values() for i in industries}
    products |= {i for s in m["satellites"].values() for i in s.get("aliases", {})}
    errors += [f"industry {p} is not in the table" for p in sorted(products) if p not in table.industries]
    uses = {d["code"] for d in m["demand"].values() if d["kind"] == "final_use"}
    errors += [f"final use {u} is not in the table" for u in sorted(uses) if u not in table.final_uses]
    return errors


def group_of(m: dict[str, Any], economy: str) -> str:
    for group, members in m["country_groups"].items():
        if economy in members:
            return group
    return "ROW"
