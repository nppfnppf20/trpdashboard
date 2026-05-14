-- Seed issue types from issuetypes.md.
-- Generic issues have development_type = NULL.
-- Renewables-specific variants are separate rows with development_type = 'Renewables'.

TRUNCATE admin_console.issue_types RESTART IDENTITY CASCADE;

INSERT INTO admin_console.issue_types (label, development_type, nppf_text, nppg_text, other_national_text, other_guidance_text, sort_order) VALUES

('Heritage', NULL,
$t$<p>The NPPF requires that in determining applications, local planning authorities should require an applicant to describe the significance of any heritage assets affected, including any contribution made by their setting.</p>$t$,
NULL, NULL, NULL, 0),

('Flood risk & drainage', NULL,
$t$<p>The requirements for Flood Risk Assessments are provided in the NPPF and associated PPG. Footnote 63 of Paragraph 181 of the NPPF (December 2024) requires that a site-specific FRA should be submitted with planning applications for all sites greater than 1 ha in Flood Zone 1.</p>$t$,
NULL, NULL, NULL, 1),

('Air Quality', NULL, NULL, NULL, NULL, NULL, 2),

('Amenity', NULL,
$t$<p>Paragraph 135 of the National Planning Policy Framework (NPPF, December 2024) states that planning decisions should ensure developments create places with a high standard of amenity for existing and future users.</p>$t$,
NULL, NULL, NULL, 3),

('Noise', NULL,
$t$<p>Paragraph 198 of the National Planning Policy Framework (NPPF) (2024) states that planning policies and decisions should ensure that new development is appropriate for its location, taking into account the likely effects of pollution—including noise—on health, living conditions and the natural environment. Specifically, it requires decisions to:</p>
<blockquote><p>"(a) mitigate and reduce to a minimum potential adverse impacts resulting from noise from new development – and avoid noise giving rise to significant adverse impacts on health and the quality of life;"</p></blockquote>
<p>Additionally, paragraph 187(e) of the NPPF emphasises the importance of:</p>
<blockquote><p>"preventing new and existing development from contributing to, being put at unacceptable risk from, or being adversely affected by, unacceptable levels of… noise pollution…"</p></blockquote>
<p>The NPPF refers to the Noise Policy Statement for England (NPSE) which applies to all forms of noise and includes environmental noise.</p>$t$,
$t$<p>The NPPG reflects the NPSE stating that noise needs to be considered when new developments may create additional noise and that opportunities should, where possible, be taken to improve the acoustic environment.</p>$t$,
NULL, NULL, 4),

('Energy', NULL, NULL, NULL, NULL, NULL, 5),

('Fire safety', NULL, NULL, NULL, NULL, NULL, 6),

('Daylight / sunlight', NULL, NULL, NULL, NULL, NULL, 7),

('Arboriculture', NULL,
$t$<p>Paragraph 187(b) of the NPPF (2024) states that planning policies and decisions should contribute to and enhance the natural and local environment by recognising the intrinsic character and beauty of the countryside, and the wider benefits from natural capital and ecosystem services – including the benefits of trees and woodland.</p>$t$,
NULL, NULL, NULL, 8),

('Ecology', NULL,
$t$<p>Chapter 15 of the NPPF, Conserving and enhancing the natural environment, signifies the national government's commitments to enhancing biodiversity and natural capital. Paragraph 193 requires that "if significant harm to biodiversity resulting from a development cannot be avoided…. Adequately mitigated, or as a last resort compensated for, then planning permission should be refused." Likewise, "development whose primary objective is to conserve or enhance biodiversity should be supported; while opportunities to improve biodiversity in and around developments should be integrated as part of their design, especially where this can secure measurable net gains for biodiversity or enhance public access to nature where this is appropriate."</p>$t$,
NULL, NULL, NULL, 9),

('Green Belt', NULL, NULL, NULL, NULL, NULL, 10),

('Townscape and visual impact', NULL, NULL, NULL, NULL, NULL, 11),

('Transport and access', NULL,
$t$<p>Section 9 of the NPPF requires LPAs to consider and promote sustainable forms of transport whilst addressing community needs and creating places that are safe, secure and attractive which minimise the scope for conflicts between pedestrians, cyclists and vehicles.</p>$t$,
NULL, NULL, NULL, 12),

('Landscape and visual effects', NULL, NULL, NULL, NULL, NULL, 13),

