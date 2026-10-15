<script>
  // Form for "+ Add gate question": pick the section (stage) it belongs to, or start a new one.
  export let gate = [];
  export let gateNo = 2;
  export let onSubmit = async () => {};   // ({ gate, ref, section, section_title, question, owner, score, comment })
  export let onClose = () => {};

  const NEW = 'new';

  // Existing sections for this gate, in order.
  $: sections = gate
    .filter(g => g.gate === gateNo)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
    .reduce((acc, g) => {
      if (!acc.find(s => s.section === g.section)) acc.push({ section: g.section, title: g.section_title });
      return acc;
    }, []);
  $: owners = [...new Set(gate.map(g => g.owner).filter(Boolean))];

  let sectionChoice = '';       // existing section number, or NEW
  let newTitle = '';
  let ref = '';
  let refTouched = false;
  let question = '';
  let owner = '';
  let score = 0;
  let comment = '';
  let saving = false;
  let error = null;

  $: if (sectionChoice === '' && sections.length) sectionChoice = String(sections[0].section);

  $: sectionNumber = sectionChoice === NEW ? Math.max(0, ...sections.map(s => s.section)) + 1 : parseInt(sectionChoice, 10);

  // Suggest the next reference in the chosen section (3.13 becomes 3.14) until the user types their own.
  $: suggested = (() => {
    if (!sectionNumber) return '';
    const minors = gate
      .filter(g => g.gate === gateNo && g.section === sectionNumber)
      .map(g => parseInt(String(g.ref).split('.')[1], 10))
      .filter(Number.isInteger);
    return `${sectionNumber}.${(minors.length ? Math.max(...minors) : 0) + 1}`;
  })();
  $: if (!refTouched) ref = suggested;

  async function submit(e) {
    e.preventDefault();
    if (!question.trim()) { error = 'Add the question.'; return; }
    if (!ref.trim()) { error = 'Add a reference.'; return; }
    if (sectionChoice === NEW && !newTitle.trim()) { error = 'Give the new section a title.'; return; }
    saving = true;
    error = null;
    try {
      await onSubmit({
        gate: gateNo,
        ref: ref.trim(),
        section: sectionNumber,
        section_title: sectionChoice === NEW ? newTitle.trim() : '',
        question: question.trim(),
        owner: owner.trim(),
        score,
        comment: comment.trim(),
      });
      onClose();
    } catch (err) {
      error = err.message;
      saving = false;
    }
  }
  function onKey(e) { if (e.key === 'Escape' && !saving) onClose(); }
</script>

<svelte:window on:keydown={onKey} />

<div class="wq-backdrop" on:click|self={() => !saving && onClose()} role="presentation">
  <form class="wq-modal" on:submit={submit} aria-label="Add gate question">
    <div class="wq-head">
      <div>
        <div class="wq-eyebrow">New</div>
        <h2>Add gate question</h2>
      </div>
      <button class="btn btn-secondary btn-sm" type="button" on:click={onClose} disabled={saving}>Close</button>
    </div>

    <div class="wq-body">
      <div class="wq-two">
        <label class="wq-field">
          <span class="form-label">Stage gate</span>
          <input class="form-input" value="Stage Gate {gateNo}" disabled>
        </label>
        <label class="wq-field">
          <span class="form-label">Section</span>
          <select class="form-input" bind:value={sectionChoice}>
            {#each sections as s (s.section)}<option value={String(s.section)}>{s.section}. {s.title}</option>{/each}
            <option value={NEW}>New section…</option>
          </select>
        </label>
      </div>

      {#if sectionChoice === NEW}
        <label class="wq-field">
          <span class="form-label">New section title (section {sectionNumber})</span>
          <input class="form-input" bind:value={newTitle} placeholder="e.g. Submission and validation" autocomplete="off">
        </label>
      {/if}

      <label class="wq-field">
        <span class="form-label">Reference</span>
        <input class="form-input wq-ref" bind:value={ref} on:input={() => (refTouched = true)} autocomplete="off">
      </label>

      <label class="wq-field">
        <span class="form-label">Question</span>
        <!-- svelte-ignore a11y-autofocus -->
        <textarea class="form-input" rows="3" bind:value={question} placeholder="e.g. Have we agreed the submission programme with the client?" autofocus></textarea>
      </label>

      <div class="wq-two">
        <label class="wq-field">
          <span class="form-label">Responsible</span>
          <input class="form-input" bind:value={owner} list="wq-owners" autocomplete="off">
          <datalist id="wq-owners">{#each owners as o (o)}<option value={o}></option>{/each}</datalist>
        </label>
        <label class="wq-field">
          <span class="form-label">Score (0 to 5)</span>
          <select class="form-input" bind:value={score}>
            {#each [0, 1, 2, 3, 4, 5] as n (n)}<option value={n}>{n}</option>{/each}
          </select>
        </label>
      </div>

      <label class="wq-field">
        <span class="form-label">Comments / evidence (optional)</span>
        <textarea class="form-input" rows="2" bind:value={comment}></textarea>
      </label>

      {#if error}<div class="wq-error">{error}</div>{/if}
    </div>

    <div class="wq-foot">
      <button class="btn btn-secondary btn-sm" type="button" on:click={onClose} disabled={saving}>Cancel</button>
      <button class="btn btn-primary btn-sm" type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add gate question'}</button>
    </div>
  </form>
</div>

<style>
  .wq-backdrop { position: fixed; inset: 0; background: var(--overlay-bg); display: flex; align-items: center; justify-content: center; z-index: 2100; padding: 1rem; }
  .wq-modal { background: var(--color-white); border-radius: var(--radius-lg); width: min(38rem, 100%); max-height: 92vh; display: flex; flex-direction: column; box-shadow: var(--shadow-modal); overflow: hidden; }
  .wq-head { display: flex; justify-content: space-between; align-items: flex-start; padding: 1rem 1.25rem; border-bottom: 1px solid var(--color-slate-200); }
  .wq-head h2 { margin: 0.125rem 0 0; font-size: 1.05rem; font-weight: 600; color: var(--color-slate-800); }
  .wq-eyebrow { font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-slate-400); }
  .wq-body { padding: 1rem 1.25rem; overflow: auto; display: flex; flex-direction: column; gap: 0.75rem; }
  .wq-field { display: flex; flex-direction: column; }
  .wq-two { display: grid; grid-template-columns: 1fr 1.6fr; gap: 0.75rem; }
  .wq-ref { max-width: 8rem; font-family: 'Courier New', monospace; }
  .wq-error { font-size: 0.8rem; color: var(--color-red-600); background: var(--color-red-50); border: 1px solid var(--color-red-200); border-radius: var(--radius-sm); padding: 0.5rem 0.75rem; }
  .wq-foot { display: flex; justify-content: flex-end; gap: 0.5rem; padding: 0.875rem 1.25rem; border-top: 1px solid var(--color-slate-200); }
  @media (max-width: 36rem) { .wq-two { grid-template-columns: 1fr; } }
</style>
