const app = document.querySelector('#app');
const slug = new URLSearchParams(location.search).get('client');
const requestedLanguage = new URLSearchParams(location.search).get('lang');

function escapeHtml(value) {
	return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
		'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
	}[character]));
}

function logoMarkup(client) {
	const source = client.logo_url || client.logoUrl || client.logo;
	if (!source || !/^https?:\/\//i.test(source)) return '';
	return `<img class="menu-logo" src="${escapeHtml(source)}" alt="${escapeHtml(client.name)} logo">`;
}

function languageMarkup(client) {
	return (client.languages || ['en']).map((language) => `<a href="?client=${encodeURIComponent(client.slug)}&lang=${encodeURIComponent(language)}" aria-current="${language === requestedLanguage ? 'page' : 'false'}">${escapeHtml(language.toUpperCase())}</a>`).join('');
}

function renderMenu(client) {
	document.title = `${client.name} — Digital menu`;
	const phone = client.phone ? `<a href="tel:${encodeURIComponent(client.phone)}">Call</a>` : '';
	const whatsapp = client.whatsapp ? `<a href="https://wa.me/${client.whatsapp.replace(/\D/g, '')}">WhatsApp</a>` : '';
	const map = client.address ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}">Directions</a>` : '';
	const categories = (client.categories || []).map((category) => `
		<section class="category">
			<h2>${escapeHtml(client.translations?.[requestedLanguage]?.categories?.[category.name]?.name || category.name)}</h2>
			${(category.items || []).map((item) => `
				<article class="item">
					<div class="item-header"><h3>${escapeHtml(client.translations?.[requestedLanguage]?.items?.[item.name]?.name || item.name)}</h3><span class="price">${escapeHtml(item.price)} ${escapeHtml(client.currency || '€')}</span></div>
					${item.description ? `<p>${escapeHtml(client.translations?.[requestedLanguage]?.items?.[item.name]?.description || item.description)}</p>` : ''}
				</article>`).join('')}
		</section>`).join('');
	app.innerHTML = `
		<header class="menu-hero">${logoMarkup(client)}<h1>${escapeHtml(client.name)}</h1>
			${client.address ? `<p>${escapeHtml(client.address)}</p>` : ''}
			<nav class="menu-languages" aria-label="Menu languages">${languageMarkup(client)}</nav>
			<nav class="actions" aria-label="Contact">${phone}${whatsapp}${map}</nav>
		</header>
		<div class="menu-container">${categories || '<p class="message">Menu coming soon.</p>'}</div>
		<footer class="menu-footer"><p>${escapeHtml(client.name)}</p><a class="footer-brand" href="https://smart-menu-solutions.github.io/smart-menu-solutions/index.html"><img src="https://primary.jwwb.nl/public/q/b/h/temp-qwfllybferzrbmruxsqy/designer-6-photoroom-high.png?enable-io=true&enable=upscale&height=70" alt="Smart Menu Solutions logo"><span>Digital menu by Smart Menu Solutions</span></a></footer>`;
}

async function loadMenu() {
	if (!slug) throw new Error('This menu link is missing its client identifier.');
	const response = await fetch(`${AUTH_CONFIG.supabaseUrl}/rest/v1/menus?slug=eq.${encodeURIComponent(slug)}&is_published=eq.true&select=*`, {
		headers: { apikey: AUTH_CONFIG.supabasePublishableKey, Accept: 'application/json' }
	});
	if (!response.ok) throw new Error('The menu could not be loaded.');
	const menus = await response.json();
	if (!menus.length) throw new Error('This menu is not available.');
	renderMenu(menus[0]);
}

loadMenu().catch((error) => { app.innerHTML = `<p class="message error">${escapeHtml(error.message)}</p>`; });
