<script>
  // MapLibre GL + Terra Draw map for viewing / drawing a single site boundary
  // polygon. Replaces the Leaflet + leaflet-draw maps in AddProjectModal and
  // ProjectViewModal's Site Boundary tab.
  //
  //   geojson   — the saved polygon geometry as a JSON string (or null)
  //   editable  — when true the user can draw / reshape / clear the polygon
  //   on:change — fires { geojson: string | null, area: string } after every
  //               draw / reshape / clear (area is e.g. "12.34 ha", or '')
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';

  export let geojson = null;
  export let editable = false;

  const dispatch = createEventDispatcher();
  const MAX_POINTS = 1000;
  const OS_KEY = import.meta.env.VITE_OS_API_KEY;

  const BASEMAPS = [
    {
      id: 'osm',
      label: 'Map',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors'
    },
    {
      id: 'satellite',
      label: 'Satellite',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      maxzoom: 19,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics'
    },
    ...(OS_KEY
      ? [{
          id: 'os',
          label: 'OS',
          tiles: [`https://api.os.uk/maps/raster/v1/zxy/Outdoor_3857/{z}/{x}/{y}.png?key=${OS_KEY}`],
          maxzoom: 19,
          attribution: 'Contains OS data © Crown copyright and database rights'
        }]
      : [])
  ];

  let container;
  let map;
  let draw;
  let maplibregl;
  let ready = false;
  let basemap = BASEMAPS[0].id;
  let hasPolygon = false;
  let mode = 'static';
  let lastEmitted = undefined; // last geojson string we emitted, to ignore our own echo
  let loadedGeojson = undefined; // last prop value pushed into the draw store

  function purple() {
    return getComputedStyle(document.documentElement).getPropertyValue('--color-purple-600').trim() || '#9333ea';
  }

  function rasterSource(b) {
    return { type: 'raster', tiles: b.tiles, tileSize: 256, maxzoom: b.maxzoom, attribution: b.attribution };
  }

  function buildStyle() {
    const sources = {};
    const layers = [];
    for (const b of BASEMAPS) {
      sources[b.id] = rasterSource(b);
      layers.push({
        id: `base-${b.id}`,
        type: 'raster',
        source: b.id,
        layout: { visibility: b.id === basemap ? 'visible' : 'none' }
      });
    }
    return { version: 8, sources, layers };
  }

  function setBasemap(id) {
    basemap = id;
    if (!map) return;
    for (const b of BASEMAPS) {
      map.setLayoutProperty(`base-${b.id}`, 'visibility', b.id === id ? 'visible' : 'none');
    }
  }

  // Spherical polygon area (m²) for the outer ring, [lng, lat] degrees.
  function ringAreaSqM(ring) {
    const R = 6378137;
    let sum = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [lng1, lat1] = ring[i];
      const [lng2, lat2] = ring[i + 1];
      sum += ((lng2 - lng1) * Math.PI / 180) *
        (2 + Math.sin(lat1 * Math.PI / 180) + Math.sin(lat2 * Math.PI / 180));
    }
    return Math.abs(sum * R * R / 2);
  }

  function polygonFeatures() {
    return draw.getSnapshot().filter(f => f.geometry.type === 'Polygon');
  }

  function emit() {
    const polys = polygonFeatures();
    hasPolygon = polys.length > 0;
    if (!hasPolygon) {
      lastEmitted = null;
      dispatch('change', { geojson: null, area: '' });
      return;
    }
    const geometry = polys[0].geometry;
    lastEmitted = JSON.stringify(geometry);
    const ha = (ringAreaSqM(geometry.coordinates[0]) / 10000).toFixed(2);
    dispatch('change', { geojson: lastEmitted, area: `${ha} ha` });
  }

  function fitToPolygon(geometry) {
    const coords = geometry.coordinates[0];
    const bounds = coords.reduce(
      (b, c) => b.extend(c),
      new maplibregl.LngLatBounds(coords[0], coords[0])
    );
    map.fitBounds(bounds, { padding: 60, maxZoom: 18, duration: 0 });
  }

  function loadGeojson(value) {
    loadedGeojson = value;
    draw.clear();
    hasPolygon = false;
    if (!value) return;
    try {
      const geometry = typeof value === 'string' ? JSON.parse(value) : value;
      if (geometry?.type !== 'Polygon') return;
      draw.addFeatures([{ type: 'Feature', geometry, properties: { mode: 'polygon' } }]);
      hasPolygon = true;
      fitToPolygon(geometry);
    } catch (err) {
      console.error('Error displaying polygon:', err);
    }
  }

  function applyMode() {
    if (!ready) return;
    if (!editable) {
      draw.setMode('static');
      mode = 'static';
      return;
    }
    if (hasPolygon) {
      startSelect();
    } else {
      startDraw();
    }
  }

  function startDraw() {
    // One polygon at a time — drawing a new one replaces the old.
    draw.setMode('polygon');
    mode = 'polygon';
  }

  function startSelect() {
    const polys = polygonFeatures();
    if (!polys.length) return;
    draw.setMode('select');
    draw.selectFeature(polys[0].id);
    mode = 'select';
  }

  function clearPolygon() {
    draw.clear();
    emit();
    startDraw();
  }

  function onFinish(id, context) {
    if (context?.mode !== 'polygon' || context.action !== 'draw') return;
    const feature = draw.getSnapshot().find(f => f.id === id);
    if (!feature) return;
    if (feature.geometry.coordinates[0].length > MAX_POINTS) {
      draw.removeFeatures([id]);
      alert(`Polygon too complex. Please draw a simpler shape (max ${MAX_POINTS} points).\n\nThis prevents performance issues during analysis.`);
      startDraw();
      return;
    }
    // Drop any previously drawn polygon.
    const others = polygonFeatures().filter(f => f.id !== id).map(f => f.id);
    if (others.length) draw.removeFeatures(others);
    emit();
    startSelect();
  }

  function onChange(ids, type) {
    // Reshape / move of the selected polygon. Creation is handled in onFinish.
    if (type === 'update' && mode === 'select') emit();
  }

  async function init() {
    // maplibre-gl 6.x is ESM-only with named exports (no default export)
    const [mlModule, td, { TerraDrawMapLibreGLAdapter }] = await Promise.all([
      import('maplibre-gl'),
      import('terra-draw'),
      import('terra-draw-maplibre-gl-adapter'),
      import('maplibre-gl/dist/maplibre-gl.css')
    ]);
    if (!container) return;
    maplibregl = mlModule.default ?? mlModule;

    map = new maplibregl.Map({
      container,
      style: buildStyle(),
      center: [-2.5, 54.5],
      zoom: 5
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.on('load', () => {
      const colour = purple();
      const polygonStyles = {
        fillColor: colour,
        fillOpacity: 0.2,
        outlineColor: colour,
        outlineWidth: 3
      };
      draw = new td.TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map, lib: maplibregl }),
        modes: [
          new td.TerraDrawPolygonMode({
            allowSelfIntersections: false,
            styles: { ...polygonStyles, closingPointColor: colour, closingPointOutlineColor: colour }
          }),
          new td.TerraDrawSelectMode({
            flags: {
              polygon: {
                feature: {
                  draggable: true,
                  coordinates: { midpoints: true, draggable: true, deletable: true }
                }
              }
            },
            styles: {
              selectedPolygonColor: colour,
              selectedPolygonFillOpacity: 0.2,
              selectedPolygonOutlineColor: colour,
              selectedPolygonOutlineWidth: 3,
              selectionPointColor: colour,
              selectionPointOutlineColor: colour,
              midPointColor: colour,
              midPointOutlineColor: colour
            }
          }),
          new td.TerraDrawStaticMode({ styles: polygonStyles })
        ]
      });
      draw.on('finish', onFinish);
      draw.on('change', onChange);
      draw.start();
      ready = true;
      loadGeojson(geojson);
      applyMode();
    });
  }

  onMount(() => {
    if (browser) init();
  });

  onDestroy(() => {
    try { draw?.stop(); } catch { /* adapter may already be gone */ }
    map?.remove();
    map = null;
    draw = null;
  });

  // Re-sync when the saved polygon changes from outside (e.g. after save, or
  // cancelling an edit) — but never while editing, and ignore our own echo.
  $: if (ready && !editable && geojson !== loadedGeojson && geojson !== lastEmitted) {
    loadGeojson(geojson);
  }

  // Cancelling an edit: restore whatever the parent considers saved.
  $: if (ready && !editable && mode !== 'static') {
    loadGeojson(geojson);
    applyMode();
  }

  // Entering edit mode.
  $: if (ready && editable && (mode === 'static')) {
    applyMode();
  }
