<script>
  import TrackersWidget from './TrackersWidget.svelte';
  import ChatWidget from './ChatWidget.svelte';
  import KeyDatesWidget from './KeyDatesWidget.svelte';
  import SurveyorWidget from './SurveyorWidget.svelte';
  import MeetingNotesWidget from './MeetingNotesWidget.svelte';

  export let project;
  export let onAcceptDateSuggestion = null; // async (field, date) => boolean
</script>

<div class="ov-grid">
  <TrackersWidget {project} />
  <ChatWidget {project} {onAcceptDateSuggestion} />
  <MeetingNotesWidget {project} />
  <KeyDatesWidget {project} />
  <SurveyorWidget {project} />
</div>

<style>
  .ov-grid {
    display: grid;
    grid-template-columns: 1.6fr 1fr 1fr;
    grid-template-rows: minmax(320px, 2fr) minmax(160px, 1fr);
    gap: 1rem;
    flex: 1;
    /* min-height:0 (rather than a fixed floor like 600px) lets the grid
       actually shrink with its flex parent instead of overflowing it when
       the window gets shorter — the row minmax() minimums above are still
       the real floor. overflow-y:auto means that once those minimums are
       hit, this scrolls instead of getting clipped/squished by the modal
       body's overflow:hidden above it. */
    min-height: 0;
    overflow-y: auto;
    padding: 1.25rem 1.75rem 0;
  }

  @media (max-width: 1100px) {
    .ov-grid {
      grid-template-columns: 1fr 1fr;
      grid-template-rows: none;
      min-height: 0;
    }
  }
</style>
