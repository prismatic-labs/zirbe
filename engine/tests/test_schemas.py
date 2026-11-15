"""The schemas accept the smallest valid documents and reject each kind of break."""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

import pytest
from jsonschema import Draft202012Validator

from engine import schemas
from engine.__main__ import main
from engine.tests import factories as f

NAMES = list(f.DOCUMENTS)


@pytest.mark.parametrize("name", NAMES)
def test_schema_is_valid_draft_2020_12(name: str) -> None:
    Draft202012Validator.check_schema(schemas.load_schema(name))


def test_shared_definitions_agree_across_files() -> None:
    seen: dict[str, tuple[str, Any]] = {}
    for name in NAMES:
        for def_name, body in schemas.load_schema(name).get("$defs", {}).items():
            if def_name in seen:
                first, first_body = seen[def_name]
                assert body == first_body, f"$defs/{def_name} differs: {first} vs {name}"
            else:
                seen[def_name] = (name, body)


@pytest.mark.parametrize("name", NAMES)
def test_smallest_valid_document_passes(name: str) -> None:
    assert schemas.contract_errors(name, f.DOCUMENTS[name]()) == []


Mutation = Callable[[Any], None]


def _set(path: list[Any], value: Any) -> Mutation:
    def apply(doc: Any) -> None:
        for key in path[:-1]:
            doc = doc[key]
        doc[path[-1]] = value
    return apply


def _drop(path: list[Any]) -> Mutation:
    def apply(doc: Any) -> None:
        for key in path[:-1]:
            doc = doc[key]
        del doc[path[-1]]
    return apply


def _append(path: list[Any], value: Any) -> Mutation:
    def apply(doc: Any) -> None:
        for key in path:
            doc = doc[key]
        doc.append(value)
    return apply


FP = ["AT", "it_hardware", "domestic"]
SCHED = ["vienna", "ai", "central"]

