const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
const app = isBrowser ? document.querySelector('#app') : null;
const slug = isBrowser ? new URLSearchParams(location.search).get('client') : null;
const urlLanguageParam = isBrowser ? new URLSearchParams(location.search).get('lang') : null;
// No explicit ?lang= in the URL (the normal case when a customer scans the
// QR code) — falls back to 'en' until renderMenu() swaps it for the menu's
// own main language once the client data has loaded.
let requestedLanguage = (urlLanguageParam || 'en').toLowerCase();

function escapeHtml(value) {
	return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
		'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
	}[character]));
}

const HEADER_FONTS = {
	playfair: { family: "'Playfair Display', serif", google: 'Playfair+Display:wght@600;700' },
	montserrat: { family: "'Montserrat', sans-serif", google: 'Montserrat:wght@600;700' },
	poppins: { family: "'Poppins', sans-serif", google: 'Poppins:wght@600;700' },
	dancing: { family: "'Dancing Script', cursive", google: 'Dancing+Script:wght@600;700' },
	oswald: { family: "'Oswald', sans-serif", google: 'Oswald:wght@600;700' }
};
// Only Open Sans is loaded by default (via menu.css); a client's custom
// header font is fetched on demand so picking one doesn't cost every other
// client's page load, and skipped entirely once already injected.
function loadGoogleFont(googleParam) {
	const id = `google-font-${googleParam}`;
	if (document.getElementById(id)) return;
	const link = document.createElement('link');
	link.id = id;
	link.rel = 'stylesheet';
	link.href = `https://fonts.googleapis.com/css2?family=${googleParam}&display=swap`;
	document.head.appendChild(link);
}

