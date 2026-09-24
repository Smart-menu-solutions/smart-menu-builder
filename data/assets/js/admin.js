const STORAGE_KEY = 'menupilot.clients.v1';
const seedClients = [{ id: 'customer-001', name: 'Taverna Athens', slug: 'taverna-athens', phone: '+30 123456789', whatsapp: '+30 123456789', address: 'Rhodes, Greece', currency: '€', languages: ['en', 'de', 'el'], categories: [{ name: 'Starters', items: [{ name: 'Tzatziki', description: 'Greek yogurt with cucumber and garlic', price: '5.90' }] }, { name: 'Mains', items: [{ name: 'Gyros plate', description: 'With fries and tzatziki', price: '14.90' }] }, { name: 'Drinks', items: [{ name: 'Coca Cola', description: '0.33L', price: '3.50' }] }] }];
const $ = (selector) => document.querySelector(selector);
let clients = loadClients();
let selectedId = clients[0]?.id;
let clientSearch = '';
let subscriptionsBySlug = {};
let showOnlyNeedsRenewal = false;
const RENEWAL_SITE = 'https://smart-menu-solutions.github.io/smart-menu-solutions';
const LANG_STORAGE_KEY = 'smartmenu.admin.lang';
let currentLang = (() => {
	try { return localStorage.getItem(LANG_STORAGE_KEY) || 'de'; } catch { return 'de'; }
})();
function strings() {
	const catalog = window.ADMIN_STRINGS || {};
	return catalog[currentLang] || catalog.de || {};
}
// Dates follow the dashboard language, not the browser's own locale, so the
// topbar date and the activity timestamps read the same way as the rest of
// the page.
function dateLocale() { return currentLang === 'de' ? 'de-DE' : 'en-GB'; }
function subscriptionStatusLabel(status) { return strings().subscriptionStatus?.[status] || status; }
// menu.js renders the live menu's language switcher buttons in exactly the
// order client.languages lists them, so this order is directly what a
// customer sees, not just an admin-side convenience.
const LANGUAGE_CATALOG = [
	{ code: 'en', label: 'English' }, { code: 'de', label: 'Deutsch' }, { code: 'el', label: 'Ελληνικά' },
	{ code: 'it', label: 'Italiano' }, { code: 'es', label: 'Español' }, { code: 'fr', label: 'Français' }
];
// Enabled languages first, in the client's saved order, then any not-yet-
// enabled catalog languages appended so they still show up (unchecked) to
// be turned on.
function languageDisplayOrder(client) {
	const enabled = (client.languages || ['en', 'de', 'el']).filter((code) => LANGUAGE_CATALOG.some((entry) => entry.code === code));
	const rest = LANGUAGE_CATALOG.map((entry) => entry.code).filter((code) => !enabled.includes(code));
	return [...enabled, ...rest];
}

function slugifyName(value) {
	return String(value || '').trim().toLowerCase()
		.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
		.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-');
}

// Smart Food Match tag suggestions - pure keyword guesses over a section/
// dish's own name+description, covering the same 6 languages as
// LANGUAGE_CATALOG (en/de/el/it/es/fr). These only ever pre-fill an empty tag
// (see the call sites in render()) - never re-run over a tag an owner has
// already set or corrected, or a deliberate fix would revert on next render.
const COURSE_TYPE_KEYWORDS = {
	starter: /vorspeis|starter|antipast|entrada|orektik|meze|entr.e/i,
	dessert: /dessert|nachspeis|dolci|suess|s.ss|postre|epidorpio/i,
	drink: /getraenk|getr.nk|drink|bevand|bebida|beverage|ποτ|boisson/i,
	main: /hauptgericht|hauptspeis|main.?course|secondi|piatt.\s*principal|plato\s*principal|plat\s*principal|kurio/i
};
function suggestCourseType(categoryName) {
	const name = String(categoryName || '');
	for (const [type, pattern] of Object.entries(COURSE_TYPE_KEYWORDS)) if (pattern.test(name)) return type;
	return '';
}
const STYLE_KEYWORDS = {
	fresh: /salat|salad|frisch|leicht|fresh|light|insalata|ensalada|fresco/i,
	hearty: /deftig|herzhaft|kraeftig|kr.ftig|hearty|rich|gegrillt|grill|steak|burger|bistecca/i,
	special: /spezial|signature|chef|gourmet|especial|speciale/i,
	quick: /schnell|express|quick|fast|snack/i
};
function suggestStyle(name, description) {
	const text = `${name || ''} ${description || ''}`;
	for (const [style, pattern] of Object.entries(STYLE_KEYWORDS)) if (pattern.test(text)) return style;
	return '';
}
const APPETITE_SIZE_KEYWORDS = {
	small: /mini|klein|small|piccol|peque/i,
	'very-large': /xxl|sharing|family|riesig|big|maxi|grande/i
};
// No keyword hit falls back to a sensible default by course, rather than
// leaving every dish "medium" regardless of whether it's a starter or a
// main - that default only kicks in once a real courseType is known.
function suggestAppetiteSize(name, description, courseType) {
	const text = `${name || ''} ${description || ''}`;
	for (const [size, pattern] of Object.entries(APPETITE_SIZE_KEYWORDS)) if (pattern.test(text)) return size;
	if (courseType === 'main') return 'large';
	if (courseType === 'starter' || courseType === 'dessert') return 'medium';
	return '';
}
// The live menu hides the Smart Food Match button unless all three courses
// have at least one tagged item - mirrored here so the admin toggle can
// warn the owner *before* they enable it and nothing visibly happens.
function smartFoodMatchQualifies(client) {
	const hasCourse = (courseType) => (client.categories || []).some((category) => category.courseType === courseType && (category.items || []).length > 0);
	return hasCourse('starter') && hasCourse('main') && hasCourse('dessert');
}

// SmartService Hub routes every ordered dish to Küche or Bar by reading the
// same courseType field Smart Food Match uses ('drink' -> Bar, anything
// else -> Küche) - so unlike Smart Food Match it needs *every* non-empty
// section classified, not just one starter/main/dessert each, or orders
// from an untagged section would have nowhere correct to go.
function smartServiceHubQualifies(client) {
	const sections = (client.categories || []).filter((category) => (category.items || []).length > 0);
	return sections.length > 0 && sections.every((category) => !!category.courseType);
}

function normalizeClient(client) {
	return {
		...client,
		name: client.name || 'Unnamed customer',
		slug: client.slug || slugifyName(client.name) || `menu-${Date.now()}`,
		slugManual: client.slugManual !== undefined ? client.slugManual : true,
		categories: Array.isArray(client.categories) ? client.categories.map((category) => ({
			name: category.name || 'Menu',
			image: category.image || '',
			// '' means unclassified - never auto-defaulted to a real course here,
			// so an existing untagged client's categories stay excluded from
			// every Smart Food Match pool until an owner explicitly tags them.
			courseType: category.courseType || '',
			items: Array.isArray(category.items) ? category.items.map((item) => ({
				// id is SmartService Hub's stable reference for this exact dish
				// (order_items.product_id) - must survive normalization, or every
				// save-to-cloud silently wipes it and breaks ordering for that
				// dish. Backfilled once for pre-existing items (see the 2026-09
				// migration note); every dish created from here on already has one.
				id: item.id || crypto.randomUUID(),
				name: item.name || 'Unnamed dish', description: item.description || '', price: item.price || '', image: item.image || '',
				appetiteSize: item.appetiteSize || '', style: item.style || '', isFavorite: !!item.isFavorite
			})) : []
		})) : [],
		languages: Array.isArray(client.languages) && client.languages.length ? client.languages : ['en'],
		translations: client.translations || {},
		smart_food_match_enabled: !!client.smart_food_match_enabled,
		// Read-only passthrough - auto-activated by stripe-webhook, never set
		// here or in saveClients()'s upsert payload below (unlike
		// smart_food_match_enabled, which IS staff-editable). Including it in
		// the upsert would let an unrelated "Save changes" click silently
		// overwrite the webhook's own value back to whatever was last loaded
		// into memory.
		analytics_reports_enabled: !!client.analytics_reports_enabled,
		// Same read-only reasoning as analytics_reports_enabled above - set
		// once by stripe-webhook at initial purchase, never staff-editable.
		photo_addon_enabled: !!client.photo_addon_enabled
	};
}
function loadClients() { try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); return Array.isArray(saved) && saved.length ? saved.map(normalizeClient) : structuredClone(seedClients).map(normalizeClient); } catch { return structuredClone(seedClients).map(normalizeClient); } }
async function saveClients() {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
	if (typeof supabaseClient === 'undefined') return;
	const selectedSlug = selectedClient()?.slug;
	const uniqueClients = [...new Map(clients.map((client) => [client.slug, client])).values()];
	const rows = uniqueClients.map((client) => ({
		slug: client.slug,
		name: client.name,
		phone: client.phone || null,
		whatsapp: client.whatsapp || null,
		address: client.address || null,
		currency: client.currency || '€',
		languages: client.languages || ['en', 'de', 'el'],
		translations: client.translations || {},
		header_background_url: client.header_background_url || null,
		header_font: client.header_font || null,
		header_text_color: client.header_text_color || null,
		smart_food_match_enabled: !!client.smart_food_match_enabled,
		categories: client.categories || [],		is_published: true,		updated_at: new Date().toISOString()
	}));
	const { data, error } = await supabaseClient.from('menus').upsert(rows, { onConflict: 'slug' }).select();
	if (error) throw new Error(strings().couldNotSaveMenus.replace('{error}', error.message));
	if (data?.length) {
		const savedBySlug = new Map(data.map((row) => [row.slug, normalizeClient({ ...row, id: row.id })]));
		clients = clients.map((client) => savedBySlug.get(client.slug) || client);
		selectedId = clients.find((client) => client.slug === selectedSlug)?.id || selectedId;
		localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
	}
	// Lets an already-open guest ordering tab (SmartService Hub) pick up a
	// price/dish change without needing a manual reload - see menu.js's
	// subscribeRealtime(). Every saveClients() call broadcasts for every
	// hub-enabled client touched, even when the actual edit wasn't to the
	// menu (e.g. a language reorder) - a spurious refetch on the guest side
	// is harmless, missing a real one wouldn't be.
	data?.filter((row) => row.smartservice_hub_enabled).forEach((row) => {
		const channel = supabaseClient.channel(`restaurant:${row.slug}`);
		channel.send({ type: 'broadcast', event: 'menu_updated', payload: {} }).finally(() => supabaseClient.removeChannel(channel));
	});
}
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function selectedClient() { return clients.find((client) => client.id === selectedId); }
function menuUrl(client) {
	const mainLanguage = (client.languages && client.languages[0]) || client.sourceLanguage || 'en';
	return `${window.location.href.replace(/admin\.html.*$/, '')}menu.html?client=${encodeURIComponent(client.slug)}&lang=${encodeURIComponent(mainLanguage)}`;
}
async function uploadImage(file, pathHint) {
	if (typeof supabaseClient === 'undefined') throw new Error(strings().cloudStorageUnavailable);
	const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
	const path = `${pathHint}-${Date.now()}.${extension}`;
	const { error } = await supabaseClient.storage.from('menu-images').upload(path, file, { contentType: file.type || 'image/jpeg', upsert: true });
	if (error) throw new Error(strings().imageUploadFailed.replace('{error}', error.message));
	const { data } = supabaseClient.storage.from('menu-images').getPublicUrl(path);
	return data.publicUrl;
}
function notify(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2200); }
function initials(name) { return name.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase(); }

function selectedLanguages() { return [...document.querySelectorAll('input[name="language"]:checked')].map((input) => input.value); }

// A PDF (re-)import replaces the whole categories array with fresh objects
// that parsePdfText() has no way to attach images to, since photos only
// ever get added afterwards through the admin UI (uploadImage). Without
// this, importing a menu again to pick up a text edit would silently wipe
// every category/dish photo already uploaded. Carries an existing image
// over by matching category/item name (case-insensitive, trimmed) — an
// exact-match heuristic on purpose, so a renamed dish just ends up without
// its old photo rather than risking the wrong photo landing on it.
function mergeImportedImages(existingCategories, importedCategories) {
	const norm = (name) => String(name || '').trim().toLowerCase();
	const existingItemsByName = new Map();
	(existingCategories || []).forEach((category) => {
		(category.items || []).forEach((item) => { if (item.image) existingItemsByName.set(norm(item.name), item.image); });
	});
	const existingCategoriesByName = new Map((existingCategories || []).map((category) => [norm(category.name), category]));
	return importedCategories.map((category) => {
		const matchedCategory = existingCategoriesByName.get(norm(category.name));
		return {
			...category,
			image: matchedCategory?.image || '',
			items: category.items.map((item) => ({ ...item, image: existingItemsByName.get(norm(item.name)) || '' }))
		};
	});
}