BREAKS: list[tuple[str, str, Mutation]] = [
    # meta
    ("meta", "fixture flag missing", _drop(["fixture"])),
    ("meta", "unknown field", _set(["extra"], 1)),
    ("meta", "prices not basic", _set(["table", "prices"], "purchasers")),
    ("meta", "fractional reference year", _set(["table", "reference_year"], 2022.5)),
    ("meta", "timestamp without zone", _set(["generated_at"], "2026-01-01T00:00:00")),
    ("meta", "timestamp not a date", _set(["generated_at"], "yesterday")),
    ("meta", "exchange rate zero", _set(["fx_eur_chf", "value"], 0)),
    ("meta", "tiers out of order", _set(["tiers"], ["0", "1", "2", "4+", "3"])),
    ("meta", "Taiwan folded away", _drop(["country_groups", 9])),
    ("meta", "country groups out of order", _set(["country_groups", 0, "id"], "CH")),
    ("meta", "extra country group", _append(["country_groups"], {"id": "ROW", "label": "x"})),
    ("meta", "industry group renamed", _set(["industry_groups", 8, "id"], "it")),
    ("meta", "slider on construction", _set(["categories", 0, "has_slider"], True)),
    ("meta", "no slider on it_hardware", _set(["categories", 3, "has_slider"], False)),
    ("meta", "unknown phase", _set(["categories", 0, "phase"], "both")),
    ("meta", "staff category missing", _drop(["categories", 8])),
    ("meta", "Vienna in Switzerland", _set(["sites", 0, "country"], "CH")),
    ("meta", "Zurich priced in EUR", _set(["sites", 3, "currency"], "EUR")),
    ("meta", "latitude out of range", _set(["sites", 0, "lat"], 91)),
    ("meta", "site without sources", _set(["sites", 0, "source_ids"], [])),
    ("meta", "badly formed source id", _set(["sites", 0, "source_ids"], ["Has Spaces"])),
    ("meta", "table without source", _drop(["table", "source_id"])),
    ("meta", "table source not a dataset", _set(["table", "source_id"], "other_table")),
    ("meta", "datasets missing", _drop(["datasets"])),
    ("meta", "datasets empty", _set(["datasets"], [])),
    ("meta", "dataset without publisher", _drop(["datasets", 0, "publisher"])),
    ("meta", "dataset url not a link", _set(["datasets", 0, "url"], "oecd.org")),
    ("meta", "dataset date with time", _set(["datasets", 0, "accessed"], "2026-01-01T00:00:00Z")),
    ("meta", "dataset date impossible", _set(["datasets", 0, "accessed"], "2026-02-30")),
    ("meta", "dataset date compact", _set(["datasets", 0, "accessed"], "20260101")),
    ("meta", "duplicate dataset", _append(["datasets"], f.meta()["datasets"][0])),
    # fingerprints
    ("fingerprints", "staff fingerprint present", _set(["AT", "staff"], f.category_fingerprints())),
    ("fingerprints", "electricity missing", _drop(["CH", "electricity"])),
    ("fingerprints", "third purchaser", _set(["DE"], {})),
    ("fingerprints", "domestic share above 1", _set(["AT", "cooling", "default_domestic_share"], 1.2)),
    ("fingerprints", "domestic share below 0", _set(["AT", "cooling", "default_domestic_share"], -0.1)),
    ("fingerprints", "unknown country group", _set(FP + ["va", "XX"], 0.1)),
    ("fingerprints", "only four tiers", _drop(FP + ["tiers", 4])),
    ("fingerprints", "six tiers", _append(FP + ["tiers"], f.tier("4+"))),
    ("fingerprints", "tiers out of order", _set(FP + ["tiers", 1, "tier"], "2")),
    ("fingerprints", "tier 4+ with output", _set(FP + ["tiers", 4, "output"], {"AT": 0.0})),
    ("fingerprints", "tier 4+ with purchases", _set(FP + ["tiers", 4, "purchases"], {})),
    ("fingerprints", "tier 2 without purchases", _drop(FP + ["tiers", 2, "purchases"])),
    ("fingerprints", "tier 0 without output", _drop(FP + ["tiers", 0, "output"])),
    ("fingerprints", "negative output", _set(FP + ["tiers", 0, "output", "AT"], -0.1)),
    ("fingerprints", "negative purchase", _set(FP + ["tiers", 0, "purchases", "AT", "AT"], -0.1)),
    ("fingerprints", "unknown seller", _set(FP + ["tiers", 0, "purchases", "AT", "XX"], 0.1)),
    ("fingerprints", "negative carbon", _set(FP + ["co2e_kg", "AT"], -0.1)),
    ("fingerprints", "low share above the default", _set(["AT", "it_hardware", "domestic_share_low"], 0.5)),
    ("fingerprints", "high share below the default", _set(["CH", "cooling", "default_domestic_share"], 0.5)),
    ("fingerprints", "negative jobs", _set(FP + ["jobs_domestic_per_meur"], -1)),
    ("fingerprints", "industry group missing", _drop(FP + ["va_domestic_by_industry", "it_services"])),
    ("fingerprints", "unknown industry group", _set(FP + ["va_domestic_by_industry", "x"], 0.0)),
    ("fingerprints", "no sources", _set(["AT", "cooling", "source_ids"], [])),
    ("fingerprints", "duplicate sources", _set(["AT", "cooling", "source_ids"], ["table", "table"])),
    # lifecycle
    ("lifecycle", "site missing", _drop(["lugano"])),
    ("lifecycle", "unknown site", _set(["basel"], {})),
    ("lifecycle", "archetype missing", _drop(["vienna", "cloud"])),
    ("lifecycle", "scenario missing", _drop(["vienna", "ai", "high_impact"])),
    ("lifecycle", "staff spend missing", _drop(SCHED + ["spend", "staff"])),
    ("lifecycle", "unknown spend category", _set(SCHED + ["spend", "land"], f.series())),
    ("lifecycle", "series of 19", _drop(SCHED + ["electricity_mwh", 19])),
    ("lifecycle", "series of 21", _append(SCHED + ["staff_jobs"], 0.0)),
    ("lifecycle", "negative spend", _set(SCHED + ["spend", "construction", 0], -1.0)),
    ("lifecycle", "cross-border share above 1", _set(SCHED + ["cross_border_payroll_share"], 1.5)),
    ("lifecycle", "negative grid factor", _set(SCHED + ["grid_kgco2e_per_mwh"], -1.0)),
    ("lifecycle", "milestone after year 20", _set(SCHED + ["milestones", 0, "year"], 21)),
    ("lifecycle", "milestone year 0", _set(SCHED + ["milestones", 0, "year"], 0)),
    ("lifecycle", "decommissioning milestone", _set(SCHED + ["milestones", 0, "key"], "decommission")),
    ("lifecycle", "schedule without sources", _set(SCHED + ["source_ids"], [])),
    ("lifecycle", "heat pump spend missing", _drop(SCHED + ["heat_pump_spend"])),
    ("lifecycle", "heat pump spend of 19", _drop(SCHED + ["heat_pump_spend", 0])),
    ("lifecycle", "negative heat pump spend", _set(SCHED + ["heat_pump_spend", 5], -1.0)),
    ("lifecycle", "variant with an unknown field", _set(SCHED + ["variants"], {f.ASSUMPTION_ID: {"low": {"jobs": 1.0}, "high": {}}})),
    ("lifecycle", "variant without a high end", _set(SCHED + ["variants"], {f.ASSUMPTION_ID: {"low": {}}})),
    ("lifecycle", "variant with an empty spend", _set(SCHED + ["variants"], {f.ASSUMPTION_ID: {"low": {"spend": {}}, "high": {}}})),
    ("lifecycle", "variant spend series of 19", _set(SCHED + ["variants"], {f.ASSUMPTION_ID: {"low": {"spend": {"staff": f.series()[1:]}}, "high": {}}})),
    ("lifecycle", "variant share above 1", _set(SCHED + ["variants"], {f.ASSUMPTION_ID: {"low": {}, "high": {"domestic_share": {"it_hardware": 1.5}}}})),
    ("lifecycle", "variants outside the central schedule", _set(["vienna", "ai", "low_impact", "variants"], {})),
    # assumptions
    ("assumptions", "empty list", lambda doc: doc.clear()),
    ("assumptions", "low missing", _drop([0, "low"])),
    ("assumptions", "unknown status", _set([0, "status"], "final")),
    ("assumptions", "unknown direction", _set([0, "direction"], "up")),
    ("assumptions", "url not a link", _set([0, "url"], "see report")),
    ("assumptions", "field outside the contract", _set([0, "date"], "2026-11-10")),
    ("assumptions", "low above central", _set([0, "low"], 5.0)),
    ("assumptions", "duplicate id", _append([], f.assumption())),
    ("assumptions", "no date read", _drop([0, "source_accessed"])),
    ("assumptions", "date read not a date", _set([0, "source_accessed"], "last week")),
    ("assumptions", "published as free text", _set([0, "source_published"], "spring 2025")),
    ("assumptions", "published after read (year)", _set([0, "source_published"], "2027")),
    ("assumptions", "published after read (month)", _set([0, "source_published"], "2026-02")),
    ("assumptions", "published after read (day)", _set([0, "source_published"], "2026-01-02")),
]


