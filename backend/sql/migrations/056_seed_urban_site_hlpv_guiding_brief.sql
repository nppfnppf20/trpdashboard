-- Seed a Guiding Brief for the HLPV narrative — Urban Site development type
-- guidance_content: injected into LLM system prompt when generating the narrative
-- review_checklist: used by the "Check brief" button to assess the draft

INSERT INTO admin_console.guiding_briefs
  (name, document_type, development_type, guidance_content, review_checklist, sort_order)
VALUES (
  'Urban Site HLPV',
  'hlpv',
  'Urban Site',

  -- ───────────────────────────────────────────────────────────────────────────
  -- GUIDANCE CONTENT
  -- ───────────────────────────────────────────────────────────────────────────
  $guidance$
## Urban Site HLPV – Company Process Note

The assessment should focus on planning principle, policy context, site constraints and key risks. It is not intended to resolve detailed design matters at this stage.

### 1. Overall Approach
The assessment should be iterative and structured. The output is a planning suitability view, not a design solution.

Key steps:
- Start with allocations and growth context
- Establish existing lawful use
- Review the relevant policy framework
- Assess the principle of development
- Identify constraints and survey requirements
- Review nearby consents and appeals
- Distinguish between fatal issues, manageable risks and design-led challenges

### 2. Site Allocations & Growth Area Context
Before detailed assessment, confirm whether the site is:
- Specifically allocated
- Within a growth, opportunity, regeneration or town-centre area
- Subject to any site-specific development guidance

Allocations are often the starting point for urban planning assessment and may carry significant weight in establishing the principle of development. An allocation may indicate acceptable uses, development capacity, height and massing expectations, access or public realm requirements, and site-specific constraints.

### 3. Existing Use & Lawful Planning Position
Establish the current lawful planning use of the site. Sources may include planning history, officer reports, decision notices, existing consents, lawful development certificates, and site records.

Where lawful use cannot be conclusively established, a working assumption can be made, but it should be clearly caveated and linked to available evidence.

### 4. Principle of Development & Use Acceptability
Assess whether the proposed use or mix of uses is acceptable in principle, including:
- Strategic policy support
- Local Plan policy position
- Site allocation requirements
- Existing use protections
- Compatibility with surrounding uses
- Any policy restrictions or land-use designations

Where the proposed use is not clearly supported, identify which elements are problematic, whether alternative uses may be more policy-compliant, and whether planning benefits could help address policy conflict.

### 5. Policy Framework Review
Review the full statutory development plan and any relevant guidance, including London Plan or equivalent strategic policy, Local Plan policies, supplementary planning documents, site allocations, and emerging policy where relevant. Where policies differ, planning judgement is required.

### 6. Planning History and Lawful Fallback
Review the site's planning history carefully. For previous consents, confirm whether permission was granted, whether any Section 106 agreement was completed, whether the permission was implemented, and whether it establishes a lawful fallback position.

### 7. Housing Delivery, 5YHLS & Tilted Balance
For residential or mixed-use schemes involving housing, check whether the local planning authority has a compliant five-year housing land supply and is passing the Housing Delivery Test. If not, the tilted balance may apply, affording greater weight to the benefits of housing in the planning balance.

### 8. Constraints, Height & Designations
Initial views should be formed on height, massing and site capacity, informed by site allocation guidance, surrounding townscape, nearby approved schemes, heritage and amenity constraints, and public transport accessibility.

Common urban constraints include heritage, townscape, ecology and trees, amenity, transport and access, flood risk, contaminated land, air quality, noise, and utilities and servicing. Some constraints may be design-led and manageable, while others may materially affect the principle or deliverability of development.

### 9. Amenity Considerations
Assess likely impacts on existing neighbours, including daylight and sunlight, privacy and overlooking, noise, outlook, and sense of enclosure. Also consider the quality of accommodation for future occupiers, including noise, air quality, access to light, and relationship with neighbouring uses.

### 10. Transport & Highways
Key checks include public transport accessibility, car parking expectations, servicing and delivery access, pedestrian and cycle access, highway safety, and relationship with local and strategic transport policy. In London, PTAL should be reviewed — higher ratings may support car-free or low-car development.

### 11. Surveys & Technical Work
Surveys likely to be required may include ecology, arboriculture/trees, heritage, archaeology, townscape and visual impact, daylight and sunlight, highways and transport, flood risk and drainage, contaminated land, noise, and air quality. The exact scope depends on the site's location, condition, surrounding uses and proposed development.

### 12. Nearby Consents and Appeals
Review nearby permissions and appeals to understand how the local planning authority has interpreted policy in practice. Focus on comparable sites, comparable uses, similar designations or constraints, officer reasoning, and appeal outcomes.

### 13. CIL & PIL
Confirm whether the authority is a CIL charging authority. In London, Mayoral CIL applies and Borough CIL may also apply. Review the relevant charging schedule. PIL requirements should also be confirmed where relevant.

### 14. Output of the Assessment
The planning suitability assessment should conclude with a clear view on the principle of development, key policy risks, main constraints, likely survey requirements, relevant planning history, nearby consent evidence, design-critical issues, and an overall planning risk rating or suitability view.
$guidance$,

  -- ───────────────────────────────────────────────────────────────────────────
  -- REVIEW CHECKLIST
  -- ───────────────────────────────────────────────────────────────────────────
  $checklist$
## Urban Site HLPV – Review Checklist

### Allocations & Growth Context
- Whether the site is allocated, within a growth/opportunity/regeneration area, or subject to specific development guidance is addressed
- Any site-specific guidance on use, capacity, height or access is noted

### Existing Use & Lawful Position
- The current lawful planning use of the site is identified
- Sources of evidence for lawful use are referenced or caveated where uncertain

### Principle of Development
- Whether the proposed use is acceptable in principle is clearly addressed
- Relevant strategic and Local Plan policy is considered
- Compatibility with surrounding uses is discussed

### Policy Framework
- The development plan hierarchy (strategic and local) is reviewed
- Any supplementary planning guidance or emerging policy is noted where relevant

### Planning History & Fallback
- The site's planning history is reviewed
- Whether any previous consent was implemented and whether it creates a lawful fallback is addressed

### Housing Delivery & Tilted Balance
- Five-year housing land supply position and Housing Delivery Test status are checked for residential schemes
- Whether the tilted balance applies is noted where relevant

### Constraints & Designations
- Heritage constraints are identified and their implications for development are addressed
- Townscape and height considerations are discussed
- Ecology and tree constraints are noted
- Flood risk is addressed
- Contaminated land, air quality or noise constraints are flagged where relevant

### Amenity
- Impacts on neighbouring amenity (daylight, sunlight, privacy, noise, outlook) are addressed
- Quality of accommodation for future occupiers is considered

### Transport & Highways
- Public transport accessibility is addressed (PTAL in London)
- Car parking, servicing, cycle and pedestrian access are considered
- Highway safety is noted where relevant

### Surveys Required
- Required surveys are clearly listed based on site-specific constraints
- Daylight/sunlight, heritage, ecology, transport and flood risk surveys are flagged where appropriate

### Nearby Consents & Appeals
- Comparable nearby permissions or appeal decisions are referenced where available
- LPA policy interpretation is noted based on recent decisions

### CIL & PIL
- Whether the authority is a CIL charging authority is confirmed
- Relevant charging schedules and PIL requirements are noted

### Overall Conclusion
- A clear view on the principle of development is provided
- Key risks are summarised and given a steer (fatal / manageable / design-led)
- Overall planning risk rating or suitability view is stated
$checklist$,

  20
)
ON CONFLICT (document_type, COALESCE(development_type, ''))
DO UPDATE SET
  name             = EXCLUDED.name,
  guidance_content = EXCLUDED.guidance_content,
  review_checklist = EXCLUDED.review_checklist,
  sort_order       = EXCLUDED.sort_order,
  updated_at       = NOW();
