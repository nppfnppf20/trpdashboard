<script>
  // MapLibre map of Similar Schemes results: one dot per planning application (coloured by status), plus the
  // project's site boundary when it has one.
  //
  //   schemes   — [{ name, lng, lat, description, address, state, date, reason, url, dim, saved, selected }]
  //   boundary  — the project's saved polygon geometry as a JSON string (or null)
  //   on:toggle — fires the application name when "Select" is pressed in a popup
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';
  import { safeUrl } from '$lib/utils/safeUrl.js';
  // Vite must bundle the MapLibre worker itself (same as SiteBoundaryMap).
  import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

  export let schemes = [];
  export let boundary = null;

  const dispatch = createEventDispatcher();

  const BASEMAPS = [
    { id: 'osm', label: 'Map', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], maxzoom: 19, attribution: '© OpenStreetMap contributors' },
    { id: 'satellite', label: 'Satellite', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], maxzoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' }
  ];

  let container;
  let map;
  let maplibregl;
  let popup;
  let ready = false;
  let resizeObserver;
  let basemap = BASEMAPS[0].id;
  let fittedKey = '';
  /** @type {Record<string, string>} */
  let colours = {};

  const cssVar = (name, fallback) =>
    (browser && getComputedStyle(document.documentElement).getPropertyValue(name).trim()) || fallback;

  function loadColours() {
    colours = {
      granted: cssVar('--color-emerald-600', '#059669'),
      refused: cssVar('--color-red-600', '#dc2626'),
      live: cssVar('--color-amber-600', '#d97706'),
      other: cssVar('--color-slate-500', '#64748b'),
      saved: cssVar('--color-purple-600', '#9333ea'),
      selected: cssVar('--color-slate-900', '#0f172a'),
      white: cssVar('--color-white', '#ffffff')
    };
  }

  $: legend = colours.granted
    ? [
        { label: 'Permitted', colour: colours.granted },
        { label: 'Rejected', colour: colours.refused },
        { label: 'Undecided', colour: colours.live },
        { label: 'Other', colour: colours.other }
      ]
    : [];

  function buildStyle() {
    const sources = {};
    const layers = [];
    for (const b of BASEMAPS) {
      sources[b.id] = { type: 'raster', tiles: b.tiles, tileSize: 256, maxzoom: b.maxzoom, attribution: b.attribution };
      layers.push({ id: `base-${b.id}`, type: 'raster', source: b.id, layout: { visibility: b.id === basemap ? 'visible' : 'none' } });
    }
    return { version: 8, sources, layers };
  }

  function setBasemap(id) {
    basemap = id;
    if (!map) return;
    for (const b of BASEMAPS) map.setLayoutProperty(`base-${b.id}`, 'visibility', b.id === id ? 'visible' : 'none');
  }

  function siteFeature() {
    if (!boundary) return null;
    try {
      const geometry = typeof boundary === 'string' ? JSON.parse(boundary) : boundary;
      return geometry?.type === 'Polygon' ? { type: 'Feature', geometry, properties: {} } : null;
    } catch {
      return null;
    }
  }

  function pointFeatures() {
    return schemes
      .filter(r => Number.isFinite(r.lng) && Number.isFinite(r.lat))
      .map(r => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
        properties: {
          name: r.name,
          description: r.description || '',
          address: r.address || '',
          state: r.state || '',
          date: r.date || '',
          reason: r.reason || '',
          url: r.url || '',
          dim: !!r.dim,
          saved: !!r.saved,
          selected: !!r.selected
        }
      }));
  }

  function addLayers() {
    map.addSource('site', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource('schemes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

    map.addLayer({ id: 'site-fill', type: 'fill', source: 'site', paint: { 'fill-color': colours.saved, 'fill-opacity': 0.2 } });
    map.addLayer({ id: 'site-line', type: 'line', source: 'site', paint: { 'line-color': colours.saved, 'line-width': 3 } });

    map.addLayer({
      id: 'schemes-dots',
      type: 'circle',
      source: 'schemes',
      paint: {
        'circle-radius': ['case', ['get', 'selected'], 10, 7],
        'circle-color': [
          'match', ['get', 'state'],
          ['Permitted', 'Conditions'], colours.granted,
          'Rejected', colours.refused,
          'Undecided', colours.live,
          colours.other
        ],
        'circle-opacity': ['case', ['get', 'dim'], 0.35, 0.9],
        'circle-stroke-width': ['case', ['any', ['get', 'saved'], ['get', 'selected']], 3, 1.5],
        'circle-stroke-color': ['case', ['get', 'saved'], colours.saved, ['get', 'selected'], colours.selected, colours.white]
      }
    });

    map.on('click', 'schemes-dots', e => {
      const f = e.features?.[0];
      if (f) showPopup(f);
    });
    map.on('mouseenter', 'schemes-dots', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'schemes-dots', () => (map.getCanvas().style.cursor = ''));
  }

  function formatDate(d) {
    if (!d) return '';
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // Popup content is built with DOM nodes and textContent so nothing from PlanIt is ever parsed as HTML.
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function showPopup(feature) {
    const p = feature.properties;
    const root = el('div', 'sm-popup');
    root.append(el('div', 'sm-popup-desc', p.description || '(No description)'));
    if (p.address) root.append(el('div', 'sm-popup-meta', p.address));
    const meta = [p.state, p.date && `Submitted ${formatDate(p.date)}`].filter(Boolean).join(' · ');
    if (meta) root.append(el('div', 'sm-popup-meta', meta));
    if (p.reason) {
      const why = el('div', 'sm-popup-why');
      why.append(el('strong', '', 'Why relevant: '), document.createTextNode(p.reason));
      root.append(why);
    }

    const actions = el('div', 'sm-popup-actions');
    if (p.saved === true || p.saved === 'true') {
      actions.append(el('span', 'sm-popup-saved', 'Saved to this project'));
    } else {
      const selected = p.selected === true || p.selected === 'true';
      const btn = el('button', 'sm-popup-btn', selected ? 'Deselect' : 'Select');
      btn.type = 'button';
      btn.addEventListener('click', () => {
        dispatch('toggle', p.name);
        popup?.remove();
      });
      actions.append(btn);
    }
    if (p.url && safeUrl(p.url)) {
      const a = el('a', 'sm-popup-link', 'Council site');
      a.href = safeUrl(p.url);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      actions.append(a);
    }
    root.append(actions);

    popup?.remove();
    popup = new maplibregl.Popup({ maxWidth: '320px', offset: 10 })
      .setLngLat(feature.geometry.coordinates.slice())
      .setDOMContent(root)
      .addTo(map);
  }

  function update() {
    if (!ready) return;
    const site = siteFeature();
    const points = pointFeatures();
    map.getSource('site').setData({ type: 'FeatureCollection', features: site ? [site] : [] });
    map.getSource('schemes').setData({ type: 'FeatureCollection', features: points });

    // Only re-frame the map when the set of places changes, not when you tick a dot.
    const key = points.map(f => f.properties.name).sort().join('|') + (site ? '|site' : '');
    if (key === fittedKey) return;
    fittedKey = key;
    const coords = [...points.map(f => f.geometry.coordinates), ...(site ? site.geometry.coordinates[0] : [])];
    if (!coords.length) return;
    const bounds = coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
    map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 0 });
  }

  // Re-draw whenever the data changes.
  $: if (ready) {
    schemes;
    boundary;
    update();
  }

  async function init() {
    const [mlModule] = await Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')]);
    if (!container) return;
    maplibregl = /** @type {any} */ (mlModule).default ?? mlModule;
    maplibregl.setWorkerUrl(maplibreWorkerUrl);
    loadColours();

    map = new maplibregl.Map({ container, style: buildStyle(), center: [-2.5, 54.5], zoom: 5 });
    resizeObserver = new ResizeObserver(() => map?.resize());
    resizeObserver.observe(container);
    requestAnimationFrame(() => map?.resize());

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.on('load', () => {
      addLayers();
      ready = true;
      map.resize();
      update();
    });
  }

  onMount(() => {
    if (browser) init().catch(err => console.error('Schemes map failed to initialise:', err));
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    popup?.remove();
    map?.remove();
    map = null;
  });
</script>

<div class="schemes-map">
  <div class="map-canvas" bind:this={container}></div>

  <div class="basemap-switcher" role="group" aria-label="Basemap">
    {#each BASEMAPS as b}
      <button type="button" class:active={basemap === b.id} on:click={() => setBasemap(b.id)}>{b.label}</button>
    {/each}
  </div>

  <div class="legend">
    {#each legend as item}
      <span class="legend-item"><span class="legend-dot" style="background: {item.colour}"></span>{item.label}</span>
    {/each}
    {#if boundary}<span class="legend-item"><span class="legend-box"></span>Project site</span>{/if}
    <span class="legend-item"><span class="legend-ring"></span>Saved</span>
  </div>
</div>

<style>
  .schemes-map {
    position: relative;
    height: 520px;
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .map-canvas {
    position: absolute;
    inset: 0;
  }

  .basemap-switcher {
    position: absolute;
    z-index: 2;
    top: 10px;
    left: 10px;
    display: flex;
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .basemap-switcher button {
    border: none;
    background: transparent;
    padding: 0.3rem 0.7rem;
    font: inherit;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-slate-600);
    cursor: pointer;
  }

  .basemap-switcher button.active {
    background: var(--color-purple-600);
    color: var(--color-white);
  }

  .legend {
    position: absolute;
    z-index: 2;
    left: 10px;
    bottom: 34px;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    max-width: calc(100% - 20px);
    padding: 0.35rem 0.6rem;
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    font-size: 0.7rem;
    color: var(--color-slate-700);
  }

  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .legend-dot {
    width: 0.65rem;
    height: 0.65rem;
    border-radius: 50%;
  }

  .legend-box {
    width: 0.8rem;
    height: 0.6rem;
    border: 2px solid var(--color-purple-600);
    background: var(--color-purple-50);
  }

  .legend-ring {
    width: 0.65rem;
    height: 0.65rem;
    border-radius: 50%;
    border: 3px solid var(--color-purple-600);
  }

  :global(.sm-popup) {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.78rem;
    color: var(--color-slate-800);
    line-height: 1.4;
  }

  :global(.sm-popup-desc) {
    font-weight: 600;
  }

  :global(.sm-popup-meta) {
    color: var(--color-slate-500);
    font-size: 0.72rem;
  }

  :global(.sm-popup-why) {
    color: var(--color-slate-700);
  }

  :global(.sm-popup-actions) {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.15rem;
  }

  :global(.sm-popup-btn) {
    border: 1px solid var(--color-purple-600);
    background: var(--color-white);
    color: var(--color-purple-700);
    border-radius: var(--radius-pill);
    padding: 0.1rem 0.7rem;
    font: inherit;
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
  }

  :global(.sm-popup-btn:hover) {
    background: var(--color-purple-50);
  }

  :global(.sm-popup-saved) {
    color: var(--color-purple-700);
    font-size: 0.72rem;
    font-weight: 600;
  }

  :global(.sm-popup-link) {
    color: var(--color-purple-600);
    font-size: 0.72rem;
  }
</style>
