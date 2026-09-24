/* Service worker for the installable guest menu (menu.html) and the admin
   workspace (admin.html/login.html). Registered by data/assets/js/pwa.js.

   Everything is network-first: while online, pages, scripts and menu data
   always come fresh from the network, exactly as without a service worker -
   the cache is only a fallback for when the connection drops. Images are the
   one exception (stale-while-revalidate), since a slightly old photo is
   harmless and they are the heaviest part of a menu.

   Never cached: anything that isn't a GET, Edge Functions (orders, staff,
   stats), auth, realtime, and any Supabase request carrying a login session
   - so no order state, bill or owner data ever lands in the cache. */

const VERSION = 'v1';
const PAGES = `sms-pages-${VERSION}`;
const ASSETS = `sms-assets-${VERSION}`;
const DATA = `sms-data-${VERSION}`;
const IMAGES = `sms-images-${VERSION}`;
const KNOWN_CACHES = [PAGES, ASSETS, DATA, IMAGES];

const PWA_PAGES = ['menu.html', 'admin.html', 'login.html'];
const SUPABASE_HOST = 'qlzugnwsufbgznoawvic.supabase.co';
const CDN_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
// Slow restaurant wifi: after this long, fall back to the cached copy (if
// there is one) instead of leaving the guest staring at a blank page.
const NETWORK_TIMEOUT_MS = 4000;
const MAX_IMAGES = 150;

self.addEventListener('install', (event) => {
	// Only the icons are precached - the pages and their versioned scripts get
	// cached on first visit (see the 'warm' message below), so this list never
	// has to be kept in sync with the ?v= strings in the HTML.
	event.waitUntil(caches.open(ASSETS).then((cache) => cache.addAll([
		'assets/icons/icon-192.png',
		'assets/icons/icon-512.png'
	])));
	// No skipWaiting() here: a new version waits until the page's update
	// banner is tapped (pwa.js), so nobody gets swapped mid-order.
});

self.addEventListener('activate', (event) => {
	event.waitUntil((async () => {
		const names = await caches.keys();
		await Promise.all(names.filter((name) => name.startsWith('sms-') && !KNOWN_CACHES.includes(name)).map((name) => caches.delete(name)));
		await self.clients.claim();
	})());
});

self.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
	if (event.data?.type === 'WARM') event.waitUntil(warm(event.data));
});

self.addEventListener('fetch', (event) => {
	const strategy = route(event.request);
	if (strategy) event.respondWith(strategy());
});

function pageName(url) {
	return url.pathname.split('/').pop() || 'index.html';
}

// Returns a function producing the response, or null to leave the request
// entirely to the browser (as if there were no service worker).
function route(request) {
	if (request.method !== 'GET') return null;
	const url = new URL(request.url);

	if (url.origin === self.location.origin) {
		if (request.mode === 'navigate') {
			if (!PWA_PAGES.includes(pageName(url))) return null;
			// One cached copy per page, whatever the ?client=... - the HTML is
			// the same for every restaurant, the menu itself is fetched below.
			return () => networkFirst(request, PAGES, url.pathname, offlinePage);
		}
		if (request.destination === 'image') return () => staleWhileRevalidate(request, IMAGES);
		return () => networkFirst(request, ASSETS, request);
	}

	if (url.hostname === SUPABASE_HOST) {
		if (isPublicMenuRequest(url, request)) return () => networkFirst(request, DATA, request);
		if (url.pathname.startsWith('/storage/v1/object/public/')) return () => staleWhileRevalidate(request, IMAGES);
		return null;
	}

	if (CDN_HOSTS.includes(url.hostname)) return () => staleWhileRevalidate(request, ASSETS);
	if (request.destination === 'image') return () => staleWhileRevalidate(request, IMAGES);
	return null;
}

// Only the anonymous published-menu read menu.js makes. The admin's own
// reads of the same table go through supabase-js, which always sends an
// Authorization header - those stay uncached.
function isPublicMenuRequest(url, request) {
	return url.pathname === '/rest/v1/menus'
		&& url.searchParams.get('is_published') === 'eq.true'
		&& !request.headers.has('authorization');
}

