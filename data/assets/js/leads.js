/* Free lead finder: searches OpenStreetMap (Overpass API, no key, no cost)
   for restaurants/bars/cafés in a chosen country, lets the user enrich a
   contact's website for an email/WhatsApp link on demand (via a small
   Edge Function, since fetching arbitrary websites needs to happen
   server-side to avoid CORS), export everything to CSV, and open a
   pre-filled, country-appropriate WhatsApp chat one contact at a time.
   Deliberately no bulk/automatic sending - the outgoing message is only
   ever opened, never sent, by this code; a human clicks "send" each time. */

const $ = (selector) => document.querySelector(selector);

// Large countries (Germany, France, ...) time out if all three amenity
// types are queried in one go against the whole country - runSearch()
// queries one type at a time instead. Multiple mirrors because the main
// instance frequently 504s under load; the others are used as fallback.
const OVERPASS_ENDPOINTS = [
	'https://overpass-api.de/api/interpreter',
	'https://overpass.kumi.systems/api/interpreter',
	'https://overpass.openstreetmap.ru/api/interpreter'
];
const RESULT_CAP = 500;
const SITE_URL = 'https://smart-menu-solutions.github.io/smart-menu-solutions/index.html';

// ISO 3166-1 alpha-2 code, display name, which message template to use, and
// the international calling code (used to fix up locally-formatted numbers
// picked up during enrichment - see withCallingCode()).
const COUNTRIES = [
	{ code: 'DE', name: 'Germany', lang: 'de', callingCode: '49' },
	{ code: 'AT', name: 'Austria', lang: 'de', callingCode: '43' },
	{ code: 'CH', name: 'Switzerland', lang: 'de', callingCode: '41' },
	{ code: 'GR', name: 'Greece', lang: 'el', callingCode: '30' },
	{ code: 'CY', name: 'Cyprus', lang: 'el', callingCode: '357' },
	{ code: 'IT', name: 'Italy', lang: 'it', callingCode: '39' },
	{ code: 'ES', name: 'Spain', lang: 'es', callingCode: '34' },
	{ code: 'FR', name: 'France', lang: 'fr', callingCode: '33' },
	{ code: 'PT', name: 'Portugal', lang: 'pt', callingCode: '351' },
	{ code: 'NL', name: 'Netherlands', lang: 'en', callingCode: '31' },
	{ code: 'BE', name: 'Belgium', lang: 'fr', callingCode: '32' },
	{ code: 'HR', name: 'Croatia', lang: 'en', callingCode: '385' },
	{ code: 'PL', name: 'Poland', lang: 'en', callingCode: '48' },
	{ code: 'GB', name: 'United Kingdom', lang: 'en', callingCode: '44' },
	{ code: 'IE', name: 'Ireland', lang: 'en', callingCode: '353' },
	{ code: 'MT', name: 'Malta', lang: 'en', callingCode: '356' }
];

const MESSAGE_TEMPLATES = {
	de: 'Hallo 👋\nNutzt ihr aktuell noch gedruckte Speisekarten?\nWir helfen Restaurants dabei, auf digitale QR-Menüs umzusteigen, die sich jederzeit in Sekunden aktualisieren lassen.\nVielleicht interessant für euch: {site}',
	en: 'Hi 👋\nAre you still using printed menus?\nWe help restaurants switch to digital QR menus that can be updated in seconds, anytime.\nMight be worth a look: {site}',
	el: 'Γεια σου 👋\nΧρησιμοποιείτε ακόμα έντυπα μενού;\nΒοηθάμε εστιατόρια να περάσουν σε ψηφιακά μενού QR που ενημερώνονται σε δευτερόλεπτα, όποτε θέλετε.\nΊσως σας ενδιαφέρει: {site}',
	it: 'Ciao 👋\nUsate ancora menu cartacei?\nAiutiamo i ristoranti a passare a menu digitali QR aggiornabili in pochi secondi, in qualsiasi momento.\nPotrebbe interessarvi: {site}',
	es: 'Hola 👋\n¿Todavía usáis cartas en papel?\nAyudamos a los restaurantes a pasar a menús digitales QR que se pueden actualizar en segundos, en cualquier momento.\nPuede que os interese: {site}',
	fr: 'Bonjour 👋\nUtilisez-vous encore des cartes papier ?\nNous aidons les restaurants à passer à des menus QR numériques modifiables en quelques secondes, à tout moment.\nCela pourrait vous intéresser : {site}',
	pt: 'Olá 👋\nAinda usam menus em papel?\nAjudamos restaurantes a mudar para menus digitais QR que podem ser atualizados em segundos, a qualquer momento.\nPode ser do vosso interesse: {site}'
};

const STORAGE_KEY = 'smartmenu.leads.v1';

