## Data

Economic structure: 2022. Main table: Inter-Country Input-Output tables (ICIO), 2025 edition, revision of January 2026, basic prices.

- **Inter-Country Input-Output tables (ICIO)**. OECD, 2025 edition, revision of January 2026. Licence: CC BY 4.0. Read on 2026-11-10. [Link](https://www.oecd.org/en/data/datasets/inter-country-input-output-tables.html)
- **Greenhouse Gas Footprints (GHGFP), principal indicators, production-based emissions**. OECD, 2025 edition. Licence: CC BY 4.0. Read on 2026-11-10. [Link](https://data-explorer.oecd.org/?tm=DF_ICIO_GHG_MAIN_2025)
- **Trade in Employment (TiM), employment by industry**. OECD, 2025 edition. Licence: CC BY 4.0. Read on 2026-11-10. [Link](https://www.oecd.org/en/data/datasets/trade-in-employment.html)
- **Employment by industry, persons and hours worked (nama_10_a64_e)**. Eurostat, online table nama_10_a64_e. Licence: CC BY 4.0. Read on 2026-11-10. [Link](https://ec.europa.eu/eurostat/databrowser/view/nama_10_a64_e/default/table)
- **Euro exchange rates, annual averages (ert_bil_eur_a)**. Eurostat, online table ert_bil_eur_a. Licence: CC BY 4.0. Read on 2026-11-10. [Link](https://ec.europa.eu/eurostat/databrowser/view/ert_bil_eur_a/default/table)
- **GDP price index, national currency, 2015 = 100 (nama_10_gdp)**. Eurostat, online table nama_10_gdp. Licence: CC BY 4.0. Read on 2026-11-10. [Link](https://ec.europa.eu/eurostat/databrowser/view/nama_10_gdp/default/table)
- **BACI, international trade by product, reconciled from UN Comtrade**. CEPII, V202601 (released January 2026), HS 2022. Licence: Etalab Open Licence 2.0. Read on 2026-11-10. [Link](https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37)
- **Trade in Value Added (TiVA), principal indicators, domestic value added in gross exports**. OECD, 2025 edition. Licence: CC BY 4.0. Read on 2026-11-10. [Link](https://data-explorer.oecd.org/?tm=TIVA)

## Assumptions

Each assumption has a low, a central and a high value. The page uses the central value. The stress test pushes every assumption to its low or high end at once.

### Share of IT hardware made in Austria

Low 0%, central 2%, high 10% (share of spend).

Source: CEPII BACI, imports of servers, storage units and network switches (HS 847150, 847170, 851762), 2022. Read on 2026-11-10. [Link](https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37)

The table groups servers with instruments and watches (C26), so its domestic share for Austria (30% in 2022) does not describe servers. Austria imported about USD 2.1 billion of this kit in 2022 and has no large server, storage or switch assembly. The range allows for a small part made at home, such as some network kit.

### Share of IT hardware made in Switzerland

Low 0%, central 2%, high 10% (share of spend).

Source: CEPII BACI, imports of servers, storage units and network switches (HS 847150, 847170, 851762), 2022. Read on 2026-11-10. [Link](https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37)

The table groups servers with instruments and watches (C26), which are large in Switzerland, so its domestic share (72% in 2022) does not describe servers. Switzerland imported about USD 2.9 billion of this kit in 2022 and has no large server, storage or switch assembly. The range allows for a small part made at home, such as some network kit.

### Cost to build the facility in Austria, per MW

Low 9,240,000, central 10,270,000, high 11,300,000, in EUR per MW of IT load.

Source: Turner & Townsend, Data centre construction cost index 2025-2026 (Frankfurt, USD 11.6 per watt). Read on 2026-11-10. [Link](https://www.turnerandtownsend.com/insights-old/data-centre-construction-cost-index-2025-2026/)

The index does not cover Vienna, so Frankfurt stands in for Austria. Reference facility: air-cooled hyperscale build of 30 to 50 MW, without land or IT equipment. Low and high are 10% either side.

### Cost to build the facility in Switzerland, per MW

Low 11,310,000, central 12,570,000, high 13,830,000, in EUR per MW of IT load.

Source: Turner & Townsend, Data centre construction cost index 2025-2026 (Zurich, USD 14.2 per watt). Read on 2026-11-10. [Link](https://www.turnerandtownsend.com/insights-old/data-centre-construction-cost-index-2025-2026/)

Zurich ranks third worldwide in the index. Reference facility: air-cooled hyperscale build of 30 to 50 MW, without land or IT equipment. Low and high are 10% either side.

### Extra building cost for a liquid-cooled facility

Low 1.07, central 1.085, high 1.1, in factor on the facility cost.

Source: Turner & Townsend, Data centre construction cost index 2025-2026. Read on 2026-11-10. [Link](https://www.turnerandtownsend.com/insights-old/data-centre-construction-cost-index-2025-2026/)

US liquid-cooled data centres cost 7 to 10% more than air-cooled ones of the same IT load. Applied to the AI archetype, which is liquid-cooled in this model; the cloud archetype is air-cooled.

### Share of the build cost for electrical systems, air-cooled facility

Low 54%, central 54%, high 54% (share of facility cost).

Source: Turner & Townsend, Data centre cost index 2025, as reported by ConstructConnect. Read on 2026-11-10. [Link](https://news.constructconnect.com/data-center-construction-input-costs-rise-significantly)

The index gives electrical 48 to 54%, mechanical 22 to 33%, core and shell 9 to 14% and contractor fees 10% across air- and liquid-cooled sites. The ends add up to 100% only when paired: air-cooled 54, 22, 14 and 10; liquid-cooled 48, 33, 9 and 10. The shares are fixed by design, so they do not vary on their own.

### Share of the build cost for electrical systems, liquid-cooled facility

Low 48%, central 48%, high 48% (share of facility cost).

Source: Turner & Townsend, Data centre cost index 2025, as reported by ConstructConnect. Read on 2026-11-10. [Link](https://news.constructconnect.com/data-center-construction-input-costs-rise-significantly)

See the note on the air-cooled electrical share for how the paired shares follow from the index.

### Share of the build cost for cooling and other mechanical systems, air-cooled facility

Low 22%, central 22%, high 22% (share of facility cost).

Source: Turner & Townsend, Data centre cost index 2025, as reported by ConstructConnect. Read on 2026-11-10. [Link](https://news.constructconnect.com/data-center-construction-input-costs-rise-significantly)

See the note on the air-cooled electrical share. The rest of the build cost, core and shell plus contractor fees, counts as construction.

### Share of the build cost for cooling and other mechanical systems, liquid-cooled facility

Low 33%, central 33%, high 33% (share of facility cost).

Source: Turner & Townsend, Data centre cost index 2025, as reported by ConstructConnect. Read on 2026-11-10. [Link](https://news.constructconnect.com/data-center-construction-input-costs-rise-significantly)

See the note on the air-cooled electrical share.

### Share of electrical and cooling cost that is installation work

Low 20%, central 30%, high 40% (share).

Source: Bank of America Global Research, Who makes the data center? (September 2024). Read on 2026-11-11.

Bank of America puts installation at USD 1.5 million per MW against USD 1.7 million of electrical and 1.4 million of thermal equipment, so installation is 33% of the installed kit (29% if backup power is counted too). Cost indices put equipment and its installation in one package. Installation is work by building trades, so this share counts as construction, and the rest as electrical or cooling equipment.

### Design, engineering and project management, as a share of the build cost

Low 4.5%, central 5.5%, high 6.5% (share of facility cost).

Source: Bank of America Global Research, Who makes the data center? (September 2024). Read on 2026-11-11.

Bank of America: design and engineering services generally cost 4.5 to 6.5% of the infrastructure costs of a data centre, without IT equipment. Added on top of the facility cost, because the construction cost index leaves professional services out.

### Share of the build spent in year 1

Low 30%, central 40%, high 50% (share).

Source: Own estimate, no published benchmark found. Read on 2026-11-10.

Site works and the building shell come first, so less than half is spent in year 1. The rest is spent in year 2, when most equipment is delivered and installed.

### Cost of IT equipment for an AI site, per MW

Low 19,670,000, central 23,110,000, high 26,550,000, in EUR per MW of IT load.

Source: Epoch AI, AI datacenter cost breakdown (Michael and Cottier, 2026). Read on 2026-11-11. [Link](https://epoch.ai/data-insights/ai-datacenter-cost-breakdown)

Servers (USD 21.2 million per MW) plus network kit (USD 4.9 million per MW) in Epoch AI's 1 GW case. Published in May 2026 and not deflated to 2025. The high value is Bank of America's estimate of USD 30 million per MW for IT equipment (September 2024). The low value sits as far below Epoch AI's figure as the high value sits above it.

### Cost of IT equipment for a cloud site, per MW

Low 9,110,000, central 14,530,000, high 26,550,000, in EUR per MW of IT load.

Source: Worked out from Bank of America Global Research, Who makes the data center? (September 2024), and Lawrence Berkeley National Laboratory, 2024 United States Data Center Energy Usage Report (Shehabi et al.). Read on 2026-11-11. [Link](https://eta-publications.lbl.gov/publications/2024-lbnl-data-center-energy-usage-report)

Built up per MW. A conventional server draws about 673 W at full load in 2025 (LBNL: 600 W in 2023, 782 W by 2028). Servers take 83% of IT power, storage 13% and network 4% (LBNL, 2023), so 1 MW holds about 1,233 servers. Central uses the average server price in 2023, USD 11,167 (USD 134 billion for about 12 million servers), and low the median, USD 7,000 (Bank of America). Storage and network add 19.2% to the server cost (Bank of America). Converted at 0.885 euros per dollar. The average includes AI servers, so it leans high for a cloud site, while cloud servers are better equipped than the median one. The high value is Bank of America's USD 30 million per MW, a market average that includes AI servers.

### Years between IT refreshes at an AI site

Low 3, central 5, high 7, in years.

Source: Epoch AI, AI datacenter cost breakdown (Michael and Cottier, 2026). Read on 2026-11-10. [Link](https://epoch.ai/data-insights/ai-datacenter-cost-breakdown)

Epoch AI assumes 5 years and tests 3 and 7. Amazon shortened the useful life of part of its servers from 6 to 5 years from 2025, citing the pace of AI development (annual report 2024).

### Years between IT refreshes at a cloud site

Low 5, central 6, high 7, in years.

Source: Amazon annual report 2024 (Form 10-K). Read on 2026-11-10. [Link](https://www.sec.gov/Archives/edgar/data/1018724/000101872425000004/amzn-20241231.htm)

Amazon used a 6-year useful life for servers in 2024.

### Average IT power use at an AI site, as a share of capacity

Low 0.4, central 0.7, high 0.85, in average IT electrical load over rated IT capacity (0 to 1).

Source: Epoch AI (2026); Lawrence Berkeley National Laboratory, 2024 United States Data Center Energy Usage Report (Shehabi et al.). Read on 2026-11-11. [Link](https://epoch.ai/data-insights/ai-datacenter-cost-breakdown)

Average IT power over IT capacity. Epoch AI uses 71% this way for its AI case (capacity times PUE times hours gives its electricity bill), the average of four estimates. LBNL builds it up from the servers instead: busy at 70% of rated power, idle at 20%, busy 80% of the time for training and 40% for inference, which gives 60% and 40% of rated power. The low value covers that.

### Average IT power use at a cloud site, as a share of capacity

Low 45%, central 65%, high 75% (share).

Source: Lawrence Berkeley National Laboratory, 2024 United States Data Center Energy Usage Report (Shehabi et al.). Read on 2026-11-11. [Link](https://eta-publications.lbl.gov/publications/2024-lbnl-data-center-energy-usage-report)

Average IT power over IT capacity. LBNL puts hyperscale servers busy about 50% of the time by 2027. Idle, they still draw 36% of their maximum power in 2023, falling to 27% by 2028, about 32% in 2025. Halfway between idle and maximum power gives about 66%.

### Power usage effectiveness of an AI site

Low 1.1, central 1.15, high 1.3, in ratio of total power to IT power.

Source: Uptime Institute, Global Data Center Survey 2025; German Energy Efficiency Act (EnEfG), section 11. Read on 2026-11-10. [Link](https://www.gesetze-im-internet.de/enefg/__11.html)

The average across all surveyed sites is about 1.54. Germany requires new data centres opened from July 2026 to reach 1.2. Liquid cooling allows lower values.

### Power usage effectiveness of a cloud site

Low 1.15, central 1.25, high 1.4, in ratio of total power to IT power.

Source: Uptime Institute, Global Data Center Survey 2025; German Energy Efficiency Act (EnEfG), section 11. Read on 2026-11-10. [Link](https://www.gesetze-im-internet.de/enefg/__11.html)

The average across all surveyed sites is about 1.54; new large sites do much better.

### Yearly maintenance and facility services, as a share of the build cost

Low 0.5%, central 1.05%, high 2% (share of facility cost per year).

Source: Epoch AI, AI datacenter cost breakdown (Michael and Cottier, 2026). Read on 2026-11-10. [Link](https://epoch.ai/data-insights/ai-datacenter-cost-breakdown)

Epoch AI puts maintenance at USD 120 million a year for a facility costing USD 11.4 billion (1.05%). The high value leaves room for facility services such as security and cleaning, which this category also covers.

### Year of the mid-life refresh of electrical and cooling kit

Low 10, central 12, high 15, in year of operation (1 to 20).

Source: Own estimate, no published benchmark found. Read on 2026-11-10.

Batteries and some cooling kit wear out well before the building does. Operators typically replace UPS systems about every 10 years (Bank of America, 2024), which sets the low value.

### Share of electrical and cooling kit replaced at mid-life

Low 20%, central 30%, high 40% (share).

Source: Own estimate, no published benchmark found. Read on 2026-11-10.

Covers the short-lived parts, such as batteries, UPS units and some cooling plant. Long-lived parts, such as switchgear and pipework, stay.

### Electricity price for a large user in Austria, before taxes

Low 122.9, central 124, high 140.5, in EUR per MWh.

Source: Eurostat, electricity prices for non-household consumers (nrg_pc_205), 150,000 MWh or more a year, excluding taxes and levies. Read on 2026-11-11. [Link](https://ec.europa.eu/eurostat/databrowser/view/nrg_pc_205/default/table)

2025 average of 125.7 (first half) and 122.9 (second half). The low value is the lowest half year since 2023 (122.9; the first half of 2026 was 123.2), the high value the second half of 2024 (140.5). Taxes are left out of all spend.

### Electricity price for a large user in Switzerland, before taxes

Low 115, central 130, high 171, in EUR per MWh.

Source: USI (Università della Svizzera italiana), Wholesale electricity market 2025; ElCom, median electricity tariff for Switzerland 2025, category C7 (opendata.swiss). Read on 2026-11-10. [Link](https://www.usi.ch/en/feeds/34486)

Estimate for a site using 200 to 300 GWh a year: Swiss wholesale power averaged about EUR 100 per MWh in the first ten months of 2025 (USI), plus about EUR 30 for the grid and supply, an estimate. High is the ElCom median for the much smaller C7 user (cheapest product, energy plus grid, 16.04 Rp/kWh), kept as an upper bound because a large site pays less. Eurostat has no Swiss figure.

### Operator staff per MW

Low 0.56, central 1.2, high 1.6, in persons employed per MW of IT load.

Source: Verdant, The Jobs Mirage of Data Centres (Meadway, 2026), as reported by Capacity. Read on 2026-11-10. [Link](https://capacityglobal.com/news/think-tank-challenges-the-employment-case-for-uk-data-centres/)

Planned UK sites average 1.2 operational jobs per MW, weighted by size; the whole pipeline 1.6. The 720 MW QTS Cambois campus plans about 400 permanent jobs (0.56 per MW). The evidence does not separate AI and cloud sites, so both use one range. These are UK plans, used here for want of Austrian or Swiss figures.

### Yearly employer cost per staff member in Austria

Low 62,844, central 77,300, high 91,819, in EUR per person per year.

Source: Eurostat, national accounts by industry (nama_10_a64 and nama_10_a64_e), compensation per employee, 2025. Read on 2026-11-10. [Link](https://ec.europa.eu/eurostat/databrowser/view/nama_10_a64/default/table)

Low is the average across the economy, high the average in IT services (J62 and J63). Site staff mix technicians and IT specialists, so the central value sits in between.

### Yearly employer cost per staff member in Switzerland

Low 106,105, central 132,100, high 158,075, in EUR per person per year.

Source: Eurostat, national accounts by industry (nama_10_a64 and nama_10_a64_e), compensation per person employed, 2024. Read on 2026-11-10. [Link](https://ec.europa.eu/eurostat/databrowser/view/nama_10_a64/default/table)

Low is the average across the economy, high the average in IT services (J62 and J63). Eurostat has no pay per employee for Swiss IT services, so the high value is pay per person employed, which counts the self-employed too and runs lower: 17% lower in Austria. 2024 is the latest year for Switzerland. The central value sits in between.

### Share of staff pay going to people who live across the border, Vienna

Low 2%, central 5%, high 8% (share of payroll).

Source: Statistik Austria, commuters from abroad, as reported by ORF. Read on 2026-11-10. [Link](https://orf.at/stories/3327502/)

The share for Austria as a whole, 5.2% of employment in 2021; no figure by city was found. It counts workers, and the model applies it to pay.

### Share of staff pay going to people who live across the border, Innsbruck

Low 2%, central 5%, high 8% (share of payroll).

Source: Statistik Austria, commuters from abroad, as reported by ORF. Read on 2026-11-10. [Link](https://orf.at/stories/3327502/)

The share for Austria as a whole, 5.2% of employment in 2021; no figure by city was found. It counts workers, and the model applies it to pay.

### Share of staff pay going to people who live across the border, Linz

Low 2%, central 5%, high 8% (share of payroll).

Source: Statistik Austria, commuters from abroad, as reported by ORF. Read on 2026-11-10. [Link](https://orf.at/stories/3327502/)

The share for Austria as a whole, 5.2% of employment in 2021; no figure by city was found. It counts workers, and the model applies it to pay.

### Share of staff pay going to people who live across the border, Zurich

Low 0.5%, central 1%, high 2% (share of payroll).

Source: Federal Statistical Office (BFS), cross-border commuter statistics, 4th quarter 2022. Read on 2026-11-10. [Link](https://dam-api.bfs.admin.ch/hub/api/dam/assets/24310206/master)

Estimate. Zurich is not among the cantons with high shares of cross-border commuters. The model applies the share to pay.

### Share of staff pay going to people who live across the border, Geneva

Low 20%, central 28.8%, high 35% (share of payroll).

Source: Federal Statistical Office (BFS), cross-border commuter statistics, 4th quarter 2022. Read on 2026-11-10. [Link](https://dam-api.bfs.admin.ch/hub/api/dam/assets/24310206/master)

Cross-border commuters were 28.8% of people working in the canton of Geneva (against STATENT 2020). It counts workers in the canton, and the model applies it to pay.

### Share of staff pay going to people who live across the border, Lugano

Low 25%, central 32.6%, high 40% (share of payroll).

Source: Federal Statistical Office (BFS), cross-border commuter statistics, 4th quarter 2022. Read on 2026-11-10. [Link](https://dam-api.bfs.admin.ch/hub/api/dam/assets/24310206/master)

Cross-border commuters were 32.6% of people working in the canton of Ticino (against STATENT 2020), the highest share in Switzerland. It counts workers in the canton, and the model applies it to pay.

### Carbon of grid electricity in Austria, over its life cycle

Low 123, central 173, high 227, in kg CO2e per MWh.

Source: Energieinstitut Vorarlberg, Konversionsfaktoren Strommix AT und Szenarienbetrachtung (2025). Read on 2026-11-10. [Link](https://www.energieinstitut.at/media/konversionsfaktoren-strommix-at-und-szenarienbetrachtung.pdf)

Austrian consumer mix with net imports, average 2020 to 2024: about 173 g per kWh. Low is the study's 2030 scenario (123 g), high the building code factor of 2019 (OIB-RL 6, 227 g).

### Carbon of grid electricity in Switzerland, over its life cycle

Low 59, central 66, high 128, in kg CO2e per MWh.

Source: VSE (Swiss electricity industry association), method note on the Swiss consumer mix 2024; BAFU, Umweltbilanz Strommix Schweiz 2018. Read on 2026-11-10. [Link](https://www.strom.ch/de/media/15408/download)

Swiss consumer mix, location-based, 59 g per kWh in 2024, plus 7.4 g for the grid. High is the 2018 value from the Federal Office for the Environment (128 g), an older year kept as a stress value.

### Carbon of electricity from a renewable contract, over its life cycle

Low 11, central 24, high 48, in kg CO2e per MWh.

Source: IPCC, Fifth Assessment Report, Working Group III, Annex III, Table A.III.2. Read on 2026-11-10. [Link](https://www.ipcc.ch/report/ar5/wg3/)

Life-cycle medians, hydropower 24 (central), onshore wind 11 (low), utility solar 48 (high).

### Share of IT energy delivered as heat to the network

Low 30%, central 50%, high 70% (share).

Source: Own estimate, no published benchmark found. Read on 2026-11-10.

Heat networks take less heat in summer, so not all of the servers' heat can be delivered over a year. The range covers networks with weak and with strong summer demand.

### Heat delivered per unit of electricity used by the heat pumps

Low 3, central 4, high 4.9, in coefficient of performance.

Source: Danish District Heating Association, Inspirational catalogue for large heat pumps. Read on 2026-11-10. [Link](https://danskfjernvarme.dk/media/lcgnphch/inspirational-catalogue-for-large-heat-pumps.pdf)

The Odense data centre heat pumps reach 4.4 and 4.9. Networks that need hotter water, such as Vienna's, get lower values.

### Cost of heat pumps, per MW of heat output

Low 500,000, central 700,000, high 1,000,000, in EUR per MW of heat output.

Source: Zangeneh and Øi, Utilization of excess heat from data centers, University of South-Eastern Norway (2022). Read on 2026-11-10. [Link](https://openarchive.usn.no/usn-xmlui/handle/11250/3009228)

A master's thesis case study (Rjukan, Norway) assumes EUR 0.7 million per MW of heat pump output. One case, so the range is wide. Heat pump output per MW of IT load equals the share of server heat captured, since the compressor electricity is already part of the facility load.

### Cost of the connection to the heat network, per MW

Low 50,000, central 150,000, high 400,000, in EUR per MW of IT load.

Source: Own estimate, no published benchmark found. Read on 2026-11-10.

The cost depends mostly on the distance to the network, so the range is wide.

### Yearly upkeep of the heat recovery kit, as a share of its cost

Low 1%, central 2%, high 3% (share per year).

Source: Own estimate, no published benchmark found. Read on 2026-11-10.

Set at a yearly rate typical for mechanical plant such as pumps and heat exchangers.

### Carbon avoided per MWh of heat delivered to the network

Low 100, central 224, high 250, in kg CO2e per MWh of heat.

Source: IPCC, 2006 Guidelines for National Greenhouse Gas Inventories, Volume 2, Chapter 2 (natural gas, 56.1 t CO2 per TJ). Read on 2026-11-10. [Link](https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol2.html)

Central assumes the heat replaces a gas boiler of 90% efficiency. Low is an estimate for a network that already uses much waste heat or biomass.
