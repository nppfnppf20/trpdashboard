<script>
  import TrackersWidget from './TrackersWidget.svelte';
  import ChatWidget from './ChatWidget.svelte';
  import KeyDatesWidget from './KeyDatesWidget.svelte';
  import SurveyorWidget from './SurveyorWidget.svelte';
  import MeetingNotesWidget from './MeetingNotesWidget.svelte';

  export let project;
</script>

<div class="ov-grid">
  <TrackersWidget {project} />
  <ChatWidget {project} />
  <KeyDatesWidget {project} />
  <SurveyorWidget {project} />
  <MeetingNotesWidget {project} />
</div>

<style>
  .ov-grid {
    display: grid;
    grid-template-columns: 1.6fr 1fr 1fr;
    grid-template-rows: minmax(260px, 1fr) minmax(260px, 1fr);
    gap: 1rem;
    min-height: 600px;
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
