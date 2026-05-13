# HLPV Narrative Tab — Handoff Notes

## Tab order in the HLPV tool
Site Analysis → Initial Report → Edit Report → **Narrative**

Both Edit Report and Narrative tabs appear only when `trpReportVisible || loadedFromSaved`.

---

## What was built / changed

### New file: `frontend/src/lib/components/hlpv/NarrativeTab.svelte`
Standalone tab component that:
- Accepts the same raw data props as TRPReportEditor (heritageData, landscapeData, etc.) + projectId
- Internally derives `disciplines` via `buildCombinedReport`
- Shows only disciplines where `triggeredRules.length > 0`
- Renders `NarrativeBriefingSelector` dropdown + "Generate narrative" / "Regenerate all" button in a toolbar
- Shows a dashed placeholder per discipline before generation, then `NarrativePanel` (rich text editor) once a narrative exists
- Before calling `generateNarrative`, augments each discipline object with a `designationDetails` string built from the raw feature data (listed building names + grades + distances, conservation area names, SSSI names, ancient woodland names, ag land grades, etc.)

### Modified: `frontend/src/lib/components/hlpv/TRPReportEditor.svelte`
Stripped out all narrative-related code: 3 imports, 2 reactive statements, the narrative toolbar block, the `<NarrativePanel>` in the disciplines loop, and all narrative CSS. Edit Report is now purely for editing risk levels, recommendations, and summaries.

### Modified: `frontend/src/lib/components/hlpv/Dashboard.svelte`
- Imported `NarrativeTab`
- Added "Narrative" tab button (alongside "Edit Report" when analysis data exists)
- Added `{:else if activeTab === 'narrative'}` content block

### Modified: `backend/src/services/llm.service.js` — `buildHlpvDisciplinePrompt`
- Added `## Individual designations found` section — includes `discipline.designationDetails` if present (pre-formatted bullet list of names + distances from the frontend)
- Instruction updated: *"Name specific designations by their actual names and state their distances from the site as listed above"*

---

## Full narrative generation flow

1. User opens Narrative tab → `loadBriefingNotes(projectId)` fires, populates dropdown
2. User optionally picks a specific briefing note; if not, latest is used automatically
3. User clicks Generate → `generateNarrative(projectId, disciplinesForGeneration)` called in store
4. Store filters to disciplines with triggered rules, grabs `selectedBriefingNoteId`, POSTs to `POST /api/hlpv/generate-narrative`
5. Backend controller fetches briefing note HTML — latest if no ID given, specific note if ID given, none if no projectId
6. `generateHlpvNarrative` in `llm.service.js` loops over disciplines, calls `buildHlpvDisciplinePrompt` per discipline, calls Claude
7. Prompt contains: triggered rules, individual designation names + distances (`designationDetails`), suggested text, briefing note excerpt, tone example, instructions
8. Response: `{ narratives: { Heritage: "<p>...</p>", Ecology: "<p>...</p>", ... } }`
9. Store sets `narratives` store, `NarrativePanel` renders per discipline with editable `RichTextEditor`

### Briefing note behaviour
- Project selected, dropdown untouched → **latest briefing note used automatically**
- Project selected, specific note chosen → that specific note used
- No project selected → no briefing note

---

## Existing files (built in earlier sessions, not changed this session)

| File | Purpose |
|------|---------|
| `backend/src/controllers/hlpvNarrative.controller.js` | POST handler — fetches briefing note, calls LLM service |
| `backend/src/routes/hlpvNarrative.routes.js` | `POST /generate-narrative` route |
| `backend/src/routes/index.js` | Registers `router.use('/api/hlpv', hlpvNarrativeRoutes)` |
| `frontend/src/lib/api/hlpv.js` | `getBriefingNotes()` and `generateHlpvNarrative()` API calls |
| `frontend/src/lib/stores/hlpv-narrative.js` | Svelte stores + `loadBriefingNotes()`, `generateNarrative()`, `updateNarrative()` |
| `frontend/src/lib/components/hlpv/NarrativePanel.svelte` | Shows `RichTextEditor` per discipline when content exists; hidden when empty |
| `frontend/src/lib/components/hlpv/NarrativeBriefingSelector.svelte` | Dropdown with click-outside handling |
| `backend/hlpvexample.md` | Tone example loaded at startup into `HLPV_TONE_EXAMPLE_BLOCK` in llm.service.js |

---

## Known issues / things not yet tested

- **No persistence** — generated narratives are in-memory only; cleared on page reload
- **`designationDetails` field names** — the helper in `NarrativeTab` assumes `dist_m`, `on_site`, `name`/`site_name` etc. Worth verifying against real DB output per designation type if results look wrong
- **TypeScript `any` warnings** in the new `.js` store/api files and `.svelte` components — benign at runtime (Vite uses esbuild, no type checking), but `svelte-check` will flag them
