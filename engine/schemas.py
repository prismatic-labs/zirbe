"""Load the JSON Schemas in schema/ and check the engine's output files against them."""

from __future__ import annotations

import json
import re
from collections.abc import Iterable, Iterator
from datetime import date, datetime
from functools import cache
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_DIR = ROOT / "schema"
OUT_DIR = ROOT / "data" / "out"

# Output file name -> schema name (schema/<name>.schema.json).
OUTPUT_FILES: dict[str, str] = {
    "meta.json": "meta",
    "fingerprints.json": "fingerprints",
    "lifecycle.json": "lifecycle",
    "assumptions.json": "assumptions",
}

# jsonschema only enforces these formats with extra packages installed,
# so they are checked here with the standard library.
FORMATS = FormatChecker(formats=())
CALENDAR_DATE = re.compile(r"\d{4}-\d{2}-\d{2}")


@FORMATS.checks("date-time", raises=ValueError)
def _is_datetime(value: object) -> bool:
    if not isinstance(value, str):
        return True
    return datetime.fromisoformat(value).tzinfo is not None


@FORMATS.checks("date", raises=ValueError)
def _is_date(value: object) -> bool:
    if not isinstance(value, str):
        return True
    return bool(CALENDAR_DATE.fullmatch(value)) and bool(date.fromisoformat(value))


@FORMATS.checks("uri")
def _is_uri(value: object) -> bool:
    if not isinstance(value, str):
        return True
    parts = urlparse(value)
    return parts.scheme in {"http", "https"} and bool(parts.netloc)


@cache
def load_schema(name: str) -> dict[str, Any]:
    path = SCHEMA_DIR / f"{name}.schema.json"
    return json.loads(path.read_text(encoding="utf-8"))


def validator(name: str) -> Draft202012Validator:
    return Draft202012Validator(load_schema(name), format_checker=FORMATS)


def schema_errors(name: str, doc: Any) -> list[str]:
    errors = validator(name).iter_errors(doc)
    return sorted(f"{name}: {e.json_path}: {e.message}" for e in errors)


def _duplicates(where: str, ids: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    errors = []
    for i in ids:
        if i in seen:
            errors.append(f"{where}: duplicate id {i!r}")
        seen.add(i)
    return errors


def _meta_errors(doc: dict[str, Any]) -> list[str]:
    dataset_ids = [d["id"] for d in doc["datasets"]]
    errors = _duplicates("meta.datasets", dataset_ids)
    if doc["table"]["source_id"] not in dataset_ids:
        errors.append(f"meta.table: source_id {doc['table']['source_id']!r} is not in datasets")
    return errors


def _assumption_errors(doc: list[dict[str, Any]]) -> list[str]:
    errors = _duplicates("assumptions", (a["id"] for a in doc))
    for item in doc:
        aid = item["id"]
        if not item["low"] <= item["central"] <= item["high"]:
            errors.append(f"assumptions: {aid!r} needs low <= central <= high")
        published = item.get("source_published")
        if published and published > item["source_accessed"][: len(published)]:
            errors.append(f"assumptions: {aid!r} was published after it was read")
    return errors


def _fingerprint_errors(doc: dict[str, Any]) -> list[str]:
    return [
        f"fingerprints.{purchaser}.{category}: needs domestic_share_low <= default_domestic_share <= domestic_share_high"
        for purchaser, categories in doc.items()
        for category, c in categories.items()
        if not c["domestic_share_low"] <= c["default_domestic_share"] <= c["domestic_share_high"]
    ]


def _lifecycle_errors(doc: dict[str, Any]) -> list[str]:
    return [
        f"lifecycle.{site}.{archetype}.{scenario}: only the central schedule lists variants"
        for site, archetypes in doc.items()
        for archetype, scenarios in archetypes.items()
        for scenario, schedule in scenarios.items()
        if scenario != "central" and "variants" in schedule
    ]


def contract_errors(name: str, doc: Any) -> list[str]:
    """Schema errors, then the single-file rules JSON Schema cannot express."""
    errors = schema_errors(name, doc)
    if errors:
        return errors
    if name == "meta":
        return _meta_errors(doc)
    if name == "assumptions":
        return _assumption_errors(doc)
    if name == "fingerprints":
        return _fingerprint_errors(doc)
    if name == "lifecycle":
        return _lifecycle_errors(doc)
    return []


def source_refs(name: str, doc: Any) -> Iterator[tuple[str, str]]:
    """Every (location, source_id) a document cites."""
    if name == "meta":
        yield "meta.fx_eur_chf", doc["fx_eur_chf"]["source_id"]
        for site in doc["sites"]:
            for sid in site["source_ids"]:
                yield f"meta.sites.{site['id']}", sid
    elif name == "fingerprints":
        for purchaser, categories in doc.items():
            for category, entry in categories.items():
                for sid in entry["source_ids"]:
                    yield f"fingerprints.{purchaser}.{category}", sid
    elif name == "lifecycle":
        for site, archetypes in doc.items():
            for archetype, scenarios in archetypes.items():
                for scenario, schedule in scenarios.items():
                    for sid in schedule["source_ids"]:
                        yield f"lifecycle.{site}.{archetype}.{scenario}", sid
                    for sid in schedule.get("variants", {}):
                        yield f"lifecycle.{site}.{archetype}.{scenario}.variants", sid


def _variant_share_errors(docs: dict[str, Any]) -> list[str]:
    """A variant's domestic share is the low or the high share the fingerprints carry for that category."""
    country = {site["id"]: site["country"] for site in docs["meta"]["sites"]}
    errors = []
    for site, archetypes in docs["lifecycle"].items():
        for archetype, scenarios in archetypes.items():
            for aid, ends in scenarios["central"].get("variants", {}).items():
                for end, changed in ends.items():
                    for category, share in changed.get("domestic_share", {}).items():
                        if share != docs["fingerprints"][country[site]][category][f"domestic_share_{end}"]:
                            errors.append(
                                f"lifecycle.{site}.{archetype}.central.variants.{aid}.{end}: "
                                f"{category} share differs from fingerprints domestic_share_{end}"
                            )
    return errors


def cross_file_errors(docs: dict[str, Any]) -> list[str]:
    """Every source_id resolves to a dataset or an assumption, and the two id sets never overlap."""
    datasets = {d["id"] for d in docs["meta"]["datasets"]}
    assumptions = {a["id"] for a in docs["assumptions"]}
    errors = [f"id {i!r} is both a dataset and an assumption" for i in sorted(datasets & assumptions)]
    known = datasets | assumptions
    for name, doc in docs.items():
        errors.extend(
            f"{where}: unknown source_id {sid!r}"
            for where, sid in source_refs(name, doc)
            if sid not in known
        )
    return errors + _variant_share_errors(docs)


def validate_docs(docs: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    for name, doc in docs.items():
        errors.extend(contract_errors(name, doc))
    if not errors and set(docs) == set(OUTPUT_FILES.values()):
        errors.extend(cross_file_errors(docs))
    return errors


def validate_dir(directory: Path) -> list[str]:
    errors: list[str] = []
    docs: dict[str, Any] = {}
    for file_name, name in OUTPUT_FILES.items():
        path = directory / file_name
        if not path.is_file():
            errors.append(f"{name}: missing {path}")
            continue
        docs[name] = json.loads(path.read_text(encoding="utf-8"))
    return errors + validate_docs(docs)
