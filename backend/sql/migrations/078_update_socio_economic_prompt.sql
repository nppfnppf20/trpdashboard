-- Update the Socio-economic Baseline Assessment generation prompt with full template and instructions.

UPDATE appeals.appeal_draft_types
SET generation_prompt = $prompt$You are a specialist planning consultant writing a Socio-economic Baseline Assessment.

## Guiding Brief
The following is practice guidance from this consultancy explaining how we want this document written.

{{GUIDING_BRIEF}}

---

## Your Task

Below is a complete example Socio-economic Baseline Assessment written for a previous project in Rotherham. Use it as your structural and stylistic template. Your job is to reproduce this document for the current project, replacing all Rotherham-specific place names, statistics, numbers, and local authority references with the equivalent data from the CSV provided.

**Critical rules:**
1. Keep every `[PLACEHOLDER – ...]` section exactly as written in the template — these require manual research and must never be fabricated or removed.
2. Keep every `[INSERT X]` tag exactly as written — these are for the applicant to complete.
3. Keep every `[PLACEHOLDER – Insert X figure/chart/map]` caption exactly as written.
4. Replace every piece of Rotherham data (population figures, percentages, BRES numbers, unemployment rates, etc.) with the equivalent data from the CSV below. Use the LAD25 row for the local authority, the Regions row for the regional comparator, and the Countries/England row for the national comparator.
5. Replace "Rotherham Metropolitan Borough", "Rotherham", "South Yorkshire", and similar place references with the correct place name for the current project (use the `geo_name` values in the CSV, or leave as `[INSERT LOCAL AUTHORITY NAME]` if not determinable).
6. Reproduce all tables with the correct data from the CSV. Where data is not available in the CSV, mark the cell as `[DATA NOT AVAILABLE]`.
7. Do not add sections, remove sections, or change the document structure.
8. Output as HTML: `<h1>` for top-level headings, `<h2>` for section headings, `<h3>` for sub-headings, `<p>` for paragraphs, `<table>/<thead>/<tbody>/<tr>/<th>/<td>` for tables, `<ul>/<li>` for bullet lists. No `<html>`, `<head>`, `<body>`, `<style>`, or `<script>` tags. No markdown.

---

## Socio-economic Data (CSV)

The following CSV contains socio-economic statistics for the local authority, region, and national level. Use these to populate all data sections in the document.

{{SOCIO_DATA}}

---

## Briefing Notes

{{BRIEFING_NOTES}}

---

## Template Document

Reproduce the following document, replacing Rotherham data with data from the CSV above, and preserving all [PLACEHOLDER] and [INSERT X] tags exactly.

---

# [INSERT SITE NAME]

[add image]

# Socio-Economic Baseline Assessment

**Applicant:** [INSERT APPLICANT]
**Date:** XX/XX/2025

---

# Executive Summary

This report has been prepared by [INSERT CONSULTANT] on behalf of [INSERT APPLICANT] to assess the social and economic characteristics of the area surrounding the proposed development of [INSERT SITE NAME], a [INSERT CAPACITY / DEVELOPMENT TYPE] on approximately [INSERT HECTARES] hectares of land within [INSERT LOCAL AUTHORITY].

The study area has been defined as [INSERT LOCAL AUTHORITY], based on the site's location within the local authority area and the anticipated area within which the principal socio-economic effects of the proposed development are likely to be experienced. This should be reviewed following confirmation of the site's Travel to Work Area and local commuting flow characteristics.

The baseline research is structured into the themes of population and demographics, employment, qualifications, health, commuting patterns, access to renewable energy, deprivation, tourism, and agricultural land.

## Population & Demographics

[Reproduce this section using CSV data for the local authority, region and England.]

## Employment

[Reproduce this section using BRES data from the CSV.]

## Economic Activity

[Reproduce this section using Annual Population Survey and UK Business Counts data from the CSV.]

## Qualifications

[Reproduce this section using Census 2021 qualifications data from the CSV.]

## Health

[Reproduce this section using Census 2021 general health data from the CSV.]

## Commuting Patterns

[Reproduce this section using method of travel and car availability data from the CSV.]

## Access to Renewable Energy

