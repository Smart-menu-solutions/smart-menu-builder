const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
const app = isBrowser ? document.querySelector('#app') : null;
const slug = isBrowser ? new URLSearchParams(location.search).get('client') : null;
// SmartService Hub ordering mode: a table's link is
// ?client=<slug>&table=<table_number>&k=<link_secret> - see order-session
// Edge Function. The table number alone is printed openly on the table and
// never rotates (see 0017_table_hub.sql), but reading/writing that table's
// order additionally requires k, a per-table random value that also never
// rotates (see 0019_table_link_secret.sql) - without it, guessing another
// table's number in the URL only 404s instead of exposing or letting you
// order onto someone else's tab.
const tableNumber = isBrowser ? new URLSearchParams(location.search).get('table') : null;
const linkSecret = isBrowser ? new URLSearchParams(location.search).get('k') : null;
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
	playfair: { family: "'Playfair Display', serif" },
	montserrat: { family: "'Montserrat', sans-serif" },
	poppins: { family: "'Poppins', sans-serif" },
	dancing: { family: "'Dancing Script', cursive" },
	oswald: { family: "'Oswald', sans-serif" }
};
// Only Open Sans is loaded by default (via menu.css); the header fonts are
// self-hosted (assets/fonts, no request to Google) and their stylesheet is
// only added when a client actually picked one. It declares all five, but
// a browser only downloads the font files a page really uses.
function loadHeaderFonts() {
	if (document.getElementById('header-fonts')) return;
	const link = document.createElement('link');
	link.id = 'header-fonts';
	link.rel = 'stylesheet';
	link.href = 'assets/fonts/fonts-menu-headers.css';
	document.head.appendChild(link);
}

// Privacy policy + imprint in the menu's current language, so guests can
// see who processes their data (see the Privacy Policy's guest section).
// Only German has its own legal pages; every other language gets English.
const LEGAL_LINK_TEXT = {
	de: ['Datenschutz', 'Impressum'], en: ['Privacy', 'Legal notice'], el: ['Απόρρητο', 'Νομικές πληροφορίες'],
	it: ['Privacy', 'Note legali'], es: ['Privacidad', 'Aviso legal'], fr: ['Confidentialité', 'Mentions légales']
};
function legalLinksMarkup() {
	const [privacy, imprint] = LEGAL_LINK_TEXT[requestedLanguage] || LEGAL_LINK_TEXT.en;
	const base = `https://smartmenusolutions.com/${requestedLanguage === 'de' ? 'de/' : ''}`;
	return `<nav class="menu-legal"><a href="${base}privacy-policy.html" target="_blank" rel="noopener">${escapeHtml(privacy)}</a> · <a href="${base}imprint.html" target="_blank" rel="noopener">${escapeHtml(imprint)}</a></nav>`;
}

