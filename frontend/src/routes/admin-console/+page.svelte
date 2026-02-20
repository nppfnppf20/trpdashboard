<script>
  import { goto } from '$app/navigation';
</script>

<div class="admin-console-home">
  <div class="header">
    <h1>Admin Console</h1>
    <p>Manage surveyors and administrative data</p>
  </div>

  <div class="tools-grid">
    <button class="tool-card" on:click={() => goto('/admin-console/surveyors')}>
      <div class="card-icon">
        <i class="las la-users"></i>
      </div>
      <h2>Surveyors</h2>
      <p>View and manage surveyor organisations, contacts, and performance ratings</p>
    </button>
  </div>
</div>

<style>
  .admin-console-home {
    padding: 3rem;
  }

  .header {
    text-align: center;
    margin-bottom: 3rem;
  }

  .header h1 {
    margin: 0 0 1rem 0;
    font-size: 2rem;
    color: #1e293b;
  }

  .header p {
    margin: 0;
    font-size: 1.125rem;
    color: #64748b;
  }

  .tools-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .tool-card {
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    padding: 2rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s;
  }

  .tool-card:hover {
    border-color: #3b82f6;
    transform: translateY(-4px);
    box-shadow: 0 10px 25px rgba(59, 130, 246, 0.2);
  }

  .card-icon {
    width: 4rem;
    height: 4rem;
    border-radius: 50%;
    background: #dbeafe;
    color: #3b82f6;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.5rem;
  }

  .card-icon i {
    font-size: 2rem;
  }

  .tool-card h2 {
    margin: 0 0 1rem 0;
    font-size: 1.5rem;
    color: #1e293b;
  }

  .tool-card p {
    margin: 0;
    color: #64748b;
    line-height: 1.6;
  }
</style>

