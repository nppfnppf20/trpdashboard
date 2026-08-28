<script>
  import { goto } from '$app/navigation';
  import { signOut } from '$lib/stores/auth.js';
  import AddProjectModal from '../projects/AddProjectModal.svelte';

  let showAddProjectModal = false;
  let openInfoCard = null;

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

  function navigateToTenders() {
    goto('/tenders');
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

  function navigateToPlanning() {
    goto('/planning-application');
  }

  function navigateToMeetingNotes() {
    goto('/meeting-notes');
  }

  function navigateToMarketing() {
    goto('/marketing');
  }

  function navigateToPolicy() {
    goto('/policy');
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
      <i class="las la-plus"></i>
      <span class="btn-label">New Project</span>
    </button>

    <!-- Tools Grid -->
    <div class="tools-grid">

      <!-- Project Information Card -->
      <div class="tool-card" on:click={navigateToProjectMap} on:keydown={(e) => e.key === 'Enter' && navigateToProjectMap()} role="button" tabindex="0">
        <div class="card-content">
          <div class="card-icon card-icon-purple">
            <i class="las la-project-diagram"></i>
          </div>

          <h2 class="card-title">
            Projects
          </h2>

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
      <div style="display:none">
      <div class="tool-card" on:click={navigateToHLPV} on:keydown={(e) => e.key === 'Enter' && navigateToHLPV()} role="button" tabindex="0">
        <div class="card-content">
          <div class="card-icon card-icon-blue">
            <i class="las la-map-marked-alt"></i>
          </div>

          <h2 class="card-title">
            Renewables HLPV Tool (beta)
          </h2>

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
            Launch Renewables HLPV Assessment
            <i class="las la-arrow-right"></i>
          </button>
        </div>
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

      <!-- Planning Application Tool Card -->
      <div class="tool-card" on:click={navigateToPlanning} on:keydown={(e) => e.key === 'Enter' && navigateToPlanning()} role="button" tabindex="0">
        <div class="card-content">
          <div class="card-icon card-icon-blue">
            <i class="las la-clipboard-list"></i>
          </div>

          <h2 class="card-title">
            Planning Deliverables
          </h2>

          <div class="features-list">
            <div class="feature-item">
              <i class="las la-magic feature-icon-blue"></i>
              <span>Generated Starting Argument</span>
            </div>
            <div class="feature-item">
              <i class="las la-file-upload feature-icon-blue"></i>
              <span>Document-by-Document Review</span>
            </div>
            <div class="feature-item">
              <i class="las la-edit feature-icon-blue"></i>
              <span>Live Editable Working Draft</span>
            </div>
            <div class="feature-item">
              <i class="las la-layer-group feature-icon-blue"></i>
              <span>Seeded from Key Issues</span>
            </div>
          </div>

          <button class="tool-button tool-button-blue" on:click|stopPropagation={navigateToPlanning}>
            Open Planning Application Tool
            <i class="las la-arrow-right"></i>
          </button>
        </div>
      </div>

      <!-- Meeting Notes Card -->
      <div class="tool-card" on:click={navigateToMeetingNotes} on:keydown={(e) => e.key === 'Enter' && navigateToMeetingNotes()} role="button" tabindex="0">
        <div class="card-content">
          <div class="card-icon card-icon-purple">
            <i class="las la-file-signature"></i>
          </div>

          <h2 class="card-title">
            Meeting Notes
          </h2>

          <div class="features-list">
            <div class="feature-item">
              <i class="las la-magic feature-icon-violet"></i>
              <span>Summary &amp; Action Extraction</span>
            </div>
            <div class="feature-item">
              <i class="las la-users-cog feature-icon-violet"></i>
              <span>Internal &amp; Project Meetings</span>
            </div>
            <div class="feature-item">
              <i class="las la-graduation-cap feature-icon-violet"></i>
              <span>CPD Records</span>
            </div>
            <div class="feature-item">
              <i class="las la-tasks feature-icon-violet"></i>
              <span>Action Tracker</span>
            </div>
          </div>

          <button class="tool-button tool-button-purple" on:click|stopPropagation={navigateToMeetingNotes}>
            Open Meeting Notes
            <i class="las la-arrow-right"></i>
          </button>
        </div>
      </div>

      <!-- Marketing Tool Card -->
      <div class="tool-card" on:click={navigateToMarketing} on:keydown={(e) => e.key === 'Enter' && navigateToMarketing()} role="button" tabindex="0">
        <div class="card-content">
          <div class="card-icon card-icon-teal">
            <i class="las la-bullhorn"></i>
          </div>

          <h2 class="card-title">
            Marketing <span class="beta-tag">Beta</span>
          </h2>

          <div class="features-list">
            <div class="feature-item">
              <i class="las la-magic feature-icon-teal"></i>
              <span>AI-Generated Drafts</span>
            </div>
            <div class="feature-item">
              <i class="las la-linkedin feature-icon-teal"></i>
              <span>LinkedIn Posts</span>
            </div>
            <div class="feature-item">
              <i class="las la-envelope-open-text feature-icon-teal"></i>
              <span>Newsletters</span>
            </div>
            <div class="feature-item">
              <i class="las la-edit feature-icon-teal"></i>
              <span>Live Editable Output</span>
            </div>
          </div>

          <button class="tool-button tool-button-teal" on:click|stopPropagation={navigateToMarketing}>
            Open Marketing
            <i class="las la-arrow-right"></i>
          </button>
        </div>
      </div>

      <!-- Policy & Industry Updates Card -->
      <div class="tool-card" on:click={navigateToPolicy} on:keydown={(e) => e.key === 'Enter' && navigateToPolicy()} role="button" tabindex="0">
        <div class="card-content">
          <div class="card-icon card-icon-blue">
            <i class="las la-newspaper"></i>
          </div>

          <h2 class="card-title">
            Policy &amp; Industry Updates
          </h2>

          <div class="features-list">
            <div class="feature-item">
              <i class="las la-file-upload feature-icon-check"></i>
              <span>Upload Policy Documents</span>
            </div>
            <div class="feature-item">
              <i class="las la-magic feature-icon-check"></i>
              <span>AI Summary &amp; Key Points</span>
            </div>
            <div class="feature-item">
              <i class="las la-users-cog feature-icon-check"></i>
              <span>Auto-fed from Meeting Notes</span>
            </div>
            <div class="feature-item">
              <i class="las la-pen feature-icon-check"></i>
              <span>Our Take Commentary</span>
            </div>
          </div>

          <button class="tool-button tool-button-blue" on:click|stopPropagation={navigateToPolicy}>
            Open Policy Updates
            <i class="las la-arrow-right"></i>
          </button>
        </div>
      </div>

      <!-- Planning Deliverables Card — hidden pending migration into Planning Application Tool -->
      <!--
      <div class="tool-card" on:click={navigateToPlanningDeliverables} on:keydown={(e) => e.key === 'Enter' && navigateToPlanningDeliverables()} role="button" tabindex="0">
        <div class="card-content">
          <div class="card-icon card-icon-teal">
            <i class="las la-file-alt"></i>
          </div>
          <h2 class="card-title">Planning Deliverables</h2>
          <p class="card-description">
            Create professional planning documents from templates. Generate screening opinions, scoping reports, planning statements and more with automated project data integration.
          </p>
          <div class="features-list">
            <div class="feature-item"><i class="las la-file-invoice feature-icon-teal"></i><span>Document Templates</span></div>
            <div class="feature-item"><i class="las la-edit feature-icon-teal"></i><span>Rich Text Editor</span></div>
            <div class="feature-item"><i class="las la-magic feature-icon-teal"></i><span>Auto Project Data Merge</span></div>
            <div class="feature-item"><i class="las la-download feature-icon-teal"></i><span>Export to PDF/Word</span></div>
          </div>
          <button class="tool-button tool-button-teal" on:click|stopPropagation={navigateToPlanningDeliverables}>
            Create Documents <i class="las la-arrow-right"></i>
          </button>
        </div>
      </div>
      -->

      <!-- Web Scraper Tool Card -->
      <div class="tool-card" on:click={navigateToWebScraper} on:keydown={(e) => e.key === 'Enter' && navigateToWebScraper()} role="button" tabindex="0">
        <div class="card-content">
          <div class="card-icon card-icon-orange">
            <i class="las la-database"></i>
          </div>

          <h2 class="card-title">
            Web Scraper Data
          </h2>

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

      <!-- Tenders Card -->
      <div class="tool-card" on:click={navigateToTenders} on:keydown={(e) => e.key === 'Enter' && navigateToTenders()} role="button" tabindex="0">
        <div class="card-content">
          <div class="card-icon card-icon-indigo">
            <i class="las la-landmark"></i>
          </div>

          <h2 class="card-title">
            Tenders <span class="beta-tag">Beta</span>
          </h2>

          <div class="features-list">
            <div class="feature-item">
              <i class="las la-file-contract feature-icon-indigo"></i>
              <span>Live &amp; Awarded Notices</span>
            </div>
            <div class="feature-item">
              <i class="las la-magic feature-icon-indigo"></i>
              <span>AI Relevance Filtering</span>
            </div>
            <div class="feature-item">
              <i class="las la-landmark feature-icon-indigo"></i>
              <span>Council Activity Rankings</span>
            </div>
            <div class="feature-item">
              <i class="las la-sync feature-icon-indigo"></i>
              <span>One-Click Data Sync</span>
            </div>
          </div>

          <button class="tool-button tool-button-indigo" on:click|stopPropagation={navigateToTenders}>
            Open Tenders
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
    background: var(--color-slate-100);
    padding: 3rem 1rem;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  }

  .home-container {
    max-width: 1200px;
    margin: 0 auto;
    position: relative;
  }

  /* --- Top controls --- */

  .logout-btn {
    position: absolute;
    top: 0;
    left: 0;
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    cursor: pointer;
    color: var(--color-slate-500);
    font-size: 0.8125rem;
    font-weight: 500;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    transition: all 0.15s;
  }

  .logout-btn:hover {
    background: var(--color-white);
    border-color: var(--color-slate-400);
    color: var(--color-slate-700);
  }

  .logout-btn:active {
    transform: none;
  }

  .create-project-btn {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 10;
    width: auto;
    height: auto;
    padding: 0.5rem 1.125rem;
    background: var(--color-primary-500);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    transition: all 0.15s;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    box-shadow: 0 1px 3px rgba(37, 99, 235, 0.3);
  }

  .create-project-btn:hover {
    background: var(--color-primary-600);
    box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
  }

  .create-project-btn:active {
    transform: none;
  }

  .create-project-btn i {
    font-size: 1rem;
    color: white;
  }

  .btn-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: white;
  }

  /* --- Header --- */

  .home-header {
    text-align: center;
    margin-bottom: 2.5rem;
    padding-top: 1.5rem;
  }

  .home-title {
    font-size: 2.25rem;
    font-weight: 700;
    color: var(--color-slate-900);
    margin: 0 0 0.75rem 0;
    line-height: 1.2;
    letter-spacing: -0.025em;
  }

  .home-subtitle {
    font-size: 1rem;
    color: var(--color-slate-500);
    max-width: 520px;
    margin: 0 auto;
    line-height: 1.6;
    font-weight: 400;
  }

  /* --- Grid --- */

  .tools-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
    gap: 1.25rem;
    margin-bottom: 4rem;
    padding-top: 3.5rem;
  }

  /* --- Cards --- */

  .tool-card {
    background: var(--color-white);
    border: 1px solid var(--color-slate-200);
    border-radius: 12px;
    padding: 1.75rem 2rem;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  }

  .tool-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 28px rgba(37, 99, 235, 0.1), 0 2px 8px rgba(0, 0, 0, 0.06);
    border-color: var(--color-primary-200);
  }

  .tool-card:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.18);
  }

  .card-content {
    text-align: center;
  }

  .card-icon {
    width: 3rem;
    height: 3rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.125rem;
  }

  .card-icon-blue,
  .card-icon-green,
  .card-icon-purple,
  .card-icon-orange,
  .card-icon-teal,
  .card-icon-indigo,
  .card-icon-slate {
    background: var(--color-primary-50);
    color: var(--color-primary-500);
  }

  .card-icon-violet {
    background: var(--color-violet-100);
    color: var(--color-violet-600);
  }

  .card-icon i {
    font-size: 1.5rem;
  }

  .beta-tag {
    display: inline-block;
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    background: var(--color-amber-100);
    color: var(--color-amber-800);
    vertical-align: middle;
    margin-left: 0.3rem;
    position: relative;
    top: -1px;
  }

  .card-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-slate-900);
    margin: 0 0 1.5rem 0;
    letter-spacing: -0.015em;
  }

  .card-description {
    color: var(--color-slate-500);
    margin-bottom: 1.25rem;
    line-height: 1.6;
    font-size: 0.9rem;
  }

  .features-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-bottom: 1.5rem;
    text-align: left;
    max-width: 280px;
    margin-left: auto;
    margin-right: auto;
  }

  .feature-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--color-slate-500);
    font-weight: 400;
  }

  .feature-icon-check,
  .feature-icon-blue,
  .feature-icon-orange,
  .feature-icon-teal,
  .feature-icon-indigo,
  .feature-icon-slate {
    color: var(--color-primary-500);
    font-size: 0.875rem;
  }

  .feature-icon-violet {
    color: var(--color-violet-600);
    font-size: 0.875rem;
  }

  .tool-button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5625rem 1.125rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    text-decoration: none;
    color: var(--color-white);
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    background: var(--color-primary-500);
    box-shadow: 0 1px 3px rgba(37, 99, 235, 0.25);
  }

  .tool-button-blue,
  .tool-button-green,
  .tool-button-purple,
  .tool-button-orange,
  .tool-button-teal,
  .tool-button-indigo,
  .tool-button-slate {
    background: var(--color-primary-500);
  }

  .tool-button-violet {
    background: var(--color-violet-600);
  }

  .tool-button:hover,
  .tool-button-blue:hover,
  .tool-button-green:hover,
  .tool-button-purple:hover,
  .tool-button-orange:hover,
  .tool-button-teal:hover,
  .tool-button-indigo:hover,
  .tool-button-slate:hover {
    background: var(--color-primary-600);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
  }

  .tool-button-violet:hover {
    background: var(--color-violet-700);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.35);
  }

  .tool-button i {
    font-size: 0.9375rem;
  }

  /* --- Footer --- */

  .home-footer {
    text-align: center;
    margin-top: 3rem;
  }

  .footer-text {
    color: var(--color-slate-400);
    font-size: 0.8125rem;
    margin: 0;
    font-weight: 400;
  }

  @media (max-width: 768px) {
    .home-page {
      padding: 2rem 1rem;
    }

    .home-title {
      font-size: 1.75rem;
    }

    .home-subtitle {
      font-size: 0.9375rem;
    }

    .tools-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .tool-card {
      padding: 1.5rem;
    }

    .features-list {
      max-width: none;
    }
  }
</style>