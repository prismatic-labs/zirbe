# Zirbe

Follow the Euro: an interactive input-output model of where data-centre spending goes in Austria and Switzerland, from the firms paid directly through their supply chains over a twenty-year lifecycle.

**Live:** [prismatic-labs.github.io/zirbe/](https://prismatic-labs.github.io/zirbe/)

## Structure

- `engine/`: Python data pipeline that reads OECD ICIO, TiM, GHG footprints, TiVA, CEPII BACI, and Eurostat price/employment tables, and builds the four JSON datasets in `data/out/`.
- `assumptions/`: Model assumptions with low, central, and high values and source provenance (`assumptions/assumptions.yaml`).
- `schema/`: JSON Schema (Draft 2020-12) definitions for `meta.json`, `fingerprints.json`, `lifecycle.json`, and `assumptions.json`.
- `docs/`: Method note (`docs/METHOD.md`) and generated source list (`docs/SOURCES.md`).
- `web/`: Vite + React + TypeScript web application.

## Commands

```bash
# Web viewer
cd web
npm install
npm run dev
npm run test
npm run build

# Python engine (rebuilds data/out/*.json and docs/SOURCES.md from raw tables)
python -m engine build
python -m engine validate data/out
```
