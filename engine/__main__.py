"""Command line: `python -m engine build | download | shares | validate`."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from engine import fingerprints, lifecycle, pipeline, schemas, shares, sources_doc
from engine import download as dl


def download(only: list[str] | None = None, force: bool = False) -> int:
    config = dl.load_sources()
    http = dl.RequestsHttp(config["http"]["timeout_seconds"])
    pending = dl.download_all(config, http, only=only, force=force)
    for step in pending:
        print(f"Manual step needed for {step.source_id}:\n  {step.instructions}\n  Save it at {step.path}", file=sys.stderr)
    present = len(dl.read_manifest(dl.RAW_DIR))
    print(f"{present} source(s) in {dl.RAW_DIR / 'MANIFEST.json'}; {len(pending)} manual step(s) pending.")
    return 1 if pending else 0


def _load() -> pipeline.Inputs | None:
    try:
        inp = pipeline.load_inputs()
    except pipeline.InputError as err:
        print(err, file=sys.stderr)
        return None
    t = inp.table
    print(f"Economic structure: {t.year} ({len(t.economies)} economies x {len(t.industries)} industries)")
    return inp


def _tiva_ok(inp: pipeline.Inputs) -> bool:
    results = pipeline.tiva_results(inp)
    for r in results:
        verdict = "ok" if r.ok else f"FAILS (limit {r.tolerance} points)"
        print(f"TiVA check {r.economy} {r.year}: engine {r.engine:.2f}%, TiVA {r.tiva:.2f}%, gap {r.gap:+.2f} points, {verdict}")
    return all(r.ok for r in results)


def build() -> int:
    """Fetch what is missing, run every check, and write the four files to data/out/."""
    if download() != 0 or (inp := _load()) is None:
        return 1
    tiva_ok = _tiva_ok(inp)
    docs, errors = pipeline.build_outputs(inp)
    for line in errors:
        print(line, file=sys.stderr)
    if errors or not tiva_ok:
        return 1
    for file_name, name in schemas.OUTPUT_FILES.items():
        pipeline.write_json(schemas.OUT_DIR / file_name, docs[name])
    sources_path = schemas.ROOT / "docs" / "SOURCES.md"
    sources_path.parent.mkdir(parents=True, exist_ok=True)
    sources_path.write_text(sources_doc.render(docs["meta"], docs["assumptions"]), encoding="utf-8")
    print(f"\nWrote {', '.join(schemas.OUTPUT_FILES)} to {schemas.OUT_DIR.relative_to(schemas.ROOT)}/, and docs/SOURCES.md.")
    print(f"\nPer euro at {inp.m['prices']['year']} prices, default domestic shares:")
    print("\n".join(fingerprints.summary_lines(docs["fingerprints"])))
    print("\nHeadline, cents of value added at home per euro spent so far (low to high scenario):")
    va = lifecycle.va_home_per_euro(docs["fingerprints"], inp.m)
    print("\n".join(lifecycle.summary_lines(docs["lifecycle"], va, inp.m)))
    return 0


def shares_command(top: int) -> int:
    """Read the table, run the TiVA check and print the default domestic shares."""
    if (inp := _load()) is None:
        return 1
    tiva_ok = _tiva_ok(inp)
    print()
    print("\n".join(shares.report_lines(inp.table, inp.m, inp.demands, top)))
    return 0 if tiva_ok else 1


def validate(directory: Path) -> int:
    errors = schemas.validate_dir(directory)
    for line in errors:
        print(line, file=sys.stderr)
    if errors:
        print(f"{len(errors)} problem(s) in {directory}", file=sys.stderr)
        return 1
    print(f"All {len(schemas.OUTPUT_FILES)} files in {directory} match the schemas.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m engine", description="Zirbe engine")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("build", help="fetch missing raw data, then build data/out/")
    fetch = commands.add_parser("download", help="fetch raw data into data/raw/ (the only command that uses the network)")
    fetch.add_argument("--only", nargs="+", metavar="SOURCE_ID", help="fetch just these sources")
    fetch.add_argument("--force", action="store_true", help="fetch again even if the files are current")
    report = commands.add_parser("shares", help="run the TiVA check and print each category's default domestic share")
    report.add_argument("--top", type=int, default=5, help="import origins to list per category")
    check = commands.add_parser("validate", help="check output files against schema/")
    check.add_argument("directory", nargs="?", type=Path, default=schemas.OUT_DIR)
    args = parser.parse_args(argv)
    if args.command == "build":
        return build()
    if args.command == "download":
        return download(args.only, args.force)
    if args.command == "shares":
        return shares_command(args.top)
    return validate(args.directory)


if __name__ == "__main__":
    sys.exit(main())
