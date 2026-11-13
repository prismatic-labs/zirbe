"""Fetch the raw data listed in engine/sources.yaml into data/raw/ and record it in MANIFEST.json."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Callable, Iterable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol

import requests
import yaml

from engine.schemas import ROOT

SOURCES_FILE = ROOT / "engine" / "sources.yaml"
RAW_DIR = ROOT / "data" / "raw"
USER_AGENT = "zirbe-engine (Prismatic Labs research)"


class ManualStep(Exception):
    """A source needs a file to be fetched by hand."""

    def __init__(self, source_id: str, instructions: str, path: Path) -> None:
        super().__init__(f"{source_id}: {instructions} Save it at {path}")
        self.source_id = source_id
        self.instructions = instructions
        self.path = path


class Http(Protocol):
    def get_json(self, url: str, params: Any = None) -> Any: ...
    def download(self, url: str, dest: Path) -> None: ...


class RequestsHttp:
    def __init__(self, timeout_seconds: float) -> None:
        self.timeout = timeout_seconds
        self.session = requests.Session()
        self.session.headers["User-Agent"] = USER_AGENT

    def get_json(self, url: str, params: Any = None) -> Any:
        response = self.session.get(url, params=params, timeout=self.timeout)
        response.raise_for_status()
        return response.json()

    def download(self, url: str, dest: Path) -> None:
        part = dest.with_name(dest.name + ".part")
        with self.session.get(url, stream=True, timeout=self.timeout) as response:
            response.raise_for_status()
            with part.open("wb") as out:
                for chunk in response.iter_content(chunk_size=None):
                    out.write(chunk)
        part.replace(dest)


def load_sources(path: Path = SOURCES_FILE) -> dict[str, Any]:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def write_json(path: Path, doc: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(doc, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    path.write_text(text + "\n", encoding="utf-8")


def sha256(path: Path) -> str:
    with path.open("rb") as f:
        return hashlib.file_digest(f, "sha256").hexdigest()


# Fetchers: each writes its file under dest_dir and returns the URLs it used
# plus anything the remote says about its own version.

def fetch_file(source: dict[str, Any], dest_dir: Path, http: Http, cfg: dict[str, Any]) -> dict[str, Any]:
    spec = source["fetch"]
    if not spec.get("url"):
        raise ManualStep(source["id"], spec["instructions"], dest_dir / spec["file"])
    http.download(spec["url"], dest_dir / spec["file"])
    return {"urls": [spec["url"]]}


def fetch_dbnomics(source: dict[str, Any], dest_dir: Path, http: Http, cfg: dict[str, Any]) -> dict[str, Any]:
    spec = source["fetch"]
    series_url = f"{cfg['dbnomics_api']}/series/{spec['dataset']}"
    dataset_url = f"{cfg['dbnomics_api']}/datasets/{spec['dataset']}"
    params = {
        "dimensions": json.dumps(spec["dimensions"], sort_keys=True),
        "observations": "1",
        "limit": cfg["dbnomics_page_size"],
    }
    docs: list[dict[str, Any]] = []
    while True:
        page = http.get_json(series_url, {**params, "offset": len(docs)})["series"]
        docs.extend(page["docs"])
        if not page["docs"] or len(docs) >= page["num_found"]:
            break
    meta = http.get_json(dataset_url)["datasets"]["docs"][0]
    docs.sort(key=lambda d: d["series_code"])
    write_json(dest_dir / spec["file"], {"dataset": meta, "series": docs})
    return {"urls": [series_url, dataset_url], "remote_updated": meta.get("indexed_at")}


def fetch_eurostat(source: dict[str, Any], dest_dir: Path, http: Http, cfg: dict[str, Any]) -> dict[str, Any]:
    spec = source["fetch"]
    url = f"{cfg['eurostat_api']}/{spec['dataset']}"
    params = [(key, value) for key, values in spec["params"].items() for value in values]
    doc = http.get_json(url, params)
    write_json(dest_dir / spec["file"], doc)
    return {"urls": [url], "remote_updated": doc.get("updated")}


def fetch_manual(source: dict[str, Any], dest_dir: Path, http: Http, cfg: dict[str, Any]) -> dict[str, Any]:
    spec = source["fetch"]
    path = dest_dir / spec["file"]
    if not path.is_file():
        raise ManualStep(source["id"], spec["instructions"], path)
    return {"urls": [source["page"]], "manual": True}


FETCHERS: dict[str, Callable[[dict[str, Any], Path, Http, dict[str, Any]], dict[str, Any]]] = {
    "file": fetch_file,
    "dbnomics": fetch_dbnomics,
    "eurostat": fetch_eurostat,
    "manual": fetch_manual,
}


def file_record(path: Path, raw_dir: Path) -> dict[str, Any]:
    return {"path": path.relative_to(raw_dir).as_posix(), "sha256": sha256(path), "bytes": path.stat().st_size}


def is_current(entry: dict[str, Any] | None, raw_dir: Path) -> bool:
    """True when every file the manifest lists is on disk with the recorded checksum."""
    if not entry:
        return False
    return all(
        (raw_dir / f["path"]).is_file() and sha256(raw_dir / f["path"]) == f["sha256"]
        for f in entry["files"]
    )


def manifest_entry(source: dict[str, Any], fetched: dict[str, Any], path: Path, raw_dir: Path, now: datetime) -> dict[str, Any]:
    when = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc) if fetched.get("manual") else now
    return {
        "id": source["id"],
        "name": source["name"],
        "publisher": source["publisher"],
        "edition": source["edition"],
        "license": source["license"],
        "page": source["page"],
        "urls": fetched["urls"],
        "remote_updated": fetched.get("remote_updated"),
        "downloaded_at": when.replace(microsecond=0).isoformat(),
        "files": [file_record(path, raw_dir)],
    }


def read_manifest(raw_dir: Path) -> dict[str, dict[str, Any]]:
    path = raw_dir / "MANIFEST.json"
    if not path.is_file():
        return {}
    return {e["id"]: e for e in json.loads(path.read_text(encoding="utf-8"))["sources"]}


def write_manifest(raw_dir: Path, entries: dict[str, dict[str, Any]]) -> None:
    doc = {"sources": [entries[k] for k in sorted(entries)]}
    (raw_dir / "MANIFEST.json").write_text(json.dumps(doc, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def raw_file(source_id: str, config: dict[str, Any] | None = None, raw_dir: Path = RAW_DIR) -> Path:
    """Where a source's file lives in data/raw/; fails if it is not there yet."""
    config = config or load_sources()
    source = next((s for s in config["sources"] if s["id"] == source_id), None)
    if source is None:
        raise KeyError(f"{source_id} is not in engine/sources.yaml")
    path = raw_dir / source_id / source["fetch"]["file"]
    if not path.is_file():
        raise FileNotFoundError(f"{path} is missing; run `python -m engine download`")
    return path