function logoMarkup(client) {
	const source = client.logo_url || client.logoUrl || client.logo;
	if (!source || !/^https?:\/\//i.test(source)) return '';
	return `<img class="menu-logo" src="${escapeHtml(source)}" alt="${escapeHtml(client.name)} logo">`;
}

function languageMarkup(client) {
	return (client.languages || ['en']).map((language) => {
		const current = language === requestedLanguage ? ' aria-current="page"' : '';
		return `<a href="?client=${encodeURIComponent(client.slug)}&lang=${encodeURIComponent(language)}"${current}>${escapeHtml(language.toUpperCase())}</a>`;
	}).join('');
}

function fallbackTranslation(client, language, type, sourceText) {
	const catalogs = window.MENU_TRANSLATION_FALLBACKS;
	if (!catalogs || typeof catalogs !== 'object') return null;
	const fallback = catalogs?.[client.slug]?.[language];
	if (!fallback || typeof fallback !== 'object') return null;
	if (type === 'category') {
		if (!fallback.categories || typeof fallback.categories !== 'object') return null;
		const category = fallback.categories[sourceText];
		return typeof category === 'string' && category ? category : null;
	}
	if (!fallback.items || typeof fallback.items !== 'object') return null;
	const item = fallback.items[sourceText];
	if (!Array.isArray(item) || typeof item[0] !== 'string') return null;
	return { name: item[0], description: typeof item[1] === 'string' ? item[1] : '' };
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

function buildContactLinks(client) {
	const phone = client.phone ? `<a href="tel:${encodeURIComponent(client.phone)}">Call</a>` : '';
	const whatsapp = client.whatsapp ? `<a href="https://wa.me/${client.whatsapp.replace(/\D/g, '')}" target="_blank" rel="noopener">WhatsApp</a>` : '';
	const map = client.address ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}" target="_blank" rel="noopener">Directions</a>` : '';
	return `${phone}${whatsapp}${map}`;
}

function categoryId(name) {
	return encodeURIComponent(name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
}

function buildCategory(client, category) {
	const categoryImage = category.image && /^https?:\/\//i.test(category.image) ? `<img class="category-image" src="${escapeHtml(category.image)}" alt="">` : '';
	return `
		<section class="category" id="category-${categoryId(category.name)}">
			<h2>${escapeHtml(categoryName(client, category))}</h2>
			${categoryImage}
			${(category.items || []).map((item) => {
				const translation = itemTranslation(client, item);
				const description = translation.description || item.description;
				const itemImage = item.image && /^https?:\/\//i.test(item.image) ? `<img class="item-image" src="${escapeHtml(item.image)}" alt="">` : '';
				return `
				<article class="item">
					${itemImage}
					<div class="item-body">
						<div class="item-header"><h3>${escapeHtml(translation.name || item.name)}</h3><span class="price">${escapeHtml(item.price)} ${escapeHtml(client.currency || '€')}</span></div>
						${description ? `<p>${escapeHtml(description)}</p>` : ''}
					</div>
				</article>`;
			}).join('')}
		</section>`;
}

function renderMenu(client) {
	if (!urlLanguageParam) {
		requestedLanguage = ((client.languages && client.languages[0]) || client.sourceLanguage || 'en').toLowerCase();
	}
	document.title = `${client.name} — Digital menu`;
	const visibleCategories = (client.categories || []).filter((category) => Array.isArray(category.items) && category.items.length);
	const categories = visibleCategories.map((category) => buildCategory(client, category)).join('');
	const heroBackground = client.header_background_url && /^https?:\/\//i.test(client.header_background_url)
		? ` style="background-image:linear-gradient(rgba(38,36,33,.5),rgba(38,36,33,.5)), url('${escapeHtml(client.header_background_url)}')"`
		: '';
	const headerFont = HEADER_FONTS[client.header_font];
	if (headerFont) loadGoogleFont(headerFont.google);
	const headerTextStyle = [
		headerFont ? `font-family:${headerFont.family}` : '',
		/^#[0-9a-f]{3,8}$/i.test(client.header_text_color || '') ? `color:${client.header_text_color}` : ''
	].filter(Boolean).join(';');
	const headerTextAttr = headerTextStyle ? ` style="${headerTextStyle}"` : '';
	app.innerHTML = `
		<header class="menu-hero" id="menu-top"${heroBackground}><a class="menu-back" href="?client=${encodeURIComponent(client.slug)}&lang=${encodeURIComponent(requestedLanguage)}#menu-top">← Back to menu</a>${logoMarkup(client)}<h1${headerTextAttr}>${escapeHtml(client.name)}</h1>
			${client.address ? `<p${headerTextAttr}>${escapeHtml(client.address)}</p>` : ''}
			<nav class="actions" aria-label="Contact">${buildContactLinks(client)}</nav>
			<nav class="menu-languages" aria-label="Menu languages">${languageMarkup(client)}</nav>
		</header>
		<nav class="category-nav" aria-label="Menu categories">${visibleCategories.map((category) => `<a href="#category-${categoryId(category.name)}">${escapeHtml(categoryName(client, category))}</a>`).join('')}</nav>
		<div class="menu-container">${categories || '<p class="message">Menu coming soon.</p>'}</div>
		<footer class="menu-footer"><p>${escapeHtml(client.name)}</p><a class="footer-brand" href="https://smart-menu-solutions.github.io/smart-menu-solutions/index.html"><img src="https://primary.jwwb.nl/public/q/b/h/temp-qwfllybferzrbmruxsqy/designer-6-photoroom-high.png?enable-io=true&enable=upscale&height=70" alt="Smart Menu Solutions logo"><span>Digital menu by Smart Menu Solutions</span></a></footer>`;
}

async function loadMenu() {
	if (!slug) throw new Error('This menu link is missing its client identifier.');
	const FALLBACK_CLIENTS = {
		'gute-laune': {
			name: 'Gute Laune', slug: 'gute-laune', currency: '€',
			languages: ['de', 'en', 'el', 'it', 'es'],
			categories: [
				['Heiße Getränke', [['Espresso', '2.50'], ['Doppio Espresso', '3.50'], ['Americano', '3.00'], ['Cappuccino', '3.80'], ['Latte Macchiato', '4.20'], ['Café Crème', '3.20'], ['Mokka', '3.50'], ['Heiße Schokolade', '4.00'], ['Tee (verschiedene Sorten)', '3.00']]],
				['Kalte Getränke', [['Eiskaffee', '4.50'], ['Frappé', '4.80'], ['Frischer Orangensaft', '4.00'], ['Apfelsaft', '3.50'], ['Mineralwasser (0,5 l)', '2.50'], ['Softdrinks', '3.00']]],
				['Frühstück & Snacks', [['Croissant', '2.50'], ['Schoko-Croissant', '3.00'], ['Toast mit Käse & Schinken', '4.50'], ['Club Sandwich', '6.90'], ['Bagel mit Frischkäse', '4.80'], ['Joghurt mit Honig & Nüssen', '5.50']]],
				['Kuchen & Desserts', [['Käsekuchen', '4.50'], ['Schokoladenkuchen', '4.80'], ['Apfelkuchen', '4.20'], ['Tiramisu', '5.50'], ['Muffin', '3.00']]],
				['Spezialitäten', [['Freddo Espresso', '3.80'], ['Freddo Cappuccino', '4.50'], ['Affogato', '5.00'], ['Hausgemachter Eistee', '4.20']]]
			].map(([name, items]) => ({ name, items: items.map(([itemName, price]) => ({ name: itemName, description: '', price })) }))
		}
	};
	if (FALLBACK_CLIENTS[slug]) {
		renderMenu(FALLBACK_CLIENTS[slug]);
		return;
	}
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 10000);
	let response;
	try {
		response = await fetch(`${AUTH_CONFIG.supabaseUrl}/rest/v1/menus?slug=eq.${encodeURIComponent(slug)}&is_published=eq.true&select=*`, {
			headers: { apikey: AUTH_CONFIG.supabasePublishableKey, Accept: 'application/json' },
			signal: controller.signal
		});
	} finally {
		clearTimeout(timeoutId);
	}
	if (!response.ok) throw new Error('The menu could not be loaded. Please try again later.');
	let menus;
	try {
		menus = await response.json();
	} catch {
		throw new Error('The menu could not be loaded. Please try again later.');
	}
	if (!menus.length) throw new Error('This menu is not available.');
	renderMenu(menus[0]);
}

	if (isBrowser) {
		loadMenu().catch((error) => {
			const friendly = error.name === 'AbortError'
				? 'Loading the menu is taking too long. Please check your connection and try again.'
				: (error instanceof TypeError
					? 'The menu could not be loaded. Please check your connection and try again.'
					: error.message);
			app.innerHTML = `<p class="message error">${escapeHtml(friendly)}</p>`;
		});
	}

const menuHelpers = { escapeHtml, logoMarkup, languageMarkup, fallbackTranslation, categoryName, itemTranslation };

if (typeof module !== 'undefined' && module.exports) {
	module.exports = menuHelpers;
}
if (typeof window !== 'undefined') {
	window.__menuHelpers = menuHelpers;
}
export default menuHelpers;
export { escapeHtml, logoMarkup, languageMarkup, fallbackTranslation, categoryName, itemTranslation };
