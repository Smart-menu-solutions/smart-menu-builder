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

function fallbackTranslation(client, language, type, sourceText) {
	const fallback = window.MENU_TRANSLATION_FALLBACKS?.[client.slug]?.[language];
	if (!fallback) return null;
	if (type === 'category') return fallback.categories?.[sourceText] || null;
	const item = fallback.items?.[sourceText];
	return item ? { name: item[0], description: item[1] } : null;
}

function categoryName(client, category) {
	return client.translations?.[requestedLanguage]?.categories?.[category.name]?.name
		|| fallbackTranslation(client, requestedLanguage, 'category', category.name)
		|| category.name;
}

function itemTranslation(client, item) {
	return client.translations?.[requestedLanguage]?.items?.[item.name]
		|| fallbackTranslation(client, requestedLanguage, 'item', item.name)
		|| {};
}

function renderMenu(client) {
	document.title = `${client.name} — Digital menu`;
	const phone = client.phone ? `<a href="tel:${encodeURIComponent(client.phone)}">Call</a>` : '';
		const whatsapp = client.whatsapp ? `<a href="https://wa.me/${client.whatsapp.replace(/\D/g, '')}" target="_blank" rel="noopener">WhatsApp</a>` : '';
		const map = client.address ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}" target="_blank" rel="noopener">Directions</a>` : '';
	const visibleCategories = (client.categories || []).filter((category) => Array.isArray(category.items) && category.items.length);
	const categories = visibleCategories.map((category) => `
		<section class="category" id="category-${encodeURIComponent(category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}">
			<h2>${escapeHtml(categoryName(client, category))}</h2>
			${(category.items || []).map((item) => `
				<article class="item">
					<div class="item-header"><h3>${escapeHtml(itemTranslation(client, item).name || item.name)}</h3><span class="price">${escapeHtml(item.price)} ${escapeHtml(client.currency || '€')}</span></div>
					${item.description || itemTranslation(client, item).description ? `<p>${escapeHtml(itemTranslation(client, item).description || item.description)}</p>` : ''}
				</article>`).join('')}
		</section>`).join('');
	app.innerHTML = `
		<header class="menu-hero" id="menu-top"><a class="menu-back" href="#menu-top">← Back to menu</a>${logoMarkup(client)}<h1>${escapeHtml(client.name)}</h1>
			${client.address ? `<p>${escapeHtml(client.address)}</p>` : ''}
			<nav class="actions" aria-label="Contact">${phone}${whatsapp}${map}</nav>
			<nav class="menu-languages" aria-label="Menu languages">${languageMarkup(client)}</nav>
		</header>
		<nav class="category-nav" aria-label="Menu categories">${visibleCategories.map((category) => `<a href="#category-${encodeURIComponent(category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}">${escapeHtml(categoryName(client, category))}</a>`).join('')}</nav>
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
