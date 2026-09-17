const STORAGE_KEY = 'menupilot.clients.v1';
const seedClients = [{ id: 'customer-001', name: 'Taverna Athens', slug: 'taverna-athens', phone: '+30 123456789', whatsapp: '+30 123456789', address: 'Rhodes, Greece', currency: '€', languages: ['en', 'de', 'el'], categories: [{ name: 'Starters', items: [{ name: 'Tzatziki', description: 'Greek yogurt with cucumber and garlic', price: '5.90' }] }, { name: 'Mains', items: [{ name: 'Gyros plate', description: 'With fries and tzatziki', price: '14.90' }] }, { name: 'Drinks', items: [{ name: 'Coca Cola', description: '0.33L', price: '3.50' }] }] }];
const $ = (selector) => document.querySelector(selector);
let clients = loadClients();
let selectedId = clients[0]?.id;
let clientSearch = '';
let subscriptionsBySlug = {};
let showOnlyNeedsRenewal = false;
const SUBSCRIPTION_STATUS_LABELS = { active: 'Active', expired: 'Expired', deactivated: 'Deactivated', cancelled: 'Cancelled' };
const RENEWAL_SITE = 'https://smart-menu-solutions.github.io/smart-menu-solutions';
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
	if (error) throw new Error(`Could not save menus: ${error.message}`);
	if (data?.length) {
		const savedBySlug = new Map(data.map((row) => [row.slug, normalizeClient({ ...row, id: row.id })]));
		clients = clients.map((client) => savedBySlug.get(client.slug) || client);
		selectedId = clients.find((client) => client.slug === selectedSlug)?.id || selectedId;
		localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
	}
}
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function selectedClient() { return clients.find((client) => client.id === selectedId); }
function menuUrl(client) {
	const mainLanguage = (client.languages && client.languages[0]) || client.sourceLanguage || 'en';
	return `${window.location.href.replace(/admin\.html.*$/, '')}menu.html?client=${encodeURIComponent(client.slug)}&lang=${encodeURIComponent(mainLanguage)}`;
}
async function uploadImage(file, pathHint) {
	if (typeof supabaseClient === 'undefined') throw new Error('Cloud storage is not available.');
	const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
	const path = `${pathHint}-${Date.now()}.${extension}`;
	const { error } = await supabaseClient.storage.from('menu-images').upload(path, file, { contentType: file.type || 'image/jpeg', upsert: true });
	if (error) throw new Error(`Image upload failed: ${error.message}`);
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
			lastItem = { name, description: '', price };
			category.items.push(lastItem);
		} else {
			lastItem = null;
		}
	});
	const nonEmptyCategories = categories.filter((c) => c.items.length);
	return nonEmptyCategories.length ? nonEmptyCategories : [{ name: 'Imported menu', items: [{ name: 'Review imported PDF text', description: text.slice(0, 240), price: '0.00' }] }];
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
	if (!file) return notify('Choose a PDF first');
	$('#importStatus').textContent = 'Reading PDF…';
	try {
		const pdfjs = window.pdfjsLib;
		if (!pdfjs) throw new Error('PDF reader could not be loaded.');
		pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
		const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
		let text = '';
		for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
			const page = await pdf.getPage(pageNumber);
			const content = await page.getTextContent();
			text += `${pdfPageText(content)}\n`;
		}
		if (!text.trim()) {
			$('#importStatus').textContent = 'No text layer found. Running OCR…';
			const tesseract = window.Tesseract;
			if (typeof tesseract.createWorker !== 'function') throw new Error('OCR reader could not be loaded.');
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
		if (!text.trim()) throw new Error('No readable text found in this PDF.');
		const client = selectedClient();
		client.categories = mergeImportedImages(client.categories, parsePdfText(text));
		await saveClients();
		render();
		$('#importStatus').textContent = `Imported ${pdf.numPages} page(s). Check the draft before saving.`;
	} catch (error) {
		$('#importStatus').textContent = `PDF could not be read: ${error.message}`;
		notify(error.message);
	}
}

function updateLanguageState() {
	const client = selectedClient();
	client.languages = selectedLanguages();
	$('#translationStatus').textContent = `${client.languages.length} language(s) selected.`;
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
		headers: { 'Content-Type': 'application/json', apikey: AUTH_CONFIG.supabasePublishableKey },
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
	if (!targets.length) return notify('Select at least one target language.');
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
					$('#translationStatus').textContent = `Translating menu… (${done}/${totalItems}, currently ${language})`;
				}
			}
		}
		await saveClients();
		$('#translationStatus').textContent = failures ? `Translated to ${targets.join(', ')} with ${failures} item(s) left unchanged.` : `Translated to ${targets.join(', ')}.`;
	} catch (error) {
		$('#translationStatus').textContent = 'Translation failed.';
		notify(error.message);
	}
}