function parsePdfText(text) {
	const categories = [];
	const categoryByName = new Map();
	let category = null;
	const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
	const pricePattern = /(?:\d+[.,]\d{2}\s*(?:€|EUR|\$|USD|£|GBP)?|(?:€|EUR|\$|USD|£|GBP)\s*\d+[.,]\d{2})\s*$/i;
	const knownCategoryPattern = /^(hei(?:ß|ss)e?\s+getränke|kalte\s+getränke|frühstück\s*(?:&|und)\s+snacks?|kuchen\s*(?:&|und)\s+desserts?|spezialitäten|vorspeisen|hauptgerichte|hauptspeisen|nachspeisen|salate|snacks?|beilagen|suppen|pizza|pasta|burger|desserts?|starters?|mains?|sides?|soups?|salads?|hot\s+drinks?|cold\s+drinks?|breakfast\s*(?:&|and)\s+snacks?)$/i;
	// Table headers from a PDF's column labels (e.g. "Produkt Preis") — never
	// real menu categories, but they otherwise pass the generic heuristic
	// below and, repeated on every page, used to create one duplicate
	// category per page instead of being ignored.
	const headerLinePattern = /^(produkt|preis|price|artikel|bezeichnung|men[uü]|item|name|beschreibung|description|qty|anzahl|product)(\s*(preis|price))?$/i;
	const looksLikeCategory = (line) => line.length <= 42 && !headerLinePattern.test(line) && (knownCategoryPattern.test(line) || (/^[A-ZÄÖÜ][^.!?]{2,41}$/.test(line) && !/\d/.test(line)));
	// PDFs commonly print "1. Item name – 6,90 €" on one line and the
	// description on the following line(s) (see the blank-line-separated
	// layout this parser is built for). Track the most recently added item
	// so the next non-price, non-category line(s) can be attached to it as
	// its description instead of being silently dropped.
	let lastItem = null;
	lines.forEach((line) => {
		const match = line.match(pricePattern);
		if (!match) {
			if (looksLikeCategory(line)) {
				lastItem = null;
				const existing = categoryByName.get(line);
				if (existing) {
					category = existing;
				} else {
					category = { name: line, items: [] };
					categoryByName.set(line, category);
					categories.push(category);
				}
				return;
			}
			if (lastItem) lastItem.description = lastItem.description ? `${lastItem.description} ${line}` : line;
			return;
		}
		const price = match[0].replace(/[^0-9.,]/g, '').replace(',', '.');
		const name = line.slice(0, match.index)
			.replace(/^[\s•*\-–—▪◦]+/, '')
			.replace(/[.·‧… ]{2,}$/, '')
			.replace(/[\s•*\-–—]+$/, '')
			.trim();
		if (name) {
			if (!category) { category = { name: 'Imported menu', items: [] }; categoryByName.set(category.name, category); categories.push(category); }
			lastItem = { id: crypto.randomUUID(), name, description: '', price };
			category.items.push(lastItem);
		} else {
			lastItem = null;
		}
	});
	const nonEmptyCategories = categories.filter((c) => c.items.length);
	return nonEmptyCategories.length ? nonEmptyCategories : [{ name: 'Imported menu', items: [{ id: crypto.randomUUID(), name: 'Review imported PDF text', description: text.slice(0, 240), price: '0.00' }] }];
}

function pdfPageText(content) {
	const rows = new Map();
	content.items.forEach((item) => {
		const value = String(item.str || '').trim();
		if (!value) return;
		const y = Math.round((item.transform?.[5] || 0) / 2) * 2;
		const row = rows.get(y) || [];
		row.push({ x: item.transform?.[4] || 0, value });
		rows.set(y, row);
	});
	return [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, row]) => row.sort((a, b) => a.x - b.x).map((item) => item.value).join(' ')).join('\n');
}

async function importPdf() {
	const file = $('#menuPdf').files[0];
	if (!file) return notify(strings().choosePdfFirst);
	$('#importStatus').textContent = strings().readingPdf;
	try {
		const pdfjs = window.pdfjsLib;
		if (!pdfjs) throw new Error(strings().pdfReaderFailed);
		pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
		const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
		let text = '';
		for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
			const page = await pdf.getPage(pageNumber);
			const content = await page.getTextContent();
			text += `${pdfPageText(content)}\n`;
		}
		if (!text.trim()) {
			$('#importStatus').textContent = strings().noTextLayerOcr;
			const tesseract = window.Tesseract;
			if (typeof tesseract.createWorker !== 'function') throw new Error(strings().ocrReaderFailed);
			const worker = await tesseract.createWorker('eng');
			for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
				const page = await pdf.getPage(pageNumber);
				const viewport = page.getViewport({ scale: 1.5 });
				const canvas = document.createElement('canvas');
				canvas.width = viewport.width;
				canvas.height = viewport.height;
				await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
				const result = await worker.recognize(canvas);
				text += `${result.data.text}\n`;
			}
			await worker.terminate();
		}
		if (!text.trim()) throw new Error(strings().pdfNoText);
		const client = selectedClient();
		client.categories = mergeImportedImages(client.categories, parsePdfText(text));
		await saveClients();
		render();
		$('#importStatus').textContent = strings().pdfImported.replace('{n}', pdf.numPages);
	} catch (error) {
		$('#importStatus').textContent = strings().pdfReadFailed.replace('{error}', error.message);
		notify(error.message);
	}
}

function updateLanguageState() {
	const client = selectedClient();
	client.languages = selectedLanguages();
	$('#translationStatus').textContent = strings().languagesSelected.replace('{n}', client.languages.length);
}


// MyMemory's casing is inconsistent per target language — observed lower-
// casing everything for Spanish and ALL CAPS for Greek, unrelated to how
// the source text was capitalized. Normalize to Title Case so category/
// item names look consistent regardless of which language they end up in.
function normalizeTranslationCasing(text) {
	if (!text) return text;
	return text.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (match, boundary, letter) => boundary + letter.toUpperCase());
}

// DeepL is the primary translator (proxied through a Supabase Edge Function
// — DeepL doesn't support direct browser calls, and its key can't be
// exposed client-side). Much more reliable than MyMemory for short, ambiguous
// menu category/item names, which MyMemory frequently mistranslates outright
// rather than just mis-capitalizing.
async function translateViaDeepL(text, source, target) {
	const response = await fetch(`${AUTH_CONFIG.supabaseUrl}/functions/v1/translate`, {
		method: 'POST',
		headers: await ownerFunctionHeaders(),
		body: JSON.stringify({ text, source, target })
	});
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	const result = await response.json();
	if (result.error) throw new Error(result.error);
	return result.translatedText || text;
}

