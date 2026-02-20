<script>
  import { goto } from '$app/navigation';
  import { signOut } from '$lib/stores/auth.js';
  import AddProjectModal from '../projects/AddProjectModal.svelte';

  let showAddProjectModal = false;

  function navigateToHLPV() {
    goto('/hlpv');
  }

  function navigateToSocioeconomics() {
    goto('/socioeconomics');
  }

  function navigateToProjectMap() {
    goto('/projectmap');
  }

  function navigateToWebScraper() {
    goto('/webscraper');
  }

  function navigateToPlanningDeliverables() {
    goto('/planning');
  }

  function navigateToSurveyorManagement() {
    goto('/surveyor-management');
  }
  
  function navigateToAdminConsole() {
    goto('/admin-console');
  }

  function openAddProjectModal() {
    showAddProjectModal = true;
  }

  function closeAddProjectModal() {
    showAddProjectModal = false;
  }

  function handleProjectCreated(project) {
    console.log('Project created:', project);
    // Could show success message here
  }

  async function handleLogout() {
    await signOut();
    window.location.href = '/auth/login';
  }
</script>

<div class="home-page">
  <div class="home-container">
    <!-- Logout Button -->
    <button class="logout-btn" on:click={handleLogout} title="Logout">
      Logout
    </button>

    <!-- Create Project Button -->
    <button class="create-project-btn" on:click={openAddProjectModal} title="Create New Project">
      <span class="plus-icon">+</span>
    </button>

    <!-- Header Section -->
    <div class="home-header">
      <h1 class="home-title">
        Planning Assessment Tools
      </h1>
      <p class="home-subtitle">
        Comprehensive planning and development assessment tools for informed decision-making
      </p>
    </div>

    <!-- Tools Grid -->
    <div class="tools-grid">

      <!-- Project Information Card -->
      <div class="tool-card" on:click={navigateToProjectMap} on:keydown={(e) => e.key === 'Enter' && navigateToProjectMap()} role="button" tabindex="0">
        <div class="card-content">
          <div class="card-icon card-icon-purple">
            <i class="las la-project-diagram"></i>
          </div>

          <h2 class="card-title">
            Project Information
          </h2>

          <p class="card-description">
            View and manage all your projects in one place. Access a comprehensive table of project information and visualize your projects alongside scraped planning data on an interactive map.
          </p>

          <div class="features-list">
            <div class="feature-item">
              <i class="las la-table feature-icon-check"></i>
              <span>Project Information Table</span>
            </div>
            <div class="feature-item">
              <i class="las la-map-marked-alt feature-icon-check"></i>
              <span>Interactive Map View</span>
            </div>
            <div class="feature-item">
              <i class="las la-project-diagram feature-icon-check"></i>
              <span>Your Projects & Scraped Data</span>
            </div>
            <div class="feature-item">
              <i class="las la-eye feature-icon-check"></i>
              <span>Visual Project Overview</span>
            </div>
          </div>

          <button class="tool-button tool-button-purple" on:click|stopPropagation={navigateToProjectMap}>
            View Projects
            <i class="las la-arrow-right"></i>
          </button>
        </div>
      </div>

      <!-- HLPV Assessment Tool Card -->
      <div class="tool-card" on:click={navigateToHLPV} on:keydown={(e) => e.key === 'Enter' && navigateToHLPV()} role="button" tabindex="0">
        <div class="card-content">
          <div class="card-icon card-icon-blue">
            <i class="las la-map-marked-alt"></i>
          </div>

          <h2 class="card-title">
            High-Level Planning View Tool (beta)
          </h2>

          <p class="card-description">
            Provisional heritage, landscape, planning, and viability assessment tool. Analyses sites for
            heritage constraints, landscape impacts, agricultural land quality, renewable energy potential, and ecology
            considerations.
          </p>

          <div class="features-list">
            <div class="feature-item">
              <i class="las la-check-circle feature-icon-check"></i>
              <span>Heritage Analysis</span>
            </div>
            <div class="feature-item">
              <i class="las la-check-circle feature-icon-check"></i>
              <span>Landscape Assessment</span>
            </div>
            <div class="feature-item">
              <i class="las la-check-circle feature-icon-check"></i>
              <span>Agricultural Land Classification</span>
            </div>
            <div class="feature-item">
              <i class="las la-check-circle feature-icon-check"></i>
              <span>Renewables & Ecology</span>
            </div>
          </div>

          <button class="tool-button tool-button-blue" on:click|stopPropagation={navigateToHLPV}>
            Launch HLPV Assessment
            <i class="las la-arrow-right"></i>
          </button>
        </div>
      </div>

      <!-- Surveyor Management Card -->
      <div class="tool-card" on:click={navigateToSurveyorManagement} on:keydown={(e) => e.key === 'Enter' && navigateToSurveyorManagement()} role="button" tabindex="0">
        <div class="card-content">
          <div class="card-icon card-icon-indigo">
            <i class="las la-user-tie"></i>
          </div>

          <h2 class="card-title">
            Surveyor Management
          </h2>

          <p class="card-description">
            Manage external surveyors, track quotes and instructed work, monitor project programme with Gantt charts, and review surveyor performance across projects.
          </p>

          <div class="features-list">
            <div class="feature-item">
              <i class="las la-file-invoice-dollar feature-icon-indigo"></i>
              <span>Quote Management</span>
            </div>
            <div class="feature-item">
              <i class="las la-calendar-alt feature-icon-indigo"></i>
              <span>Programme & Gantt Charts</span>
            </div>
            <div class="feature-item">
              <i class="las la-tasks feature-icon-indigo"></i>
              <span>Instructed Work Tracking</span>
            </div>
            <div class="feature-item">
              <i class="las la-star feature-icon-indigo"></i>
              <span>Surveyor Reviews</span>
            </div>
          </div>

          <button class="tool-button tool-button-indigo" on:click|stopPropagation={navigateToSurveyorManagement}>
            Manage Surveyors
            <i class="las la-arrow-right"></i>
          </button>
        </div>
      </div>

      <!-- Planning Deliverables Card -->
      <div class="tool-card" on:click={navigateToPlanningDeliverables} on:keydown={(e) => e.key === 'Enter' && navigateToPlanningDeliverables()} role="button" tabindex="0">
        <div class="card-content">
          <div class="card-icon card-icon-teal">
            <i class="las la-file-alt"></i>
          </div>

          <h2 class="card-title">
            Planning Deliverables
          </h2>

          <p class="card-description">
            Create professional planning documents from templates. Generate screening opinions, scoping reports, planning statements and more with automated project data integration.
          </p>

          <div class="features-list">
            <div class="feature-item">
              <i class="las la-file-invoice feature-icon-teal"></i>
              <span>Document Templates</span>
            </div>
            <div class="feature-item">
              <i class="las la-edit feature-icon-teal"></i>
              <span>Rich Text Editor</span>
            </div>
            <div class="feature-item">
              <i class="las la-magic feature-icon-teal"></i>
              <span>Auto Project Data Merge</span>
            </div>
            <div class="feature-item">
              <i class="las la-download feature-icon-teal"></i>
              <span>Export to PDF/Word</span>
            </div>
          </div>

          <button class="tool-button tool-button-teal" on:click|stopPropagation={navigateToPlanningDeliverables}>
            Create Documents
            <i class="las la-arrow-right"></i>
          </button>
        </div>
      </div>

      <!-- Web Scraper Tool Card -->
      <div class="tool-card" on:click={navigateToWebScraper} on:keydown={(e) => e.key === 'Enter' && navigateToWebScraper()} role="button" tabindex="0">
        <div class="card-content">
          <div class="card-icon card-icon-orange">
            <i class="las la-database"></i>
          </div>

          <h2 class="card-title">
            Web Scraper Data
          </h2>

          <p class="card-description">
            View and analyze scraped planning application data from across the UK. Access comprehensive information on renewable energy projects and data centre developments.
          </p>

          <div class="features-list">
            <div class="feature-item">
              <i class="las la-solar-panel feature-icon-orange"></i>
              <span>Renewables Projects</span>
            </div>
            <div class="feature-item">
              <i class="las la-server feature-icon-orange"></i>
              <span>Data Centres</span>
            </div>
            <div class="feature-item">
              <i class="las la-table feature-icon-orange"></i>
              <span>Tabular Data View</span>
            </div>
            <div class="feature-item">
              <i class="las la-filter feature-icon-orange"></i>
              <span>Sortable & Filterable</span>
            </div>
          </div>

          <button class="tool-button tool-button-orange" on:click|stopPropagation={navigateToWebScraper}>
            Launch Web Scraper
            <i class="las la-arrow-right"></i>
          </button>
        </div>
      </div>

      <!-- Admin Console Card -->
      <div class="tool-card" on:click={navigateToAdminConsole} on:keydown={(e) => e.key === 'Enter' && navigateToAdminConsole()} role="button" tabindex="0">
        <div class="card-content">
          <div class="card-icon card-icon-slate">
            <i class="las la-cog"></i>
          </div>

          <h2 class="card-title">
            Admin Console
          </h2>

          <p class="card-description">
            Administrative tools for managing surveyor organisations, contacts, and system configuration. View performance ratings and manage surveyor data.
          </p>

          <div class="features-list">
            <div class="feature-item">
              <i class="las la-users feature-icon-slate"></i>
              <span>Surveyor Organisations</span>
            </div>
            <div class="feature-item">
              <i class="las la-address-book feature-icon-slate"></i>
              <span>Contact Management</span>
            </div>
            <div class="feature-item">
              <i class="las la-star-half-alt feature-icon-slate"></i>
              <span>Performance Ratings</span>
            </div>
            <div class="feature-item">
              <i class="las la-database feature-icon-slate"></i>
              <span>Data Administration</span>
            </div>
          </div>

          <button class="tool-button tool-button-slate" on:click|stopPropagation={navigateToAdminConsole}>
            Open Admin Console
            <i class="las la-arrow-right"></i>
          </button>
        </div>
      </div>

      <!-- Socioeconomics Tool Card -->
      <div class="tool-card" on:click={navigateToSocioeconomics} on:keydown={(e) => e.key === 'Enter' && navigateToSocioeconomics()} role="button" tabindex="0">
        <div class="card-content">
          <div class="card-icon card-icon-green">
            <i class="las la-chart-bar"></i>
          </div>

          <h2 class="card-title">
            Socioeconomics Tool
          </h2>

          <p class="card-description">
            Analyse socioeconomic data including demographics, employment patterns, transportation methods,
            health statistics, and educational qualifications to understand community characteristics.
          </p>

          <div class="features-list">
            <div class="feature-item">
              <i class="las la-users feature-icon-blue"></i>
              <span>Demographics Analysis</span>
            </div>
            <div class="feature-item">
              <i class="las la-briefcase feature-icon-blue"></i>
              <span>Employment Patterns</span>
            </div>
            <div class="feature-item">
              <i class="las la-car feature-icon-blue"></i>
              <span>Transportation Data</span>
            </div>
            <div class="feature-item">
              <i class="las la-graduation-cap feature-icon-blue"></i>
              <span>Education & Health</span>
            </div>
          </div>

          <button class="tool-button tool-button-green" on:click|stopPropagation={navigateToSocioeconomics}>
            Launch Socioeconomics Tool
            <i class="las la-arrow-right"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Footer Info -->
    <div class="home-footer">
      <p class="footer-text">
        Professional planning assessment tools designed for comprehensive site analysis and informed decision-making
      </p>
    </div>
  </div>
