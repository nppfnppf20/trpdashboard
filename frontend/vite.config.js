import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: {
		include: ['leaflet', 'leaflet-draw', 'leaflet-image', 'leaflet-ruler']
	}
});
