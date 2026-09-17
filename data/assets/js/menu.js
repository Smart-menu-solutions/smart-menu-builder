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
		<section class="category" id="category-${categoryId(category.name)}" data-category-name="${escapeHtml(category.name)}">
			<h2>${escapeHtml(categoryName(client, category))}</h2>
			${categoryImage}
			${(category.items || []).map((item) => {
				const translation = itemTranslation(client, item);
				const description = translation.description || item.description;
				const itemImage = item.image && /^https?:\/\//i.test(item.image) ? `<img class="item-image" src="${escapeHtml(item.image)}" alt="">` : '';
				return `
				<article class="item" data-item-name="${escapeHtml(item.name)}">
					${itemImage}
					<div class="item-body">
						<div class="item-header"><h3>${escapeHtml(translation.name || item.name)}</h3><span class="price">${escapeHtml(item.price)} ${escapeHtml(client.currency || '€')}</span></div>
						${description ? `<p>${escapeHtml(description)}</p>` : ''}
					</div>
				</article>`;
			}).join('')}
		</section>`;
}

// --- Smart Food Match: pure rule-based matching, no AI/API calls ---------
// Legacy/untagged sections have courseType '' and fall through to 'other',
// which never gets its own pool below - keeping existing untagged clients'
// data harmless rather than guessing where an unclassified section belongs.
function courseTypeOf(category) {
	return category.courseType || 'other';
}

function buildCourseCatalog(client) {
	const pools = { starter: [], main: [], dessert: [], drink: [] };
	(client.categories || []).forEach((category) => {
		const pool = pools[courseTypeOf(category)];
		if (pool) pool.push(...(category.items || []));
	});
	return pools;
}

// Gates the quiz entry point on the live menu - only offer it once there's
// at least one real candidate for every course, so it can never open into a
// broken/empty result.
function canRunSmartMatch(client) {
	const pools = buildCourseCatalog(client);
	return pools.starter.length > 0 && pools.main.length > 0 && pools.dessert.length > 0;
}

// Cascading filter -> fallback -> random pick. `rng` defaults to Math.random
// but is injectable so tests can pick deterministically (rng=()=>0 picks the
// first candidate, rng=()=>0.999 the last).
function pickCourse(pool, { style, appetiteSize, favoritesOnly } = {}, rng = Math.random) {
	if (!pool.length) return null;
	let candidates = pool;
	if (favoritesOnly) {
		const favorites = pool.filter((item) => item.isFavorite);
		if (favorites.length) candidates = favorites;
	} else if (style) {
		const styled = pool.filter((item) => item.style === style);
		if (styled.length) candidates = styled;
	}
	if (appetiteSize) {
		const sized = candidates.filter((item) => item.appetiteSize === appetiteSize);
		if (sized.length) candidates = sized;
	}
	const index = Math.min(candidates.length - 1, Math.floor(rng() * candidates.length));
	return candidates[index];
}

// answers: { appetiteSize, style, favoritesOnly } - the "what do you want
// today" question is intentionally not read here, it's decorative/mood-
// flavor only (confirmed: the result is always a full 3-course combo
// regardless of that answer) and is only ever echoed back in the "why"
// text, built where this is called from (it needs the language strings).
function matchSmartFoodMenu(client, answers, rng = Math.random) {
	const pools = buildCourseCatalog(client);
	const result = { starter: null, main: null, dessert: null, drink: null, skipped: [] };
	// Drink is optional and only attempted when the menu actually has
	// drink-tagged items - unlike starter/main/dessert (required by
	// canRunSmartMatch's gate), so existing clients who haven't tagged any
	// drinks yet keep getting a normal 3-course result instead of a
	// "no drink available" message.
	const courses = pools.drink.length > 0 ? ['starter', 'main', 'dessert', 'drink'] : ['starter', 'main', 'dessert'];
	courses.forEach((course) => {
		const pick = pickCourse(pools[course], answers, rng);
		if (pick) result[course] = pick; else result.skipped.push(course);
	});
	return result;
}

// Falls back to German for any language not yet authored in quiz-strings.js
// (see that file's TODO languages) rather than throwing or showing blanks -
// same null-safe convention as fallbackTranslation().
function smartFoodMatchStrings() {
	const catalogs = window.SMART_FOOD_MATCH_STRINGS;
	if (!catalogs) return null;
	return catalogs[requestedLanguage] || catalogs.de || null;
}

function quizOptionsMarkup(question, name) {
	return question.options.map((option) => `<label class="quiz-option"><input type="radio" name="${name}" value="${escapeHtml(option.value)}"><span>${escapeHtml(option.label)}</span></label>`).join('');
}

function smartFoodMatchButtonMarkup(strings) {
	return `<div class="smart-match-entry"><button type="button" class="smart-match-button" id="smartMatchOpen">${escapeHtml(strings.openButton)}</button><p class="smart-match-tagline">${escapeHtml(strings.intro)}</p></div>`;
}

function smartFoodMatchModalMarkup(strings) {
	return `
	<div class="smart-match-overlay" id="smartMatchOverlay" hidden>
		<div class="smart-match-box" role="dialog" aria-modal="true" aria-label="${escapeHtml(strings.title)}">
			<button type="button" class="smart-match-close" id="smartMatchClose" aria-label="${escapeHtml(strings.closeLabel)}">✕</button>
			<div class="smart-match-scroll">
				<div id="smartMatchQuiz">
					<h2>${escapeHtml(strings.title)}</h2>
					<div class="quiz-question"><p>${escapeHtml(strings.q1.text)}</p><div class="quiz-options">${quizOptionsMarkup(strings.q1, 'q1')}</div></div>
					<div class="quiz-question"><p>${escapeHtml(strings.q2.text)}</p><div class="quiz-options">${quizOptionsMarkup(strings.q2, 'q2')}</div></div>
					<div class="quiz-question"><p>${escapeHtml(strings.q3.text)}</p><div class="quiz-options">${quizOptionsMarkup(strings.q3, 'q3')}</div></div>
					<button type="button" class="smart-match-submit" id="smartMatchSubmit">${escapeHtml(strings.submitLabel)}</button>
				</div>
				<div id="smartMatchResult" hidden></div>
			</div>
		</div>
	</div>`;
}

function smartMatchAppetiteLabel(strings, value) { return strings.q2.options.find((option) => option.value === value)?.label || ''; }
function smartMatchStyleLabel(strings, value) { return strings.q3.options.find((option) => option.value === value)?.label || ''; }

function courseResultMarkup(client, strings, label, item) {
	if (!item) return `<div class="smart-match-course"><h3>${escapeHtml(label)}</h3><p class="smart-match-empty">${escapeHtml(strings.skippedMessage)}</p></div>`;
	const translation = itemTranslation(client, item);
	return `<div class="smart-match-course"><h3>${escapeHtml(label)}</h3><p class="smart-match-dish">${escapeHtml(translation.name || item.name)}</p></div>`;
}

// Logs one '<course>::<dish name>' entry per served course into recoLog (a
// Set, so a visitor retaking the quiz several times in one session still
// only counts once per distinct course+dish - same "once per visit"
// convention as seenCategories/seenDishes in startViewTracking()). Read at
// beacon-flush time, not sent immediately, to stay a single request per
// visit.
function logSmartMatchRecommendations(result, recoLog) {
	if (!recoLog) return;
	['starter', 'main', 'dessert', 'drink'].forEach((course) => {
		const item = result[course];
		if (item) recoLog.add(`${course}::${item.name}`);
	});
}

function renderSmartFoodResult(client, strings, answers, result, recoLog) {
	logSmartMatchRecommendations(result, recoLog);
	const why = answers.favoritesOnly ? strings.whyFavoritesTemplate
		: strings.whyTemplate.replace('{appetite}', smartMatchAppetiteLabel(strings, answers.appetiteSize).toLowerCase()).replace('{style}', smartMatchStyleLabel(strings, answers.style).toLowerCase());
	document.getElementById('smartMatchResult').innerHTML = `
		<h2>${escapeHtml(strings.resultTitle)}</h2>
		${courseResultMarkup(client, strings, strings.starterLabel, result.starter)}
		${courseResultMarkup(client, strings, strings.mainLabel, result.main)}
		${courseResultMarkup(client, strings, strings.dessertLabel, result.dessert)}
		${result.drink ? courseResultMarkup(client, strings, strings.drinkLabel, result.drink) : ''}
		<p class="smart-match-why"><strong>${escapeHtml(strings.whyLabel)}</strong><br>${escapeHtml(why)}</p>
		<button type="button" class="smart-match-submit" id="smartMatchRestart">${escapeHtml(strings.restartLabel)}</button>`;
	document.getElementById('smartMatchQuiz').hidden = true;
	document.getElementById('smartMatchResult').hidden = false;
	document.getElementById('smartMatchRestart').addEventListener('click', () => {
		document.querySelectorAll('#smartMatchQuiz input[type="radio"]:checked').forEach((input) => { input.checked = false; });
		document.getElementById('smartMatchResult').hidden = true;
		document.getElementById('smartMatchQuiz').hidden = false;
	});
}

function wireSmartFoodMatch(client, strings, recoLog) {
	const openButton = document.getElementById('smartMatchOpen');
	const overlay = document.getElementById('smartMatchOverlay');
	if (!openButton || !overlay) return;
	openButton.addEventListener('click', () => { overlay.hidden = false; });
	document.getElementById('smartMatchClose').addEventListener('click', () => { overlay.hidden = true; });
	overlay.addEventListener('click', (event) => { if (event.target === overlay) overlay.hidden = true; });
	document.getElementById('smartMatchSubmit').addEventListener('click', () => {
		const checked = (name) => document.querySelector(`#smartMatchQuiz input[name="${name}"]:checked`)?.value;
		const q3 = checked('q3');
		if (!checked('q1') || !checked('q2') || !q3) { notifySmartMatch(strings); return; }
		const answers = { appetiteSize: checked('q2'), style: q3 === 'favorites' ? null : q3, favoritesOnly: q3 === 'favorites' };
		const result = matchSmartFoodMenu(client, answers);
		renderSmartFoodResult(client, strings, answers, result, recoLog);
	});
}

