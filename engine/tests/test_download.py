"""Download logic, run against a fake HTTP client. No network."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pytest

from engine import download as dl

NOW = datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone.utc)
HTTP_CFG = {
    "timeout_seconds": 1,
    "dbnomics_api": "https://dbn.test/v22",
    "dbnomics_page_size": 2,
    "eurostat_api": "https://es.test/data",
}


class FakeHttp:
    def __init__(self, json_by_url: dict[str, Any] | None = None, file_bytes: bytes = b"zip") -> None:
        self.json_by_url = json_by_url or {}
        self.file_bytes = file_bytes
        self.calls: list[tuple[str, Any]] = []

    def get_json(self, url: str, params: Any = None) -> Any:
        self.calls.append((url, params))
        answer = self.json_by_url[url]
        return answer(params) if callable(answer) else answer

    def download(self, url: str, dest: Path) -> None:
        self.calls.append((url, None))
        dest.write_bytes(self.file_bytes)


def source(sid: str, fetch: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": sid, "name": sid, "publisher": "Test", "edition": "e1",
        "license": "CC BY 4.0", "page": f"https://page.test/{sid}", "fetch": fetch,
    }


def config(*sources: dict[str, Any]) -> dict[str, Any]:
    return {"http": HTTP_CFG, "sources": list(sources)}


def dbnomics_pages(params: Any) -> dict[str, Any]:
    all_docs = [{"series_code": c} for c in ("C", "A", "B")]
    offset, limit = params["offset"], params["limit"]
    return {"series": {"num_found": len(all_docs), "docs": all_docs[offset : offset + limit]}}


DBN = source("dbn", {"kind": "dbnomics", "dataset": "OECD/X", "dimensions": {"M": ["P"]}, "file": "series.json"})
DBN_URLS = {
    "https://dbn.test/v22/series/OECD/X": dbnomics_pages,
    "https://dbn.test/v22/datasets/OECD/X": {"datasets": {"docs": [{"code": "X", "indexed_at": "2026-01-01"}]}},
}


def test_dbnomics_pages_are_joined_and_sorted(tmp_path: Path) -> None:
    http = FakeHttp(DBN_URLS)
    assert dl.download_all(config(DBN), http, tmp_path, NOW) == []
    doc = json.loads((tmp_path / "dbn" / "series.json").read_text())
    assert [d["series_code"] for d in doc["series"]] == ["A", "B", "C"]
    assert doc["dataset"]["code"] == "X"
    offsets = [p["offset"] for url, p in http.calls if url.endswith("/series/OECD/X")]
    assert offsets == [0, 2]


def test_eurostat_repeats_each_parameter(tmp_path: Path) -> None:
    src = source("es", {"kind": "eurostat", "dataset": "t1", "params": {"geo": ["AT", "CH"], "unit": ["U"]}, "file": "t1.json"})
    http = FakeHttp({"https://es.test/data/t1": {"updated": "2026-01-01T00:00:00", "value": {}}})
    dl.download_all(config(src), http, tmp_path, NOW)
    assert http.calls == [("https://es.test/data/t1", [("geo", "AT"), ("geo", "CH"), ("unit", "U")])]
    entry = dl.read_manifest(tmp_path)["es"]
    assert entry["remote_updated"] == "2026-01-01T00:00:00"


ZIP = source("z", {"kind": "file", "url": "https://files.test/z.zip", "file": "z.zip", "instructions": "x"})


def test_raw_file_finds_present_files_only(tmp_path: Path) -> None:
    cfg = config(ZIP)
    with pytest.raises(FileNotFoundError, match="run `python -m engine download`"):
        dl.raw_file("z", cfg, tmp_path)
    (tmp_path / "z").mkdir()
    (tmp_path / "z" / "z.zip").write_bytes(b"zip")
    assert dl.raw_file("z", cfg, tmp_path) == tmp_path / "z" / "z.zip"
    with pytest.raises(KeyError, match="nope"):
        dl.raw_file("nope", cfg, tmp_path)


def test_a_source_taken_out_of_the_config_leaves_the_manifest(tmp_path: Path) -> None:
    dl.download_all(config(ZIP, DBN), FakeHttp(DBN_URLS), tmp_path, NOW)
    assert set(dl.read_manifest(tmp_path)) == {"z", "dbn"}
    dl.download_all(config(DBN), FakeHttp(DBN_URLS), tmp_path, NOW, only=["dbn"])
    assert set(dl.read_manifest(tmp_path)) == {"z", "dbn"}  # a partial run keeps it
    dl.download_all(config(DBN), FakeHttp(DBN_URLS), tmp_path, NOW)
    assert set(dl.read_manifest(tmp_path)) == {"dbn"}


def test_manifest_records_checksum_size_date_and_urls(tmp_path: Path) -> None:
    src = source("f", {"kind": "file", "url": "https://files.test/a.zip", "file": "a.zip", "instructions": "x"})
    dl.download_all(config(src), FakeHttp(file_bytes=b"abc"), tmp_path, NOW)
    entry = dl.read_manifest(tmp_path)["f"]
    assert entry["files"] == [{
        "path": "f/a.zip",
        "sha256": "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
        "bytes": 3,
    }]
    assert entry["downloaded_at"] == "2026-01-02T03:04:05+00:00"
    assert entry["urls"] == ["https://files.test/a.zip"]
    assert {"name", "publisher", "edition", "license", "page"} <= set(entry)


def test_current_files_are_not_fetched_again(tmp_path: Path) -> None:
    dl.download_all(config(DBN), FakeHttp(DBN_URLS), tmp_path, NOW)
    second = FakeHttp(DBN_URLS)
    dl.download_all(config(DBN), second, tmp_path, NOW)
    assert second.calls == []


def test_changed_file_or_force_fetches_again(tmp_path: Path) -> None:
    dl.download_all(config(DBN), FakeHttp(DBN_URLS), tmp_path, NOW)
    (tmp_path / "dbn" / "series.json").write_text("tampered")
    again = FakeHttp(DBN_URLS)
    dl.download_all(config(DBN), again, tmp_path, NOW)
    assert again.calls
    forced = FakeHttp(DBN_URLS)
    dl.download_all(config(DBN), forced, tmp_path, NOW, force=True)
    assert forced.calls


def test_file_without_url_is_a_manual_step(tmp_path: Path) -> None:
    src = source("icio", {"kind": "file", "url": None, "file": "t.zip", "instructions": "Copy the link."})
    pending = dl.download_all(config(src), FakeHttp(), tmp_path, NOW)
    assert [(p.source_id, p.path) for p in pending] == [("icio", tmp_path / "icio" / "t.zip")]
    assert dl.read_manifest(tmp_path) == {}


def test_manual_file_is_recorded_once_present(tmp_path: Path) -> None:
    src = source("tiva", {"kind": "manual", "file": "x.csv", "instructions": "Download it."})
    assert len(dl.download_all(config(src), FakeHttp(), tmp_path, NOW)) == 1
    (tmp_path / "tiva" / "x.csv").write_text("a,b\n")
    assert dl.download_all(config(src), FakeHttp(), tmp_path, NOW) == []
    entry = dl.read_manifest(tmp_path)["tiva"]
    assert entry["urls"] == ["https://page.test/tiva"]
    assert entry["files"][0]["path"] == "tiva/x.csv"


def test_only_limits_the_sources(tmp_path: Path) -> None:
    other = source("other", {"kind": "manual", "file": "o.csv", "instructions": "x"})
    pending = dl.download_all(config(DBN, other), FakeHttp(DBN_URLS), tmp_path, NOW, only=["dbn"])
    assert pending == []
    assert set(dl.read_manifest(tmp_path)) == {"dbn"}


def test_sources_file_is_complete() -> None:
    cfg = dl.load_sources()
    assert set(HTTP_CFG) == set(cfg["http"])
    ids = [s["id"] for s in cfg["sources"]]
    assert len(ids) == len(set(ids))
    for s in cfg["sources"]:
        assert re.fullmatch(r"[a-z][a-z0-9_]*", s["id"]), s["id"]
        assert {"name", "publisher", "edition", "license", "page", "fetch"} <= set(s), s["id"]
        assert s["fetch"]["kind"] in dl.FETCHERS, s["id"]
        assert s["fetch"]["file"], s["id"]
        if s["fetch"]["kind"] in {"manual", "file"}:
            assert s["fetch"]["instructions"], s["id"]