// Fallback only — used when DeepL errors (e.g. an unsupported language, or
// the proxy being briefly unavailable). Free and needs no key, but its
// crowd-sourced translation memory frequently returns wrong words (not just
// wrong casing) for short menu terms, so it's a last resort, not the default.
async function translateViaMyMemory(text, source, target) {
	for (let attempt = 0; attempt < 3; attempt += 1) {
		try {
			// Supplying a contact email raises MyMemory's free daily quota
			// from 5,000 to 50,000 words (their documented anti-abuse trade-off,
			// no signup needed) — without it we hit HTTP 429 well before a
			// full menu across 4 languages finishes translating.
			const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}&de=smartmenusolutions@outlook.com`);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const result = await response.json();
			if (result.responseStatus && result.responseStatus !== 200) throw new Error(`Translation status ${result.responseStatus}`);
			return normalizeTranslationCasing(result.responseData?.translatedText) || text;
		} catch (error) {
			if (attempt === 2) throw error;
			await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
		}
	}
}

async function translateText(text, source, target) {
	if (!text) return '';
	if (source === target) return text;
	const catalogs = window.MENU_TRANSLATION_FALLBACKS || {};
	const clientSlug = selectedClient()?.slug;
	const fallback = catalogs?.[clientSlug]?.[target]
		|| catalogs?.['restaurant-zum-dorfkrug']?.[clientSlug]?.[target];
	const categoryTranslation = fallback?.categories?.[text];
	const itemTranslation = fallback?.items?.[text];
	if (categoryTranslation) return categoryTranslation;
	if (itemTranslation) return itemTranslation[0];
	try {
		return await translateViaDeepL(text, source, target);
	} catch (error) {
		console.error('DeepL translation failed, falling back to MyMemory', error);
		return translateViaMyMemory(text, source, target);
	}
}

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
// MyMemory throttles by requests-per-second, separately from its daily word
// quota — a real menu across several categories/items/languages easily fires
// dozens of calls back-to-back with no delay between them, which the API
// answers with 429s far before the daily quota is anywhere near used. A
// small gap between requests keeps the whole run under that limit.
const TRANSLATE_REQUEST_DELAY_MS = 250;
async function translateMenu() {
	const client = selectedClient();
	client.sourceLanguage = $('#sourceLanguage').value;
	const source = client.sourceLanguage;
	const targets = selectedLanguages().filter((language) => language !== source);
	if (!targets.length) return notify(strings().selectTargetLanguage);
	try {
		client.translations = client.translations || {};
		let failures = 0;
		const totalItems = client.categories.reduce((sum, category) => sum + (category.items?.length || 0), 0) * targets.length;
		let done = 0;
		for (const language of targets) {
			client.translations[language] = { categories: {}, items: {} };
			for (const category of client.categories) {
				try { client.translations[language].categories[category.name] = { name: await translateText(category.name, source, language) }; } catch { failures += 1; client.translations[language].categories[category.name] = { name: category.name }; }
				await wait(TRANSLATE_REQUEST_DELAY_MS);
				for (const item of category.items || []) {
					const fallbackItem = window.MENU_TRANSLATION_FALLBACKS?.[client.slug]?.[language]?.items?.[item.name];
					let name = fallbackItem?.[0] || item.name; let description = fallbackItem?.[1] || item.description;
					if (!fallbackItem) {
						try { name = await translateText(item.name, source, language); } catch { failures += 1; }
						await wait(TRANSLATE_REQUEST_DELAY_MS);
						if (item.description) { try { description = await translateText(item.description, source, language); } catch { failures += 1; } await wait(TRANSLATE_REQUEST_DELAY_MS); }
					}
					client.translations[language].items[item.name] = { name, description };
					done += 1;
					$('#translationStatus').textContent = strings().translatingProgress.replace('{done}', done).replace('{total}', totalItems).replace('{lang}', language);
				}
			}
		}
		await saveClients();
		$('#translationStatus').textContent = failures
			? strings().translatedWithFailures.replace('{targets}', targets.join(', ')).replace('{n}', failures)
			: strings().translatedTo.replace('{targets}', targets.join(', '));
	} catch (error) {
		$('#translationStatus').textContent = strings().translationFailed;
		notify(error.message);
	}
}

// The Add-ons tab: a read-only board of purchase status for the three
// sellable extras, plus a "Send link" per feature that has a self-service
// page (analytics/smart-food-match both live on the same addons.html, sfm
// via manage-addons; photo has no purchase page of its own yet, so it gets
// a status dot but no send button).
// One "Gratis" checkbox per add-on. Ticking it turns that add-on on for the
// client without a purchase; unticking turns it off - and the database only
// has one yes/no per add-on, so this can't tell a free add-on from a paid one
// (unticking asks first).
const ADDON_FREE_TOGGLES = [
	{ checkbox: '#addonFreeAnalytics', flag: 'analytics_reports_enabled', label: 'Smart WeeklyReport™' },
	{ checkbox: '#addonFreeSfm', flag: 'smart_food_match_enabled', label: 'Smart FoodMatch™' },
	{ checkbox: '#addonFreePhoto', flag: 'photo_addon_enabled', label: 'Smart DishPhoto™' },
	{ checkbox: '#addonFreeSmartServiceHub', flag: 'smartservice_hub_enabled', label: 'Smart ServiceHub™' }
];

const STAFF_ROLES = ['waiter', 'kitchen', 'bar', 'cashier'];
// menu_slug -> every staff link of that restaurant, in STAFF_ROLES order and
// oldest first within a role. A role can have several links (a 2nd kitchen,
// a beach bar - see 0023_multiple_staff_access.sql); each carries an
// optional owner-chosen label, null meaning the role's default name.
let smartServiceAccessBySlug = {};
let smartServiceTablesBySlug = {};

function staffAccessUrl(row) {
	const base = window.location.href.replace(/admin\.html.*$/, '');
	return `${base}${row.role}.html?t=${row.token}`;
}

function staffAccessName(row, lang) {
	const roleLabels = window.STAFF_STRINGS?.[lang]?.roleLabels || window.STAFF_STRINGS?.de?.roleLabels || {};
	return row.label || roleLabels[row.role] || row.role.charAt(0).toUpperCase() + row.role.slice(1);
}

// Every link of the client, or - before any exist - one placeholder row per
// role (token null) so the onboarding template still lists all four roles.
function staffAccessRowsForTemplate(client) {
	const rows = smartServiceAccessBySlug[client.slug] || [];
	return rows.length ? rows : STAFF_ROLES.map((role) => ({ role, token: null, label: null }));
}

// Onboarding template: the 4 staff links, in whichever of the 6 menu
// languages the owner picks - meant to be copied straight into an email to
// the client. Guest table links aren't listed here - each one also needs
// its per-table link_secret (see 0019_table_link_secret.sql), so those come
// from the QR codes/copy-link buttons in the table list below instead of
// being typed out from the table number alone. Reuses staff-strings.js's
// translations (roleLabels) rather than keeping a second copy of the same
// words.
const ONBOARDING_LANGS = ['de', 'en', 'el', 'it', 'es', 'fr'];
let onboardingTemplateLang = 'de';

function onboardingTemplateText(client, lang) {
	const strings = window.STAFF_STRINGS?.[lang] || window.STAFF_STRINGS?.de || {};
	const heading = (strings.onboardingHeading || 'Smart ServiceHub™ – {name}').replace('{name}', client.name);
	const staffLines = staffAccessRowsForTemplate(client).map((row) => `${staffAccessName(row, lang)}: ${row.token ? staffAccessUrl(row) : '-'}`).join('\n');
	return `${heading}\n\n${strings.staffHeading || 'Staff access'}:\n${staffLines}`;
}

// Rich version of the same content - used both for the on-screen preview
// and, via the clipboard's text/html entry, for pasting into an email
// client (onboardingTemplateText's plain-text version rides along as the
// text/plain fallback for clients that don't).
function onboardingTemplateHtml(client, lang) {
	const strings = window.STAFF_STRINGS?.[lang] || window.STAFF_STRINGS?.de || {};
	const heading = (strings.onboardingHeading || 'Smart ServiceHub™ – {name}').replace('{name}', client.name);
	const sectionLabelStyle = 'font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#737373;margin:0 0 8px';
	const staffRows = staffAccessRowsForTemplate(client).map((row) => {
		const url = row.token ? staffAccessUrl(row) : '';
		return `<tr><td style="padding:0 0 6px 0"><strong>${escapeHtml(staffAccessName(row, lang))}:</strong> ${url ? `<a href="${escapeAttr(url)}">${escapeHtml(url)}</a>` : '-'}</td></tr>`;
	}).join('');
	return `<div style="font-family:Arial,Helvetica,sans-serif">
		<p style="font-weight:700;font-size:15px;margin:0 0 16px">${escapeHtml(heading)}</p>
		<p style="${sectionLabelStyle}">${escapeHtml(strings.staffHeading || 'Staff access')}</p>
		<table cellpadding="0" cellspacing="0">${staffRows}</table>
	</div>`;
}

// A table's guest link - table number plus its link_secret (see
// 0019_table_link_secret.sql), the same link its printed QR code holds.
function tableGuestUrl(client, table) {
	const base = window.location.href.replace(/admin\.html.*$/, '');
	return `${base}menu.html?client=${encodeURIComponent(client.slug)}&table=${encodeURIComponent(table.table_number)}&k=${encodeURIComponent(table.link_secret)}`;
}

// "Copy for email" under the table list: every table's QR code image, name
// and link, in the language picked for the onboarding template below, so
// the owner can send the whole set to the venue for printing in one go.
function tablesEmailRows(client) {
	return [...(smartServiceTablesBySlug[client.slug] || [])]
		.sort((a, b) => String(a.table_number).localeCompare(String(b.table_number), undefined, { numeric: true }));
}

function tablesEmailText(client, lang) {
	const strings = window.STAFF_STRINGS?.[lang] || window.STAFF_STRINGS?.de || {};
	const heading = (strings.tablesEmailHeading || 'Table QR codes – {name}').replace('{name}', client.name);
	const lines = tablesEmailRows(client).map((table) => `${strings.table || 'Table'} ${table.table_number}: ${tableGuestUrl(client, table)}`);
	return `${heading}\n\n${strings.tablesEmailHint || ''}\n\n${lines.join('\n')}`;
}

// The on-screen number overlay (qrWithNumberMarkup) is a CSS trick that
// wouldn't survive being pasted into an email, so for the email the number
// is drawn into the QR image itself: same white box with a dark border, in
// the middle - safe because the code uses ecc=H (tolerates ~30% covered).
// The finished PNG goes to the public menu-images bucket under the table's
// random id (not guessable) so every email client can load it. The file name
// also carries a short hash of the table's link, so copying again reuses the
// same file (the owner may insert and delete in that bucket, not overwrite),
// while a renamed table gets a fresh image. Removing a table deletes them.
const TABLE_QR_SIZE = 360;
const TABLE_QR_FOLDER = (client) => `table-qr/${client.slug}`;
const tableQrImageCache = new Map();

async function shortHash(text) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].slice(0, 6).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function loadCrossOriginImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('QR image could not be loaded'));
		img.src = src;
	});
}

async function tableQrImageUrl(client, table) {
	const url = tableGuestUrl(client, table);
	const cacheKey = `${table.id}|${url}`;
	if (tableQrImageCache.has(cacheKey)) return tableQrImageCache.get(cacheKey);
	const qr = await loadCrossOriginImage(`https://api.qrserver.com/v1/create-qr-code/?size=${TABLE_QR_SIZE}x${TABLE_QR_SIZE}&margin=12&ecc=H&data=${encodeURIComponent(url)}`);
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = TABLE_QR_SIZE;
	const ctx = canvas.getContext('2d');
	ctx.drawImage(qr, 0, 0, TABLE_QR_SIZE, TABLE_QR_SIZE);
	const label = String(table.table_number);
	// Largest bold font whose box stays within ~42% of the width (a longer
	// label like "T12" or "Terrasse 3" shrinks to fit instead of covering more).
	let fontSize = Math.round(TABLE_QR_SIZE * 0.2);
	ctx.font = `700 ${fontSize}px Arial, Helvetica, sans-serif`;
	while (ctx.measureText(label).width > TABLE_QR_SIZE * 0.34 && fontSize > 18) {
		fontSize -= 2;
		ctx.font = `700 ${fontSize}px Arial, Helvetica, sans-serif`;
	}
	const padX = fontSize * 0.35;
	const boxW = ctx.measureText(label).width + padX * 2;
	const boxH = fontSize * 1.3;
	const x = (TABLE_QR_SIZE - boxW) / 2;
	const y = (TABLE_QR_SIZE - boxH) / 2;
	ctx.fillStyle = '#ffffff';
	ctx.strokeStyle = '#262421';
	ctx.lineWidth = Math.max(2, TABLE_QR_SIZE / 120);
	ctx.beginPath();
	if (ctx.roundRect) ctx.roundRect(x, y, boxW, boxH, fontSize * 0.15); else ctx.rect(x, y, boxW, boxH);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#262421';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(label, TABLE_QR_SIZE / 2, TABLE_QR_SIZE / 2 + fontSize * 0.05);
	const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
	const path = `${TABLE_QR_FOLDER(client)}/${table.id}-${await shortHash(url)}.png`;
	const { error } = await supabaseClient.storage.from('menu-images').upload(path, blob, { contentType: 'image/png', upsert: false });
	// Already there from an earlier copy = same table, same link: reuse it.
	if (error && !/exist|duplicate/i.test(error.message || '')) throw new Error(error.message);
	const publicUrl = supabaseClient.storage.from('menu-images').getPublicUrl(path).data.publicUrl;
	tableQrImageCache.set(cacheKey, publicUrl);
	return publicUrl;
}

async function tableQrImageUrls(client) {
	const entries = await Promise.all(tablesEmailRows(client).map(async (table) => [table.id, await tableQrImageUrl(client, table)]));
	return Object.fromEntries(entries);
}

function tablesEmailHtml(client, lang, imageUrls) {
	const strings = window.STAFF_STRINGS?.[lang] || window.STAFF_STRINGS?.de || {};
	const heading = (strings.tablesEmailHeading || 'Table QR codes – {name}').replace('{name}', client.name);
	const cells = tablesEmailRows(client).map((table) => {
		const url = tableGuestUrl(client, table);
		const label = `${strings.table || 'Table'} ${table.table_number}`;
		return `<td style="padding:0 16px 22px 0;vertical-align:top;text-align:center;width:170px">
			<img src="${escapeAttr(imageUrls[table.id])}" width="150" height="150" alt="${escapeAttr(label)}" style="display:block;margin:0 auto 6px;border:0">
			<div style="font-weight:700;font-size:15px">${escapeHtml(label)}</div>
			<a href="${escapeAttr(url)}" style="font-size:12px;color:#f66a09">${escapeHtml(strings.tablesEmailLinkText || 'Link')}</a>
		</td>`;
	});
	// Three QR codes per row - fits an email body and a printed A4 page.
	const rows = [];
	for (let i = 0; i < cells.length; i += 3) rows.push(`<tr>${cells.slice(i, i + 3).join('')}</tr>`);
	return `<div style="font-family:Arial,Helvetica,sans-serif;color:#262421">
		<p style="font-weight:700;font-size:15px;margin:0 0 8px">${escapeHtml(heading)}</p>
		<p style="font-size:13px;color:#737373;margin:0 0 16px">${escapeHtml(strings.tablesEmailHint || '')}</p>
		<table cellpadding="0" cellspacing="0">${rows.join('')}</table>
	</div>`;
}

// Rich copy for email clients (QR images included), plain text as fallback.
// html may be a Promise: the clipboard write has to start right inside the
// click (browsers only allow it during the user's gesture), while the table
// QR images are still being drawn and uploaded - ClipboardItem accepts a
// promise and waits for it.
async function copyForEmail(html, text) {
	const htmlBlob = Promise.resolve(html).then((value) => new Blob([value], { type: 'text/html' }));
	try {
		await navigator.clipboard.write([
			new ClipboardItem({
				'text/html': htmlBlob,
				'text/plain': new Blob([text], { type: 'text/plain' })
			})
		]);
		notify(strings().onboardingCopiedRich);
	} catch (error) {
		// The rich version itself failing (e.g. an image upload) is a real
		// error worth showing; otherwise fall back to plain text.
		const htmlError = await htmlBlob.then(() => null, (reason) => reason);
		if (htmlError) { notify(strings().couldNotCreateTableQr.replace('{error}', htmlError.message)); return; }
		await navigator.clipboard.writeText(text);
		notify(strings().onboardingCopiedText);
	}
}

// restaurant_access/restaurant_tables aren't in the `clients` (menus) rows
// or subscriptionsBySlug - separate tables, own fetch, same "map keyed by
// menu_slug then render()" shape as syncSubscriptions(). Only id/table_number
// is fetched for tables - no qr_token/status to show here, that's the Admin
// Hub's job now (see 0017_table_hub.sql); this is just so the owner can see
// what's already there (and remove one, e.g. after a typo) before adding
// another.
async function syncSmartServiceHub() {
	if (typeof supabaseClient === 'undefined') return;
	const [{ data: access }, { data: tables }] = await Promise.all([
		supabaseClient.from('restaurant_access').select('id, menu_slug, role, token, label, created_at').order('created_at'),
		supabaseClient.from('restaurant_tables').select('id, menu_slug, table_number, link_secret').order('table_number')
	]);
	smartServiceAccessBySlug = {};
	(access || []).forEach((row) => { (smartServiceAccessBySlug[row.menu_slug] ||= []).push(row); });
	Object.values(smartServiceAccessBySlug).forEach((rows) => rows.sort((a, b) => STAFF_ROLES.indexOf(a.role) - STAFF_ROLES.indexOf(b.role)));
	smartServiceTablesBySlug = {};
	(tables || []).forEach((row) => { (smartServiceTablesBySlug[row.menu_slug] ||= []).push(row); });
	render();
}

// Creates one link per role the first time SmartService Hub is switched on
// for a client. Roles can hold several links now (no unique constraint left
// to no-op against), so it asks the database which roles already have one
// and only fills in the missing ones - safe to call again later.
async function provisionSmartServiceAccess(client) {
	const { data: existing, error: readError } = await supabaseClient.from('restaurant_access').select('role').eq('menu_slug', client.slug);
	if (readError) { notify(strings().couldNotSetUpStaffLinks.replace('{error}', readError.message)); return; }
	const have = new Set((existing || []).map((row) => row.role));
	const rows = STAFF_ROLES.filter((role) => !have.has(role)).map((role) => ({ menu_slug: client.slug, role }));
	if (rows.length) {
		const { error } = await supabaseClient.from('restaurant_access').insert(rows);
		if (error) { notify(strings().couldNotSetUpStaffLinks.replace('{error}', error.message)); return; }
	}
	await syncSmartServiceHub();
}

// Label as the owner typed it, or null for "the role's default name" -
// matches the check constraint in 0023_multiple_staff_access.sql.
function cleanAccessLabel(value) {
	const label = String(value || '').trim().slice(0, 40);
	return label || null;
}

// Writes just this one column. saveClients() deliberately never sends the
// analytics/photo flags (a stale copy in memory could overwrite what
// stripe-webhook set), so a Gratis toggle updates only its own column.
async function setAddonFlag(client, flag, value) {
	if (typeof supabaseClient !== 'undefined') {
		const { data, error } = await supabaseClient.from('menus').update({ [flag]: value, updated_at: new Date().toISOString() }).eq('slug', client.slug).select('slug');
		if (error) throw new Error(strings().couldNotSave.replace('{error}', error.message));
		if (!data?.length) throw new Error(strings().saveClientFirst);
	}
	client[flag] = value;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
}

function wireAddonFreeCheckboxes() {
	ADDON_FREE_TOGGLES.forEach(({ checkbox, flag, label }) => {
		const input = $(checkbox);
		if (!input) return;
		input.addEventListener('change', async () => {
			const client = selectedClient();
			if (!client) return;
			const wanted = input.checked;
			if (!wanted && !confirm(strings().addonTurnOffConfirm.replace('{addon}', label).replace('{name}', client.name))) { input.checked = true; return; }
			try {
				await setAddonFlag(client, flag, wanted);
				notify((wanted ? strings().addonGivenFree : strings().addonTurnedOff).replace('{addon}', label).replace('{name}', client.name));
				if (flag === 'smartservice_hub_enabled' && wanted) await provisionSmartServiceAccess(client);
			} catch (error) {
				input.checked = !wanted;
				notify(error.message);
			}
			renderAddonBoard(client, subscriptionsBySlug[client.slug]);
		});
	});
}

function renderAddonBoard(client, clientSubscription) {
	const analyticsStatus = $('#addonStatusAnalytics');
	if (!analyticsStatus) return; // Add-ons tab not present in this markup version
	analyticsStatus.classList.toggle('active', !!client.analytics_reports_enabled);
	const viewLink = $('#addonViewAnalytics');
	if (client.analytics_reports_enabled && clientSubscription?.stats_token) {
		viewLink.style.display = '';
		viewLink.href = `${RENEWAL_SITE}/stats.html?token=${clientSubscription.stats_token}`;
	} else {
		viewLink.style.display = 'none';
	}

	$('#addonStatusSfm').classList.toggle('active', !!client.smart_food_match_enabled);
	$('#addonStatusPhoto').classList.toggle('active', !!client.photo_addon_enabled);
	ADDON_FREE_TOGGLES.forEach(({ checkbox, flag }) => { const input = $(checkbox); if (input) input.checked = !!client[flag]; });

	// Smart Food Match only shows up on the live menu once the sections are
	// tagged (see smartFoodMatchQualifies()), so say whether it's ready.
	const hint = $('#smartFoodMatchHint');
	if (hint) {
		const qualifies = smartFoodMatchQualifies(client);
		hint.textContent = qualifies ? strings().sfmReady : strings().sfmNotReady;
		hint.classList.toggle('smart-match-not-ready', !qualifies);
	}

	const addonsUrl = clientSubscription?.addon_token ? `${RENEWAL_SITE}/addons.html?token=${clientSubscription.addon_token}` : '';
	[$('#addonSendAnalytics'), $('#addonSendSfm'), $('#addonSendPhoto'), $('#addonSendSmartServiceHub')].forEach((button) => {
		if (!button) return;
		button.disabled = !addonsUrl;
		button.dataset.link = addonsUrl;
	});

	renderSmartServiceHubExtra(client);
}

// Same "Ready/Not ready" hint pattern as Smart Food Match, plus - only once
// the add-on is actually active - the 4 staff links. Comes from
// syncSmartServiceHub(), not from `client` itself.
function renderSmartServiceHubExtra(client) {
	const statusEl = $('#addonStatusSmartServiceHub');
	if (statusEl) statusEl.classList.toggle('active', !!client.smartservice_hub_enabled);

	const hint = $('#smartServiceHubHint');
	if (hint) {
		const qualifies = smartServiceHubQualifies(client);
		hint.textContent = qualifies ? strings().hubReady : strings().hubNotReady;
		hint.classList.toggle('smart-match-not-ready', !qualifies);
	}

	const extra = $('#smartServiceHubExtra');
	if (!extra) return;
	extra.hidden = !client.smartservice_hub_enabled;
	if (!client.smartservice_hub_enabled) return;

	const base = window.location.href.replace(/admin\.html.*$/, '');
	const accessRows = smartServiceAccessBySlug[client.slug] || [];
	const linksList = $('#smartServiceHubLinks');
	if (linksList) {
		// Role names come from staff-strings.js rather than a second copy here -
		// same reasoning as the onboarding template above. A named link also
		// shows which role it is, since "Beach Bar" alone doesn't say whether
		// it gets bar tickets or the cashier view. The last link of a role
		// can't be deleted - that role would be left with no screen at all.
		const roleLabels = window.STAFF_STRINGS?.[currentLang]?.roleLabels || {};
		linksList.innerHTML = accessRows.map((row) => {
			const roleName = roleLabels[row.role] || row.role;
			const sameRole = accessRows.filter((other) => other.role === row.role).length;
			const name = staffAccessName(row, currentLang);
			const removeButton = sameRole > 1
				? `<button type="button" class="table-chip-remove" data-remove-access="${escapeAttr(row.id)}" data-access-name="${escapeAttr(name)}" title="${escapeAttr(strings().removeAccess)}" aria-label="${escapeAttr(strings().removeAccess)}">✕</button>`
				: '';
			return `<div class="addon-board-row access-row"><span class="addon-board-main"><span class="addon-board-name">${escapeHtml(name)}</span>${row.label ? `<span class="access-role-hint">${escapeHtml(roleName)}</span>` : ''}</span><button type="button" class="button button-ghost addon-board-send" data-rename-access="${escapeAttr(row.id)}" data-access-name="${escapeAttr(row.label || '')}">${escapeHtml(strings().renameAccess)}</button><button type="button" class="button button-ghost addon-board-send" data-staff-link="${escapeAttr(staffAccessUrl(row))}">${escapeHtml(strings().copyLink)}</button>${removeButton}</div>`;
		}).join('');
	}
	const roleSelect = $('#smartServiceHubNewAccessRole');
	if (roleSelect) {
		const roleLabels = window.STAFF_STRINGS?.[currentLang]?.roleLabels || {};
		const chosen = roleSelect.value || 'kitchen';
		roleSelect.innerHTML = STAFF_ROLES.map((role) => `<option value="${role}"${role === chosen ? ' selected' : ''}>${escapeHtml(roleLabels[role] || role)}</option>`).join('');
	}

	const tables = smartServiceTablesBySlug[client.slug] || [];
	const tableNumbersEl = $('#smartServiceHubTableNumbers');
	if (tableNumbersEl) {
		// The link needs both the table number and its link_secret (see
		// 0019_table_link_secret.sql - table number alone is guessable, the
		// secret is what actually keeps another table's order private) - what
		// the owner actually needs from here is a printable QR *image* for
		// each table's physical sticker, same on-demand QR image service the
		// main "Client QR code" panel uses (see #qrImage). The table number is
		// overlaid on the QR itself (not just printed as a caption) so two
		// printed codes can't get mixed up - ecc=H (highest error correction)
		// is what makes a QR code tolerate an obstruction like this in the
		// first place.
		tableNumbersEl.innerHTML = tables.length
			? tables.map((table) => {
				const tableUrl = tableGuestUrl(client, table);
				const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=90x90&margin=6&ecc=H&data=${encodeURIComponent(tableUrl)}`;
				return `<div class="addon-board-row table-qr-row">${qrWithNumberMarkup(qrSrc, table.table_number, 44)}<span class="addon-board-main"><span class="addon-board-name">${escapeHtml(strings().tableLabel.replace('{n}', table.table_number))}</span></span><button type="button" class="button button-ghost addon-board-send" data-print-table-qr="${escapeAttr(qrSrc.replace('size=90x90', 'size=400x400'))}" data-print-table-number="${escapeAttr(String(table.table_number))}">${escapeHtml(strings().openQr)}</button><button type="button" class="button button-ghost addon-board-send" data-table-link="${escapeAttr(tableUrl)}">${escapeHtml(strings().copyLink)}</button><button type="button" class="table-chip-remove" data-remove-table="${table.id}" data-remove-table-number="${escapeAttr(String(table.table_number))}" title="${escapeHtml(strings().removeTable)}" aria-label="${escapeHtml(strings().removeTable)}">✕</button></div>`;
			}).join('')
			: `<p class="client-empty">${escapeHtml(strings().noTablesYet)}</p>`;
	}

	const tablesCopy = $('#tablesEmailCopy');
	if (tablesCopy) tablesCopy.disabled = !tables.length;
	renderOnboardingTemplate(client);
}

// Overlays the table number on the QR image itself (centered, white badge)
// rather than just captioning it - two printed codes can't get mixed up
// even if someone tears off/loses the surrounding label. Safe to obscure
// that much of the code because the QR is generated with ecc=H (highest
// error correction, tolerates a sizeable chunk of the image being covered).
function qrWithNumberMarkup(qrSrc, tableNumber, size) {
	return `<span class="table-qr-wrap" style="width:${size}px;height:${size}px"><img class="table-qr-thumb" src="${escapeAttr(qrSrc)}" alt="${escapeAttr(strings().tableQrAlt.replace('{n}', tableNumber))}" style="width:${size}px;height:${size}px"><span class="table-qr-number" style="font-size:${Math.round(size * 0.28)}px">${escapeHtml(String(tableNumber))}</span></span>`;
}

// Opens a small standalone print page with the same overlaid QR, full size.
function openPrintableTableQr(qrSrc, tableNumber) {
	const win = window.open('', '_blank');
	if (!win) return;
	win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(strings().tableLabel.replace('{n}', tableNumber))}</title>
		<style>body{font-family:system-ui,sans-serif;text-align:center;padding:48px 24px}
		.table-qr-wrap{position:relative;display:inline-block}
		.table-qr-number{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;border:2px solid #262421;border-radius:8px;padding:6px 14px;font-weight:700;color:#262421}
		</style>
		</head><body>${qrWithNumberMarkup(qrSrc, tableNumber, 320)}</body></html>`);
	win.document.close();
}

function renderOnboardingTemplate(client) {
	const langRow = $('#onboardingTemplateLangs');
	if (langRow) {
		langRow.innerHTML = ONBOARDING_LANGS.map((lang) => `<button type="button" class="button button-ghost template-lang-btn ${lang === onboardingTemplateLang ? 'active' : ''}" data-onboarding-lang="${lang}">${lang.toUpperCase()}</button>`).join('');
	}
	const preview = $('#onboardingTemplatePreview');
	if (preview) preview.innerHTML = onboardingTemplateHtml(client, onboardingTemplateLang);
}

function render() {
	const client = selectedClient() || clients[0]; if (!client) return;
	selectedId = client.id;
	// Fill in a Smart Food Match tag suggestion the first time a category/item
	// is ever rendered with that field still empty, then leave it alone for
	// good - once a real value is stored (even an auto-suggested one), this
	// short-circuits and never overwrites it again, so an owner's correction
	// can't silently revert on a later render. Runs before the qualifies-hint
	// check and the category editor template below, both of which read these
	// same fields - otherwise a freshly-classified client would show a stale
	// "not ready" hint until a second render.
	client.categories.forEach((category) => {
		category.courseType = category.courseType || suggestCourseType(category.name);
		(category.items || []).forEach((item) => {
			item.style = item.style || suggestStyle(item.name, item.description);
			item.appetiteSize = item.appetiteSize || suggestAppetiteSize(item.name, item.description, category.courseType);
		});
	});
	$('#clientCount').textContent = clients.length; $('#navClientCount').textContent = clients.length;
	$('#sectionCount').textContent = clients.reduce((total, item) => total + item.categories.length, 0); $('#qrCount').textContent = clients.length;
	const needsRenewal = (sub) => sub && (sub.status === 'expired' || sub.status === 'deactivated');
	const needsRenewalCount = Object.values(subscriptionsBySlug).filter(needsRenewal).length;
	if ($('#renewalCount')) $('#renewalCount').textContent = needsRenewalCount;
	const searched = clients.filter((item) => `${item.name} ${item.slug}`.toLowerCase().includes(clientSearch.toLowerCase()));
	const visibleClients = showOnlyNeedsRenewal ? searched.filter((item) => needsRenewal(subscriptionsBySlug[item.slug])) : searched;
	$('#clientList').innerHTML = visibleClients.map((item) => {
		const sub = subscriptionsBySlug[item.slug];
		const statusClass = sub ? (sub.status !== 'active' ? `status-${sub.status}` : '') : 'status-none';
		const statusLabel = sub ? subscriptionStatusLabel(sub.status) : strings().noSubscription;
		const subInfo = sub ? strings().clientRowSub.replace('{plan}', escapeHtml(sub.plan)).replace('{date}', escapeHtml(sub.current_period_end || '?')) : '';
		const statusBadge = `<span class="status-badge ${statusClass}">${escapeHtml(statusLabel)}</span>`;
		return `<div class="client-row ${item.id === selectedId ? 'selected' : ''}" data-client="${item.id}"><span class="client-avatar">${initials(item.name)}</span><span class="client-info"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(strings().sectionsCount.replace('{n}', item.categories.length))}${subInfo}</small><span class="status-badge-row">${statusBadge}</span></span><i class="client-status ${statusClass}" title="${escapeAttr(statusLabel)}"></i></div>`;
	}).join('') || `<p class="client-empty">${escapeHtml(showOnlyNeedsRenewal ? strings().noClientsNeedRenewal : strings().noClientsFound)}</p>`;
	document.querySelectorAll('[data-client]').forEach((row) => row.addEventListener('click', () => { selectedId = row.dataset.client; render(); }));
	$('#editorTitle').textContent = client.name; $('#businessName').value = client.name; $('#slug').value = client.slug; $('#slug').dataset.manual = client.slugManual === false ? 'false' : 'true'; $('#phone').value = client.phone || ''; $('#whatsapp').value = client.whatsapp || ''; $('#address').value = client.address || ''; $('#currency').value = client.currency || '€';
	if ($('#headerBgPreview')) $('#headerBgPreview').innerHTML = client.header_background_url ? `<img src="${escapeAttr(client.header_background_url)}" alt="">` : `<span class="header-bg-empty">${escapeHtml(strings().noCustomBackground)}</span>`;
	if ($('#headerFont')) $('#headerFont').value = client.header_font || '';
	if ($('#headerTextColor')) $('#headerTextColor').value = client.header_text_color || '#ffffff';
	// The three add-on flags are set automatically by stripe-webhook on
	// purchase; staff can also give any of them for free with the "Gratis"
	// checkboxes on the Add-ons tab (see renderAddonBoard() and
	// wireAddonFreeCheckboxes()).
	const clientSubscription = subscriptionsBySlug[client.slug];
	updateDishCount(client, clientSubscription);
	renderAddonBoard(client, clientSubscription);
	const isLocked = !!clientSubscription && clientSubscription.status !== 'active';
	const banner = $('#subscriptionBanner');
	if (isLocked) {
		const renewalUrl = `${RENEWAL_SITE}/renewal.html?token=${clientSubscription.renewal_token}`;
		const lockedText = strings().subscriptionLocked.replace('{status}', `<strong>${escapeHtml(subscriptionStatusLabel(clientSubscription.status))}</strong>`);
		banner.innerHTML = `${lockedText} <a href="${renewalUrl}" target="_blank" rel="noopener">${escapeHtml(strings().renewalLink)}</a>`;
		banner.style.display = '';
	} else {
		banner.style.display = 'none';
	}
	const languageOrder = languageDisplayOrder(client);
	const enabledLanguages = client.languages || ['en', 'de', 'el'];
	$('#languageEditor').innerHTML = languageOrder.map((code, index) => {
		const entry = LANGUAGE_CATALOG.find((item) => item.code === code);
		const checked = enabledLanguages.includes(code);
		const isSource = code === (client.sourceLanguage || 'de');
		const translatedItemCount = Object.keys(client.translations?.[code]?.items || {}).length;
		const hasTranslation = isSource || translatedItemCount > 0;
		const isMain = checked && index === 0;
		const moveUp = escapeAttr(strings().moveLanguageUp);
		const moveDown = escapeAttr(strings().moveLanguageDown);
		// entry.label stays as it is - Deutsch/English/Ελληνικά are the language's
		// own name, not chrome, and the live menu's switcher shows them the same way.
		return `<div class="language-row${checked && !hasTranslation ? ' lang-missing' : ''}"><label class="language-check"><span>${escapeHtml(entry?.label || code)}${isMain ? ` (${escapeHtml(strings().languageMain)})` : ''}</span><input type="checkbox" name="language" value="${code}"${checked ? ' checked' : ''}></label><span class="language-move"><button type="button" class="move-language" data-move-language="up-${index}" title="${moveUp}" aria-label="${moveUp}" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" class="move-language" data-move-language="down-${index}" title="${moveDown}" aria-label="${moveDown}" ${index === languageOrder.length - 1 ? 'disabled' : ''}>↓</button></span></div>`;
	}).join('');
	document.querySelectorAll('[data-move-language]').forEach((button) => button.addEventListener('click', () => {
		const [direction, indexText] = button.dataset.moveLanguage.split('-');
		const index = Number(indexText);
		const target = direction === 'up' ? index - 1 : index + 1;
		if (target < 0 || target >= languageOrder.length) return;
		[languageOrder[index], languageOrder[target]] = [languageOrder[target], languageOrder[index]];
		client.languages = languageOrder.filter((code) => enabledLanguages.includes(code));
		saveClients().then(render).catch((error) => notify(error.message));
	}));
	document.querySelectorAll('input[name="language"]').forEach((input) => input.addEventListener('change', () => {
		updateLanguageState();
		saveClients().then(render).catch((error) => notify(error.message));
	}));
	$('#sourceLanguage').value = client.sourceLanguage || 'de';
	function imageControl(kind, index, imageUrl) {
		const text = strings();
		const buttonLabel = kind === 'category'
			? (imageUrl ? text.changeSectionPhoto : text.addSectionPhoto)
			: (imageUrl ? text.changeDishPhoto : text.addDishPhoto);
		return `<div class="image-control" data-image-kind="${kind}" data-image-index="${index}">${imageUrl ? `<img class="image-thumb" src="${escapeAttr(imageUrl)}" alt="">` : ''}<label class="image-upload-btn">${escapeHtml(buttonLabel)}<input type="file" accept="image/*" data-image-input="${kind}-${index}" hidden></label>${imageUrl ? `<button type="button" class="remove-button" data-remove-image="${kind}-${index}" title="${escapeAttr(text.removePhoto)}">×</button>` : ''}</div>`;
	}
	function selectOptions(options, current) {
		return options.map(([value, label]) => `<option value="${value}"${value === (current || '') ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('');
	}
	// courseType is tagged once per section (not per dish) - it's what Smart
	// Food Match uses to know which section counts as starters/mains/desserts.
	function courseTypeControl(category, categoryIndex) {
		const text = strings();
		const options = [['', text.courseUnclassified], ['starter', text.courseStarter], ['main', text.courseMain], ['dessert', text.courseDessert], ['drink', text.courseDrink], ['other', text.courseOther]];
		return `<select data-category-course-type="${categoryIndex}" class="course-type-select" title="${escapeAttr(text.courseTypeTitle)}">${selectOptions(options, category.courseType)}</select>`;
	}
	function itemTagsControl(item, categoryIndex, itemIndex) {
		const text = strings();
		const sizeOptions = [['', text.sizeNotSet], ['small', text.sizeSmall], ['medium', text.sizeMedium], ['large', text.sizeLarge], ['very-large', text.sizeVeryLarge]];
		const styleOptions = [['', text.styleNotSet], ['fresh', text.styleFresh], ['hearty', text.styleHearty], ['special', text.styleSpecial], ['quick', text.styleQuick]];
		return `<div class="item-tags"><select data-item-appetite-size="${categoryIndex}-${itemIndex}" title="${escapeAttr(text.sizeTitle)}">${selectOptions(sizeOptions, item.appetiteSize)}</select><select data-item-style="${categoryIndex}-${itemIndex}" title="${escapeAttr(text.styleTitle)}">${selectOptions(styleOptions, item.style)}</select><label class="item-favorite-check"><input type="checkbox" data-item-favorite="${categoryIndex}-${itemIndex}"${item.isFavorite ? ' checked' : ''}> ${escapeHtml(text.favorite)}</label></div>`;
	}
	const editorText = strings();
	const sectionNameAria = escapeAttr(editorText.sectionNameAria);
	const moveSectionUp = escapeAttr(editorText.moveSectionUp);
	const moveSectionDown = escapeAttr(editorText.moveSectionDown);
	const removeSectionLabel = escapeAttr(editorText.removeSection);
	const dishNameLabel = escapeAttr(editorText.dishName);
	const dishDescriptionLabel = escapeAttr(editorText.dishDescription);
	const dishDescriptionAria = escapeAttr(editorText.dishDescriptionAria);
	const priceLabel = escapeAttr(editorText.price);
	const removeDishLabel = escapeAttr(editorText.removeDish);
	$('#categoryEditor').innerHTML = client.categories.map((category, categoryIndex) => `<div class="category-block"><div class="category-top"><input data-category-name="${categoryIndex}" value="${escapeAttr(category.name)}" aria-label="${sectionNameAria}"><span class="category-move"><button type="button" class="move-category" data-move-category="up-${categoryIndex}" title="${moveSectionUp}" aria-label="${moveSectionUp}">↑</button><button type="button" class="move-category" data-move-category="down-${categoryIndex}" title="${moveSectionDown}" aria-label="${moveSectionDown}">↓</button></span><button type="button" class="remove-button" data-remove-category="${categoryIndex}" title="${removeSectionLabel}">×</button></div>${imageControl('category', categoryIndex, category.image)}${courseTypeControl(category, categoryIndex)}<div class="category-items">${category.items.map((item, itemIndex) => `<div class="item-block"><div class="item-row"><input data-item-name="${categoryIndex}-${itemIndex}" value="${escapeAttr(item.name)}" placeholder="${dishNameLabel}" aria-label="${dishNameLabel}"><input data-item-description="${categoryIndex}-${itemIndex}" value="${escapeAttr(item.description)}" placeholder="${dishDescriptionLabel}" aria-label="${dishDescriptionAria}"><input data-item-price="${categoryIndex}-${itemIndex}" value="${escapeAttr(item.price)}" placeholder="0.00" aria-label="${priceLabel}"><button type="button" class="remove-button" data-remove-item="${categoryIndex}-${itemIndex}" title="${removeDishLabel}">×</button></div>${imageControl('item', `${categoryIndex}-${itemIndex}`, item.image)}${itemTagsControl(item, categoryIndex, itemIndex)}</div>`).join('')}</div><button type="button" class="add-item" data-add-item="${categoryIndex}">${escapeHtml(editorText.addDish)}</button></div>`).join('');
	const uploadClientId = client.id;
	document.querySelectorAll('[data-image-input]').forEach((input) => input.addEventListener('change', async () => {
		const file = input.files[0];
		if (!file) return;
		const [kind, ...rest] = input.dataset.imageInput.split('-');
		const index = rest.join('-');
		try {
			const pathHint = `${client.slug}/${kind}-${index}`;
			const url = await uploadImage(file, pathHint);
			// saveClients() replaces `clients` with fresh objects fetched back
			// from Supabase after every save, so the `client` object captured
			// when this listener was attached can go stale mid-upload. Two
			// photos uploaded close together used to race: whichever upload
			// finished second wrote its URL onto the now-orphaned old object,
			// which the next saveClients() call never persisted - the photo
			// silently vanished until re-uploaded. Re-resolving by the
			// (stable) client id right before writing avoids that.
			const target = clients.find((item) => item.id === uploadClientId);
			if (!target) return;
			if (kind === 'category') target.categories[Number(index)].image = url;
			else { const [categoryIndex, itemIndex] = index.split('-').map(Number); target.categories[categoryIndex].items[itemIndex].image = url; }
			await saveClients();
			render();
			notify(strings().photoUploaded);
		} catch (error) { notify(error.message); }
	}));
	document.querySelectorAll('[data-remove-image]').forEach((button) => button.addEventListener('click', () => {
		const [kind, ...rest] = button.dataset.removeImage.split('-');
		const index = rest.join('-');
		if (kind === 'category') client.categories[Number(index)].image = '';
		else { const [categoryIndex, itemIndex] = index.split('-').map(Number); client.categories[categoryIndex].items[itemIndex].image = ''; }
		saveClients().then(render).catch((error) => notify(error.message));
	}));
	document.querySelectorAll('[data-remove-category]').forEach((button) => button.addEventListener('click', () => { client.categories.splice(Number(button.dataset.removeCategory), 1); saveClients(); render(); }));
	document.querySelectorAll('[data-move-category]').forEach((button) => button.addEventListener('click', () => { const [direction, indexText] = button.dataset.moveCategory.split('-'); const index = Number(indexText); const target = direction === 'up' ? index - 1 : index + 1; if (target < 0 || target >= client.categories.length) return; [client.categories[index], client.categories[target]] = [client.categories[target], client.categories[index]]; saveClients().then(render).catch((error) => notify(error.message)); }));
	document.querySelectorAll('[data-remove-item]').forEach((button) => button.addEventListener('click', () => { const [categoryIndex, itemIndex] = button.dataset.removeItem.split('-').map(Number); client.categories[categoryIndex].items.splice(itemIndex, 1); saveClients(); render(); }));
	document.querySelectorAll('[data-add-item]').forEach((button) => button.addEventListener('click', () => { client.categories[Number(button.dataset.addItem)].items.push({ id: crypto.randomUUID(), name: 'New dish', description: '', price: '0.00', appetiteSize: '', style: '', isFavorite: false }); saveClients(); render(); }));
	document.querySelectorAll('[data-category-course-type]').forEach((select) => select.addEventListener('change', () => { client.categories[Number(select.dataset.categoryCourseType)].courseType = select.value; saveClients().then(render).catch((error) => notify(error.message)); }));
	document.querySelectorAll('[data-item-appetite-size]').forEach((select) => select.addEventListener('change', () => { const [categoryIndex, itemIndex] = select.dataset.itemAppetiteSize.split('-').map(Number); client.categories[categoryIndex].items[itemIndex].appetiteSize = select.value; saveClients().then(render).catch((error) => notify(error.message)); }));
	document.querySelectorAll('[data-item-style]').forEach((select) => select.addEventListener('change', () => { const [categoryIndex, itemIndex] = select.dataset.itemStyle.split('-').map(Number); client.categories[categoryIndex].items[itemIndex].style = select.value; saveClients().then(render).catch((error) => notify(error.message)); }));
	document.querySelectorAll('[data-item-favorite]').forEach((checkbox) => checkbox.addEventListener('change', () => { const [categoryIndex, itemIndex] = checkbox.dataset.itemFavorite.split('-').map(Number); client.categories[categoryIndex].items[itemIndex].isFavorite = checkbox.checked; saveClients().then(render).catch((error) => notify(error.message)); }));
	const url = menuUrl(client); $('#qrUrl').textContent = url; $('#previewMenu').href = url; if ($('#previewMenuTop')) $('#previewMenuTop').href = url; $('#qrImage').src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=12&data=${encodeURIComponent(url)}`;
	// The Email templates tab isn't about this client (it's the shared template
	// list), so a locked client must not switch its buttons off - that also
	// keeps the template toolbar's own disabled states (e.g. Delete with nothing
	// ticked) from being overwritten here on every render.
	document.querySelectorAll('#clientForm input, #clientForm select, #clientForm button, #clientForm textarea').forEach((element) => { if (element.id !== 'deleteClient' && !element.closest('[data-tab-panel="emails"]')) element.disabled = isLocked; });
}
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }
function escapeAttr(value) { return escapeHtml(value); }
async function readForm() { const client = selectedClient(); const name = $('#businessName').value.trim(); const slug = slugifyName($('#slug').value) || slugifyName(name); if (!name) return notify(strings().customerNameRequired); if (!slug) return notify(strings().urlSlugRequired); if (clients.some((item) => item.id !== client.id && item.slug === slug)) return notify(strings().slugInUse); client.name = name; client.slug = slug; client.phone = $('#phone').value.trim(); client.whatsapp = $('#whatsapp').value.trim(); client.address = $('#address').value.trim(); client.currency = $('#currency').value; document.querySelectorAll('[data-category-name]').forEach((input) => { client.categories[Number(input.dataset.categoryName)].name = input.value.trim() || 'Untitled section'; }); document.querySelectorAll('[data-item-name]').forEach((input) => { const [categoryIndex, itemIndex] = input.dataset.itemName.split('-').map(Number); client.categories[categoryIndex].items[itemIndex].name = input.value.trim() || 'Untitled dish'; }); document.querySelectorAll('[data-item-description]').forEach((input) => { const [categoryIndex, itemIndex] = input.dataset.itemDescription.split('-').map(Number); client.categories[categoryIndex].items[itemIndex].description = input.value.trim(); }); document.querySelectorAll('[data-item-price]').forEach((input) => { const [categoryIndex, itemIndex] = input.dataset.itemPrice.split('-').map(Number); client.categories[categoryIndex].items[itemIndex].price = input.value.trim(); }); localStorage.setItem(STORAGE_KEY, JSON.stringify(clients)); render(); $('#savedState').textContent = strings().savedLocallyJustNow; notify(strings().clientSavedLocally.replace('{name}', client.name)); try { await saveClients(); $('#savedState').textContent = strings().savedToCloud; } catch (error) { notify(strings().savedLocallyCloudFailed.replace('{error}', error.message)); } }
async function addClient() { const client = { id: `client-${Date.now()}`, name: 'New customer', slug: `new-customer-${Date.now()}`, slugManual: false, phone: '', whatsapp: '', address: '', currency: '€', languages: selectedLanguages().length ? selectedLanguages() : ['en'], categories: [{ name: 'Menu', items: [{ name: 'Signature dish', description: 'Describe this dish', price: '0.00' }] }], localCreatedAt: Date.now() }; clients.push(client); selectedId = client.id; render(); notify(strings().newCustomerCreated); try { await saveClients(); } catch (error) { notify(strings().savedLocallyCloudFailed.replace('{error}', error.message)); } }

$('#businessName').addEventListener('input', () => { const slugInput = $('#slug'); if (slugInput.dataset.manual !== 'true') slugInput.value = slugifyName($('#businessName').value); }); $('#slug').addEventListener('input', () => { $('#slug').dataset.manual = 'true'; const client = selectedClient(); if (client) client.slugManual = true; }); $('#clientForm').addEventListener('submit', (event) => { event.preventDefault(); readForm(); }); $('#addClient').addEventListener('click', addClient); $('#addClientTop').addEventListener('click', addClient); $('#addCategory').addEventListener('click', () => { selectedClient().categories.push({ name: 'New section', items: [] }); saveClients().then(render).catch((error) => notify(error.message)); });
async function deleteClient() {
	if (clients.length === 1) return notify(strings().keepOneClient);
	if (!confirm(strings().deleteClientConfirm)) return;
	const removed = selectedClient();
	const previousClients = clients;
	const previousSelectedId = selectedId;
	clients = clients.filter((client) => client.id !== selectedId);
	selectedId = clients[0].id;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
	render();
	if (typeof supabaseClient !== 'undefined' && removed?.slug) {
		const { error } = await supabaseClient.from('menus').delete().eq('slug', removed.slug);
		if (error) {
			// Cloud delete failed - e.g. an order/subscription still references
			// this menu, which the database's foreign key blocks. Undo the
			// optimistic local removal instead of leaving this tab out of sync
			// with Supabase: without this, the client would silently reappear
			// next time any device re-synced, looking like the deletion never
			// happened at all.
			clients = previousClients;
			selectedId = previousSelectedId;
			localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
			render();
			notify(strings().couldNotDeleteClient.replace('{name}', removed.name).replace('{error}', error.message));
			return;
		}
	}
	notify(strings().clientDeleted);
}
$('#deleteClient').addEventListener('click', deleteClient); if ($('#deleteClientTop')) $('#deleteClientTop').addEventListener('click', deleteClient); $('#copyUrl').addEventListener('click', async () => { await navigator.clipboard.writeText($('#qrUrl').textContent); notify(strings().menuLinkCopied); }); if ($('#saveChangesTop')) $('#saveChangesTop').addEventListener('click', () => readForm()); $('#downloadQr').addEventListener('click', async () => {
	try {
		const response = await fetch($('#qrImage').src);
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const blob = await response.blob();
		const blobUrl = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = blobUrl;
		link.download = `${selectedClient().slug}-qr.png`;
		document.body.appendChild(link);
		link.click();
		link.remove();
		URL.revokeObjectURL(blobUrl);
	} catch (error) {
		notify(strings().couldNotDownloadQr.replace('{error}', error.message));
	}
});
function exportMenu() { const client = selectedClient(); const blob = new Blob([JSON.stringify({ name: client.name, slug: client.slug, categories: client.categories }, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${client.slug}-menu.json`; link.click(); URL.revokeObjectURL(link.href); }
$('#exportMenu').addEventListener('click', exportMenu); $('#importMenu').addEventListener('click', () => $('#menuJson').click()); $('#menuJson').addEventListener('change', async () => { const file = $('#menuJson').files[0]; if (!file) return; try { const imported = JSON.parse(await file.text()); const client = selectedClient(); client.categories = normalizeClient({ categories: imported.categories }).categories; if (imported.name) client.name = imported.name; if (imported.slug) client.slug = slugifyName(imported.slug); await saveClients(); render(); notify(strings().menuJsonImported); } catch (error) { notify(strings().jsonImportFailed.replace('{error}', error.message)); } });
async function syncFromSupabase() {
	if (typeof supabaseClient === 'undefined') return;
	const { data, error } = await supabaseClient.from('menus').select('*').order('created_at');
	if (error) { notify(strings().cloudSyncUnavailable); return; }
	if (data?.length) {
		const remoteClients = data.filter((client) => client.slug !== 'new-venue-3').map(normalizeClient);
		const remoteSlugs = new Set(remoteClients.map((client) => client.slug));
		// Only keep local-only clients created in the last 15 minutes (still
		// waiting on their first cloud sync). Anything older that isn't in the
		// remote list anymore was deleted there and shouldn't reappear locally.
		const RECENT_MS = 15 * 60 * 1000;
		const localOnlyClients = clients.filter((client) => !remoteSlugs.has(client.slug) && client.localCreatedAt && (Date.now() - client.localCreatedAt) < RECENT_MS);
		clients = [...remoteClients, ...localOnlyClients];
		selectedId = clients.find((client) => client.id === selectedId)?.id || clients[0]?.id;
		localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
		render();
	} else if (clients.length) {
		try { await saveClients(); render(); } catch (error) { notify(error.message); }
	}
}
// How many menu items each plan includes (same numbers as the pricing page).
const PLAN_DISH_LIMITS = { start: { label: 'Smart Start', limit: 50 }, pro: { label: 'Smart Pro', limit: 150 }, premium: { label: 'Smart Premium', limit: 450 } };

function planKey(plan) {
	const value = String(plan || '').toLowerCase();
	if (value.includes('premium')) return 'premium';
	if (value.includes('pro')) return 'pro';
	if (value.includes('start')) return 'start';
	return '';
}

// Total dishes across all sections, next to the "Sections & dishes" title -
// "23 / 50 dishes" when the menu's plan is known, orange from 90% of the
// limit and red once it's exceeded. Without a subscription there is no plan
// to compare against, so only the count is shown.
function updateDishCount(client, subscription) {
	const badge = $('#dishCount');
	if (!badge) return;
	const total = client.categories.reduce((sum, category) => sum + (category.items?.length || 0), 0);
	const plan = PLAN_DISH_LIMITS[planKey(subscription?.plan)];
	badge.classList.remove('dish-count--near', 'dish-count--over');
	if (!plan) {
		badge.textContent = total === 1 ? strings().dishCountOne : strings().dishCountMany.replace('{n}', total);
		badge.title = strings().noPlanLimitTitle;
		return;
	}
	badge.textContent = strings().dishCountOfLimit.replace('{n}', total).replace('{limit}', plan.limit);
	badge.title = strings().planIncludesTitle.replace('{plan}', plan.label).replace('{limit}', plan.limit);
	if (total > plan.limit) badge.classList.add('dish-count--over');
	else if (total >= plan.limit * 0.9) badge.classList.add('dish-count--near');
}

async function syncSubscriptions() {
	if (typeof supabaseClient === 'undefined') return;
	const { data, error } = await supabaseClient.from('subscriptions').select('menu_slug, plan, status, current_period_end, renewal_token, stats_token, addon_token').order('created_at', { ascending: false });
	if (error) return;
	subscriptionsBySlug = {};
	(data || []).forEach((row) => { if (!subscriptionsBySlug[row.menu_slug]) subscriptionsBySlug[row.menu_slug] = row; });
	render();
}

async function loadActivity() {
	const list = $('#activityList');
	if (!list) return;
	if (typeof supabaseClient === 'undefined') { list.innerHTML = `<p class="client-empty">${escapeHtml(strings().cloudConnectionUnavailable)}</p>`; return; }
	const { data, error } = await supabaseClient
		.from('notifications_log')
		.select('kind, sent_to, provider_message_id, created_at, subscriptions(menu_slug, customers(contact_name))')
		.order('created_at', { ascending: false })
		.limit(50);
	if (error) { list.innerHTML = `<p class="client-empty">${escapeHtml(strings().couldNotLoadActivity.replace('{error}', error.message))}</p>`; return; }
	if (!data || !data.length) { list.innerHTML = `<p class="client-empty">${escapeHtml(strings().noActivityYet)}</p>`; return; }
	list.innerHTML = data.map((row) => {
		const who = row.subscriptions?.customers?.contact_name || row.subscriptions?.menu_slug || strings().unknownRecipient;
		const sent = !!row.provider_message_id;
		const when = new Date(row.created_at).toLocaleString(dateLocale());
		const recipient = strings().activityTo.replace('{to}', escapeHtml(row.sent_to));
		return `<div class="activity-row"><div><strong>${escapeHtml(row.kind)}</strong><small>${escapeHtml(who)} · ${recipient}</small></div><div class="activity-meta"><span class="activity-status ${sent ? 'sent' : 'failed'}">${escapeHtml(sent ? strings().activitySent : strings().activityFailed)}</span><small>${escapeHtml(when)}</small></div></div>`;
	}).join('');
}

async function loadPhotoLibrary() {
	const grid = $('#photoLibraryGrid');
	if (!grid) return;
	grid.innerHTML = `<p class="client-empty">${escapeHtml(strings().loading)}</p>`;
	const { files, error } = await listLibraryPhotos();
	if (error) { grid.innerHTML = `<p class="client-empty">${escapeHtml(strings().couldNotLoadPhotos.replace('{error}', error))}</p>`; return; }
	if (!files.length) { grid.innerHTML = `<p class="client-empty">${escapeHtml(strings().noPhotosYet)}</p>`; return; }
	grid.innerHTML = files.map((file) => `<div class="photo-library-item"><img src="${escapeAttr(file.url)}" alt="" loading="lazy"><button type="button" class="icon-button photo-delete-x" data-delete-photo="${escapeAttr(file.name)}" title="${escapeAttr(strings().deletePhoto)}">×</button></div>`).join('');
	document.querySelectorAll('[data-delete-photo]').forEach((button) => button.addEventListener('click', async () => {
		if (!confirm(strings().deletePhotoConfirm)) return;
		const { error } = await supabaseClient.storage.from('menu-images').remove([`library/${button.dataset.deletePhoto}`]);
		if (error) { notify(strings().couldNotDeletePhoto.replace('{error}', error.message)); return; }
		notify(strings().photoDeleted);
		await loadPhotoLibrary();
	}));
}
async function listLibraryPhotos() {
	if (typeof supabaseClient === 'undefined') return { error: strings().cloudConnectionUnavailable };
	const { data, error } = await supabaseClient.storage.from('menu-images').list('library', { sortBy: { column: 'created_at', order: 'desc' } });
	if (error) return { error: error.message };
	const files = (data || []).filter((file) => file.id && file.name !== '.emptyFolderPlaceholder');
	return { files: files.map((file) => ({ name: file.name, url: supabaseClient.storage.from('menu-images').getPublicUrl(`library/${file.name}`).data.publicUrl })) };
}
async function openHeaderBgPicker() {
	const modal = $('#photoPickerModal');
	const grid = $('#photoPickerGrid');
	modal.hidden = false;
	grid.innerHTML = `<p class="client-empty">${escapeHtml(strings().loading)}</p>`;
	const { files, error } = await listLibraryPhotos();
	if (error) { grid.innerHTML = `<p class="client-empty">${escapeHtml(strings().couldNotLoadPhotos.replace('{error}', error))}</p>`; return; }
	if (!files.length) { grid.innerHTML = `<p class="client-empty">${escapeHtml(strings().noPhotosInLibrary)}</p>`; return; }
	grid.innerHTML = files.map((file) => `<div class="photo-library-item photo-pick-item" data-pick-photo="${escapeAttr(file.url)}"><img src="${escapeAttr(file.url)}" alt="" loading="lazy"></div>`).join('');
	document.querySelectorAll('[data-pick-photo]').forEach((item) => item.addEventListener('click', async () => {
		selectedClient().header_background_url = item.dataset.pickPhoto;
		modal.hidden = true;
		try { await saveClients(); notify(strings().headerBackgroundUpdated); } catch (error) { notify(error.message); }
		render();
	}));
}
if ($('#pickHeaderBg')) $('#pickHeaderBg').addEventListener('click', openHeaderBgPicker);
if ($('#closePhotoPicker')) $('#closePhotoPicker').addEventListener('click', () => { $('#photoPickerModal').hidden = true; });
if ($('#photoPickerModal')) $('#photoPickerModal').addEventListener('click', (event) => { if (event.target.id === 'photoPickerModal') $('#photoPickerModal').hidden = true; });
if ($('#uploadHeaderBg')) $('#uploadHeaderBg').addEventListener('change', async () => {
	const input = $('#uploadHeaderBg');
	const file = input.files[0];
	if (!file) return;
	try {
		const url = await uploadImage(file, `library/${Date.now()}`);
		selectedClient().header_background_url = url;
		await saveClients();
		notify(strings().headerBackgroundUploaded);
		render();
	} catch (error) { notify(error.message); } finally { input.value = ''; }
});
if ($('#removeHeaderBg')) $('#removeHeaderBg').addEventListener('click', () => {
	selectedClient().header_background_url = '';
	saveClients().then(render).catch((error) => notify(error.message));
});
if ($('#headerFont')) $('#headerFont').addEventListener('change', () => {
	selectedClient().header_font = $('#headerFont').value;
	saveClients().then(render).catch((error) => notify(error.message));
});
if ($('#headerTextColor')) $('#headerTextColor').addEventListener('change', () => {
	selectedClient().header_text_color = $('#headerTextColor').value;
	saveClients().then(render).catch((error) => notify(error.message));
});
wireAddonFreeCheckboxes();
[$('#addonSendAnalytics'), $('#addonSendSfm'), $('#addonSendPhoto'), $('#addonSendSmartServiceHub')].forEach((button) => {
	if (!button) return;
	button.addEventListener('click', async () => {
		if (!button.dataset.link) return;
		await navigator.clipboard.writeText(button.dataset.link);
		notify(strings().addonsLinkCopied);
	});
});

// The 4 staff links and each table's QR link are rebuilt into fresh
// buttons on every render() (see renderSmartServiceHubExtra()), so this is
// delegated on the tab panel rather than bound to specific buttons.
const smartServiceHubPanel = document.querySelector('[data-tab-panel="addons"]');
if (smartServiceHubPanel) {
	smartServiceHubPanel.addEventListener('click', async (event) => {
		const printTableQr = event.target.closest('[data-print-table-qr]');
		if (printTableQr) {
			openPrintableTableQr(printTableQr.dataset.printTableQr, printTableQr.dataset.printTableNumber);
			return;
		}
		const removeTable = event.target.closest('[data-remove-table]');
		if (removeTable) {
			const tableId = removeTable.dataset.removeTable;
			const tableNumber = removeTable.dataset.removeTableNumber;
			if (!confirm(strings().removeTableConfirm.replace('{n}', tableNumber))) return;
			const { error } = await supabaseClient.from('restaurant_tables').delete().eq('id', tableId);
			if (error) { notify(strings().couldNotRemoveTable.replace('{error}', error.message)); return; }
			// Its emailed QR image (if one was ever made) goes too - best effort.
			const removedFrom = selectedClient();
			if (removedFrom) {
				supabaseClient.storage.from('menu-images').list(TABLE_QR_FOLDER(removedFrom), { search: tableId })
					.then(({ data }) => {
						const names = (data || []).filter((file) => file.name.startsWith(`${tableId}-`)).map((file) => `${TABLE_QR_FOLDER(removedFrom)}/${file.name}`);
						if (names.length) return supabaseClient.storage.from('menu-images').remove(names);
					})
					.catch(() => {});
			}
			notify(strings().tableRemoved.replace('{n}', tableNumber));
			await syncSmartServiceHub();
			return;
		}
		const renameAccess = event.target.closest('[data-rename-access]');
		if (renameAccess) {
			const input = prompt(strings().renameAccessPrompt, renameAccess.dataset.accessName || '');
			if (input === null) return;
			const { error } = await supabaseClient.from('restaurant_access').update({ label: cleanAccessLabel(input) }).eq('id', renameAccess.dataset.renameAccess);
			if (error) { notify(strings().couldNotSaveAccess.replace('{error}', error.message)); return; }
			notify(strings().accessSaved);
			await syncSmartServiceHub();
			return;
		}
		const removeAccess = event.target.closest('[data-remove-access]');
		if (removeAccess) {
			if (!confirm(strings().removeAccessConfirm.replace('{name}', removeAccess.dataset.accessName))) return;
			const { error } = await supabaseClient.from('restaurant_access').delete().eq('id', removeAccess.dataset.removeAccess);
			if (error) { notify(strings().couldNotSaveAccess.replace('{error}', error.message)); return; }
			notify(strings().accessRemoved.replace('{name}', removeAccess.dataset.accessName));
			await syncSmartServiceHub();
			return;
		}
		const langButton = event.target.closest('[data-onboarding-lang]');
		if (langButton) {
			onboardingTemplateLang = langButton.dataset.onboardingLang;
			const client = selectedClient();
			if (client) renderOnboardingTemplate(client);
			return;
		}
		if (event.target.closest('#onboardingTemplateCopy')) {
			const client = selectedClient();
			if (!client) return;
			// text/html so a rich email client (Gmail, Outlook web, Apple
			// Mail) pastes the actual QR code images, not just links -
			// text/plain rides along as the fallback for anything that
			// only accepts plain text.
			await copyForEmail(onboardingTemplateHtml(client, onboardingTemplateLang), onboardingTemplateText(client, onboardingTemplateLang));
			return;
		}
		if (event.target.closest('#tablesEmailCopy')) {
			const client = selectedClient();
			if (!client || !tablesEmailRows(client).length) return;
			const lang = onboardingTemplateLang;
			notify(strings().tablesEmailPreparing);
			await copyForEmail(tableQrImageUrls(client).then((urls) => tablesEmailHtml(client, lang, urls)), tablesEmailText(client, lang));
			return;
		}
		const button = event.target.closest('[data-staff-link], [data-table-link]');
		if (!button) return;
		const link = button.dataset.staffLink || button.dataset.tableLink;
		if (!link) return;
		await navigator.clipboard.writeText(link);
		notify(strings().linkCopied);
	});
}
// Another link for an existing role (a 2nd kitchen, a beach bar...): the
// token fills itself in via the column default, same as the first four.
if ($('#smartServiceHubAddAccess')) $('#smartServiceHubAddAccess').addEventListener('click', async () => {
	const client = selectedClient();
	const role = $('#smartServiceHubNewAccessRole')?.value;
	const input = $('#smartServiceHubNewAccessName');
	if (!client || !STAFF_ROLES.includes(role)) return;
	const label = cleanAccessLabel(input.value);
	const { error } = await supabaseClient.from('restaurant_access').insert({ menu_slug: client.slug, role, label });
	if (error) { notify(strings().couldNotSaveAccess.replace('{error}', error.message)); return; }
	input.value = '';
	notify(strings().accessAdded);
	await syncSmartServiceHub();
});
// Just a table_number insert - link_secret fills itself in via the column
// default (see 0019_table_link_secret.sql), no need to generate one here.
if ($('#smartServiceHubAddTable')) $('#smartServiceHubAddTable').addEventListener('click', async () => {
	const client = selectedClient();
	const input = $('#smartServiceHubNewTable');
	const tableNumber = input.value.trim();
	if (!client || !tableNumber) return;
	const { error } = await supabaseClient.from('restaurant_tables').insert({ menu_slug: client.slug, table_number: tableNumber });
	if (error) { notify(strings().couldNotAddTable.replace('{error}', error.message)); return; }
	input.value = '';
	notify(strings().tableAdded.replace('{n}', tableNumber));
	await syncSmartServiceHub();
});

// Read-only reference copy of what the Edge Functions actually send (see
// stripe-webhook/check-subscriptions/manage-addons index.ts) - kept here as
// plain text for pasting into a manual email, not wired to send anything
// itself. Has to be updated by hand if the real template copy changes. The
// entries marked "(manual)" are not sent by the system at all - they exist
// only here, for writing by hand.
const EMAIL_TEMPLATES = [
	{
		name: 'Order confirmation',
		subject: 'Ihre Bestellung bei Smart Menu Solutions',
		body: `Hallo [Vorname Nachname],

vielen Dank für Ihre Bestellung. Wir haben Ihre Angaben und Ihr Menü erhalten und melden uns in Kürze mit den nächsten Schritten.

Plan: [Smart Start/Pro/Premium]

Falls Sie Smart FoodMatch™, Smart WeeklyReport™ oder Smart DishPhoto™ noch nicht gebucht haben, können Sie das jederzeit nachholen: [Zusatzmodule verwalten →]

Bei Fragen erreichen Sie uns jederzeit unter smartmenusolutions@outlook.com.

Mit freundlichen Grüßen
[+ HTML-Signatur]`
	},
	{
		// Manual - not sent by any Edge Function. Written by hand and sent
		// with the client's QR code attached once the menu is finished.
		name: 'Finished menu: QR code delivery (manual)',
		subject: 'Ihr individueller QR-Code für [Menü-Name] ist fertig',
		body: `Hallo [Vorname Nachname],

vielen Dank für Ihr Vertrauen! Ihre digitale Speisekarte für [Menü-Name] ist fertig und ab sofort online.

Anbei erhalten Sie Ihren individuellen QR-Code (als [PNG/PDF] im Anhang). Ihr Menü erreichen Sie auch direkt über diesen Link: [Menü-Link →]

So geht es weiter:
• Drucken Sie den QR-Code aus und platzieren Sie ihn dort, wo Ihre Gäste ihn sehen – zum Beispiel auf den Tischen, an der Theke oder am Eingang.
• Ihre Gäste scannen den Code mit der Kamera ihres Smartphones und sehen sofort Ihre aktuelle Speisekarte – ganz ohne App.
• Bitte prüfen Sie Ihr Menü in Ruhe und geben Sie uns Bescheid, falls etwas angepasst werden soll.

Änderungen an Ihrer Speisekarte, wie neue Gerichte oder geänderte Preise, senden Sie uns einfach per E-Mail. Die Updates sind in Ihrem Plan ([Smart Start/Pro/Premium]) enthalten.

Falls Sie Smart FoodMatch™, Smart WeeklyReport™ oder Smart DishPhoto™ noch nicht gebucht haben, können Sie das jederzeit nachholen: [Zusatzmodule verwalten →]

Bei Fragen erreichen Sie uns jederzeit unter smartmenusolutions@outlook.com.

Wir wünschen Ihnen viel Erfolg mit Ihrer neuen digitalen Speisekarte und freuen uns über Ihr Vertrauen.

Mit freundlichen Grüßen
[+ HTML-Signatur]`
	},
	{
		name: 'Renewal confirmation',
		subject: 'Ihre Verlängerung bei Smart Menu Solutions',
		body: `Hallo [Vorname Nachname],

vielen Dank für die Verlängerung Ihres Abos. Wir haben Ihre Angaben und Ihr Menü erhalten und melden uns in Kürze mit den nächsten Schritten.

Plan: [Smart Start/Pro/Premium]

Falls Sie Smart FoodMatch™, Smart WeeklyReport™ oder Smart DishPhoto™ noch nicht gebucht haben, können Sie das jederzeit nachholen: [Zusatzmodule verwalten →]

Bei Fragen erreichen Sie uns jederzeit unter smartmenusolutions@outlook.com.

Mit freundlichen Grüßen
[+ HTML-Signatur]`
	},
	{
		name: 'Renewal payment failed',
		subject: 'Ihre Verlängerung ist fehlgeschlagen – bitte handeln',
		body: `Hallo [Vorname Nachname],

leider konnte die automatische Zahlung für die Verlängerung Ihres Abos nicht durchgeführt werden.

Ihr Menü bleibt noch 7 Tage online, damit Sie das in Ruhe klären können. Bitte verlängern Sie Ihr Abo über folgenden Link, um eine Unterbrechung zu vermeiden: [Jetzt verlängern →]

Bei Fragen erreichen Sie uns jederzeit unter smartmenusolutions@outlook.com.

Mit freundlichen Grüßen
[+ HTML-Signatur]`
	},
	{
		name: 'Subscription deactivated',
		subject: 'Ihr Abo wurde deaktiviert',
		body: `Hallo [Vorname Nachname],

da die Zahlung für Ihre Verlängerung ausblieb, wurde Ihr Abo nun deaktiviert und Ihr Menü ist über den QR-Code nicht mehr erreichbar.

Sie können Ihr Abo jederzeit über folgenden Link reaktivieren: [Abo reaktivieren →]

Bei Fragen erreichen Sie uns jederzeit unter smartmenusolutions@outlook.com.

Mit freundlichen Grüßen
[+ HTML-Signatur]`
	},
	{
		name: 'Add-on added (mid-subscription)',
		subject: '[Add-on] wurde hinzugefügt',
		body: `Hallo [Vorname Nachname],

[Add-on-Name] ist jetzt für [Menü-Name] aktiv.

Berechnet wurde der anteilige Betrag für den Rest Ihres laufenden Abo-Jahres: [X,XX €]. Ab der nächsten Verlängerung läuft es automatisch mit Ihrem Tarif zusammen weiter.
(Beim Foto-Zusatz stattdessen: einmaliger Betrag, kein Renewal-Hinweis.)

Mit freundlichen Grüßen
[+ HTML-Signatur]`
	}
];
// English versions of the templates above, keyed by template name. The Edge
// Functions send the English text to customers whose menu language is
// English (their `lang` is 'en'); the German text above is the default.
const EMAIL_TEMPLATES_EN = {
	'Order confirmation': {
		subject: 'Your order at Smart Menu Solutions',
		body: `Hi [First name Last name],

thank you for your order. We've received your details and menu and will get back to you shortly with the next steps.

Plan: [Smart Start/Pro/Premium]

If you haven't booked Smart FoodMatch™, Smart WeeklyReport™ or Smart DishPhoto™ yet, you can add them anytime: [Manage add-ons →]

If you have any questions, reach us anytime at smartmenusolutions@outlook.com.

Best regards
[+ HTML signature]`
	},
	'Finished menu: QR code delivery (manual)': {
		subject: 'Your personal QR code for [Menu name] is ready',
		body: `Hi [First name Last name],

thank you for your trust! Your digital menu for [Menu name] is finished and live from now on.

Attached you'll find your personal QR code (as [PNG/PDF]). You can also reach your menu directly via this link: [Menu link →]

What happens next:
• Print the QR code and place it where your guests will see it – for example on the tables, at the counter or at the entrance.
• Your guests scan the code with their phone's camera and instantly see your current menu – no app needed.
• Please take your time to check your menu and let us know if anything needs to be adjusted.

You can send us changes to your menu, such as new dishes or changed prices, simply by email. The updates are included in your plan ([Smart Start/Pro/Premium]).

If you haven't booked Smart FoodMatch™, Smart WeeklyReport™ or Smart DishPhoto™ yet, you can add them anytime: [Manage add-ons →]

If you have any questions, reach us anytime at smartmenusolutions@outlook.com.

We wish you every success with your new digital menu and thank you for your trust.

Best regards
[+ HTML signature]`
	},
	'Renewal confirmation': {
		subject: 'Your renewal at Smart Menu Solutions',
		body: `Hi [First name Last name],

thank you for renewing your subscription. We've received your details and menu and will get back to you shortly with the next steps.

Plan: [Smart Start/Pro/Premium]

If you haven't booked Smart FoodMatch™, Smart WeeklyReport™ or Smart DishPhoto™ yet, you can add them anytime: [Manage add-ons →]

If you have any questions, reach us anytime at smartmenusolutions@outlook.com.

Best regards
[+ HTML signature]`
	},
	'Renewal payment failed': {
		subject: 'Your renewal has failed – action needed',
		body: `Hi [First name Last name],

unfortunately, the automatic payment for renewing your subscription could not be processed.

Your menu will stay online for another 7 days so you have time to sort this out. Please renew your subscription via the link below to avoid any interruption: [Renew now →]

If you have any questions, reach us anytime at smartmenusolutions@outlook.com.

Best regards
[+ HTML signature]`
	},
	'Subscription deactivated': {
		subject: 'Your subscription has been deactivated',
		body: `Hi [First name Last name],

since the payment for your renewal didn't go through, your subscription has now been deactivated and your menu is no longer reachable via the QR code.

You can reactivate your subscription anytime via the link below: [Reactivate subscription →]

If you have any questions, reach us anytime at smartmenusolutions@outlook.com.

Best regards
[+ HTML signature]`
	},
	'Add-on added (mid-subscription)': {
		subject: '[Add-on] has been added',
		body: `Hi [First name Last name],

[Add-on name] is now active for [Menu name].

We've charged the pro-rated amount for the rest of your current plan year: [X.XX €]. From your next renewal on, it's included automatically with your plan.
(For the photo add-on instead: one-time amount, no renewal note.)

Best regards
[+ HTML signature]`
	}
};

// Which language the template cards show and copy - German by default.
let templateLang = 'de';

// Staff can delete templates and write new ones. That's kept in this browser
// only (localStorage): deleting a built-in template just hides it (it can be
// restored), a custom template is removed for good.
const TEMPLATE_STORE_KEY = 'smartmenu.emailtemplates.v1';

function loadTemplateStore() {
	try {
		const saved = JSON.parse(localStorage.getItem(TEMPLATE_STORE_KEY));
		return { hidden: Array.isArray(saved?.hidden) ? saved.hidden : [], custom: Array.isArray(saved?.custom) ? saved.custom : [] };
	} catch {
		return { hidden: [], custom: [] };
	}
}

let templateStore = loadTemplateStore();

function saveTemplateStore() {
	try {
		localStorage.setItem(TEMPLATE_STORE_KEY, JSON.stringify(templateStore));
	} catch {
		notify(strings().templateStoreSaveFailed);
	}
}

// Built-in templates that haven't been deleted, then the custom ones. Each
// entry: { key, name, custom, de: {subject, body}, en: {subject, body} | null }.
function visibleTemplates() {
	const builtIn = EMAIL_TEMPLATES
		.filter((template) => !templateStore.hidden.includes(template.name))
		.map((template) => ({ key: template.name, name: template.name, custom: false, de: { subject: template.subject, body: template.body }, en: EMAIL_TEMPLATES_EN[template.name] || null }));
	const custom = templateStore.custom.map((template) => ({ key: template.id, name: template.name, custom: true, de: template.de, en: template.en?.subject || template.en?.body ? template.en : null }));
	return builtIn.concat(custom);
}

// Text to show/copy in the current language. A template without an English
// version falls back to its German text (and is flagged as such on its card).
function templateText(template) {
	return templateLang === 'en' && template.en ? template.en : template.de;
}

const templateBoard = $('#templateBoard');
const selectedTemplateKeys = new Set();

function updateTemplateToolbar() {
	const deleteButton = $('#templateDelete');
	if (deleteButton) {
		deleteButton.disabled = !selectedTemplateKeys.size;
		deleteButton.textContent = selectedTemplateKeys.size ? strings().deleteTemplateCount.replace('{n}', selectedTemplateKeys.size) : strings().deleteTemplate;
	}
	const restoreButton = $('#templateRestore');
	if (restoreButton) restoreButton.hidden = !templateStore.hidden.length;
}

function renderTemplateBoard() {
	if (!templateBoard) return;
	document.querySelectorAll('[data-template-lang]').forEach((button) => button.classList.toggle('active', button.dataset.templateLang === templateLang));
	const templates = visibleTemplates();
	[...selectedTemplateKeys].forEach((key) => { if (!templates.some((template) => template.key === key)) selectedTemplateKeys.delete(key); });
	templateBoard.innerHTML = templates.map((template) => {
		const text = templateText(template);
		const missingEnglish = templateLang === 'en' && !template.en;
		return `
		<div class="template-card">
			<div class="template-card-head">
				<label class="template-card-select" title="${escapeAttr(strings().tickToDelete)}"><input type="checkbox" data-template-select="${escapeAttr(template.key)}"${selectedTemplateKeys.has(template.key) ? ' checked' : ''}><span class="template-card-name">${escapeHtml(template.name)}</span>${template.custom ? `<span class="template-card-tag">${escapeHtml(strings().templateOwn)}</span>` : ''}</label>
				<button type="button" class="button button-ghost template-card-copy" data-template-key="${escapeAttr(template.key)}">${escapeHtml(strings().copy)}</button>
			</div>
			${missingEnglish ? `<p class="template-card-note">${escapeHtml(strings().templateNoEnglish)}</p>` : ''}
			<p class="template-card-subject"><strong>${escapeHtml(strings().subjectLabel)}</strong> ${escapeHtml(text.subject)}</p>
			<pre class="template-card-body">${escapeHtml(text.body)}</pre>
		</div>
	`;
	}).join('') || `<p class="client-empty">${escapeHtml(strings().noTemplates)}</p>`;
	updateTemplateToolbar();
}

// The form is a plain <div>, not a <form>: it sits inside the client's own
// <form>, and nested forms aren't allowed (the browser drops the inner one).
const TEMPLATE_FORM_FIELDS = ['#templateName', '#templateSubjectDe', '#templateBodyDe', '#templateSubjectEn', '#templateBodyEn'];

function openTemplateForm() {
	TEMPLATE_FORM_FIELDS.forEach((selector) => { $(selector).value = ''; });
	$('#templateForm').hidden = false;
	$('#templateName').focus();
}

function closeTemplateForm() {
	$('#templateForm').hidden = true;
}

if (templateBoard) {
	renderTemplateBoard();
	// Everything is wired once on the containers, since the cards are rebuilt
	// whenever the language, the selection or the list changes.
	templateBoard.addEventListener('click', async (event) => {
		const button = event.target.closest('[data-template-key]');
		if (!button) return;
		const template = visibleTemplates().find((item) => item.key === button.dataset.templateKey);
		if (!template) return;
		const text = templateText(template);
		await navigator.clipboard.writeText(`${text.subject}\n\n${text.body}`);
		notify(strings().templateCopied.replace('{lang}', templateLang === 'en' && template.en ? 'English' : 'Deutsch'));
	});
	templateBoard.addEventListener('change', (event) => {
		const key = event.target.dataset?.templateSelect;
		if (key === undefined) return;
		if (event.target.checked) selectedTemplateKeys.add(key); else selectedTemplateKeys.delete(key);
		updateTemplateToolbar();
	});
	document.querySelectorAll('[data-template-lang]').forEach((button) => button.addEventListener('click', () => {
		templateLang = button.dataset.templateLang;
		renderTemplateBoard();
	}));
	$('#templateAdd').addEventListener('click', openTemplateForm);
	$('#templateCancel').addEventListener('click', closeTemplateForm);
	// Enter inside a single-line field would otherwise submit the whole client form.
	$('#templateForm').addEventListener('keydown', (event) => {
		if (event.key === 'Enter' && event.target.tagName === 'INPUT') event.preventDefault();
	});
	$('#templateSave').addEventListener('click', () => {
		const name = $('#templateName').value.trim();
		if (!name) { notify(strings().templateNameRequired); $('#templateName').focus(); return; }
		templateStore.custom.push({
			id: `custom-${Date.now()}`,
			name,
			de: { subject: $('#templateSubjectDe').value.trim(), body: $('#templateBodyDe').value.trim() },
			en: { subject: $('#templateSubjectEn').value.trim(), body: $('#templateBodyEn').value.trim() }
		});
		saveTemplateStore();
		closeTemplateForm();
		renderTemplateBoard();
		notify(strings().templateAdded.replace('{name}', name));
	});
	$('#templateDelete').addEventListener('click', () => {
		if (!selectedTemplateKeys.size) return;
		const chosen = visibleTemplates().filter((template) => selectedTemplateKeys.has(template.key));
		const builtInCount = chosen.filter((template) => !template.custom).length;
		const note = builtInCount ? `\n${builtInCount === chosen.length ? strings().templateDeleteNoteAll : strings().templateDeleteNoteSome.replace('{n}', builtInCount)}` : '';
		const question = chosen.length === 1 ? strings().templateDeleteConfirmOne : strings().templateDeleteConfirmMany.replace('{n}', chosen.length);
		if (!confirm(`${question}\n${chosen.map((template) => `• ${template.name}`).join('\n')}${note}`)) return;
		chosen.forEach((template) => {
			if (template.custom) templateStore.custom = templateStore.custom.filter((item) => item.id !== template.key);
			else if (!templateStore.hidden.includes(template.key)) templateStore.hidden.push(template.key);
		});
		selectedTemplateKeys.clear();
		saveTemplateStore();
		renderTemplateBoard();
		notify(chosen.length === 1 ? strings().templateDeletedOne : strings().templateDeletedMany.replace('{n}', chosen.length));
	});
	$('#templateRestore').addEventListener('click', () => {
		templateStore.hidden = [];
		saveTemplateStore();
		renderTemplateBoard();
		notify(strings().templatesRestored);
	});
}

if ($('#photoLibraryInput')) $('#photoLibraryInput').addEventListener('change', async () => {
	const input = $('#photoLibraryInput');
	const files = [...input.files];
	if (!files.length) return;
	try {
		for (let index = 0; index < files.length; index += 1) await uploadImage(files[index], `library/${Date.now()}-${index}`);
		notify(files.length > 1 ? strings().photosUploaded : strings().photoUploaded);
		await loadPhotoLibrary();
	} catch (error) {
		notify(error.message);
	} finally {
		input.value = '';
	}
});

// The static chrome is translated by walking admin.html's data-i18n*
// attributes; everything else on screen is built by a render function, so a
// language switch has to run all of them again. Also the page's own first
// paint - it replaces the plain render()/loadActivity()/loadPhotoLibrary()
// calls that used to start things off.
function applyAdminLang() {
	const text = strings();
	document.documentElement.lang = currentLang;
	document.querySelectorAll('[data-i18n]').forEach((element) => { const value = text[element.dataset.i18n]; if (value) element.textContent = value; });
	document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => { const value = text[element.dataset.i18nPlaceholder]; if (value) element.placeholder = value; });
	document.querySelectorAll('[data-i18n-title]').forEach((element) => { const value = text[element.dataset.i18nTitle]; if (value) element.title = value; });
	document.querySelectorAll('[data-i18n-aria-label]').forEach((element) => { const value = text[element.dataset.i18nAriaLabel]; if (value) element.setAttribute('aria-label', value); });
	document.querySelectorAll('[data-admin-lang]').forEach((button) => button.classList.toggle('active', button.dataset.adminLang === currentLang));
	if ($('#qrImage') && text.qrImageAlt) $('#qrImage').alt = text.qrImageAlt;
	if ($('#topbarDate')) $('#topbarDate').textContent = new Date().toLocaleDateString(dateLocale(), { weekday: 'long', month: 'long', day: 'numeric' });
	render();
	renderTemplateBoard();
	loadActivity();
	loadPhotoLibrary();
}
document.querySelectorAll('[data-admin-lang]').forEach((button) => button.addEventListener('click', () => {
	currentLang = button.dataset.adminLang;
	try { localStorage.setItem(LANG_STORAGE_KEY, currentLang); } catch { /* convenience only */ }
	applyAdminLang();
}));

applyAdminLang();
syncFromSupabase();
syncSubscriptions();
syncSmartServiceHub();

$('#importPdf').addEventListener('click', importPdf);
$('#translateMenu').addEventListener('click', translateMenu);
$('#clientSearch').addEventListener('input', (event) => { clientSearch = event.target.value; render(); });
document.querySelectorAll('.editor-tab').forEach((tab) => tab.addEventListener('click', () => {
	document.querySelectorAll('.editor-tab').forEach((otherTab) => { otherTab.classList.remove('active'); otherTab.setAttribute('aria-selected', 'false'); });
	tab.classList.add('active'); tab.setAttribute('aria-selected', 'true');
	document.querySelectorAll('.editor-tab-panel').forEach((panel) => { panel.hidden = panel.dataset.tabPanel !== tab.dataset.tab; });
}));
const renewalFilterCard = $('#renewalFilterCard');
if (renewalFilterCard) {
	renewalFilterCard.addEventListener('click', () => { showOnlyNeedsRenewal = !showOnlyNeedsRenewal; renewalFilterCard.classList.toggle('active-filter', showOnlyNeedsRenewal); render(); });
}