const FILTERS = {
	all: () => true,
	whatsapp: (lead) => !!lead.whatsapp,
	email: (lead) => !!lead.email,
	phone: (lead) => !!lead.phone,
	contact: (lead) => !!(lead.whatsapp || lead.email || lead.phone),
	missing: (lead) => !(lead.whatsapp || lead.email || lead.phone)
};

let leads = [];
let currentCountry = COUNTRIES[0];
let currentFilter = 'all';

function visibleLeads() {
	return leads.filter(FILTERS[currentFilter] || FILTERS.all);
}

function saveLeads() {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ countryCode: currentCountry.code, leads }));
	} catch {
		// Storage full or unavailable - losing the cache on next refresh is
		// harmless, so this is deliberately silent.
	}
}

function restoreLeads() {
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
		if (!saved || !Array.isArray(saved.leads)) return;
		leads = saved.leads.map((lead) => ({ ...lead, enriching: false }));
		const country = COUNTRIES.find((entry) => entry.code === saved.countryCode);
		if (country) { currentCountry = country; $('#leadsCountry').value = country.code; }
	} catch {
		// Corrupt/old cache shape - ignore and start fresh.
	}
}

function notify(message) {
	const toast = $('#toast');
	toast.textContent = message;
	toast.classList.add('show');
	setTimeout(() => toast.classList.remove('show'), 2200);
}

function populateCountrySelect() {
	const select = $('#leadsCountry');
	select.innerHTML = COUNTRIES.map((country) => `<option value="${country.code}">${country.name}</option>`).join('');
	select.addEventListener('change', () => {
		currentCountry = COUNTRIES.find((country) => country.code === select.value) || COUNTRIES[0];
	});
	currentCountry = COUNTRIES[0];
}

// Most of these are tagged amenity=X in OSM, but hotels use tourism=hotel
// instead - not a real amenity in OSM's schema.
const TYPE_TAG_KEYS = { restaurant: 'amenity', bar: 'amenity', cafe: 'amenity', hotel: 'tourism' };

function overpassQuery(countryCode, type) {
	const key = TYPE_TAG_KEYS[type] || 'amenity';
	return `[out:json][timeout:50];
area["ISO3166-1"="${countryCode}"][admin_level=2]->.searchArea;
nwr["${key}"="${type}"](area.searchArea);
out center ${RESULT_CAP};`;
}

