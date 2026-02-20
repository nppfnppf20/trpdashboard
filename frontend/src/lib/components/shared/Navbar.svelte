
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
    <h1 class="navbar-title">HLPV Planning Assessment</h1>
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
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    color: #1e293b;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    z-index: 10;
  }

  .home-button:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
  }

  .home-button i {
    font-size: 1.125rem;
  }
</style>