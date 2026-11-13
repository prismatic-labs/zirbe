"""docs/SOURCES.md, written from meta.json and the assumptions so it always matches the data.

The method page renders a small subset of Markdown: headings, bullets, links, bold, and one
paragraph per line. Everything here stays inside that subset.
"""

from __future__ import annotations

from typing import Any

SHARE_UNIT_PREFIX = "share"
SHARE_RANGE_SUFFIX = " (0 to 1)"
PERCENT = 100


def _number(value: float) -> str:
    """Thousands separators, no trailing zeros."""
    if float(value).is_integer():
        return f"{int(value):,}"
    return f"{value:,.4f}".rstrip("0").rstrip(".")


def values_line(item: dict[str, Any]) -> str:
    """'Low 20%, central 30%, high 40% (share of facility cost).' or the same with the unit."""
    unit = str(item["unit"])
    if unit.startswith(SHARE_UNIT_PREFIX):
        shown = [f"{_number(round(item[end] * PERCENT, 4))}%" for end in ("low", "central", "high")]
        unit_note = unit.removesuffix(SHARE_RANGE_SUFFIX)
        return f"Low {shown[0]}, central {shown[1]}, high {shown[2]} ({unit_note})."
    shown = [_number(item[end]) for end in ("low", "central", "high")]
    return f"Low {shown[0]}, central {shown[1]}, high {shown[2]}, in {unit}."


def source_line(item: dict[str, Any]) -> str:
    link = f" [Link]({item['url']})" if item.get("url") else ""
    return f"Source: {item['source']}. Read on {item['source_accessed']}.{link}"


def render(meta_doc: dict[str, Any], assumption_doc: list[dict[str, Any]]) -> str:
    table = meta_doc["table"]
    lines = [
        "## Data",
        "",
        f"Economic structure: {table['reference_year']}. Main table: {table['name']}, {table['edition']}, {table['prices']} prices.",
        "",
    ]
    for d in meta_doc["datasets"]:
        licence = d.get("license") or "not stated"
        lines.append(f"- **{d['name']}**. {d['publisher']}, {d['edition']}. Licence: {licence}. Read on {d['accessed']}. [Link]({d['url']})")
    lines += [
        "",
        "## Assumptions",
        "",
        "Each assumption has a low, a central and a high value. The page uses the central value. The stress test pushes every assumption to its low or high end at once.",
        "",
    ]
    for item in assumption_doc:
        lines += [f"### {item['label']}", "", values_line(item), "", source_line(item), ""]
        note = " ".join(str(item.get("note") or "").split())
        if note:
            lines += [note, ""]
    return "\n".join(lines).rstrip("\n") + "\n"