[INSERT LOCAL AUTHORITY] has existing renewable energy infrastructure across a range of technologies, including photovoltaics, onshore wind, hydro and anaerobic digestion. [PLACEHOLDER – Insert renewable energy generation and installed capacity summary once confirmed.] Existing renewable energy generation should be assessed against domestic and total electricity consumption in the Borough to understand the extent to which local renewable energy currently contributes to local energy demand.

## Deprivation

[PLACEHOLDER – Insert IMD summary for [INSERT LOCAL AUTHORITY], including the proportion of LSOAs within the 10%, 20% and 50% most deprived areas nationally. Include site-specific LSOA deprivation commentary.]

## Tourism

[PLACEHOLDER – Insert tourism and visitor economy summary for [INSERT LOCAL AUTHORITY]. Include reference to relevant local tourism, recreation, visitor economy or leisure strategies.]

## Agricultural Land

[PLACEHOLDER – Insert Agricultural Land Classification summary, including the proportion of the site falling within each ALC grade, the extent of Best and Most Versatile agricultural land, current agricultural use, and whether effects would be temporary or permanent.]

---

# Contents

Executive Summary
Contents
1.0 Introduction
1.1 Overview
2.0 Defining the Study Area
2.1 Site Location
2.2 Travel to Work Areas
2.2.1 Commuting Patterns
2.3 Construction Employment
2.4 Summary
3.0 Socio-Economic Baseline
3.1 Introduction
3.2 Economic Studies
3.3 Population & Demographics
3.3.1 Policy
3.4 Employment
3.4.1 Policy
3.5 Economic Activity
3.5.1 Policy
3.6 Qualifications
3.6.1 Policy
3.7 Health
3.7.1 Policy
3.8 Commuting Patterns
3.8.1 Policy
3.9 Access to Renewable Energy
3.9.1 Policy
3.10 Deprivation (IMD)
3.10.1 Policy
3.11 Tourism
3.11.1 Policy
3.12 Agricultural Land
3.12.1 Policy
4.0 Future Baseline
4.1 Population
4.2 Climate Change
4.3 Agriculture
5.0 References

---

**Version – 1**

Prepared by: [INSERT CONSULTANT]

Reference: [INSERT REFERENCE]

Applicant: [INSERT APPLICANT]

---

# 1.0 Introduction

## 1.1 Overview

This report identifies and assesses the baseline socioeconomic context related to the proposed development of [INSERT SITE NAME] at [INSERT SITE LOCATION], within [INSERT LOCAL AUTHORITY].

To assess the baseline characteristics relevant to the proposed development, this assessment defines a suitable study area, reviews relevant policy context and analyses socioeconomic data for the study area. The Baseline Assessment provides the basis for assessing the sensitivity of receptors within the Socio-Economic Impact Assessment and, subsequently, the significance of impact.

The proposed development comprises [INSERT DESCRIPTION OF DEVELOPMENT, INCLUDING CAPACITY, LAND AREA, TECHNOLOGY TYPE, GRID CONNECTION, CONSTRUCTION PERIOD AND OPERATIONAL LIFETIME WHERE RELEVANT].

---

# 2.0 Defining the Study Area

## 2.1 Site Location

The proposed development boundary is shown in Figure 1. The development area measures approximately [INSERT AREA] hectares and is located within [INSERT LOCAL AUTHORITY]. The site is located at [INSERT SITE LOCATION / NEAREST SETTLEMENT].