def download_all(
    config: dict[str, Any],
    http: Http,
    raw_dir: Path = RAW_DIR,
    now: datetime | None = None,
    only: Iterable[str] | None = None,
    force: bool = False,
) -> list[ManualStep]:
    """Fetch every source not already current. Returns the manual steps still pending."""
    now = now or datetime.now(timezone.utc)
    wanted = set(only) if only else None
    entries = read_manifest(raw_dir)
    pending: list[ManualStep] = []
    for source in config["sources"]:
        sid = source["id"]
        if wanted is not None and sid not in wanted:
            continue
        if not force and is_current(entries.get(sid), raw_dir):
            continue
        dest_dir = raw_dir / sid
        dest_dir.mkdir(parents=True, exist_ok=True)
        try:
            fetched = FETCHERS[source["fetch"]["kind"]](source, dest_dir, http, config["http"])
        except ManualStep as step:
            pending.append(step)
            continue
        entries[sid] = manifest_entry(source, fetched, dest_dir / source["fetch"]["file"], raw_dir, now)
        write_manifest(raw_dir, entries)
    listed = {s["id"] for s in config["sources"]}
    if wanted is None and set(entries) - listed:
        # A source taken out of sources.yaml leaves the manifest too.
        write_manifest(raw_dir, {k: v for k, v in entries.items() if k in listed})
    return pending
