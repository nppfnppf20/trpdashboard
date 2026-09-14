<script>
  // Record-then-transcribe voice dictation button. Records via MediaRecorder,
  // sends the clip to the backend's Whisper proxy, and dispatches the
  // transcribed text — the caller decides how to merge it into its own text
  // field (append, replace, etc). Purely behavioural; callers position/size
  // it via the passed `class` (see AdvancementEntryFields.svelte's
  // .aef-mic-btn for the absolute-overlay layout, or ChatWidget/
  // ProjectChatTab for the inline-row layout).
  import { createEventDispatcher } from 'svelte';
  import { transcribeAudio } from '$lib/api/voice.js';

  export let disabled = false;
  let className = '';
  export { className as class };

  const dispatch = createEventDispatcher();

  let micState = 'idle'; // idle | recording | transcribing | error
  let mediaRecorder = null;
  let audioChunks = [];

  // Reports every state transition (not just the final transcript) so a
  // caller can show its own "recording in progress" feedback — e.g. pulsing
  // the whole field the button sits in, not just the button itself.
  function setMicState(state) {
    micState = state;
    dispatch('statechange', state);
  }

  async function toggleMic() {
    if (micState === 'recording') {
      mediaRecorder?.stop();
      return;
    }
    if (micState !== 'idle') return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setMicState('transcribing');
        try {
          const blob = new Blob(audioChunks, { type: 'audio/webm' });
          const text = await transcribeAudio(blob);
          if (text) dispatch('transcript', text);
          setMicState('idle');
        } catch (err) {
          console.error('Voice transcription failed:', err);
          setMicState('error');
          setTimeout(() => { setMicState('idle'); }, 2500);
        }
      };
      mediaRecorder.start();
      setMicState('recording');
    } catch (err) {
      console.error('Microphone access failed:', err);
      setMicState('error');
      setTimeout(() => { setMicState('idle'); }, 2500);
    }
  }
</script>

<button
  type="button"
  class="vdb-btn {className}"
  class:vdb-btn--recording={micState === 'recording'}
  class:vdb-btn--error={micState === 'error'}
  disabled={disabled || micState === 'transcribing'}
  on:click={toggleMic}
  title={micState === 'recording' ? 'Stop recording' : micState === 'transcribing' ? 'Transcribing…' : micState === 'error' ? 'Voice dictation failed' : 'Dictate'}
>
  {#if micState === 'transcribing'}
    <span class="vdb-spinner"></span>
  {:else if micState === 'error'}
    <i class="las la-exclamation-triangle"></i>
  {:else}
    <i class="las la-microphone"></i>
  {/if}
</button>

<style>
  .vdb-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--color-slate-200);
    border-radius: 50%;
    background: var(--color-white);
    color: var(--color-slate-400);
    cursor: pointer;
    font-size: 0.85rem;
  }
  .vdb-btn:hover:not(:disabled) {
    background: var(--color-primary-50);
    color: var(--color-primary-600);
    border-color: var(--color-primary-200);
  }
  .vdb-btn:disabled {
    cursor: not-allowed;
  }
  .vdb-btn--recording {
    background: var(--color-red-50);
    border-color: var(--color-red-200);
    color: var(--color-red-600);
    animation: vdb-pulse 1.2s ease-in-out infinite;
  }
  .vdb-btn--error {
    background: var(--color-red-50);
    border-color: var(--color-red-200);
    color: var(--color-red-600);
  }
  @keyframes vdb-pulse {
    0%, 100% { box-shadow: 0 0 0 0 var(--color-red-100); }
    50% { box-shadow: 0 0 0 4px var(--color-red-100); }
  }
  .vdb-spinner {
    display: inline-block;
    width: 0.75rem;
    height: 0.75rem;
    border: 2px solid var(--color-primary-200);
    border-top-color: var(--color-primary-600);
    border-radius: 50%;
    animation: vdb-spin 0.6s linear infinite;
  }
  @keyframes vdb-spin { to { transform: rotate(360deg); } }
</style>