[PLACEHOLDER – Insert description of the site's relationship to nearby settlements, roads, administrative boundaries and relevant Travel to Work Area.]

**Figure 1 – Travel to Work Areas**
[PLACEHOLDER – Insert Travel to Work Area figure]

## 2.2 Travel to Work Areas

Travel to Work Areas are a useful starting point for understanding the spatial extents of labour markets. Each TTWA has a high degree of self-containment, meaning that the vast majority of people who work within a TTWA also live in that same area. In September 2016, the Office for National Statistics published its latest TTWA boundaries, derived from Census 2011 data. The TTWA boundaries were not redefined in 2021, largely as a result of the significant impact the COVID-19 pandemic had on commuting patterns.

[PLACEHOLDER – Insert site-specific TTWA analysis, including the TTWA within which the site is located and any relevant relationship with adjoining TTWAs.]

In this case, the study area has been defined as [INSERT LOCAL AUTHORITY], reflecting the site's location and the likely local labour market from which construction and operational labour may be drawn. To test this further, commuting patterns should be assessed using Census origin-destination data.

## 2.2.1 Commuting Patterns

In addition to TTWAs it is also useful to analyse Census data on the average distance travelled to work and the movement of workers into and out of the study area.

[PLACEHOLDER – Insert commuting inflow and outflow analysis for [INSERT LOCAL AUTHORITY], including the number of residents who live and work in the area, the number commuting into the Borough, the number commuting out, and the main neighbouring local authorities involved.]

The above data should be used to determine whether there is significant self-containment of employment within the local authority boundary area, and whether it is appropriate to use [INSERT LOCAL AUTHORITY] as the study area for the assessment.

**Figure 2 – [INSERT LOCAL AUTHORITY] Inflows & Outflows**
[PLACEHOLDER – Insert inflow/outflow figure]

## 2.3 Construction Employment

Most of the employment generated by the proposed development will be related to construction and thus it is important when considering an appropriate study area for assessment to assess whether there is a sufficient number of local residents employed within the construction sector to support the employment requirements, or whether residents from nearby authorities are likely to be required to commute in.

Business Register and Employment Survey data estimates the number of construction workers within each local authority. [Populate with construction employment number and % from CSV BRES data, comparing to regional and national averages.]

[PLACEHOLDER – Insert specialist construction subsector data, including construction of utility projects and electrical, plumbing and other construction installation activities, if available.]

## 2.4 Summary

On the basis of the above analysis of TTWAs and Census data on commuting patterns, and given that the largest impact is expected to relate to employment, the area that is likely to experience the greatest social and economic impact from the proposed development is [INSERT LOCAL AUTHORITY] as a whole.

[PLACEHOLDER – Confirm this conclusion following review of TTWA boundaries and commuting inflow/outflow data.]

---

# 3.0 Socio-Economic Baseline

## 3.1 Introduction

This section defines the baseline socio-economic characteristics of the study area based on desktop research. Where appropriate, the data is also analysed at regional and national level.

The baseline research is split into the receptors of population, demographics, employment, qualifications, health, commuting patterns, access to renewable energy, deprivation and tourism.

The majority of the baseline data used for this assessment has been taken from the Office for National Statistics Census 2021, Census 2011, Annual Population Survey, Business Register and Employment Survey, UK Business Counts, electric vehicle charging statistics, renewable energy statistics and population projections.

## 3.2 Economic Studies

[PLACEHOLDER – Insert summary of relevant [INSERT LOCAL AUTHORITY] economic baseline studies, local economic strategies, employment land reviews, regional economic evidence, regeneration strategies and/or local growth plans.]

This section should identify the principal economic characteristics of [INSERT LOCAL AUTHORITY], including the structure of the local economy, key sectors, employment land supply, skills profile, productivity, deprivation, regeneration priorities and opportunities for inward investment.

## 3.3 Population & Demographics

[Populate using 2011 Census total, 2021 Census total, and working age % data from the CSV for the local authority, region and England. Calculate population growth % between 2011 and 2021. Compare working age % for local authority, region and England. Note whether the working age proportion has increased or decreased since 2011.]

[PLACEHOLDER – Insert median age and age-band analysis for [INSERT LOCAL AUTHORITY], [INSERT REGION], and England.]

**Figure 3 – Working Age Population**
[PLACEHOLDER – Insert working-age population figure]

## 3.3.1 Policy

[PLACEHOLDER – Insert policy review for population and demographics within the [INSERT LOCAL AUTHORITY] Local Plan, Core Strategy, housing strategy or other relevant local policy documents.]

Therefore, population and demographics is considered to be [INSERT ASSESSMENT OF POLICY IMPORTANCE] in [INSERT LOCAL AUTHORITY].

## 3.4 Employment

[Populate using BRES data from the CSV. List total employment, top sectors by number and %, and compare manufacturing and construction % against regional and national averages. Reproduce Table 1 with all 19 BRES sectors for the local authority, region and England.]

[Reproduce Table 2 – Occupation by Location using Census 2021 occupation data from the CSV for all 9 SOC categories, comparing local authority, region and England %.]

[Populate unemployment rate and trend from Annual Population Survey data in the CSV, using the most recent period and comparing to regional and national rates. Note the range over the time series.]

**Figure 4 – Unemployment Rate**
[PLACEHOLDER – Insert unemployment rate chart]

## 3.4.1 Policy

[PLACEHOLDER – Insert employment policy review from the [INSERT LOCAL AUTHORITY] Local Plan, economic strategy, employment land evidence base and regional policy documents.]

Based on the above, employment is considered to be [INSERT ASSESSMENT OF POLICY IMPORTANCE] in the study area.

## 3.5 Economic Activity

[Populate using UK Business Counts data from the CSV: total businesses, micro, small, medium, large counts. Reproduce Table 3 for local authority, region and England.]

[Populate economic activity rate and trend using Annual Population Survey data from the CSV. Reproduce Table 4 with all 8 time periods for local authority, region and England. Note the range and most recent value.]

[Reproduce Table 5 – Reason for Economic Inactivity using regional economic inactivity data from the CSV.]

## 3.5.1 Policy

[PLACEHOLDER – Insert policy review relating to economic activity, business growth, enterprise, productivity, investment and local economic development.]

Subsequently, economic output is assumed to be [INSERT ASSESSMENT OF POLICY IMPORTANCE].

## 3.6 Qualifications

[Populate using Census 2021 qualifications data from the CSV. Reproduce Table 6 with all qualification levels for local authority, region and England. Note Level 4+ % and No qualifications % relative to regional and national averages.]

[Use regional NEET data from the CSV. Note the most recent quarter and compare to England average.]

[PLACEHOLDER – Insert local [INSERT LOCAL AUTHORITY] NEET data if available.]

## 3.6.1 Policy

[PLACEHOLDER – Insert education, skills and training policy review for [INSERT LOCAL AUTHORITY] and the relevant region.]

Therefore, improving education is viewed to be [INSERT ASSESSMENT OF POLICY IMPORTANCE] in [INSERT LOCAL AUTHORITY].

## 3.7 Health

[Populate using Census 2021 general health data from the CSV. Note the % reporting very good health for the local authority, region and England. Reproduce Table 7 with all five health categories.]

## 3.7.1 Policy

[PLACEHOLDER – Insert health and wellbeing policy review, including any references to health inequalities, active travel, open space, air quality and healthy communities.]

Therefore, health is considered to be [INSERT ASSESSMENT OF POLICY IMPORTANCE] in policy.

## 3.8 Commuting Patterns

[Populate using method of travel data from the CSV. Note driving a car % and work from home % for the local authority, region and England. Reproduce Table 8 with all travel modes.]

[Populate car availability data from the CSV: % with no car, 1 car, 2 cars, 3+ cars.]

**Figure 5 – Car or Van Availability**
[PLACEHOLDER – Insert car or van availability chart]

[Populate EV charging data from the CSV: note the earliest and most recent counts and calculate the increase. Use the quarterly time-series columns (Oct-19 through Apr-25).]

[PLACEHOLDER – Insert plug-in vehicle licensing data and calculate the proportion of registered vehicles that are plug-in vehicles.]

**Figure 6 – Electric Vehicle Charging Points, Study Area**
[PLACEHOLDER – Insert EV charging points chart]

## 3.8.1 Policy

[PLACEHOLDER – Insert transport and accessibility policy review for [INSERT LOCAL AUTHORITY], including public transport, active travel, EV charging, parking, construction traffic and sustainable transport.]

Therefore, commuting patterns are considered to be [INSERT ASSESSMENT OF POLICY IMPORTANCE].

## 3.9 Access to Renewable Energy

[Populate using renewables data from the CSV: list technologies present (photovoltaics, onshore wind, hydro, anaerobic digestion etc.) and their counts/capacities where available.]

[PLACEHOLDER – Insert latest renewable electricity generation statistics for [INSERT LOCAL AUTHORITY], including generation by technology in MWh and installed capacity by technology in MW.]

[PLACEHOLDER – Insert domestic electricity consumption, non-domestic electricity consumption and total electricity consumption for [INSERT LOCAL AUTHORITY].]

At the time of writing this report, the cost of non-renewable energy resources has risen significantly compared with historic levels. Rising energy costs may have particular implications for households in areas experiencing deprivation or fuel poverty, with potential impacts on health, social and economic wellbeing.

[PLACEHOLDER – Insert CPI energy price trend, regional electricity and gas prices, and latest Contracts for Difference strike price commentary where required.]

Currently, however, due to the way the UK electricity market is set up, local renewable energy generation does not necessarily translate directly into lower household bills in the locality where that energy is produced. For energy savings to be felt locally, appropriate market mechanisms, local supply arrangements or community benefit measures would be required.

## 3.9.1 Policy

[PLACEHOLDER – Insert renewable energy, climate change and net zero policy review for [INSERT LOCAL AUTHORITY] and the relevant region.]

Therefore, access to renewable energy is considered to be [INSERT ASSESSMENT OF POLICY IMPORTANCE] within [INSERT LOCAL AUTHORITY].

## 3.10 Deprivation (IMD)

The Index of Multiple Deprivation is the UK Government's official measure of relative deprivation for small areas. It is a National Statistic and is produced by statisticians at the UK Government. IMD identifies areas with the highest concentrations of several different types of deprivation.

The prime purpose of the index is to provide the evidence needed about the most deprived areas of the UK to inform a variety of decisions, such as funding or targeting of programmes and services for local areas. IMD ranks all small areas in England from 1, most deprived, to 32,844, least deprived. The small areas are otherwise known as Lower Layer Super Output Areas.

IMD is currently made up of seven separate domains of deprivation. Each domain is compiled from a range of different indicators. The domains included in IMD 2019 are income; employment; health and disability; education, skills and training; barriers to housing and services; crime; and living environment.

[PLACEHOLDER – Insert IMD analysis for [INSERT LOCAL AUTHORITY], including the proportion of LSOAs falling within the top 10%, 20% and 50% most deprived nationally.]

[PLACEHOLDER – Insert site-specific IMD analysis, identifying the LSOA within which the proposed development is located and its national deprivation decile.]

**Figure 7 – Overall Index of Multiple Deprivation**
[PLACEHOLDER – Insert overall IMD map]

[PLACEHOLDER – Insert education, skills and training deprivation analysis, including the number and proportion of [INSERT LOCAL AUTHORITY] LSOAs falling within the most deprived deciles nationally.]

**Figure 8 – Educational Index of Multiple Deprivation**
[PLACEHOLDER – Insert education deprivation map]

## 3.10.1 Policy

[PLACEHOLDER – Insert deprivation policy review, including inclusive growth, regeneration, health inequalities, education, employment and access to services.]

Therefore, deprivation is assessed as [INSERT ASSESSMENT OF POLICY IMPORTANCE] within [INSERT LOCAL AUTHORITY].

## 3.11 Tourism

[PLACEHOLDER – Insert summary of relevant tourism, recreation, leisure and visitor economy strategies for [INSERT LOCAL AUTHORITY].]

This section should consider the role of tourism and recreation in the local economy, including visitor numbers, visitor spend, local attractions, accommodation supply, seasonal trends and the importance of public access to the countryside where relevant.

[PLACEHOLDER – Insert visitor economy data for [INSERT LOCAL AUTHORITY], including visitor numbers, spend, accommodation occupancy and any relevant comparison with regional or national benchmarks.]

In addition to the above, an analysis of the Public Rights of Way in close proximity to the development site should be carried out to assess whether there is opportunity for recreational walking or cycling tourism in or around the development site.

[PLACEHOLDER – Insert PRoW analysis, including reference to any public footpaths, bridleways or promoted routes within or close to the proposed development site.]

Enjoyment of PRoW by tourists and recreational users could be impacted due to noise and visual impacts associated with construction and operation of the development.

[PLACEHOLDER – Insert site-specific assessment of nearby PRoW and recreational receptors.]

**Figure 9 – Public Rights of Way, Study Area**
[PLACEHOLDER – Insert PRoW map]

## 3.11.1 Policy

[PLACEHOLDER – Insert tourism, recreation and leisure policy review for [INSERT LOCAL AUTHORITY].]

Therefore, tourism is considered to be [INSERT ASSESSMENT OF POLICY IMPORTANCE] in [INSERT LOCAL AUTHORITY].

## 3.12 Agricultural Land

[PLACEHOLDER – Insert Agricultural Land Classification survey results.]

An Agricultural Land Classification survey should be undertaken to support the planning application. This should identify the proportion of the development site within each agricultural land grade and confirm whether any of the site comprises Best and Most Versatile agricultural land.

[PLACEHOLDER – Insert percentage of site within Grade 1, Grade 2, Grade 3a, Grade 3b, Grade 4 and/or Grade 5.]

[PLACEHOLDER – Insert description of current agricultural use, including crop types, grazing, land management and recent farming history.]

The process of installing the proposed development should be assessed in terms of the extent of soil disturbance and whether any areas of agricultural land would be temporarily or permanently lost. Particular consideration should be given to access tracks, substations, inverter stations, construction compounds and any other areas where soil movement or land take would occur.

[PLACEHOLDER – Insert assessment of temporary and permanent loss of agricultural land, restoration potential and decommissioning assumptions.]

## 3.12.1 Policy

[PLACEHOLDER – Insert agricultural land policy review, including national planning policy and relevant local policy on Best and Most Versatile agricultural land, rural economy and land use.]

Therefore, agricultural land is considered to be [INSERT ASSESSMENT OF POLICY IMPORTANCE].

---

# 4.0 Future Baseline

## 4.1 Population

[Populate using population projections data from the CSV. State the 2018 baseline and 2043 projection for the local authority, calculating the % change. Break down by age groups: 0-15, 16-64, 65+. Note the projected change in working-age proportion and the ageing population trend.]

**Figure 10 – Population Projection, [INSERT LOCAL AUTHORITY]**
[PLACEHOLDER – Insert population projection chart]

## 4.2 Climate Change

Climate change is not considered to have a significant direct impact upon the socio-economic baseline. Increases to the cost of fossil fuels may result in rising household bills, consequently making home ownership and day-to-day living costs more expensive. However, there should also be a greater take-up of green energy, low-carbon technology and electric vehicle ownership which may combat this.

[Populate with EV charging growth trend from the CSV, noting the change from the earliest to the most recent data point.]

[PLACEHOLDER – Insert local climate change policy, renewable energy targets and net zero commitments.]

Overall, the baseline is not expected to be significantly affected by the impacts of climate change, although energy affordability, decarbonisation and infrastructure resilience are likely to remain increasingly important socio-economic considerations.

## 4.3 Agriculture

In Great Britain, there has been an observed decline in the farming and agriculture industry. [PLACEHOLDER – Insert latest BRES time-series data for agriculture, forestry and fishing, or crop and animal production, hunting and related service activities.]

Subsequently, it might be expected that farming businesses move away from traditional farming methods and diversify into renewable energy or other sectors.

[PLACEHOLDER – Insert site-specific commentary on agricultural diversification, current farming operations, land quality and potential future agricultural baseline.]

---

# 5.0 References

[PLACEHOLDER – Insert full reference list in the same format as the template report.]

Potential sources to include:

Annual Population Survey. Economic Activity. Nomis.

Annual Population Survey. Economic Inactivity by Reason. Nomis.

Business Register and Employment Survey. Office for National Statistics / Nomis.

Census 2011. Age Structure. Office for National Statistics / Nomis.

Census 2021. Age by Single Year. Office for National Statistics / Nomis.

Census 2021. General Health. Office for National Statistics / Nomis.

Census 2021. Highest Level of Qualification. Office for National Statistics / Nomis.

Census 2021. Method of Travel to Work. Office for National Statistics / Nomis.

Census 2021. Occupation. Office for National Statistics / Nomis.

Department for Transport. Electric Vehicle Public Charging Infrastructure Statistics.

Department for Transport and Driver and Vehicle Licensing Agency. Licensed Plug-in Vehicles.

Department for Energy Security and Net Zero. Renewable Electricity by Local Authority.

Ministry of Housing, Communities & Local Government. English Indices of Multiple Deprivation 2019.

Office for National Statistics. Population Projections.

[INSERT LOCAL AUTHORITY] Council. [PLACEHOLDER – Insert Local Plan / Core Strategy reference.]

[INSERT LOCAL AUTHORITY] Council. [PLACEHOLDER – Insert economic strategy / employment / skills / health / transport / climate / tourism policy references.]

[INSERT REGIONAL AUTHORITY / COMBINED AUTHORITY]. [PLACEHOLDER – Insert relevant regional strategy references.]$prompt$
WHERE slug = 'socio_economic_baseline';