async function networkFirst(request, cacheName, cacheKey, fallback) {
	const cache = await caches.open(cacheName);
	const network = fetch(request).then(async (response) => {
		if (response.ok) await safePut(cache, cacheKey, response.clone());
		return response;
	});
	network.catch(() => {});
	const cached = () => cache.match(cacheKey, { ignoreVary: true });
	try {
		return await withTimeout(network, NETWORK_TIMEOUT_MS, cached);
	} catch (error) {
		const hit = await cached();
		if (hit) return hit;
		if (fallback) return fallback();
		throw error;
	}
}

// Resolves with the network response, unless it takes longer than ms AND a
// cached copy exists - then the cached copy wins (the network response still
// lands in the cache for next time).
function withTimeout(network, ms, cached) {
	return new Promise((resolve, reject) => {
		let settled = false;
		const timer = setTimeout(async () => {
			const hit = await cached();
			if (hit && !settled) { settled = true; resolve(hit); }
		}, ms);
		network.then((response) => {
			clearTimeout(timer);
			if (!settled) { settled = true; resolve(response); }
		}, (error) => {
			clearTimeout(timer);
			if (!settled) { settled = true; reject(error); }
		});
	});
}

async function staleWhileRevalidate(request, cacheName) {
	const cache = await caches.open(cacheName);
	const hit = await cache.match(request, { ignoreVary: true });
	const network = fetch(request).then(async (response) => {
		// Cross-origin <img> loads are opaque (status 0) but still usable.
		if (response.ok || response.type === 'opaque') {
			await safePut(cache, request, response.clone());
			if (cacheName === IMAGES) trim(cache, MAX_IMAGES);
		}
		return response;
	});
	if (hit) {
		network.catch(() => {});
		return hit;
	}
	return network;
}

// A full cache (e.g. a phone low on storage) must never break the page -
// the response is still served, it just isn't kept for offline use.
async function safePut(cache, key, response) {
	try { await cache.put(key, response); } catch { /* quota exceeded - skip */ }
}

async function trim(cache, maxEntries) {
	const keys = await cache.keys();
	await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map((key) => cache.delete(key)));
}

// The very first visit happens before this worker controls the page, so
// nothing from it went through the fetch handler. pwa.js sends the list of
// what that page loaded, and it's fetched once more here into the cache -
// that way the menu works offline from the first visit on, not the second.
async function warm({ page, resources, apikey }) {
	const jobs = [page, ...(resources || [])].map(async (href) => {
		try {
			const url = new URL(href);
			const isPage = href === page;
			const headers = url.hostname === SUPABASE_HOST && url.pathname.startsWith('/rest/') && apikey ? { apikey } : undefined;
			const request = new Request(href, {
				headers,
				mode: url.origin === self.location.origin || headers ? 'cors' : 'no-cors',
				credentials: 'omit'
			});
			if (isPage) {
				if (!PWA_PAGES.includes(pageName(url))) return;
				const response = await fetch(request);
				if (response.ok) await safePut(await caches.open(PAGES), url.pathname, response);
				return;
			}
			const cacheName = cacheFor(url, request);
			if (!cacheName) return;
			const cache = await caches.open(cacheName);
			if (await cache.match(request, { ignoreVary: true })) return;
			const response = await fetch(request);
			if (response.ok || response.type === 'opaque') await safePut(cache, request, response);
		} catch { /* best effort - it'll be cached on the next online visit anyway */ }
	});
	await Promise.all(jobs);
}

function cacheFor(url, request) {
	if (url.origin === self.location.origin) return /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(url.pathname) ? IMAGES : ASSETS;
	if (url.hostname === SUPABASE_HOST) {
		if (isPublicMenuRequest(url, request)) return DATA;
		if (url.pathname.startsWith('/storage/v1/object/public/')) return IMAGES;
		return null;
	}
	if (CDN_HOSTS.includes(url.hostname)) return ASSETS;
	return /\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(url.pathname) ? IMAGES : null;
}

function offlinePage() {
	return new Response(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#fafaf9;color:#262421;text-align:center;padding:24px}button{margin-top:16px;padding:10px 20px;border-radius:999px;border:0;background:#f66a09;color:#fff;font-weight:700}</style></head>
<body><div><p style="font-size:40px;margin:0">📶</p><h1 style="font-size:20px">Offline</h1><p>Keine Internetverbindung · No internet connection</p><button onclick="location.reload()">↻</button></div></body></html>`,
	{ status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
