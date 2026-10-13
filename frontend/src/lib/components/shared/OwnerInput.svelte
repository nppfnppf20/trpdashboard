<script>
  // Owner field for actions: suggests the app's users as you type, but any
  // name can be typed — people without a login (client contacts, consultants)
  // are kept as plain text. Picking a suggestion gives the exact display_name,
  // which the backend uses to link the action to that account.
  import { getUsers } from '$lib/api/userProfiles.js';

  export let value = '';
  export let placeholder = 'Owner';

  let users = [];
  let loaded = false;
  // Unique per instance so several rows each get their own <datalist>.
  const listId = `owner-list-${Math.random().toString(36).slice(2, 9)}`;

  async function loadUsers() {
    if (loaded) return;
    loaded = true;
    try {
      users = await getUsers();
    } catch (err) {
      console.error('OwnerInput: failed to load users', err);
    }
  }
</script>

<input
  class="form-input"
  type="text"
  list={listId}
  {placeholder}
  autocomplete="off"
  bind:value
  on:focus={loadUsers}
  on:input
/>
<datalist id={listId}>
  {#each users as u (u.id)}
    <option value={u.display_name}></option>
  {/each}
</datalist>