</script>

<div class="site-boundary-map">
  <div class="map-canvas" bind:this={container}></div>

  <div class="basemap-switcher" role="group" aria-label="Basemap">
    {#each BASEMAPS as b}
      <button
        type="button"
        class:active={basemap === b.id}
        on:click={() => setBasemap(b.id)}
      >{b.label}</button>
    {/each}
  </div>

  {#if editable && ready}
    <div class="draw-toolbar" role="group" aria-label="Boundary tools">
      <button type="button" class:active={mode === 'polygon'} on:click={startDraw}>
        {hasPolygon ? 'Redraw' : 'Draw'}
      </button>
      <button type="button" class:active={mode === 'select'} disabled={!hasPolygon} on:click={startSelect}>
        Edit
      </button>
      <button type="button" disabled={!hasPolygon} on:click={clearPolygon}>Clear</button>
    </div>
  {/if}
</div>

<style>
  .site-boundary-map {
    position: absolute;
    inset: 0;
  }

  .map-canvas {
    position: absolute;
    inset: 0;
  }

  .basemap-switcher,
  .draw-toolbar {
    position: absolute;
    z-index: 2;
    display: flex;
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .basemap-switcher {
    top: 10px;
    left: 10px;
  }

  .draw-toolbar {
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
  }

  .basemap-switcher button,
  .draw-toolbar button {
    padding: 6px 12px;
    border: none;
    border-right: 1px solid var(--color-slate-200);
    background: transparent;
    color: var(--color-slate-700);
    font-size: var(--font-size-xs);
    font-weight: 500;
    cursor: pointer;
  }

  .basemap-switcher button:last-child,
  .draw-toolbar button:last-child {
    border-right: none;
  }

  .basemap-switcher button:hover:not(:disabled),
  .draw-toolbar button:hover:not(:disabled) {
    background: var(--color-slate-100);
  }

  .basemap-switcher button.active,
  .draw-toolbar button.active {
    background: var(--color-primary-600);
    color: var(--color-slate-50);
  }

  .draw-toolbar button:disabled {
    color: var(--color-slate-400);
    cursor: not-allowed;
  }
</style>