// A tiny inline nudge instead of a full toast system (menu.html has none) -
// just flags the quiz still has unanswered questions.
function notifySmartMatch(strings) {
	const quiz = document.getElementById('smartMatchQuiz');
	quiz.classList.remove('smart-match-shake');
	void quiz.offsetWidth;
	quiz.classList.add('smart-match-shake');
}

// Anonymous, cookie-less traffic counting for the Weekly Analytics Report
// add-on (see track-menu-view Edge Function) - a no-op for every client
// that hasn't bought the add-on, so it costs nothing for anyone else.
// Counts each category/dish once per visit via IntersectionObserver, then
// flushes a single beacon on page-hide rather than one request per item.
function startViewTracking(client, recoLog) {
	if (!client.analytics_reports_enabled) return;
	const seenCategories = new Set();
	const seenDishes = new Set();
	let sent = false;

	const flush = () => {
		if (sent) return;
		sent = true;
		const payload = JSON.stringify({ menuSlug: client.slug, categories: [...seenCategories], dishes: [...seenDishes], recommendations: [...(recoLog || [])] });
		const endpoint = `${AUTH_CONFIG.supabaseUrl}/functions/v1/track-menu-view`;
		// text/plain keeps this a CORS-safelisted "simple request" - sendBeacon
		// can't attach headers to satisfy a preflight, so a non-safelisted type
		// would just silently fail cross-origin. The function reads the body as
		// raw text and parses it itself rather than trusting Content-Type.
		if (navigator.sendBeacon && navigator.sendBeacon(endpoint, new Blob([payload], { type: 'text/plain' }))) return;
		fetch(endpoint, { method: 'POST', body: payload, keepalive: true }).catch(() => {});
	};

	if (typeof IntersectionObserver !== 'undefined') {
		const observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting) return;
				const { categoryName, itemName } = entry.target.dataset;
				if (categoryName) seenCategories.add(categoryName);
				if (itemName) seenDishes.add(itemName);
				observer.unobserve(entry.target);
			});
		}, { threshold: 0.5 });
		document.querySelectorAll('.category, .item').forEach((element) => observer.observe(element));
	}

	// pagehide covers tab close/navigate/bfcache; visibilitychange catches the
	// mobile case (switching apps) where pagehide can fire late or not at all.
	window.addEventListener('pagehide', flush);
	document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
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
	const smartMatchStrings = client.smart_food_match_enabled && canRunSmartMatch(client) ? smartFoodMatchStrings() : null;
	app.innerHTML = `
		<header class="menu-hero" id="menu-top"${heroBackground}><a class="menu-back" href="?client=${encodeURIComponent(client.slug)}&lang=${encodeURIComponent(requestedLanguage)}#menu-top">← Back to menu</a>${logoMarkup(client)}<h1${headerTextAttr}>${escapeHtml(client.name)}</h1>
			${client.address ? `<p${headerTextAttr}>${escapeHtml(client.address)}</p>` : ''}
			<nav class="actions" aria-label="Contact">${buildContactLinks(client)}</nav>
			<nav class="menu-languages" aria-label="Menu languages">${languageMarkup(client)}</nav>
		</header>
		${smartMatchStrings ? smartFoodMatchButtonMarkup(smartMatchStrings) : ''}
		<nav class="category-nav" aria-label="Menu categories">${visibleCategories.map((category) => `<a href="#category-${categoryId(category.name)}">${escapeHtml(categoryName(client, category))}</a>`).join('')}</nav>
		<div class="menu-container">${categories || '<p class="message">Menu coming soon.</p>'}</div>
		<footer class="menu-footer"><p>${escapeHtml(client.name)}</p><a class="footer-brand" href="https://smart-menu-solutions.github.io/smart-menu-solutions/index.html"><img src="https://primary.jwwb.nl/public/q/b/h/temp-qwfllybferzrbmruxsqy/designer-6-photoroom-high.png?enable-io=true&enable=upscale&height=70" alt="Smart Menu Solutions logo"><span>Digital menu by Smart Menu Solutions</span></a></footer>
		${smartMatchStrings ? smartFoodMatchModalMarkup(smartMatchStrings) : ''}`;
	const smartMatchRecoLog = new Set();
	if (smartMatchStrings) wireSmartFoodMatch(client, smartMatchStrings, smartMatchRecoLog);
	startViewTracking(client, smartMatchRecoLog);
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

const menuHelpers = {
	escapeHtml, logoMarkup, languageMarkup, fallbackTranslation, categoryName, itemTranslation,
	courseTypeOf, buildCourseCatalog, canRunSmartMatch, pickCourse, matchSmartFoodMenu
};

if (typeof module !== 'undefined' && module.exports) {
	module.exports = menuHelpers;
}
if (typeof window !== 'undefined') {
	window.__menuHelpers = menuHelpers;
}
export default menuHelpers;
export {
	escapeHtml, logoMarkup, languageMarkup, fallbackTranslation, categoryName, itemTranslation,
	courseTypeOf, buildCourseCatalog, canRunSmartMatch, pickCourse, matchSmartFoodMenu
};
