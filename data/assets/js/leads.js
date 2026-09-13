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

// ISO 3166-1 alpha-2 code, display name, and which message template to use.
const COUNTRIES = [
	{ code: 'DE', name: 'Germany', lang: 'de' },
	{ code: 'AT', name: 'Austria', lang: 'de' },
	{ code: 'CH', name: 'Switzerland', lang: 'de' },
	{ code: 'GR', name: 'Greece', lang: 'el' },
	{ code: 'CY', name: 'Cyprus', lang: 'el' },
	{ code: 'IT', name: 'Italy', lang: 'it' },
	{ code: 'ES', name: 'Spain', lang: 'es' },
	{ code: 'FR', name: 'France', lang: 'fr' },
	{ code: 'PT', name: 'Portugal', lang: 'pt' },
	{ code: 'NL', name: 'Netherlands', lang: 'en' },
	{ code: 'BE', name: 'Belgium', lang: 'fr' },
	{ code: 'HR', name: 'Croatia', lang: 'en' },
	{ code: 'PL', name: 'Poland', lang: 'en' },
	{ code: 'GB', name: 'United Kingdom', lang: 'en' },
	{ code: 'IE', name: 'Ireland', lang: 'en' },
	{ code: 'MT', name: 'Malta', lang: 'en' }
];

const MESSAGE_TEMPLATES = {
	de: 'Hallo {name} 👋 Nutzt ihr noch eine gedruckte Speisekarte? Wir bauen digitale QR-Menüs, die man in Sekunden aktualisieren kann - ohne Druckkosten. Kurzer Blick lohnt sich: {site}',
	en: 'Hi {name} 👋 Still using a printed menu? We build digital QR menus you can update in seconds - no printing costs. Worth a quick look: {site}',
	el: 'Γεια σου {name} 👋 Χρησιμοποιείτε ακόμα έντυπο μενού; Φτιάχνουμε ψηφιακά μενού QR που ενημερώνονται σε δευτερόλεπτα, χωρίς κόστος εκτύπωσης. Ρίξε μια ματιά: {site}',
	it: 'Ciao {name} 👋 Usate ancora il menu cartaceo? Creiamo menu digitali QR aggiornabili in pochi secondi, senza costi di stampa. Dai un\'occhiata: {site}',
	es: 'Hola {name} 👋 ¿Todavía usáis carta en papel? Creamos menús digitales QR que se actualizan en segundos, sin costes de impresión. Échale un vistazo: {site}',
	fr: 'Bonjour {name} 👋 Vous utilisez encore une carte papier ? Nous créons des menus QR numériques modifiables en quelques secondes, sans frais d\'impression. À voir ici : {site}',
	pt: 'Olá {name} 👋 Ainda usam menu em papel? Criamos menus digitais QR atualizáveis em segundos, sem custos de impressão. Vale a pena ver: {site}'
};

let leads = [];
let currentCountry = COUNTRIES[0];

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

function elementToLead(element) {
	const tags = element.tags || {};
	if (!tags.name) return null;
	return {
		id: `${element.type}/${element.id}`,
		name: tags.name,
		address: buildAddress(tags),
		phone: tags.phone || tags['contact:phone'] || '',
		website: tags.website || tags['contact:website'] || '',
		email: tags.email || tags['contact:email'] || '',
		whatsapp: normalizeWhatsapp(tags['contact:whatsapp']),
		selected: false,
		enriching: false
	};
}

async function runSearch() {
	const types = $('#leadsType').value === 'all' ? ['restaurant', 'bar', 'cafe', 'hotel'] : [$('#leadsType').value];
	const status = $('#leadsStatus');
	$('#leadsSearch').disabled = true;

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
		lead.whatsapp = lead.whatsapp || normalizeWhatsapp(data.whatsapp) || '';
		lead.phone = lead.phone || data.phone || '';
		notify(`Enriched ${lead.name}`);
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

function exportCsv() {
	const rows = leads.length ? leads : [];
	if (!rows.length) { notify('Nothing to export yet - run a search first'); return; }
	const header = ['name', 'address', 'phone', 'email', 'whatsapp', 'website'];
	const csv = [header.join(',')].concat(
		rows.map((lead) => header.map((key) => `"${String(lead[key] || '').replace(/"/g, '""')}"`).join(','))
	).join('\n');
	const blob = new Blob([csv], { type: 'text/csv' });
	const link = document.createElement('a');
	link.href = URL.createObjectURL(blob);
	link.download = `leads-${currentCountry.code.toLowerCase()}.csv`;
	link.click();
	URL.revokeObjectURL(link.href);
}

function escapeHtml(value) {
	return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function render() {
	const body = $('#leadsBody');
	$('#leadsCount').textContent = `${leads.length} found`;

	if (!leads.length) {
		body.innerHTML = '<tr><td colspan="8" class="leads-empty">Run a search to see results here.</td></tr>';
		return;
	}

	body.innerHTML = leads.map((lead) => `
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
	$('#leadsExport').addEventListener('click', exportCsv);
	$('#leadsSelectAll').addEventListener('change', (event) => {
		leads.forEach((lead) => { lead.selected = event.target.checked; });
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
wireEvents();
