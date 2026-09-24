/* Registers sw.js (offline menu + installable app) and shows a small
   "new version" banner when an update is waiting. Loaded by menu.html,
   admin.html and login.html. */
(function () {
	if (!('serviceWorker' in navigator) || !window.isSecureContext) return;

	const STRINGS = {
		de: { text: 'Neue Version verfügbar', button: 'Neu laden' },
		en: { text: 'A new version is available', button: 'Reload' },
		el: { text: 'Υπάρχει νέα έκδοση', button: 'Ανανέωση' },
		it: { text: 'Nuova versione disponibile', button: 'Ricarica' },
		es: { text: 'Nueva versión disponible', button: 'Recargar' }
	};

	function strings() {
		const lang = (new URLSearchParams(location.search).get('lang') || navigator.language || 'en').slice(0, 2).toLowerCase();
		return STRINGS[lang] || STRINGS.en;
	}

	function showUpdateBanner(worker) {
		if (document.getElementById('pwaUpdateBanner')) return;
		const text = strings();
		const banner = document.createElement('div');
		banner.id = 'pwaUpdateBanner';
		banner.setAttribute('role', 'status');
		banner.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:12px;max-width:calc(100% - 32px);padding:10px 12px 10px 16px;border-radius:999px;background:#262421;color:#fff;font:600 14px/1.3 system-ui,sans-serif;box-shadow:0 10px 30px -10px rgba(0,0,0,.5)';
		const label = document.createElement('span');
		label.textContent = text.text;
		const button = document.createElement('button');
		button.type = 'button';
		button.textContent = text.button;
		button.style.cssText = 'border:0;border-radius:999px;padding:8px 14px;background:#f66a09;color:#fff;font:700 13px system-ui,sans-serif;cursor:pointer;white-space:nowrap';
		button.addEventListener('click', () => {
			button.disabled = true;
			worker.postMessage({ type: 'SKIP_WAITING' });
		});
		banner.append(label, button);
		document.body.appendChild(banner);
	}

	// Hands the worker everything this page already loaded before the worker
	// was in control (see warm() in sw.js).
	function warmCache(registration) {
		const worker = registration.active;
		if (!worker) return;
		const resources = performance.getEntriesByType('resource').map((entry) => entry.name).filter((name) => /^https?:/.test(name));
		worker.postMessage({
			type: 'WARM',
			page: location.href,
			resources,
			apikey: typeof AUTH_CONFIG !== 'undefined' ? AUTH_CONFIG.supabasePublishableKey : ''
		});
	}

	// menu.html serves every restaurant, so one static manifest can't say which
	// menu the installed app should open. This rebuilds it for the current
	// restaurant: start_url keeps ?client= (and ?lang=) but drops table/k, so a
	// home-screen icon added at a table doesn't reopen that table's order
	// session days later. The app is named after the restaurant once menu.js
	// has set the page title ("El Greco — Digital menu").
	async function personalizeMenuManifest() {
		const link = document.querySelector('link[rel="manifest"][data-per-restaurant]');
		const client = new URLSearchParams(location.search).get('client');
		if (!link || !client) return;
		// Captured once: after apply() runs, link.href is the data: URL itself.
		const manifestUrl = link.href;
		let base;
		try {
			base = await (await fetch(manifestUrl)).json();
		} catch {
			return;
		}
		const absolute = (path) => new URL(path, manifestUrl).href;
		const start = new URL(location.pathname, location.href);
		start.searchParams.set('client', client);
		const lang = new URLSearchParams(location.search).get('lang');
		if (lang) start.searchParams.set('lang', lang);
		const apply = () => {
			const name = document.title.split(' — ')[0].trim();
			const manifest = {
				...base,
				id: start.pathname + '?client=' + encodeURIComponent(client),
				start_url: start.href,
				scope: absolute('./'),
				icons: base.icons.map((icon) => ({ ...icon, src: absolute(icon.src) })),
				...(name && name !== document.title ? { name, short_name: name.slice(0, 12) } : {})
			};
			link.href = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(manifest));
		};
		apply();
		const title = document.querySelector('title');
		if (title) new MutationObserver(apply).observe(title, { childList: true });
	}
	personalizeMenuManifest();

	window.addEventListener('load', async () => {
		let registration;
		try {
			registration = await navigator.serviceWorker.register('sw.js');
		} catch {
			return; // the site keeps working exactly as before, just without offline support
		}

		// Only reload for an update the user asked for (the banner button) -
		// not on the very first install, where the page is already current.
		const hadController = !!navigator.serviceWorker.controller;
		let reloading = false;
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			if (!hadController || reloading) return;
			reloading = true;
			location.reload();
		});

		if (registration.waiting && hadController) showUpdateBanner(registration.waiting);
		registration.addEventListener('updatefound', () => {
			const incoming = registration.installing;
			if (!incoming) return;
			incoming.addEventListener('statechange', () => {
				if (incoming.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(incoming);
			});
		});

		// First visit only (once the worker controls the page, its own fetch
		// handler caches everything). Gives the menu a moment to finish loading
		// its data and photos, so they're part of what gets cached.
		if (!hadController) navigator.serviceWorker.ready.then((ready) => setTimeout(() => warmCache(ready), 3000));
	});
})();