// Tries each mirror in turn (the main instance frequently 504s under load
// for whole-country queries) and returns the first successful response.
async function fetchOverpass(query) {
	let lastError;
	for (const endpoint of OVERPASS_ENDPOINTS) {
		try {
			const response = await fetch(endpoint, { method: 'POST', body: query });
			if (!response.ok) { lastError = new Error(`HTTP ${response.status}`); continue; }
			return await response.json();
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError || new Error('All Overpass mirrors failed');
}

function buildAddress(tags) {
	const parts = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
	const cityLine = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ');
	return [parts, cityLine].filter(Boolean).join(', ');
}

function normalizeWhatsapp(raw) {
	if (!raw) return '';
	return String(raw).replace('https://wa.me/', '').replace('https://api.whatsapp.com/send?phone=', '').replace(/[^\d+]/g, '');
}

// Numbers pulled from a site's tel: link (see the scrape-website Edge
// Function) are usually written in local format with no country code,
// which would produce a wa.me link for the wrong country. Prepends the
// searched country's calling code unless the number already looks
// international (already has it, or is long enough to plausibly be one).
function withCallingCode(digits) {
	if (!digits) return '';
	const code = currentCountry.callingCode;
	if (!code || digits.startsWith(code) || digits.length > 11) return digits;
	return code + digits.replace(/^0+/, '');
}

// OSM website tags frequently omit the protocol (e.g. "cafejubilee.com"),
// which breaks both the table's link and the enrich fetch (relative URL,
// or Deno's fetch rejects it outright).
function normalizeWebsite(raw) {
	if (!raw) return '';
	const trimmed = raw.trim();
	return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function elementToLead(element) {
	const tags = element.tags || {};
	if (!tags.name) return null;

	const phone = tags.phone || tags['contact:phone'] || '';
	const website = normalizeWebsite(tags.website || tags['contact:website'] || '');
	const email = tags.email || tags['contact:email'] || '';
	const whatsapp = normalizeWhatsapp(tags['contact:whatsapp']);

	// No phone, website, email, or WhatsApp means there's no way to reach
	// this place and nothing to enrich either - skip it instead of leaving
	// a dead row (no working buttons) cluttering the results.
	if (!phone && !website && !email && !whatsapp) return null;

	return {
		id: `${element.type}/${element.id}`,
		name: tags.name,
		address: buildAddress(tags),
		phone, website, email, whatsapp,
		selected: false,
		enriching: false
	};
}

async function runSearch() {
	const types = $('#leadsType').value === 'all' ? ['restaurant', 'bar', 'cafe', 'hotel'] : [$('#leadsType').value];
	const status = $('#leadsStatus');
	$('#leadsSearch').disabled = true;

	// Clear the old result set immediately instead of leaving it on screen
	// while the new search runs - otherwise it looks like the new search
	// already finished when it's really still showing stale data.
	leads = [];
	render();

	const seen = new Set();
	const collected = [];
	const failedTypes = [];

	for (const type of types) {
		status.textContent = `Searching ${currentCountry.name} - ${type}${types.length > 1 ? ` (${types.indexOf(type) + 1}/${types.length})` : ''}…`;
		try {
			const data = await fetchOverpass(overpassQuery(currentCountry.code, type));
			(data.elements || []).forEach((element) => {
				const lead = elementToLead(element);
				if (lead && !seen.has(lead.id)) { seen.add(lead.id); collected.push(lead); }
			});
		} catch (error) {
			failedTypes.push(type);
		}
	}

	leads = collected;
	$('#leadsSearch').disabled = false;

	if (!leads.length && failedTypes.length) {
		status.textContent = `Search failed for ${currentCountry.name} (${failedTypes.join(', ')}) - Overpass may be busy, try again shortly.`;
		notify('Search failed - Overpass API may be busy, try again shortly');
		render();
		return;
	}

	status.textContent = `${leads.length} result${leads.length === 1 ? '' : 's'} for ${currentCountry.name}` +
		(failedTypes.length ? ` (${failedTypes.join(', ')} timed out - try again to fill those in)` : '') + '.';
	saveLeads();
	render();
}

async function enrichLead(lead) {
	if (!lead.website || lead.enriching) return;
	lead.enriching = true;
	render();
	try {
		const response = await fetch(`${AUTH_CONFIG.supabaseUrl}/functions/v1/scrape-website`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', apikey: AUTH_CONFIG.supabasePublishableKey },
			body: JSON.stringify({ url: lead.website })
		});
		const data = await response.json();
		if (!response.ok) throw new Error(data.error || 'Could not read that website');
		lead.email = lead.email || data.email || '';
		lead.whatsapp = lead.whatsapp || withCallingCode(normalizeWhatsapp(data.whatsapp)) || '';
		lead.phone = lead.phone || data.phone || '';
		notify(`Enriched ${lead.name}`);
		saveLeads();
	} catch (error) {
		notify(`Could not enrich ${lead.name}: ${error.message}`);
	} finally {
		lead.enriching = false;
		render();
	}
}

function openWhatsapp(lead) {
	const number = lead.whatsapp || lead.phone;
	if (!number) { notify('No phone/WhatsApp number for this lead yet'); return; }
	const template = MESSAGE_TEMPLATES[currentCountry.lang] || MESSAGE_TEMPLATES.en;
	const message = template.replace('{name}', lead.name).replace('{site}', SITE_URL);
	const digits = String(number).replace(/[^\d]/g, '');
	window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, '_blank');
}

function selectedLeads() {
	return leads.filter((lead) => lead.selected);
}

function clearLeads() {
	leads = [];
	localStorage.removeItem(STORAGE_KEY);
	$('#leadsStatus').textContent = 'Cleared - run a search to start again.';
	render();
}

// If the user checked specific rows, that's a deliberate shortlist - export
// just those. Otherwise fall back to everything the current filter shows.
function rowsToExport() {
	const checked = selectedLeads();
	return checked.length ? checked : visibleLeads();
}

function exportNotice(rows) {
	const wasSelection = rows.length && rows.length === selectedLeads().length;
	notify(`Exported ${rows.length} ${wasSelection ? 'selected ' : ''}lead${rows.length === 1 ? '' : 's'}`);
}

// A plain CSV's delimiter (comma vs semicolon) and encoding depend on the
// reader's Windows regional settings, which kept guessing wrong when opened
// directly in Excel (everything crammed into column A, Greek text garbled).
// Excel has always accepted an HTML table saved with an .xls extension and
// opens it as a real, already split spreadsheet - no delimiter or encoding
// guessing involved. This is the export button for viewing/managing the
// list in Excel.
function exportExcel() {
	const rows = rowsToExport();
	if (!rows.length) { notify('Nothing to export - run a search or loosen the filter'); return; }
	const header = ['Name', 'Address', 'Phone', 'Email', 'WhatsApp', 'Website'];
	const keys = ['name', 'address', 'phone', 'email', 'whatsapp', 'website'];
	const headRow = `<tr>${header.map((label) => `<th>${escapeHtml(label)}</th>`).join('')}</tr>`;
	const bodyRows = rows.map((lead) => `<tr>${keys.map((key) => `<td>${escapeHtml(lead[key])}</td>`).join('')}</tr>`).join('');
	const html = `<html><head><meta charset="UTF-8"></head><body><table border="1">${headRow}${bodyRows}</table></body></html>`;
	const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
	const link = document.createElement('a');
	link.href = URL.createObjectURL(blob);
	link.download = `leads-${currentCountry.code.toLowerCase()}.xls`;
	link.click();
	URL.revokeObjectURL(link.href);
	exportNotice(rows);
}

// A real .csv for importing into external bulk-messaging tools (WATI,
// Zoko, Twilio, ...), which is what they expect instead of the .xls trick
// above. Semicolon-delimited (the default CSV convention on German/most
// European Windows installs, since comma doubles as the decimal separator
// there) plus a UTF-8 BOM, so double-clicking it also opens as a correctly
// split, correctly encoded table in Excel - most CSV importers accept
// either delimiter and auto-detect it regardless.
function exportCsv() {
	const rows = rowsToExport();
	if (!rows.length) { notify('Nothing to export - run a search or loosen the filter'); return; }
	const header = ['name', 'address', 'phone', 'email', 'whatsapp', 'website'];
	const csv = [header.join(';')].concat(
		rows.map((lead) => header.map((key) => `"${String(lead[key] || '').replace(/"/g, '""')}"`).join(';'))
	).join('\r\n');
	const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
	const link = document.createElement('a');
	link.href = URL.createObjectURL(blob);
	link.download = `leads-${currentCountry.code.toLowerCase()}.csv`;
	link.click();
	URL.revokeObjectURL(link.href);
	exportNotice(rows);
}

function escapeHtml(value) {
	return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function render() {
	const body = $('#leadsBody');
	const visible = visibleLeads();
	$('#leadsCount').textContent = leads.length && visible.length !== leads.length
		? `${visible.length} shown / ${leads.length} found`
		: `${leads.length} found`;

	if (!leads.length) {
		body.innerHTML = '<tr><td colspan="8" class="leads-empty">Run a search to see results here.</td></tr>';
		return;
	}
	if (!visible.length) {
		body.innerHTML = '<tr><td colspan="8" class="leads-empty">No results match this filter.</td></tr>';
		return;
	}

	body.innerHTML = visible.map((lead) => `
		<tr>
			<td><input type="checkbox" data-select="${lead.id}" ${lead.selected ? 'checked' : ''}></td>
			<td>${escapeHtml(lead.name)}</td>
			<td>${escapeHtml(lead.address) || '<span class="leads-empty">-</span>'}</td>
			<td>${escapeHtml(lead.phone) || '<span class="leads-empty">-</span>'}</td>
			<td>${lead.website ? `<a href="${escapeHtml(lead.website)}" target="_blank" rel="noopener">link</a>` : '<span class="leads-empty">-</span>'}</td>
			<td>${escapeHtml(lead.email) || '<span class="leads-empty">-</span>'}</td>
			<td>${escapeHtml(lead.whatsapp) || '<span class="leads-empty">-</span>'}</td>
			<td class="leads-actions-cell">
				<button class="button button-ghost" type="button" data-enrich="${lead.id}" ${!lead.website || lead.enriching ? 'disabled' : ''}>${lead.enriching ? 'Enriching…' : 'Enrich'}</button>
				<button class="button button-primary" type="button" data-whatsapp="${lead.id}" ${!(lead.whatsapp || lead.phone) ? 'disabled' : ''}>WhatsApp</button>
			</td>
		</tr>
	`).join('');
}

function wireEvents() {
	$('#leadsSearch').addEventListener('click', runSearch);
	$('#leadsExport').addEventListener('click', exportExcel);
	$('#leadsExportCsv').addEventListener('click', exportCsv);
	$('#leadsClear').addEventListener('click', clearLeads);
	$('#leadsSelectAll').addEventListener('change', (event) => {
		visibleLeads().forEach((lead) => { lead.selected = event.target.checked; });
		render();
	});
	$('#leadsFilter').addEventListener('change', (event) => {
		currentFilter = event.target.value;
		render();
	});
	$('#leadsBody').addEventListener('click', (event) => {
		const enrichId = event.target.dataset.enrich;
		const whatsappId = event.target.dataset.whatsapp;
		if (enrichId) enrichLead(leads.find((lead) => lead.id === enrichId));
		if (whatsappId) openWhatsapp(leads.find((lead) => lead.id === whatsappId));
	});
	$('#leadsBody').addEventListener('change', (event) => {
		const selectId = event.target.dataset.select;
		if (!selectId) return;
		const lead = leads.find((item) => item.id === selectId);
		if (lead) lead.selected = event.target.checked;
	});
}

populateCountrySelect();
restoreLeads();
wireEvents();
render();
if (leads.length) $('#leadsStatus').textContent = `Restored ${leads.length} result${leads.length === 1 ? '' : 's'} for ${currentCountry.name} from your last search.`;
