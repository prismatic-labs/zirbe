"""Load assumptions/assumptions.yaml and check it against the contract."""

from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

import yaml

from engine import schemas
from engine.schemas import ROOT

ASSUMPTIONS_FILE = ROOT / "assumptions" / "assumptions.yaml"


def _dates_as_text(item: dict[str, Any]) -> dict[str, Any]:
    """YAML reads 2026-11-10 as a date; the contract wants the ISO string."""
    return {k: v.isoformat() if isinstance(v, date) else v for k, v in item.items()}


def load_assumptions(path: Path = ASSUMPTIONS_FILE) -> list[dict[str, Any]]:
    doc = [_dates_as_text(a) for a in yaml.safe_load(path.read_text(encoding="utf-8"))]
    errors = schemas.contract_errors("assumptions", doc)
    if errors:
        raise ValueError(f"{path.name}: " + "; ".join(errors))
    return doc


def by_id(doc: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {a["id"]: a for a in doc}