('Landscape and visual effects', 'Solar',
$t$<p>Paragraph 165 of the NPPF states that "to help increase the use and supply of renewable and low carbon energy and heat, plans should" maximise "the potential for suitable development, while ensuring that adverse impacts are addressed appropriately (including cumulative landscape and visual impacts)".</p>$t$,
$t$<p>The NPPG (Reference ID: 5-013-20150327) states that "the visual impact of a well-planned and well-screened solar farm can be properly addressed within the landscape if planned sensitively."</p>$t$,
NULL, NULL, 14),

('Landscape and visual effects', 'Wind',
$t$<p>Paragraph 165 of the NPPF states that "to help increase the use and supply of renewable and low carbon energy and heat, plans should" maximise "the potential for suitable development, while ensuring that adverse impacts are addressed appropriately (including cumulative landscape and visual impacts)".</p>$t$,
$t$<p>The NPPG (Reference ID: 5-013-20150327) states that "the visual impact of a well-planned and well-screened solar farm can be properly addressed within the landscape if planned sensitively."</p>$t$,
NULL, NULL, 15),

('Landscape and visual effects', 'Synchronous condensers',
$t$<p>Paragraph 165 of the NPPF states that "to help increase the use and supply of renewable and low carbon energy and heat, plans should" maximise "the potential for suitable development, while ensuring that adverse impacts are addressed appropriately (including cumulative landscape and visual impacts)".</p>$t$,
$t$<p>The NPPG (Reference ID: 5-013-20150327) states that "the visual impact of a well-planned and well-screened solar farm can be properly addressed within the landscape if planned sensitively."</p>$t$,
NULL, NULL, 16),

('Agricultural land', NULL, NULL, NULL, NULL, NULL, 17),

('Agricultural land', 'Solar',
$t$<p>The NPPF seeks for planning decisions to contribute to the enhancement of the natural and local environment, including by "recognising… the wider benefits from natural capital and ecosystem services – including the economic and other benefits of the best and most versatile agricultural land" (Paragraph 187(b)).</p>
<p>Footnote 65 notes that "Where significant development of agricultural land is demonstrated to be necessary, areas of poorer quality land should be preferred to those of a higher quality."</p>
<p>However, the December 2024 NPPF removes the reference to the availability of land for food production to be considered.</p>$t$,
$t$<p>The supporting NPPG sets out the particular factors a local planning authority will need to consider:</p>
<blockquote><p>"Encouraging the effective use of land by focussing large scale solar farms on previously developed and non-agricultural land, provided that it is not of high environmental value; Where a proposal involves greenfield land, whether (i) the proposed use of any agricultural land has been shown to be necessary and poorer quality land has been used in preference to higher quality land; and (ii) the proposal allows for continued agricultural use where applicable and/or encourages biodiversity improvements around arrays." (Reference ID: 5-013-20150327)</p></blockquote>$t$,
$t$<p>The Written Ministerial Statement (WMS) 'Solar and protecting our Food Security and Best and Most Versatile (BMV) Land' (May 2024) highlights the current progress towards net zero through deployment of renewable energy and emphasises the importance of solar in meeting these targets. The WMS directs solar farms to lower grade land emphasising the weight of each land grade scale, with Grade 1 being of best quality and Grade 5 being of poorest (best and most versatile land is considered to be 1, 2 and 3a). According to the statement, the higher the land grade, the more "there is a greater onus on developers to show that the use of higher quality land is necessary".</p>$t$,
$t$<p>The National Policy Statement Energy EN-1 (January 2024), which is also a material consideration for local level schemes, outlines that development should not be on best and most versatile land without justification. However, it is stated "where development of agricultural land is demonstrated to be necessary, areas of poorer quality land should be preferred to those of a higher quality" (Paragraph 5.11.34).</p>
<p>The NPS for Renewable Energy Infrastructure EN-3 (January 2024) is also a material consideration in decision making at local level and confirms that while the preference should be to use lower grade agricultural land, this should not be the predominating factor in site selection (Paragraph 2.10.29).</p>$t$,
18),