function logoMarkup(client) {
	const source = client.logo_url || client.logoUrl || client.logo;
	if (!source || !/^https?:\/\//i.test(source)) return '';
	return `<img class="menu-logo" src="${escapeHtml(source)}" alt="${escapeHtml(client.name)} logo">`;
}

// Ordering mode links stay on the same table (&table=&k=) across a language
// switch. Either way this is a full navigation/reload - the draft cart
// survives it via localStorage keyed by slug+table (see loadCart/saveCart),
// not by keeping the cart in memory.
function pageUrl(client, language, hash) {
	const base = tableNumber ? `?client=${encodeURIComponent(client.slug)}&table=${encodeURIComponent(tableNumber)}&k=${encodeURIComponent(linkSecret || '')}` : `?client=${encodeURIComponent(client.slug)}`;
	return `${base}&lang=${encodeURIComponent(language)}${hash ? `#${hash}` : ''}`;
}

function languageMarkup(client) {
	return (client.languages || ['en']).map((language) => {
		const current = language === requestedLanguage ? ' aria-current="page"' : '';
		return `<a href="${pageUrl(client, language)}"${current}>${escapeHtml(language.toUpperCase())}</a>`;
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

function buildCategory(client, category, ordering) {
	const categoryImage = category.image && /^https?:\/\//i.test(category.image) ? `<img class="category-image" src="${escapeHtml(category.image)}" alt="">` : '';
	return `
		<section class="category" id="category-${categoryId(category.name)}" data-category-name="${escapeHtml(category.name)}">
			<h2>${escapeHtml(categoryName(client, category))}</h2>
			${categoryImage}
			${(category.items || []).map((item) => {
				const translation = itemTranslation(client, item);
				const description = translation.description || item.description;
				const itemImage = item.image && /^https?:\/\//i.test(item.image) ? `<img class="item-image" src="${escapeHtml(item.image)}" alt="">` : '';
				// item.id only exists once a client's dishes have gone through the
				// stable-id backfill (see admin.js) - ordering silently has no
				// button for a not-yet-backfilled item rather than erroring.
				const addButton = ordering && item.id
					? `<button type="button" class="item-add" data-add-product="${escapeHtml(item.id)}" data-add-name="${escapeHtml(translation.name || item.name)}" data-add-price="${escapeHtml(item.price)}">${escapeHtml(orderStrings().addToCart)}</button>`
					: '';
				return `
				<article class="item" data-item-name="${escapeHtml(item.name)}">
					${itemImage}
					<div class="item-body">
						<div class="item-header"><h3>${escapeHtml(translation.name || item.name)}</h3><span class="price">${escapeHtml(item.price)} ${escapeHtml(client.currency || '€')}</span></div>
						${description ? `<p>${escapeHtml(description)}</p>` : ''}
						${addButton}
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

function renderMenu(client, ordering) {
	if (!urlLanguageParam) {
		requestedLanguage = ((client.languages && client.languages[0]) || client.sourceLanguage || 'en').toLowerCase();
	}
	document.title = `${client.name} — Digital menu`;
	const visibleCategories = (client.categories || []).filter((category) => Array.isArray(category.items) && category.items.length);
	const categories = visibleCategories.map((category) => buildCategory(client, category, ordering)).join('');
	const heroBackground = client.header_background_url && /^https?:\/\//i.test(client.header_background_url)
		? ` style="background-image:linear-gradient(rgba(38,36,33,.5),rgba(38,36,33,.5)), url('${escapeHtml(client.header_background_url)}')"`
		: '';
	const headerFont = HEADER_FONTS[client.header_font];
	if (headerFont) loadHeaderFonts();
	const headerTextStyle = [
		headerFont ? `font-family:${headerFont.family}` : '',
		/^#[0-9a-f]{3,8}$/i.test(client.header_text_color || '') ? `color:${client.header_text_color}` : ''
	].filter(Boolean).join(';');
	const headerTextAttr = headerTextStyle ? ` style="${headerTextStyle}"` : '';
	const smartMatchStrings = client.smart_food_match_enabled && canRunSmartMatch(client) ? smartFoodMatchStrings() : null;
	app.innerHTML = `
		<header class="menu-hero" id="menu-top"${heroBackground}><a class="menu-back" href="${pageUrl(client, requestedLanguage, 'menu-top')}">← Back to menu</a>${logoMarkup(client)}<h1${headerTextAttr}>${escapeHtml(client.name)}</h1>
			${client.address ? `<p${headerTextAttr}>${escapeHtml(client.address)}</p>` : ''}
			<nav class="actions" aria-label="Contact">${buildContactLinks(client)}</nav>
			<nav class="menu-languages" aria-label="Menu languages">${languageMarkup(client)}</nav>
		</header>
		<div id="orderPanelSlot"></div>
		${smartMatchStrings ? smartFoodMatchButtonMarkup(smartMatchStrings) : ''}
		<div class="category-nav-row">
			<nav class="category-nav" aria-label="Menu categories">${visibleCategories.map((category) => `<a href="#category-${categoryId(category.name)}">${escapeHtml(categoryName(client, category))}</a>`).join('')}</nav>
			${ordering ? cartButtonMarkup() : ''}
		</div>
		<div class="menu-container">${categories || '<p class="message">Menu coming soon.</p>'}</div>
		<footer class="menu-footer"><p>${escapeHtml(client.name)}</p><a class="footer-brand" href="https://smart-menu-solutions.github.io/smart-menu-solutions/index.html"><img src="assets/images/logo-white.png" alt="Smart Menu Solutions logo"><span>Digital menu by Smart Menu Solutions</span></a>${legalLinksMarkup()}</footer>
		${smartMatchStrings ? smartFoodMatchModalMarkup(smartMatchStrings) : ''}
		${ordering ? cartPopupMarkup() : ''}`;
	const smartMatchRecoLog = new Set();
	if (smartMatchStrings) wireSmartFoodMatch(client, smartMatchStrings, smartMatchRecoLog);
	startViewTracking(client, smartMatchRecoLog);
	if (ordering) { wireCart(); renderOrderPanel(); }
}

// --- SmartService Hub: guest ordering (only active with &table=) ---
// orderState holds the table/menu/order this page is bound to; cart is the
// not-yet-sent draft. Both order-session calls below deliberately send no
// apikey header - Supabase's Edge Function gateway doesn't require one
// (confirmed against the live project), same as this codebase's other
// self-service pages (see addons.js).
const CART_STORAGE_PREFIX = 'smartmenu.cart.';
let orderState = null;
const cart = new Map();

function orderEndpoint() { return `${AUTH_CONFIG.supabaseUrl}/functions/v1/order-session`; }
function cartStorageKey() { return `${CART_STORAGE_PREFIX}${slug}:${tableNumber}`; }

function loadCart() {
	if (!tableNumber) return;
	try {
		const raw = localStorage.getItem(cartStorageKey());
		if (raw) JSON.parse(raw).forEach((item) => cart.set(item.productId, item));
	} catch { /* storage unavailable or corrupt - start empty */ }
}
function saveCart() {
	if (!tableNumber) return;
	try { localStorage.setItem(cartStorageKey(), JSON.stringify([...cart.values()])); } catch { /* convenience only */ }
}
function cartCount() { return [...cart.values()].reduce((sum, item) => sum + item.quantity, 0); }

// Menu prices are entered by the client and may use a comma decimal
// separator (see order-session's own findProduct(), which does the same
// replace before parsing) - normalized here too so cart/order totals add up
// regardless of how a dish's price was typed in the builder.
function parsePrice(value) {
	const parsed = parseFloat(String(value ?? '').replace(',', '.'));
	return Number.isFinite(parsed) ? parsed : 0;
}
function formatPrice(amount) {
	return `${amount.toFixed(2)} ${orderState?.menu?.currency || '€'}`;
}

// Guests never activate a table themselves (see 0017_table_hub.sql) - if
// staff haven't activated it yet, the moment they try to order anything at
// all they get told to ask staff, instead of quietly building a cart that
// can never be sent.
function addToCart(productId, name, price) {
	if (orderState && !orderState.active) { alert(orderStrings().notActiveYet); return; }
	const existing = cart.get(productId);
	if (existing) existing.quantity += 1;
	else cart.set(productId, { productId, name, price, quantity: 1, notes: '' });
	saveCart();
	renderCartRows();
}

// Dish names come from itemTranslation()/orderItemDisplayName() (per-menu
// data); this is only the surrounding chrome (buttons, labels) - see
// order-strings.js, same 6-language set as quiz-strings.js/staff-strings.js.
function orderStrings() {
	const catalog = window.ORDER_STRINGS || {};
	return catalog[requestedLanguage] || catalog.de || {};
}

function cartButtonMarkup() {
	return `<button type="button" class="cart-button" id="cartButton"><span aria-hidden="true">🛒</span> <span id="cartCount">${cartCount()}</span> <span class="cart-button-label">${escapeHtml(orderStrings().orderButton || '')}</span></button>`;
}

function cartPopupMarkup() {
	return `
	<div class="smart-match-overlay" id="cartOverlay" hidden>
		<div class="smart-match-box" role="dialog" aria-modal="true" aria-label="${escapeHtml(orderStrings().cartTitle)}">
			<button type="button" class="smart-match-close" id="cartClose" aria-label="Close">✕</button>
			<div class="smart-match-scroll">
				<h2>${escapeHtml(orderStrings().cartTitle)}</h2>
				<div id="cartRows"></div>
				<p class="cart-total" id="cartTotal" hidden></p>
				<p class="message error" id="cartError" hidden></p>
				<button type="button" class="smart-match-submit" id="cartSubmit">${escapeHtml(orderStrings().sendOrder)}</button>
			</div>
		</div>
	</div>`;
}

function renderCartRows() {
	const container = document.getElementById('cartRows');
	const rows = [...cart.values()];
	if (container) {
		container.innerHTML = rows.length ? rows.map((item) => `
			<div class="cart-row" data-cart-product="${escapeHtml(item.productId)}">
				<div class="cart-row-top">
					<span class="cart-row-name">${escapeHtml(item.name)} × ${item.quantity}</span>
					<span class="cart-row-actions">
						<span class="cart-row-price">${formatPrice(parsePrice(item.price) * item.quantity)}</span>
						<span class="cart-row-qty">
							<button type="button" data-cart-action="decrease" aria-label="Weniger">−</button>
							<button type="button" data-cart-action="increase" aria-label="Mehr">+</button>
						</span>
					</span>
				</div>
				<input type="text" class="cart-row-notes" data-cart-notes placeholder="${escapeHtml(orderStrings().notesPlaceholder)}" value="${escapeHtml(item.notes || '')}">
			</div>`).join('') : `<p class="message">${escapeHtml(orderStrings().cartEmpty)}</p>`;
	}
	const submit = document.getElementById('cartSubmit');
	if (submit) submit.disabled = !rows.length;
	const count = document.getElementById('cartCount');
	if (count) count.textContent = String(cartCount());
	const totalBox = document.getElementById('cartTotal');
	if (totalBox) {
		const total = rows.reduce((sum, item) => sum + parsePrice(item.price) * item.quantity, 0);
		totalBox.hidden = !rows.length;
		totalBox.textContent = `${orderStrings().total}: ${formatPrice(total)}`;
	}
}

function wireCart() {
	const cartButton = document.getElementById('cartButton');
	const overlay = document.getElementById('cartOverlay');
	if (cartButton && overlay) {
		cartButton.addEventListener('click', () => { renderCartRows(); overlay.hidden = false; });
		document.getElementById('cartClose').addEventListener('click', () => { overlay.hidden = true; });
		overlay.addEventListener('click', (event) => { if (event.target === overlay) overlay.hidden = true; });
		overlay.addEventListener('click', (event) => {
			const actionButton = event.target.closest('[data-cart-action]');
			if (!actionButton) return;
			const productId = actionButton.closest('[data-cart-product]').dataset.cartProduct;
			const item = cart.get(productId);
			if (!item) return;
			if (actionButton.dataset.cartAction === 'increase') item.quantity += 1;
			else { item.quantity -= 1; if (item.quantity <= 0) cart.delete(productId); }
			saveCart();
			renderCartRows();
		});
		overlay.addEventListener('input', (event) => {
			const input = event.target.closest('[data-cart-notes]');
			if (!input) return;
			const item = cart.get(input.closest('[data-cart-product]').dataset.cartProduct);
			if (item) { item.notes = input.value; saveCart(); }
		});
		document.getElementById('cartSubmit').addEventListener('click', submitCart);
	}
	// Add-to-cart buttons live inside .menu-container, rebuilt only on a full
	// page load (not on every order-panel refresh), so one delegated
	// listener on the container is enough for the page's lifetime.
	const container = document.querySelector('.menu-container');
	if (container) container.addEventListener('click', (event) => {
		const button = event.target.closest('[data-add-product]');
		if (!button) return;
		addToCart(button.dataset.addProduct, button.dataset.addName, button.dataset.addPrice);
		button.textContent = orderStrings().added;
		setTimeout(() => { button.textContent = orderStrings().addToCart; }, 900);
	});
}

async function submitCart() {
	if (!cart.size || !orderState) return;
	const submit = document.getElementById('cartSubmit');
	const errorBox = document.getElementById('cartError');
	submit.disabled = true;
	submit.textContent = orderStrings().sending;
	errorBox.hidden = true;
	try {
		const response = await fetch(orderEndpoint(), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				slug, table: tableNumber, k: linkSecret, sessionId: orderState.sessionId,
				items: [...cart.values()].map((item) => ({ productId: item.productId, quantity: item.quantity, notes: item.notes || undefined }))
			})
		});
		const data = await response.json().catch(() => ({}));
		if (!response.ok) throw new Error(data.error || orderStrings().orderFailed);
		cart.clear();
		saveCart();
		orderState.order = data.order;
		document.getElementById('cartOverlay').hidden = true;
		renderOrderPanel();
	} catch (error) {
		errorBox.textContent = error.message;
		errorBox.hidden = false;
	} finally {
		submit.disabled = false;
		submit.textContent = orderStrings().sendOrder;
	}
}

// order_items.product_name is stored as a source-language snapshot (see
// 0015_smartservice_hub.sql), so it's looked up through the same
// itemTranslation() the menu browse view already uses (by source text, not
// an id) rather than being shown untranslated on this panel.
function orderItemDisplayName(productName) {
	return (orderState.menu && itemTranslation(orderState.menu, { name: productName }).name) || productName;
}

// Recently-ordered items double as the "Nachbestellen" quick tray - one tap
// re-adds the same dish to the cart, no need to hunt through the menu again.
function orderPanelMarkup() {
	if (!orderState?.order?.items?.length) return '';
	const items = orderState.order.items;
	const sorted = [...items].sort((a, b) => (!!a.dispatched_at === !!b.dispatched_at ? 0 : a.dispatched_at ? 1 : -1));
	const rows = sorted.map((item) => `
		<div class="order-panel-row">
			<span class="status-dot ${item.dispatched_at ? 'dot-green' : 'dot-red'}"></span>
			<span>${item.quantity}× ${escapeHtml(orderItemDisplayName(item.product_name))}</span>
			<span class="order-panel-row-price">${formatPrice((item.unit_price_cents || 0) / 100 * item.quantity)}</span>
		</div>`).join('');
	const total = items.reduce((sum, item) => sum + (item.unit_price_cents || 0) * item.quantity, 0);
	const recent = [...new Map(items.map((item) => [item.product_name, item])).values()];
	// data-add-price is the same decimal-string format the menu's own
	// add-to-cart buttons use (see buildCategory()) - built from
	// unit_price_cents (the real price the server charged) rather than
	// hardcoded, so a re-added dish prices correctly in the cart total above.
	const quickTray = recent.map((item) => `<button type="button" class="quick-add" data-add-product="${escapeHtml(item.product_id)}" data-add-name="${escapeHtml(item.product_name)}" data-add-price="${((item.unit_price_cents || 0) / 100).toFixed(2)}">${escapeHtml(orderItemDisplayName(item.product_name))} +</button>`).join('');
	const billRequested = orderState.order.billRequestedAt;
	return `
	<section class="order-panel" id="orderPanel">
		<h2>${escapeHtml(orderStrings().currentOrder)}</h2>
		<div class="order-panel-rows">${rows}</div>
		<p class="cart-total">${escapeHtml(orderStrings().total)}: ${formatPrice(total / 100)}</p>
		${quickTray ? `<p class="order-panel-label">${escapeHtml(orderStrings().recentlyOrdered)}</p><div class="quick-tray">${quickTray}</div>` : ''}
		<div class="order-panel-actions">
			<button type="button" class="order-action-btn" id="requestBillButton" ${billRequested ? 'disabled' : ''}>${escapeHtml(billRequested ? orderStrings().billRequested : orderStrings().requestBill)}</button>
		</div>
	</section>`;
}

function wireOrderPanel() {
	const billButton = document.getElementById('requestBillButton');
	if (billButton) billButton.addEventListener('click', async () => {
		billButton.disabled = true;
		const response = await fetch(orderEndpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, table: tableNumber, k: linkSecret, sessionId: orderState.sessionId, action: 'request_bill' }) }).catch(() => null);
		if (response && response.ok) { orderState.order.billRequestedAt = new Date().toISOString(); renderOrderPanel(); }
		else billButton.disabled = false;
	});
}