@pytest.mark.parametrize("published", ["2025", "2026", "2026-01", "2026-01-01"])
def test_published_on_or_before_read_passes(published: str) -> None:
    doc = f.assumptions()
    doc[0]["source_published"] = published
    assert schemas.contract_errors("assumptions", doc) == []


def _all_docs() -> dict[str, Any]:
    return {name: factory() for name, factory in f.DOCUMENTS.items()}


def test_cross_file_sources_resolve() -> None:
    assert schemas.validate_docs(_all_docs()) == []


def test_a_variant_that_matches_the_fingerprints_passes() -> None:
    docs = _all_docs()
    docs["lifecycle"]["vienna"]["ai"]["central"]["variants"] = {
        f.ASSUMPTION_ID: {"low": {"domestic_share": {"it_hardware": 0.0}}, "high": {"spend": {"staff": f.series()}}},
    }
    assert schemas.validate_docs(docs) == []


@pytest.mark.parametrize(
    ("label", "mutate"),
    [
        ("site cites nothing known", lambda d: d["meta"]["sites"][2].update(source_ids=["capex.missing"])),
        ("exchange rate cites nothing known", lambda d: d["meta"]["fx_eur_chf"].update(source_id="fx.missing")),
        ("fingerprint cites nothing known", lambda d: d["fingerprints"]["CH"]["cooling"].update(source_ids=["teco2"])),
        ("schedule cites nothing known", lambda d: d["lifecycle"]["linz"]["cloud"]["low_impact"].update(source_ids=["pue.linz"])),
        ("dataset id reused as assumption", lambda d: d["assumptions"].append(f.assumption(f.DATASET_ID))),
        ("variant cites nothing known", lambda d: d["lifecycle"]["vienna"]["ai"]["central"].update(
            variants={"pue.missing": {"low": {}, "high": {}}})),
        ("variant share differs from the fingerprints", lambda d: d["lifecycle"]["vienna"]["ai"]["central"].update(
            variants={f.ASSUMPTION_ID: {"low": {}, "high": {"domestic_share": {"it_hardware": 0.5}}}})),
    ],
)
def test_cross_file_rejects(label: str, mutate: Callable[[dict[str, Any]], None]) -> None:
    docs = _all_docs()
    mutate(docs)
    assert schemas.validate_docs(docs), label


@pytest.mark.parametrize(("name", "label", "mutate"), BREAKS, ids=[f"{n}: {d}" for n, d, _ in BREAKS])
def test_schema_rejects(name: str, label: str, mutate: Mutation) -> None:
    doc = f.DOCUMENTS[name]()
    mutate(doc)
    assert schemas.contract_errors(name, doc), f"{name} accepted: {label}"


def _write_all(directory: Any) -> None:
    for file_name, name in schemas.OUTPUT_FILES.items():
        (directory / file_name).write_text(json.dumps(f.DOCUMENTS[name]()), encoding="utf-8")


def test_validate_command_passes_good_files(tmp_path: Any) -> None:
    _write_all(tmp_path)
    assert main(["validate", str(tmp_path)]) == 0


def test_validate_command_reports_missing_file(tmp_path: Any) -> None:
    _write_all(tmp_path)
    (tmp_path / "lifecycle.json").unlink()
    errors = schemas.validate_dir(tmp_path)
    assert errors == [f"lifecycle: missing {tmp_path / 'lifecycle.json'}"]
    assert main(["validate", str(tmp_path)]) == 1