// The Add-ons tab: a read-only board of purchase status for the three
// sellable extras, plus a "Send link" per feature that has a self-service
// page (analytics/smart-food-match both live on the same addons.html, sfm
// via manage-addons; photo has no purchase page of its own yet, so it gets
// a status dot but no send button).
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

	const addonsUrl = clientSubscription?.addon_token ? `${RENEWAL_SITE}/addons.html?token=${clientSubscription.addon_token}` : '';
	[$('#addonSendAnalytics'), $('#addonSendSfm')].forEach((button) => { button.disabled = !addonsUrl; });
	$('#addonSendAnalytics').dataset.link = addonsUrl;
	$('#addonSendSfm').dataset.link = addonsUrl;
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
		const statusLabel = sub ? (SUBSCRIPTION_STATUS_LABELS[sub.status] || sub.status) : 'No subscription';
		const subInfo = sub ? ` · ${escapeHtml(sub.plan)} · until ${escapeHtml(sub.current_period_end || '?')}` : '';
		const statusBadge = `<span class="status-badge ${statusClass}">${escapeHtml(statusLabel)}</span>`;
		return `<div class="client-row ${item.id === selectedId ? 'selected' : ''}" data-client="${item.id}"><span class="client-avatar">${initials(item.name)}</span><span class="client-info"><strong>${escapeHtml(item.name)}</strong><small>${item.categories.length} sections${subInfo}</small><span class="status-badge-row">${statusBadge}</span></span><i class="client-status ${statusClass}" title="${escapeAttr(statusLabel)}"></i></div>`;
	}).join('') || `<p class="client-empty">${showOnlyNeedsRenewal ? 'No clients currently need renewal.' : 'No clients found.'}</p>`;
	document.querySelectorAll('[data-client]').forEach((row) => row.addEventListener('click', () => { selectedId = row.dataset.client; render(); }));
	$('#editorTitle').textContent = client.name; $('#businessName').value = client.name; $('#slug').value = client.slug; $('#slug').dataset.manual = client.slugManual === false ? 'false' : 'true'; $('#phone').value = client.phone || ''; $('#whatsapp').value = client.whatsapp || ''; $('#address').value = client.address || ''; $('#currency').value = client.currency || '€';
	if ($('#headerBgPreview')) $('#headerBgPreview').innerHTML = client.header_background_url ? `<img src="${escapeAttr(client.header_background_url)}" alt="">` : '<span class="header-bg-empty">No custom background — using default</span>';
	if ($('#headerFont')) $('#headerFont').value = client.header_font || '';
	if ($('#headerTextColor')) $('#headerTextColor').value = client.header_text_color || '#ffffff';
	if ($('#smartFoodMatchEnabled')) {
		$('#smartFoodMatchEnabled').checked = !!client.smart_food_match_enabled;
		const qualifies = smartFoodMatchQualifies(client);
		$('#smartFoodMatchHint').textContent = qualifies
			? 'Ready - starter, main and dessert sections are all tagged.'
			: 'Not ready yet - needs at least one tagged starter, main and dessert section (see the dropdown on each section above).';
		$('#smartFoodMatchHint').classList.toggle('smart-match-not-ready', !qualifies);
	}
	// Read-only board - none of these three flags have a click handler here,
	// unlike smartFoodMatchEnabled above. analytics_reports_enabled and
	// photo_addon_enabled are set entirely by stripe-webhook on purchase
	// (smart_food_match_enabled is staff-editable via the checkbox above,
	// but its purchased/not-purchased state still belongs on this board too).
	const clientSubscription = subscriptionsBySlug[client.slug];
	renderAddonBoard(client, clientSubscription);
	const isLocked = !!clientSubscription && clientSubscription.status !== 'active';
	const banner = $('#subscriptionBanner');
	if (isLocked) {
		const renewalUrl = `${RENEWAL_SITE}/renewal.html?token=${clientSubscription.renewal_token}`;
		banner.innerHTML = `This client's subscription is <strong>${escapeHtml(SUBSCRIPTION_STATUS_LABELS[clientSubscription.status] || clientSubscription.status)}</strong>. Editing is locked until they renew. <a href="${renewalUrl}" target="_blank" rel="noopener">Renewal link</a>`;
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
		return `<div class="language-row${checked && !hasTranslation ? ' lang-missing' : ''}"><label class="language-check"><span>${escapeHtml(entry?.label || code)}${isMain ? ' (main)' : ''}</span><input type="checkbox" name="language" value="${code}"${checked ? ' checked' : ''}></label><span class="language-move"><button type="button" class="move-language" data-move-language="up-${index}" title="Move language up" aria-label="Move language up" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" class="move-language" data-move-language="down-${index}" title="Move language down" aria-label="Move language down" ${index === languageOrder.length - 1 ? 'disabled' : ''}>↓</button></span></div>`;
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
	const dishCount = client.categories.reduce((total, category) => total + category.items.length, 0);
	if ($('#dishCountBadge')) $('#dishCountBadge').textContent = `${dishCount} dish${dishCount === 1 ? '' : 'es'} total`;
	function imageControl(kind, index, imageUrl) {
		const noun = kind === 'category' ? 'section' : 'dish';
		return `<div class="image-control" data-image-kind="${kind}" data-image-index="${index}">${imageUrl ? `<img class="image-thumb" src="${escapeAttr(imageUrl)}" alt="">` : ''}<label class="image-upload-btn">${imageUrl ? `Change ${noun} photo` : `＋ Add ${noun} photo (${kind === 'category' ? 'shown as a wide banner' : 'shown small, next to the price'})`}<input type="file" accept="image/*" data-image-input="${kind}-${index}" hidden></label>${imageUrl ? `<button type="button" class="remove-button" data-remove-image="${kind}-${index}" title="Remove photo">×</button>` : ''}</div>`;
	}
	function selectOptions(options, current) {
		return options.map(([value, label]) => `<option value="${value}"${value === (current || '') ? ' selected' : ''}>${label}</option>`).join('');
	}
	// courseType is tagged once per section (not per dish) - it's what Smart
	// Food Match uses to know which section counts as starters/mains/desserts.
	function courseTypeControl(category, categoryIndex) {
		const options = [['', 'Smart Food Match: not classified'], ['starter', 'Starter'], ['main', 'Main'], ['dessert', 'Dessert'], ['drink', 'Drink'], ['other', 'Other (ignored)']];
		return `<select data-category-course-type="${categoryIndex}" class="course-type-select" title="Which course this section counts as for Smart Food Match">${selectOptions(options, category.courseType)}</select>`;
	}
	function itemTagsControl(item, categoryIndex, itemIndex) {
		const sizeOptions = [['', 'Size: not set'], ['small', 'Small'], ['medium', 'Medium'], ['large', 'Large'], ['very-large', 'Very large']];
		const styleOptions = [['', 'Style: not set'], ['fresh', 'Fresh & light'], ['hearty', 'Hearty & rich'], ['special', 'Something special'], ['quick', 'Quick & simple']];
		return `<div class="item-tags"><select data-item-appetite-size="${categoryIndex}-${itemIndex}" title="Portion size, for Smart Food Match">${selectOptions(sizeOptions, item.appetiteSize)}</select><select data-item-style="${categoryIndex}-${itemIndex}" title="Dish style, for Smart Food Match">${selectOptions(styleOptions, item.style)}</select><label class="item-favorite-check"><input type="checkbox" data-item-favorite="${categoryIndex}-${itemIndex}"${item.isFavorite ? ' checked' : ''}> Favorite</label></div>`;
	}
	$('#categoryEditor').innerHTML = client.categories.map((category, categoryIndex) => `<div class="category-block"><div class="category-top"><input data-category-name="${categoryIndex}" value="${escapeAttr(category.name)}" aria-label="Section name"><span class="category-move"><button type="button" class="move-category" data-move-category="up-${categoryIndex}" title="Move section up" aria-label="Move section up">↑</button><button type="button" class="move-category" data-move-category="down-${categoryIndex}" title="Move section down" aria-label="Move section down">↓</button></span><button type="button" class="remove-button" data-remove-category="${categoryIndex}" title="Remove section">×</button></div>${imageControl('category', categoryIndex, category.image)}${courseTypeControl(category, categoryIndex)}<div class="category-items">${category.items.map((item, itemIndex) => `<div class="item-block"><div class="item-row"><input data-item-name="${categoryIndex}-${itemIndex}" value="${escapeAttr(item.name)}" placeholder="Dish name" aria-label="Dish name"><input data-item-description="${categoryIndex}-${itemIndex}" value="${escapeAttr(item.description)}" placeholder="Description" aria-label="Dish description"><input data-item-price="${categoryIndex}-${itemIndex}" value="${escapeAttr(item.price)}" placeholder="0.00" aria-label="Price"><button type="button" class="remove-button" data-remove-item="${categoryIndex}-${itemIndex}" title="Remove dish">×</button></div>${imageControl('item', `${categoryIndex}-${itemIndex}`, item.image)}${itemTagsControl(item, categoryIndex, itemIndex)}</div>`).join('')}</div><button type="button" class="add-item" data-add-item="${categoryIndex}">＋ Add dish</button></div>`).join('');
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
			notify('Photo uploaded');
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
	document.querySelectorAll('[data-add-item]').forEach((button) => button.addEventListener('click', () => { client.categories[Number(button.dataset.addItem)].items.push({ name: 'New dish', description: '', price: '0.00', appetiteSize: '', style: '', isFavorite: false }); saveClients(); render(); }));
	document.querySelectorAll('[data-category-course-type]').forEach((select) => select.addEventListener('change', () => { client.categories[Number(select.dataset.categoryCourseType)].courseType = select.value; saveClients().then(render).catch((error) => notify(error.message)); }));
	document.querySelectorAll('[data-item-appetite-size]').forEach((select) => select.addEventListener('change', () => { const [categoryIndex, itemIndex] = select.dataset.itemAppetiteSize.split('-').map(Number); client.categories[categoryIndex].items[itemIndex].appetiteSize = select.value; saveClients().then(render).catch((error) => notify(error.message)); }));
	document.querySelectorAll('[data-item-style]').forEach((select) => select.addEventListener('change', () => { const [categoryIndex, itemIndex] = select.dataset.itemStyle.split('-').map(Number); client.categories[categoryIndex].items[itemIndex].style = select.value; saveClients().then(render).catch((error) => notify(error.message)); }));
	document.querySelectorAll('[data-item-favorite]').forEach((checkbox) => checkbox.addEventListener('change', () => { const [categoryIndex, itemIndex] = checkbox.dataset.itemFavorite.split('-').map(Number); client.categories[categoryIndex].items[itemIndex].isFavorite = checkbox.checked; saveClients().then(render).catch((error) => notify(error.message)); }));
	const url = menuUrl(client); $('#qrUrl').textContent = url; $('#previewMenu').href = url; if ($('#previewMenuTop')) $('#previewMenuTop').href = url; $('#qrImage').src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=12&data=${encodeURIComponent(url)}`;
	document.querySelectorAll('#clientForm input, #clientForm select, #clientForm button, #clientForm textarea').forEach((element) => { if (element.id !== 'deleteClient') element.disabled = isLocked; });
}
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }
function escapeAttr(value) { return escapeHtml(value); }
async function readForm() { const client = selectedClient(); const name = $('#businessName').value.trim(); const slug = slugifyName($('#slug').value) || slugifyName(name); if (!name) return notify('Customer name is required'); if (!slug) return notify('URL slug is required'); if (clients.some((item) => item.id !== client.id && item.slug === slug)) return notify('This URL slug is already in use'); client.name = name; client.slug = slug; client.phone = $('#phone').value.trim(); client.whatsapp = $('#whatsapp').value.trim(); client.address = $('#address').value.trim(); client.currency = $('#currency').value; document.querySelectorAll('[data-category-name]').forEach((input) => { client.categories[Number(input.dataset.categoryName)].name = input.value.trim() || 'Untitled section'; }); document.querySelectorAll('[data-item-name]').forEach((input) => { const [categoryIndex, itemIndex] = input.dataset.itemName.split('-').map(Number); client.categories[categoryIndex].items[itemIndex].name = input.value.trim() || 'Untitled dish'; }); document.querySelectorAll('[data-item-description]').forEach((input) => { const [categoryIndex, itemIndex] = input.dataset.itemDescription.split('-').map(Number); client.categories[categoryIndex].items[itemIndex].description = input.value.trim(); }); document.querySelectorAll('[data-item-price]').forEach((input) => { const [categoryIndex, itemIndex] = input.dataset.itemPrice.split('-').map(Number); client.categories[categoryIndex].items[itemIndex].price = input.value.trim(); }); localStorage.setItem(STORAGE_KEY, JSON.stringify(clients)); render(); $('#savedState').textContent = 'Saved locally just now'; notify(`${client.name} saved locally`); try { await saveClients(); $('#savedState').textContent = 'Saved to cloud'; } catch (error) { notify(`Saved locally; cloud sync failed: ${error.message}`); } }
async function addClient() { const client = { id: `client-${Date.now()}`, name: 'New customer', slug: `new-customer-${Date.now()}`, slugManual: false, phone: '', whatsapp: '', address: '', currency: '€', languages: selectedLanguages().length ? selectedLanguages() : ['en'], categories: [{ name: 'Menu', items: [{ name: 'Signature dish', description: 'Describe this dish', price: '0.00' }] }], localCreatedAt: Date.now() }; clients.push(client); selectedId = client.id; render(); notify('New customer created'); try { await saveClients(); } catch (error) { notify(`Saved locally; cloud sync failed: ${error.message}`); } }

$('#businessName').addEventListener('input', () => { const slugInput = $('#slug'); if (slugInput.dataset.manual !== 'true') slugInput.value = slugifyName($('#businessName').value); }); $('#slug').addEventListener('input', () => { $('#slug').dataset.manual = 'true'; const client = selectedClient(); if (client) client.slugManual = true; }); $('#clientForm').addEventListener('submit', (event) => { event.preventDefault(); readForm(); }); $('#addClient').addEventListener('click', addClient); $('#addClientTop').addEventListener('click', addClient); $('#addCategory').addEventListener('click', () => { selectedClient().categories.push({ name: 'New section', items: [] }); saveClients().then(render).catch((error) => notify(error.message)); });
async function deleteClient() {
	if (clients.length === 1) return notify('Keep at least one client in the workspace');
	if (!confirm('Delete this client and their menu?')) return;
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
			notify(`Could not delete "${removed.name}": ${error.message}`);
			return;
		}
	}
	notify('Client deleted');
}
$('#deleteClient').addEventListener('click', deleteClient); if ($('#deleteClientTop')) $('#deleteClientTop').addEventListener('click', deleteClient); $('#copyUrl').addEventListener('click', async () => { await navigator.clipboard.writeText($('#qrUrl').textContent); notify('Menu link copied'); }); if ($('#saveChangesTop')) $('#saveChangesTop').addEventListener('click', () => readForm()); $('#downloadQr').addEventListener('click', async () => {
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
		notify(`Could not download QR code: ${error.message}`);
	}
});
function exportMenu() { const client = selectedClient(); const blob = new Blob([JSON.stringify({ name: client.name, slug: client.slug, categories: client.categories }, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${client.slug}-menu.json`; link.click(); URL.revokeObjectURL(link.href); }
$('#exportMenu').addEventListener('click', exportMenu); $('#importMenu').addEventListener('click', () => $('#menuJson').click()); $('#menuJson').addEventListener('change', async () => { const file = $('#menuJson').files[0]; if (!file) return; try { const imported = JSON.parse(await file.text()); const client = selectedClient(); client.categories = normalizeClient({ categories: imported.categories }).categories; if (imported.name) client.name = imported.name; if (imported.slug) client.slug = slugifyName(imported.slug); await saveClients(); render(); notify('Menu JSON imported'); } catch (error) { notify(`JSON import failed: ${error.message}`); } });
async function syncFromSupabase() {
	if (typeof supabaseClient === 'undefined') return;
	const { data, error } = await supabaseClient.from('menus').select('*').order('created_at');
	if (error) { notify(`Cloud sync unavailable; local customer data kept`); return; }
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
	if (typeof supabaseClient === 'undefined') { list.innerHTML = '<p class="client-empty">Cloud connection unavailable.</p>'; return; }
	const { data, error } = await supabaseClient
		.from('notifications_log')
		.select('kind, sent_to, provider_message_id, created_at, subscriptions(menu_slug, customers(contact_name))')
		.order('created_at', { ascending: false })
		.limit(50);
	if (error) { list.innerHTML = `<p class="client-empty">Could not load activity: ${escapeHtml(error.message)}</p>`; return; }
	if (!data || !data.length) { list.innerHTML = '<p class="client-empty">No automated emails have gone out yet.</p>'; return; }
	list.innerHTML = data.map((row) => {
		const who = row.subscriptions?.customers?.contact_name || row.subscriptions?.menu_slug || 'Unknown';
		const sent = !!row.provider_message_id;
		const when = new Date(row.created_at).toLocaleString();
		return `<div class="activity-row"><div><strong>${escapeHtml(row.kind)}</strong><small>${escapeHtml(who)} · to ${escapeHtml(row.sent_to)}</small></div><div class="activity-meta"><span class="activity-status ${sent ? 'sent' : 'failed'}">${sent ? 'Sent' : 'Failed'}</span><small>${escapeHtml(when)}</small></div></div>`;
	}).join('');
}

