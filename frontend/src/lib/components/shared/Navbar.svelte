
<script>
  import { goto } from '$app/navigation';

  function goHome() {
    goto('/');
  }
</script>

<nav class="navbar">
  <button
    class="home-button"
    on:click={goHome}
    title="Back to Home">
    <i class="las la-home"></i>
    <span>Home</span>
  </button>
  <div class="navbar-content">
    <h1 class="navbar-title">Renewables HLPV Planning Assessment</h1>
  </div>
</nav>

<style>
  .navbar {
    position: relative;
  }

  .navbar-content {
    display: flex;
    align-items: center;
    justify-content: center;
    padding-left: 120px;
  }

  .home-button {
    position: absolute;
    top: 50%;
    left: 1rem;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--color-white);
    border: 1px solid var(--color-slate-200);
    border-radius: 0.375rem;
    color: var(--color-slate-800);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: var(--shadow-sm);
    z-index: 10;
  }

  .home-button:hover {
    background: var(--color-slate-100);
    border-color: var(--color-slate-300);
  }

  .home-button i {
    font-size: 1.125rem;
  }
</style>