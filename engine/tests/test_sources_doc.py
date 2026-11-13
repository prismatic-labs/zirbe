import json
import re

from engine import assumptions, schemas, sources_doc

BANNED = re.compile(r"\b(creat\w*|generat\w*|trac(e|es|ed|ing|k|ks|ked|king)|net benefit|net gain)\b", re.IGNORECASE)


def item(**over):
    base = {
        "id": "x", "label": "Something", "unit": "share of facility cost (0 to 1)",
        "low": 0.045, "central": 0.055, "high": 0.065,
        "source": "A report", "url": "https://example.org/r", "source_accessed": "2026-11-11", "note": "A note.",
    }
    return {**base, **over}


def test_shares_show_as_percent_without_the_range_hint() -> None:
    assert sources_doc.values_line(item()) == "Low 4.5%, central 5.5%, high 6.5% (share of facility cost)."


def test_other_units_keep_thousands_separators() -> None:
    line = sources_doc.values_line(item(unit="EUR per MW of IT load", low=9110000, central=14530000, high=26550000))
    assert line == "Low 9,110,000, central 14,530,000, high 26,550,000, in EUR per MW of IT load."


def test_source_line_links_only_when_there_is_a_url() -> None:
    assert sources_doc.source_line(item()).endswith("[Link](https://example.org/r)")
    assert "[Link]" not in sources_doc.source_line(item(url=None))


def test_real_sources_list_every_dataset_and_assumption_in_house_style() -> None:
    meta = json.loads((schemas.OUT_DIR / "meta.json").read_text(encoding="utf-8"))
    items = assumptions.load_assumptions()
    text = sources_doc.render(meta, items)
    assert text == sources_doc.render(meta, items)
    assert f"Economic structure: {meta['table']['reference_year']}" in text
    for d in meta["datasets"]:
        assert d["name"] in text
    for a in items:
        assert f"### {a['label']}" in text
    assert chr(0x2014) not in text  # house style: no em-dashes
    assert not BANNED.search(text), BANNED.search(text)


def test_method_doc_follows_house_style() -> None:
    text = (schemas.ROOT / "docs" / "METHOD.md").read_text(encoding="utf-8")
    assert "Economic structure: " in text
    assert chr(0x2014) not in text  # house style: no em-dashes
    assert not BANNED.search(text), BANNED.search(text)