async function loadPhotoLibrary() {
	const grid = $('#photoLibraryGrid');
	if (!grid) return;
	grid.innerHTML = '<p class="client-empty">Loading…</p>';
	const { files, error } = await listLibraryPhotos();
	if (error) { grid.innerHTML = `<p class="client-empty">Could not load photos: ${escapeHtml(error)}</p>`; return; }
	if (!files.length) { grid.innerHTML = '<p class="client-empty">No photos uploaded yet.</p>'; return; }
	grid.innerHTML = files.map((file) => `<div class="photo-library-item"><img src="${escapeAttr(file.url)}" alt="" loading="lazy"><button type="button" class="icon-button photo-delete-x" data-delete-photo="${escapeAttr(file.name)}" title="Delete photo">×</button></div>`).join('');
	document.querySelectorAll('[data-delete-photo]').forEach((button) => button.addEventListener('click', async () => {
		if (!confirm('Delete this photo? This cannot be undone, and it will disappear from any menu still using it.')) return;
		const { error } = await supabaseClient.storage.from('menu-images').remove([`library/${button.dataset.deletePhoto}`]);
		if (error) { notify(`Could not delete photo: ${error.message}`); return; }
		notify('Photo deleted');
		await loadPhotoLibrary();
	}));
}
async function listLibraryPhotos() {
	if (typeof supabaseClient === 'undefined') return { error: 'Cloud connection unavailable.' };
	const { data, error } = await supabaseClient.storage.from('menu-images').list('library', { sortBy: { column: 'created_at', order: 'desc' } });
	if (error) return { error: error.message };
	const files = (data || []).filter((file) => file.id && file.name !== '.emptyFolderPlaceholder');
	return { files: files.map((file) => ({ name: file.name, url: supabaseClient.storage.from('menu-images').getPublicUrl(`library/${file.name}`).data.publicUrl })) };
}
async function openHeaderBgPicker() {
	const modal = $('#photoPickerModal');
	const grid = $('#photoPickerGrid');
	modal.hidden = false;
	grid.innerHTML = '<p class="client-empty">Loading…</p>';
	const { files, error } = await listLibraryPhotos();
	if (error) { grid.innerHTML = `<p class="client-empty">Could not load photos: ${escapeHtml(error)}</p>`; return; }
	if (!files.length) { grid.innerHTML = '<p class="client-empty">No photos in your library yet — upload one under Activity first.</p>'; return; }
	grid.innerHTML = files.map((file) => `<div class="photo-library-item photo-pick-item" data-pick-photo="${escapeAttr(file.url)}"><img src="${escapeAttr(file.url)}" alt="" loading="lazy"></div>`).join('');
	document.querySelectorAll('[data-pick-photo]').forEach((item) => item.addEventListener('click', async () => {
		selectedClient().header_background_url = item.dataset.pickPhoto;
		modal.hidden = true;
		try { await saveClients(); notify('Header background updated'); } catch (error) { notify(error.message); }
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
		notify('Header background uploaded');
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
if ($('#smartFoodMatchEnabled')) $('#smartFoodMatchEnabled').addEventListener('change', () => {
	selectedClient().smart_food_match_enabled = $('#smartFoodMatchEnabled').checked;
	saveClients().then(render).catch((error) => notify(error.message));
});
[$('#addonSendAnalytics'), $('#addonSendSfm')].forEach((button) => {
	if (!button) return;
	button.addEventListener('click', async () => {
		if (!button.dataset.link) return;
		await navigator.clipboard.writeText(button.dataset.link);
		notify('Add-ons link copied');
	});
});

if ($('#photoLibraryInput')) $('#photoLibraryInput').addEventListener('change', async () => {
	const input = $('#photoLibraryInput');
	const files = [...input.files];
	if (!files.length) return;
	try {
		for (let index = 0; index < files.length; index += 1) await uploadImage(files[index], `library/${Date.now()}-${index}`);
		notify(files.length > 1 ? 'Photos uploaded' : 'Photo uploaded');
		await loadPhotoLibrary();
	} catch (error) {
		notify(error.message);
	} finally {
		input.value = '';
	}
});

render();
syncFromSupabase();
syncSubscriptions();
loadActivity();
loadPhotoLibrary();

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
