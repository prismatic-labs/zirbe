"""The 20-year spend schedule of each site, archetype and scenario.

Every number comes from assumptions/assumptions.yaml through a lookup that
records which assumptions a schedule used, so each schedule can cite them.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from engine import schemas
from engine.fingerprints import blended
from engine.mappings import contract_enum

Lookup = Callable[[str], float]
# Only the central schedule lists its variants: each one moves a single assumption away from central.
VARIANTS_IN = "central"


def years() -> int:
    """Series length from the contract (Series20)."""
    series = schemas.load_schema("lifecycle")["$defs"]["Series20"]
    return int(series["minItems"])


def whole(value: float, aid: str) -> int:
    if value != int(value):
        raise ValueError(f"{aid} must be a whole number of years, got {value}")
    return int(value)


class Recorder:
    """Looks up assumption values in one scenario and remembers which ids were used."""

    def __init__(self, values: dict[str, float]) -> None:
        self.values = values
        self.used: list[str] = []

    def __call__(self, aid: str) -> float:
        if aid not in self.values:
            raise KeyError(f"assumption {aid} is not in assumptions.yaml")
        if aid not in self.used:
            self.used.append(aid)
        return self.values[aid]


def build_costs(v: Lookup, country: str, cooling: str) -> tuple[float, dict[str, float]]:
    """Facility cost per MW and its split into the four build categories. The
    electrical and mechanical shares come as a pair for the cooling design."""
    facility = v(f"facility_capex_per_mw.{country}")
    if cooling == "liquid":
        facility *= v("liquid_cooling_premium")
    electrical = facility * v(f"capex_share.electrical.{cooling}")
    mechanical = facility * v(f"capex_share.mechanical.{cooling}")
    shell = facility - electrical - mechanical
    if shell < 0:
        raise ValueError("electrical and mechanical shares add up to more than the whole build")
    install = v("installation_share")
    return facility, {
        "construction": shell + install * (electrical + mechanical),
        "electrical": electrical * (1 - install),
        "cooling": mechanical * (1 - install),
        "engineering": facility * v("engineering_share"),
    }


def heat_recovery_capex(v: Lookup) -> float:
    """Heat pumps sized on their heat output, plus the network connection, per MW of IT load.
    heat_recovery_share is the heat delivered to the network per unit of IT energy, the heat
    pumps' own electricity included, so it is already the output: schedule() delivers
    it_mwh x share and charges share / COP of that as electricity."""
    output_mw = v("heat_recovery_share")
    return output_mw * v("heat_pump_capex_per_mw_heat") + v("heat_connection_capex_per_mw")


def schedule(site_id: str, archetype: str, v: Lookup, m: dict[str, Any]) -> dict[str, Any]:
    """One Schedule, per MW of IT load, EUR at the price year."""
    site, cfg, n = m["sites"][site_id], m["schedule"], years()
    country = site["country"].lower()
    spend = {c: [0.0] * n for c in contract_enum("CategoryId")}

    def add(category: str, year: int, amount: float) -> None:
        spend[category][year - 1] += amount

    facility, build = build_costs(v, country, m["archetypes"][archetype]["cooling"])
    first, second = cfg["build_years"]
    share_first = v("build_share_year1")
    for category, total in build.items():
        add(category, first, total * share_first)
        add(category, second, total * (1 - share_first))
    milestones = [{"year": first, "key": "build"}]

    refresh = whole(v(f"it_refresh_years.{archetype}"), f"it_refresh_years.{archetype}")
    it_cost = v(f"it_capex_per_mw.{archetype}")
    for year in range(cfg["first_fit_year"], n + 1, refresh):
        add("it_hardware", year, it_cost)
        milestones.append({"year": year, "key": "first_fit" if year == cfg["first_fit_year"] else "it_refresh"})

    midlife = whole(v("midlife_refresh_year"), "midlife_refresh_year")
    for category in ("electrical", "cooling"):
        add(category, midlife, build[category] * v("midlife_refresh_share"))
    milestones.append({"year": midlife, "key": "midlife_refresh"})

    price = v(f"electricity_price.{country}")
    it_mwh = m["units"]["hours_per_year"] * v(f"it_load_factor.{archetype}")
    pue = v(f"pue.{archetype}")
    staff = v("staff_per_mw")
    payroll = v(f"payroll_per_job.{country}")
    electricity_mwh, staff_jobs = [0.0] * n, [0.0] * n
    heat_mwh, heat_pump_mwh, heat_pump_spend = [0.0] * n, [0.0] * n, [0.0] * n
    if site["heat_available"]:
        heat_capex = heat_recovery_capex(v)
        add("heat_recovery", cfg["heat_capex_year"], heat_capex)
    for year in range(cfg["operations_from"], n + 1):
        i = year - 1
        electricity_mwh[i] = it_mwh * pue
        add("electricity", year, electricity_mwh[i] * price)
        add("maintenance", year, facility * v("maintenance_share"))
        staff_jobs[i] = staff
        add("staff", year, staff * payroll)
        if site["heat_available"]:
            heat_mwh[i] = it_mwh * v("heat_recovery_share")
            heat_pump_mwh[i] = heat_mwh[i] / v("heat_pump_cop")
            heat_pump_spend[i] = heat_pump_mwh[i] * price
            add("heat_recovery", year, heat_capex * v("heat_recovery_upkeep_share"))

    return {
        "spend": spend,
        "electricity_mwh": electricity_mwh,
        "heat_delivered_mwh": heat_mwh,
        "heat_pump_mwh": heat_pump_mwh,
        "heat_pump_spend": heat_pump_spend,
        "staff_jobs": staff_jobs,
        "grid_kgco2e_per_mwh": v(f"grid_factor.{country}"),
        "contract_kgco2e_per_mwh": v("contract_factor"),
        "heat_displaced_kgco2e_per_mwh": v("heat_displaced_factor"),
        "cross_border_payroll_share": v(f"cross_border_share.{site_id}"),
        "milestones": sorted(milestones, key=lambda ms: (ms["year"], ms["key"])),
    }


def headline(sched: dict[str, Any], va_home: dict[str, float], heat_on: bool, through_year: int) -> float:
    """Domestic value added per euro spent, cumulative from year 1."""
    value = total = 0.0
    for category, series in sched["spend"].items():
        if category == "heat_recovery" and not heat_on:
            continue
        spent = sum(series[:through_year])
        value += spent * va_home[category]
        total += spent
    if heat_on:
        spent = sum(sched["heat_pump_spend"][:through_year])
        value += spent * va_home["electricity"]
        total += spent
    return value / total


def scenario_sets(site_id: str, archetype: str, a: dict[str, dict[str, Any]], va_home: dict[str, float],
                  m: dict[str, Any]) -> dict[str, dict[str, float]]:
    """Assumption values for low_impact, central and high_impact (see mappings.yaml, schedule)."""
    central = {aid: x["central"] for aid, x in a.items()}
    probe = Recorder(central)
    schedule(site_id, archetype, probe, m)
    heat_on = m["sites"][site_id]["heat_available"]
    year = m["schedule"]["scenario_year"]

    def score(aid: str, end: str) -> float:
        return headline(schedule(site_id, archetype, Recorder({**central, aid: a[aid][end]}), m), va_home, heat_on, year)

    low, high = dict(central), dict(central)
    for aid in probe.used:
        at_low, at_high = score(aid, "low"), score(aid, "high")
        if at_low < at_high:
            low[aid], high[aid] = a[aid]["low"], a[aid]["high"]
        elif at_high < at_low:
            low[aid], high[aid] = a[aid]["high"], a[aid]["low"]
    return {"low_impact": low, "central": central, "high_impact": high}


def variant(central: dict[str, Any], moved: dict[str, Any]) -> dict[str, Any]:
    """What differs from the central schedule: the spend series and the cost of the heat pumps' electricity."""
    out: dict[str, Any] = {}
    spend = {c: series for c, series in moved["spend"].items() if series != central["spend"][c]}
    if spend:
        out["spend"] = spend
    if moved["heat_pump_spend"] != central["heat_pump_spend"]:
        out["heat_pump_spend"] = moved["heat_pump_spend"]
    return out