('Agricultural land', 'Wind',
$t$<p>The NPPF seeks for planning decisions to contribute to the enhancement of the natural and local environment, including by "recognising… the wider benefits from natural capital and ecosystem services – including the economic and other benefits of the best and most versatile agricultural land" (Paragraph 187(b)).</p>
<p>Footnote 65 notes that "Where significant development of agricultural land is demonstrated to be necessary, areas of poorer quality land should be preferred to those of a higher quality."</p>
<p>However, the December 2024 NPPF removes the reference to the availability of land for food production to be considered.</p>$t$,
$t$<p>The supporting NPPG sets out the particular factors a local planning authority will need to consider:</p>
<blockquote><p>"Encouraging the effective use of land by focussing large scale solar farms on previously developed and non-agricultural land, provided that it is not of high environmental value; Where a proposal involves greenfield land, whether (i) the proposed use of any agricultural land has been shown to be necessary and poorer quality land has been used in preference to higher quality land; and (ii) the proposal allows for continued agricultural use where applicable and/or encourages biodiversity improvements around arrays." (Reference ID: 5-013-20150327)</p></blockquote>$t$,
$t$<p>The Written Ministerial Statement (WMS) 'Solar and protecting our Food Security and Best and Most Versatile (BMV) Land' (May 2024) highlights the current progress towards net zero through deployment of renewable energy and emphasises the importance of solar in meeting these targets. The WMS directs solar farms to lower grade land emphasising the weight of each land grade scale, with Grade 1 being of best quality and Grade 5 being of poorest (best and most versatile land is considered to be 1, 2 and 3a). According to the statement, the higher the land grade, the more "there is a greater onus on developers to show that the use of higher quality land is necessary".</p>$t$,
$t$<p>The National Policy Statement Energy EN-1 (January 2024), which is also a material consideration for local level schemes, outlines that development should not be on best and most versatile land without justification. However, it is stated "where development of agricultural land is demonstrated to be necessary, areas of poorer quality land should be preferred to those of a higher quality" (Paragraph 5.11.34).</p>
<p>The NPS for Renewable Energy Infrastructure EN-3 (January 2024) is also a material consideration in decision making at local level and confirms that while the preference should be to use lower grade agricultural land, this should not be the predominating factor in site selection (Paragraph 2.10.29).</p>$t$,
19),

('Agricultural land', 'Synchronous condensers',
$t$<p>The NPPF seeks for planning decisions to contribute to the enhancement of the natural and local environment, including by "recognising… the wider benefits from natural capital and ecosystem services – including the economic and other benefits of the best and most versatile agricultural land" (Paragraph 187(b)).</p>
<p>Footnote 65 notes that "Where significant development of agricultural land is demonstrated to be necessary, areas of poorer quality land should be preferred to those of a higher quality."</p>
<p>However, the December 2024 NPPF removes the reference to the availability of land for food production to be considered.</p>$t$,
$t$<p>The supporting NPPG sets out the particular factors a local planning authority will need to consider:</p>
<blockquote><p>"Encouraging the effective use of land by focussing large scale solar farms on previously developed and non-agricultural land, provided that it is not of high environmental value; Where a proposal involves greenfield land, whether (i) the proposed use of any agricultural land has been shown to be necessary and poorer quality land has been used in preference to higher quality land; and (ii) the proposal allows for continued agricultural use where applicable and/or encourages biodiversity improvements around arrays." (Reference ID: 5-013-20150327)</p></blockquote>$t$,
$t$<p>The Written Ministerial Statement (WMS) 'Solar and protecting our Food Security and Best and Most Versatile (BMV) Land' (May 2024) highlights the current progress towards net zero through deployment of renewable energy and emphasises the importance of solar in meeting these targets. The WMS directs solar farms to lower grade land emphasising the weight of each land grade scale, with Grade 1 being of best quality and Grade 5 being of poorest (best and most versatile land is considered to be 1, 2 and 3a). According to the statement, the higher the land grade, the more "there is a greater onus on developers to show that the use of higher quality land is necessary".</p>$t$,
$t$<p>The National Policy Statement Energy EN-1 (January 2024), which is also a material consideration for local level schemes, outlines that development should not be on best and most versatile land without justification. However, it is stated "where development of agricultural land is demonstrated to be necessary, areas of poorer quality land should be preferred to those of a higher quality" (Paragraph 5.11.34).</p>
<p>The NPS for Renewable Energy Infrastructure EN-3 (January 2024) is also a material consideration in decision making at local level and confirms that while the preference should be to use lower grade agricultural land, this should not be the predominating factor in site selection (Paragraph 2.10.29).</p>$t$,
20),

('Principle of development', NULL, NULL, NULL, NULL, NULL, 21);
