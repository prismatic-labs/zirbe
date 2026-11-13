## How we work out the figure

The figure at the top is the part of the money spent so far that supports wages and profits in the home country, in cents per euro, or per franc at a Swiss site. Economists call this value added: what firms keep from their sales after paying their suppliers, mostly wages and profits. The rest of this page uses that term. It is counted where the work is done.

Spending supports value added. The model does not claim that the activity would be missing without the data centre, so the figure is a footprint of the spending, not a measure of new activity.

The figure adds up everything from year 1 to the year on the slider. At year 2 it shows the build alone. At year 20 it shows the whole life of the site.

## The estimated journey of a euro

Economic structure: 2022. The model uses the OECD Inter-Country Input-Output tables (ICIO), which show what each industry in each country buys from every other industry, at home and abroad.

Each euro is first paid to firms directly, at home or abroad (tier 0). Each firm keeps part of it as value added, pays a small part in product taxes, and spends the rest with its own suppliers (tier 1). They do the same, round after round. The model adds up what is kept in each country over all the rounds. Tiers 0 to 3 are shown one by one, and tier 4 and beyond as one group. Every round ends as someone's income or as tax, so the parts always add up to the whole euro.

For each kind of spending, the model starts from how the home country buys that product: how much comes from firms at home, how much is imported, and from where. For the building and its equipment this comes from the country's investment in that product. For running costs it comes from what the country's IT services industry buys.

IT hardware is the exception. In the table, the electronics industry also holds instruments and watches, which dominate it in Austria and Switzerland. So the share of servers, storage and network kit made at home is an assumption, and the countries it comes from are taken from CEPII BACI trade data for servers, storage units and network switches.

The sourcing sliders change the share bought at home for electrical kit, cooling kit and IT hardware. Each slider starts at the national average.

## What is spent, and when

Everything is worked out per MW of IT load. The size of the site scales the totals but never the cents per euro.

- Years 1 and 2: the build. The building, the electrical and cooling systems, and design and engineering. The part of the electrical and cooling cost that is installation work counts as building work.
- Start of year 3: the first IT fit-out (servers, storage and network kit), as operations begin.
- Years 3 to 20: electricity, maintenance and the operator's own staff.
- The IT kit is replaced on a cycle set for each building type, shorter at AI sites.
- A mid-life refresh replaces part of the electrical and cooling kit.
- With heat recovery on: heat pumps and a connection to the heat network in year 3, their upkeep, and their electricity.

The build cost per MW comes from a construction cost index for a large air-cooled site, without land or IT equipment. Frankfurt stands in for Austria, because the index does not cover an Austrian city. Zurich is in the index. AI sites are liquid-cooled, which adds to the build cost and shifts it from electrical towards cooling work. AI sites also spend more on IT kit per MW and replace it sooner. Cloud sites are air-cooled.

## Who buys the servers

A site is often built by one firm and let to another, and the tenant then brings its own servers, storage and network kit. Set "servers bought by" to "a tenant" and that kit leaves every figure: the spending, the value added, the jobs and the carbon embodied in it. What remains is the spend of the firm that builds and runs the building. Electricity stays in, because the building buys it even when the tenant pays it back.

## Two yardsticks

For comparison, level 3 shows what a euro of ordinary building work supports at home, from the same tables. It applies to any building project, such as housing or a warehouse. A data centre build supports less per euro, because more of its cost is electrical and cooling kit, part of it imported.

Grid capacity is scarce, so level 5 shows what each MW of grid connection supports at home in a year of operation. The connection is the IT load times the PUE.

## Jobs and pay

Jobs come from OECD figures on persons employed per unit of output in each Austrian or Swiss industry, applied along the estimated journey at home. A part-time job counts as one job. Construction job-years are the jobs supported by the build. Ongoing jobs are the yearly average from year 3 to year 20: the operator's staff, its suppliers, and the refreshes.

The operator's staff are counted from staff per MW. Their pay is the operator's own value added, at home, in IT services. Some of it goes to people who live across the border. That changes where wages are spent, not where value added is counted.

## Energy and carbon

### Energy