def variants(site_id: str, archetype: str, a: dict[str, dict[str, Any]], central: dict[str, float],
             m: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Each assumption moved alone to its low and to its high value, the others central, as the
    changes to the central schedule. An assumption that changes neither spend nor a domestic
    share is left out. Series are compared as written, so rounding cannot make a difference."""
    decimals = m["output"]["decimals"]

    def at(values: dict[str, float]) -> dict[str, Any]:
        return rounded(schedule(site_id, archetype, Recorder(values), m), decimals)

    probe = Recorder(central)
    schedule(site_id, archetype, probe, m)
    base = at(central)
    out: dict[str, dict[str, Any]] = {}
    for aid in probe.used:
        ends = {end: variant(base, at({**central, aid: a[aid][end]})) for end in ("low", "high")}
        if ends["low"] or ends["high"]:
            out[aid] = ends
    country = m["sites"][site_id]["country"].lower()
    for category, cat in m["categories"].items():
        if "domestic_share" not in cat:
            continue
        x = a[f"{cat['domestic_share']['assumption']}.{country}"]
        ends = {end: {"domestic_share": {category: x[end]}} if x[end] != x["central"] else {} for end in ("low", "high")}
        if ends["low"] or ends["high"]:
            out[x["id"]] = ends
    return out


def rounded(node: Any, decimals: int) -> Any:
    if isinstance(node, float):
        return round(node, decimals) + 0.0
    if isinstance(node, list):
        return [rounded(x, decimals) for x in node]
    if isinstance(node, dict):
        return {k: rounded(x, decimals) for k, x in node.items()}
    return node


def build(m: dict[str, Any], a: dict[str, dict[str, Any]], va_home: dict[str, dict[str, float]]) -> dict[str, Any]:
    """The Lifecycle document. va_home is value added at home per euro, per purchaser and category."""
    doc: dict[str, Any] = {}
    for site_id in contract_enum("SiteId"):
        purchaser = m["sites"][site_id]["country"]
        for archetype in contract_enum("ArchetypeId"):
            sets = scenario_sets(site_id, archetype, a, va_home[purchaser], m)
            for scenario in contract_enum("ScenarioId"):
                v = Recorder(sets[scenario])
                sched = schedule(site_id, archetype, v, m)
                sched["source_ids"] = list(v.used)
                if scenario == VARIANTS_IN:
                    sched["variants"] = variants(site_id, archetype, a, sets[scenario], m)
                doc.setdefault(site_id, {}).setdefault(archetype, {})[scenario] = rounded(sched, m["output"]["decimals"])
    return doc


def summary_lines(doc: dict[str, Any], va_home: dict[str, dict[str, float]], m: dict[str, Any]) -> list[str]:
    """Headline cents per euro at years 2 and 20, central with the low to high range, heat off and on."""
    end, build_end = years(), m["schedule"]["build_years"][-1]
    lines = [f"{'site':10} {'archetype':9} {'year 2':>14} {'year 20':>14} {'year 20, heat on':>17}"]
    for site_id, archetypes in doc.items():
        va = va_home[m["sites"][site_id]["country"]]
        for archetype, sets in archetypes.items():
            def cents(year: int, heat: bool) -> str:
                c, lo, hi = (100 * headline(sets[s], va, heat, year) for s in ("central", "low_impact", "high_impact"))
                return f"{c:4.1f} ({lo:4.1f}-{hi:4.1f})"
            heat = cents(end, True) if m["sites"][site_id]["heat_available"] else "no network"
            lines.append(f"{site_id:10} {archetype:9} {cents(build_end, False):>14} {cents(end, False):>14} {heat:>17}")
    return lines


def va_home_per_euro(fingerprints_doc: dict[str, Any], m: dict[str, Any]) -> dict[str, dict[str, float]]:
    """Value added at home per euro of each category, at the default domestic share."""
    out = {}
    for purchaser, categories in fingerprints_doc.items():
        def home(fp: dict[str, Any], p: str = purchaser) -> float:
            return fp["va"].get(p, 0.0)

        out[purchaser] = {c: blended(entry, home) for c, entry in categories.items()}
        out[purchaser]["staff"] = m["schedule"]["staff_domestic_value_added"]
    return out