function renderOrderPanel() {
	const slot = document.getElementById('orderPanelSlot');
	if (!slot) return;
	slot.innerHTML = orderPanelMarkup();
	wireOrderPanel();
	renderCartRows();
}

function loadSupabaseJs() {
	return new Promise((resolve, reject) => {
		if (window.supabase) { resolve(); return; }
		const script = document.createElement('script');
		script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
		script.onload = () => resolve();
		script.onerror = () => reject(new Error('realtime script failed to load'));
		document.head.appendChild(script);
	});
}

// Broadcast-only (see 0015_smartservice_hub.sql / order-session's
// broadcast()) - on any order update for this restaurant, just refetch this
// table's own order rather than trusting the payload, so it's naturally
// correct even if two updates land close together. 'menu_updated' is a
// second, separate event admin.js sends after a save (see saveClients()) -
// on that one, the whole page re-renders with the fresh menu, not just the
// order panel, so a guest's already-open tab picks up a price/dish change
// without needing to reload.
async function subscribeRealtime(menuSlug) {
	try {
		await loadSupabaseJs();
		const client = window.supabase.createClient(AUTH_CONFIG.supabaseUrl, AUTH_CONFIG.supabasePublishableKey);
		const channel = client.channel(`restaurant:${menuSlug}`);
		channel.on('broadcast', { event: 'update' }, async () => {
			const response = await fetch(`${orderEndpoint()}?slug=${encodeURIComponent(slug)}&table=${encodeURIComponent(tableNumber)}&k=${encodeURIComponent(linkSecret || '')}`).catch(() => null);
			const data = response ? await response.json().catch(() => null) : null;
			if (data?.table) { orderState.active = data.active; orderState.sessionId = data.sessionId; orderState.order = data.order; renderOrderPanel(); }
		});
		channel.on('broadcast', { event: 'menu_updated' }, async () => {
			const cartOpen = document.getElementById('cartOverlay') && !document.getElementById('cartOverlay').hidden;
			const response = await fetch(`${orderEndpoint()}?slug=${encodeURIComponent(slug)}&table=${encodeURIComponent(tableNumber)}&k=${encodeURIComponent(linkSecret || '')}`).catch(() => null);
			const data = response ? await response.json().catch(() => null) : null;
			if (!data?.menu) return;
			orderState.active = data.active;
			orderState.sessionId = data.sessionId;
			orderState.order = data.order;
			orderState.menu = data.menu;
			renderMenu(data.menu, true);
			if (cartOpen) { renderCartRows(); document.getElementById('cartOverlay').hidden = false; }
		});
		channel.subscribe();
	} catch { /* live push is a nice-to-have; the page still works, just without auto-refresh */ }
}

async function loadOrderSession() {
	const response = await fetch(`${orderEndpoint()}?slug=${encodeURIComponent(slug)}&table=${encodeURIComponent(tableNumber)}&k=${encodeURIComponent(linkSecret || '')}`);
	const data = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error(data.error || 'This menu link is no longer valid.');
	orderState = { tableId: data.table.id, active: data.active, sessionId: data.sessionId, order: data.order, menu: data.menu };
	loadCart();
	renderMenu(data.menu, true);
	subscribeRealtime(data.menu.slug);
}

async function loadMenu() {
	if (tableNumber) { await loadOrderSession(); return; }
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