</div>

<!-- Add Project Modal -->
<AddProjectModal
  isOpen={showAddProjectModal}
  onClose={closeAddProjectModal}
  onProjectCreated={handleProjectCreated}
/>

<style>
  .home-page {
    min-height: 100vh;
    background: #f8fafc;
    padding: 3rem 1rem;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
  }

  .home-container {
    max-width: 1200px;
    margin: 0 auto;
    position: relative;
  }

  .logout-btn {
    position: absolute;
    top: 0;
    left: 0;
    padding: 0.75rem 1.25rem;
    background: #dc2626;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    color: white;
    font-size: 0.875rem;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
    transition: all 0.2s;
  }

  .logout-btn:hover {
    background: #b91c1c;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(220, 38, 38, 0.4);
  }

  .logout-btn:active {
    transform: translateY(0);
  }

  .create-project-btn {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 10;
    width: 3.5rem;
    height: 3.5rem;
    background: #9333ea;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(147, 51, 234, 0.3);
    transition: all 0.2s;
  }

  .create-project-btn:hover {
    background: #7e22ce;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(147, 51, 234, 0.4);
  }

  .create-project-btn:active {
    transform: translateY(0);
  }

  .plus-icon {
    font-size: 2rem;
    color: white;
    line-height: 0;
    font-weight: 300;
    margin-top: -2px;
  }

  .home-header {
    text-align: center;
    margin-bottom: 3rem;
  }

  .home-title {
    font-size: 2.5rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 1rem 0;
    line-height: 1.2;
  }

  .home-subtitle {
    font-size: 1.25rem;
    color: #64748b;
    max-width: 600px;
    margin: 0 auto;
    line-height: 1.5;
  }

  .tools-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
    gap: 2rem;
    margin-bottom: 4rem;
  }

  .tool-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 2rem;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .tool-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    border-color: #cbd5e1;
  }

  .tool-card:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .card-content {
    text-align: center;
  }

  .card-icon {
    width: 4rem;
    height: 4rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.5rem;
  }

  .card-icon-blue {
    background: #dbeafe;
    color: #3b82f6;
  }

  .card-icon-green {
    background: #dcfce7;
    color: #16a34a;
  }

  .card-icon-purple {
    background: #f3e8ff;
    color: #9333ea;
  }

  .card-icon-orange {
    background: #ffedd5;
    color: #f97316;
  }

  .card-icon-teal {
    background: #ccfbf1;
    color: #0d9488;
  }

  .card-icon-indigo {
    background: #e0e7ff;
    color: #4f46e5;
  }

  .card-icon-slate {
    background: #f1f5f9;
    color: #475569;
  }

  .card-icon i {
    font-size: 2rem;
  }

  .card-title {
    font-size: 1.75rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 1rem 0;
  }

  .card-description {
    color: #64748b;
    margin-bottom: 1.5rem;
    line-height: 1.6;
    font-size: 1rem;
  }

  .features-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 2rem;
    text-align: left;
    max-width: 300px;
    margin-left: auto;
    margin-right: auto;
  }

  .feature-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.875rem;
    color: #64748b;
  }

  .feature-icon-check {
    color: #16a34a;
    font-size: 1rem;
  }

  .feature-icon-blue {
    color: #3b82f6;
    font-size: 1rem;
  }

  .feature-icon-orange {
    color: #f97316;
    font-size: 1rem;
  }

  .feature-icon-teal {
    color: #0d9488;
    font-size: 1rem;
  }

  .feature-icon-indigo {
    color: #4f46e5;
    font-size: 1rem;
  }

  .feature-icon-slate {
    color: #475569;
    font-size: 1rem;
  }

  .tool-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
    color: white;
  }

  .tool-button-blue {
    background: #3b82f6;
  }

  .tool-button-blue:hover {
    background: #2563eb;
    transform: translateY(-1px);
  }

  .tool-button-green {
    background: #16a34a;
  }

  .tool-button-green:hover {
    background: #15803d;
    transform: translateY(-1px);
  }

  .tool-button-purple {
    background: #9333ea;
  }

  .tool-button-purple:hover {
    background: #7e22ce;
    transform: translateY(-1px);
  }

  .tool-button-orange {
    background: #f97316;
  }

  .tool-button-orange:hover {
    background: #ea580c;
    transform: translateY(-1px);
  }

  .tool-button-teal {
    background: #0d9488;
  }

  .tool-button-teal:hover {
    background: #0f766e;
    transform: translateY(-1px);
  }

  .tool-button-indigo {
    background: #4f46e5;
  }

  .tool-button-indigo:hover {
    background: #4338ca;
    transform: translateY(-1px);
  }

  .tool-button-slate {
    background: #475569;
  }

  .tool-button-slate:hover {
    background: #334155;
    transform: translateY(-1px);
  }

  .tool-button i {
    font-size: 1.125rem;
  }

  .home-footer {
    text-align: center;
    margin-top: 3rem;
  }

  .footer-text {
    color: #64748b;
    font-size: 1rem;
    margin: 0;
  }

  @media (max-width: 768px) {
    .home-page {
      padding: 2rem 1rem;
    }

    .home-title {
      font-size: 2rem;
    }

    .home-subtitle {
      font-size: 1.125rem;
    }

    .tools-grid {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    .tool-card {
      padding: 1.5rem;
    }

    .features-list {
      max-width: none;
    }
  }
</style>