The site's electricity in a year of operation is the IT capacity, times its average use over every hour of the year, times the power usage effectiveness (PUE). PUE adds the electricity for cooling, lighting and power losses. Average use and PUE differ between AI and cloud sites, but not between sites of the same type.

### Carbon in purchases

The greenhouse gases embodied in purchases come from the OECD Greenhouse Gas Footprints: the emissions of each industry in each country per unit of output, counted where they are emitted, for all greenhouse gases in CO2 equivalent (CO2e). They are added up along the same estimated journey as the money. Electricity is left out here, so it is not counted twice.

### Carbon from electricity

Electricity carbon is the megawatt-hours times a factor. The grid average view (location-based) uses the life-cycle carbon of each country's consumption mix, imports included, plus the grid. The renewable contract view (market-based) uses the life-cycle carbon of renewable power and is labelled as such. A contract changes how the electricity is accounted for, not what flows through the local grid.

### Heat recovery

With heat recovery on, part of the servers' heat goes to a local heat network. Heat pumps raise it to the temperature the network needs, and their electricity is counted. The heat delivered is taken to replace heat from a gas boiler, and the carbon that boiler would have emitted is shown as its own line, taken off the total.

The switch starts off, because two inputs are estimates: the share of the servers' heat a network can take, and the carbon of the heat it would replace. Many networks already use waste heat or wood, and then the saving is smaller.

## The stress test

The range under the figure pushes every assumption the same way at once. The low end puts each assumption at whichever end, low or high, gives the lower figure at year 20. The high end puts each at the other end. Assumptions that do not move the figure stay at their central value. The range shows how far the figure could move if every assumption were off in the same direction. It is not a likely range.

## Prices and currencies

The table is in US dollars for 2022. Amounts are worked out in 2025 euros: table dollars to euros at the 2022 average rate, then each country's GDP price index from 2022 to 2025. For Swiss sites the page shows francs, at the 2025 average rate. The cents per euro and per franc are the same.

## What is left out, and which way it pushes the figures

- Land, financing, the operator's own taxes and its profit are not part of the modelled spending.
- Grid connection, site works and fibre sit outside the build cost index, so they are left out. They are mostly local work, so leaving them out likely makes the figure a little lower than it would be.
- Trade and transport margins on imported kit are left out. This understates value added at home for imported kit.
- Repair and installation sit with furniture and other manufacturing in the table. This likely overstates the imported share of maintenance.
- The economic structure is from 2022, a year of very high energy prices. That lowers the value added at home of Austrian electricity (12% of its output in 2022, against 18% in 2021), so the figure for Austrian sites is likely a little low once operations start.
- Supply chains are national, not regional.
- Induced effects, the spending of wages earned along the way, are left out.
- Climate differences between sites are not modelled: PUE is the same at every site of a type.
- Money from sources of other years, such as 2024 and 2026, is converted to euros but not adjusted to 2025 prices.
- Decommissioning and the end of life of the kit are left out.
- On-site emissions are left out: refrigerant leaks from the cooling plant and fuel burned by backup power. Water use is left out too. Counting them would raise the carbon footprint.
- Taxes and levies on electricity are left out of the spending.

## Checks

- For every kind of spending, value added and product taxes add up to the whole euro, within 0.5%.
- The tiers add up to the totals.
- The share of value added at home in Austrian and Swiss exports, worked out by the model, matches the OECD's Trade in Value Added figures (TiVA) within 2 percentage points.
- Against a published study. [Copenhagen Economics (2018)](https://storage.googleapis.com/gweb-sustainability.appspot.com/pdf/Google_EU-DCs_Report.pdf) studied four data centres in Belgium, Finland, Ireland and the Netherlands for their owner. For EUR 4.3 billion spent on building, running and connecting them, without servers, it reports EUR 3.6 billion of value added in the EU through the sites and their suppliers: about 84 cents per euro. For the same kind of spend at an Austrian site, this model gives 72 cents in the EU, of which 47 to 50 cents in Austria. The two agree in size, and this model is the more cautious.
- The page recomputes in under 16 milliseconds, and every number on it opens its source.
