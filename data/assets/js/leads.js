/* Free lead finder: searches OpenStreetMap (Overpass API, no key, no cost)
   for restaurants/bars/cafés in a chosen country, lets the user enrich a
   contact's website for an email/WhatsApp/Instagram handle on demand (via a
   small Edge Function, since fetching arbitrary websites needs to happen
   server-side to avoid CORS), export everything to CSV, and open a
   pre-filled, country-appropriate WhatsApp chat, email, or Instagram DM
   (message copied to the clipboard, profile opened - see openInstagram())
   one contact at a time - whichever contact channel that lead has.
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
// A single city is small enough that Overpass answers in a few seconds even
// for thousands of places (Hamburg: ~2200 restaurants in ~3s), so it doesn't
// need the tight per-type cap a whole-country query does.
const CITY_RESULT_CAP = 3000;
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

// TomTom is a second, free source used for city searches (see tomtomStage()).
// The API key is deliberately NOT in this file - the repo is public - it is
// asked for once and kept in this browser's localStorage. TomTom returns at
// most 100 places per request, so a city is covered with a grid of
// requests; category ids come from TomTom's poiCategories list.
const TOMTOM_URL = 'https://api.tomtom.com/search/2/categorySearch/.json';
const TOMTOM_KEY_STORAGE = 'smartmenu.leads.tomtomkey';
const TOMTOM_CATEGORY = { restaurant: '7315', bar: '9379004', cafe: '9376', hotel: '7314' };
const TOMTOM_MAX_POINTS = 16;
const TOMTOM_MAX_RADIUS = 8000;
const TOMTOM_WINDOW_KM = 12;
const ENRICH_CONCURRENCY = 3;
const SITE_URL = 'https://smartmenusolutions.com/';

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

// The main cities offered in the City dropdown for each country. Loading
// "every city" live from OpenStreetMap kept timing out for big countries
// (Germany, UK), so this is a fixed list of the larger ones - anything else
// is reachable via the dropdown's "Other city..." entry. English names,
// since that's what the place lookup (findCityArea()) resolves reliably.
const CITIES = {
	DE: ["Augsburg","Berlin","Bielefeld","Bochum","Bonn","Braunschweig","Bremen","Chemnitz","Dortmund","Dresden","Duisburg","Düsseldorf","Erfurt","Essen","Frankfurt am Main","Freiburg im Breisgau","Gelsenkirchen","Hamburg","Hannover","Heidelberg","Karlsruhe","Kassel","Kiel","Köln","Leipzig","Lübeck","Magdeburg","Mainz","Mannheim","Mönchengladbach","München","Münster","Nürnberg","Potsdam","Regensburg","Rostock","Saarbrücken","Stuttgart","Wiesbaden","Wuppertal"],
	AT: ["Bregenz","Dornbirn","Eisenstadt","Graz","Innsbruck","Klagenfurt","Linz","Salzburg","St. Pölten","Villach","Wels","Wien"],
	CH: ["Basel","Bern","Chur","Geneva","Lausanne","Lucerne","Lugano","St. Gallen","Winterthur","Zug","Zurich"],
	GR: ["Athens","Chania","Corfu","Heraklion","Ioannina","Kalamata","Kavala","Kos","Larissa","Mykonos","Patras","Rethymno","Rhodes","Thessaloniki","Volos","Zakynthos"],
	CY: ["Ayia Napa","Larnaca","Limassol","Nicosia","Paphos","Paralimni","Polis Chrysochous","Protaras"],
	IT: ["Bari","Bergamo","Bologna","Brescia","Cagliari","Catania","Florence","Genoa","Milan","Naples","Padua","Palermo","Parma","Perugia","Pisa","Rimini","Rome","Trieste","Turin","Venice","Verona"],
	ES: ["Alicante","Barcelona","Bilbao","Cádiz","Córdoba","Granada","Ibiza","Las Palmas","Madrid","Málaga","Marbella","Murcia","Palma","Pamplona","San Sebastián","Santa Cruz de Tenerife","Seville","Valencia","Valladolid","Zaragoza"],
	FR: ["Avignon","Bordeaux","Cannes","Dijon","Grenoble","Le Havre","Lille","Lyon","Marseille","Montpellier","Nantes","Nice","Nîmes","Paris","Reims","Rennes","Rouen","Strasbourg","Toulon","Toulouse"],
	PT: ["Albufeira","Aveiro","Braga","Cascais","Coimbra","Évora","Faro","Funchal","Lagos","Lisbon","Porto","Setúbal"],
	NL: ["Amsterdam","Arnhem","Breda","Delft","Eindhoven","Groningen","Haarlem","Leiden","Maastricht","Nijmegen","Rotterdam","The Hague","Tilburg","Utrecht","Zwolle"],
	BE: ["Antwerp","Bruges","Brussels","Charleroi","Ghent","Leuven","Liège","Mechelen","Namur","Ostend"],
	HR: ["Dubrovnik","Hvar","Osijek","Pula","Rijeka","Rovinj","Split","Šibenik","Zadar","Zagreb"],
	PL: ["Białystok","Bydgoszcz","Gdańsk","Katowice","Kraków","Lublin","Łódź","Poznań","Rzeszów","Sopot","Szczecin","Toruń","Warsaw","Wrocław","Zakopane"],
	GB: ["Bath","Belfast","Birmingham","Bournemouth","Brighton","Bristol","Cambridge","Cardiff","Edinburgh","Glasgow","Leeds","Liverpool","London","Manchester","Newcastle upon Tyne","Nottingham","Oxford","Plymouth","Sheffield","Southampton","York"],
	IE: ["Cork","Drogheda","Dublin","Dundalk","Galway","Kilkenny","Limerick","Sligo","Waterford"],
	MT: ["Bugibba","Mdina","Mosta","Rabat","Sliema","St. Julian's","Valletta","Victoria"]
};
const OTHER_CITY = '__other';

// Three-stage outreach sequence: first message -> (7 days) -> reminder ->
// (7 days) -> final message. See leadTab()/nextAction() for the stage
// machine, and the module doc comment - sending is always a manual click,
// only the "is this due yet" timing is automatic.
const FOLLOWUP_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const MESSAGE_TEMPLATES = {
	de: 'Hallo 👋\nKurze Frage: Nutzt ihr aktuell noch gedruckte Speisekarten?\nWir haben eine Lösung, mit der ihr eure Speisekarte per QR-Code jederzeit aktualisieren könnt, ganz ohne Neudruck.\nSchaut gerne mal rein: {site}',
	en: 'Hi 👋\nQuick question: are you still using printed menus?\nWe have a solution that lets you update your menu via QR code anytime, no reprinting needed.\nFeel free to take a look: {site}',
	el: 'Γεια σου 👋\nΜια γρήγορη ερώτηση: χρησιμοποιείτε ακόμα έντυπα μενού;\nΈχουμε μια λύση που σας επιτρέπει να ενημερώνετε το μενού σας μέσω QR code όποτε θέλετε, χωρίς νέα εκτύπωση.\nΡίξτε μια ματιά: {site}',
	it: 'Ciao 👋\nUna domanda veloce: usate ancora menu cartacei?\nAbbiamo una soluzione che vi permette di aggiornare il menu tramite codice QR in qualsiasi momento, senza dover ristampare.\nDate un\'occhiata: {site}',
	es: 'Hola 👋\nUna pregunta rápida: ¿seguís usando cartas en papel?\nTenemos una solución que os permite actualizar vuestra carta mediante código QR en cualquier momento, sin reimprimir.\nEchad un vistazo: {site}',
	fr: 'Bonjour 👋\nPetite question : utilisez-vous encore des cartes papier ?\nNous avons une solution qui vous permet de mettre à jour votre carte via un QR code à tout moment, sans réimpression.\nN\'hésitez pas à jeter un œil : {site}',
	pt: 'Olá 👋\nUma pergunta rápida: ainda usam menus em papel?\nTemos uma solução que vos permite atualizar o menu através de um código QR a qualquer momento, sem reimpressão.\nDeem uma vista de olhos: {site}'
};

const REMINDER_TEMPLATES = {
	de: 'Hallo 👋\nIch wollte nur kurz nachhaken, falls meine letzte Nachricht untergegangen ist.\nMit unserem QR-Menü könnt ihr Änderungen an der Speisekarte jederzeit in wenigen Sekunden vornehmen.\nHier findet ihr alle Infos: {site}',
	en: 'Hi 👋\nJust wanted to quickly follow up in case my last message got buried.\nWith our QR menu you can make changes to your menu anytime in just seconds.\nHere\'s all the info: {site}',
	el: 'Γεια σου 👋\nΉθελα απλώς να επανέλθω σύντομα, μήπως το προηγούμενο μήνυμά μου πέρασε απαρατήρητο.\nΜε το ψηφιακό μας μενού QR μπορείτε να κάνετε αλλαγές στο μενού σας όποτε θέλετε, μέσα σε λίγα δευτερόλεπτα.\nΕδώ θα βρείτε όλες τις πληροφορίες: {site}',
	it: 'Ciao 👋\nVolevo solo fare un piccolo follow-up, nel caso il mio ultimo messaggio fosse passato inosservato.\nCon il nostro menu QR potete modificare il menu in qualsiasi momento, in pochi secondi.\nQui trovate tutte le informazioni: {site}',
	es: 'Hola 👋\nSolo quería hacer un seguimiento rápido, por si mi último mensaje pasó desapercibido.\nCon nuestro menú QR podéis hacer cambios en la carta en cualquier momento, en cuestión de segundos.\nAquí tenéis toda la información: {site}',
	fr: 'Bonjour 👋\nJe voulais juste faire un petit rappel, au cas où mon dernier message serait passé inaperçu.\nAvec notre menu QR, vous pouvez modifier votre carte à tout moment, en quelques secondes.\nVoici toutes les infos : {site}',
	pt: 'Olá 👋\nSó queria fazer um pequeno seguimento, caso a minha última mensagem tenha passado despercebida.\nCom o nosso menu QR podem fazer alterações ao menu a qualquer momento, em poucos segundos.\nAqui têm todas as informações: {site}'
};

const FINAL_TEMPLATES = {
	de: 'Hallo 👋\nDas ist meine letzte Nachricht, versprochen 😊\nFalls ihr irgendwann auf eine digitale Speisekarte umsteigen möchtet, könnt ihr euch hier alles ansehen: {site}\nVielen Dank und weiterhin viel Erfolg! 🍀',
	en: 'Hi 👋\nThis is my last message, promise 😊\nIf you ever decide to switch to a digital menu, you can check everything out here: {site}\nThank you and all the best! 🍀',
	el: 'Γεια σου 👋\nΑυτό είναι το τελευταίο μου μήνυμα, το υπόσχομαι 😊\nΑν κάποια στιγμή θελήσετε να περάσετε σε ψηφιακό μενού, μπορείτε να δείτε τα πάντα εδώ: {site}\nΕυχαριστώ πολύ και καλή επιτυχία! 🍀',
	it: 'Ciao 👋\nQuesto è il mio ultimo messaggio, promesso 😊\nSe in futuro vorrete passare a un menu digitale, potete dare un\'occhiata qui: {site}\nGrazie mille e buon lavoro! 🍀',
	es: 'Hola 👋\nEste es mi último mensaje, lo prometo 😊\nSi en algún momento queréis pasaros a una carta digital, podéis ver todo aquí: {site}\n¡Muchas gracias y mucho éxito! 🍀',
	fr: 'Bonjour 👋\nC\'est mon dernier message, promis 😊\nSi un jour vous souhaitez passer à une carte numérique, vous pouvez tout voir ici : {site}\nMerci beaucoup et bonne continuation ! 🍀',
	pt: 'Olá 👋\nEsta é a minha última mensagem, prometido 😊\nSe um dia quiserem mudar para um menu digital, podem ver tudo aqui: {site}\nMuito obrigado e muito sucesso! 🍀'
};

// Email needs a subject line, unlike WhatsApp - one per template stage/
// language, same tone as the matching body above.
const MESSAGE_SUBJECTS = {
	de: 'Digitale Speisekarte statt Neudruck?',
	en: 'Digital menu instead of reprinting?',
	el: 'Ψηφιακό μενού αντί για νέα εκτύπωση;',
	it: 'Menu digitale invece di ristampare?',
	es: '¿Carta digital en lugar de reimprimir?',
	fr: 'Une carte numérique plutôt qu\'une réimpression ?',
	pt: 'Menu digital em vez de reimpressão?'
};
const REMINDER_SUBJECTS = {
	de: 'Kurze Erinnerung: digitale Speisekarte',
	en: 'Quick reminder: digital menu',
	el: 'Σύντομη υπενθύμιση: ψηφιακό μενού',
	it: 'Piccolo promemoria: menu digitale',
	es: 'Recordatorio rápido: carta digital',
	fr: 'Petit rappel : carte numérique',
	pt: 'Lembrete rápido: menu digital'
};
const FINAL_SUBJECTS = {
	de: 'Letzte Nachricht: digitale Speisekarte',
	en: 'Last message: digital menu',
	el: 'Τελευταίο μήνυμα: ψηφιακό μενού',
	it: 'Ultimo messaggio: menu digitale',
	es: 'Último mensaje: carta digital',
	fr: 'Dernier message : carte numérique',
	pt: 'Última mensagem: menu digital'
};

const STORAGE_KEY = 'smartmenu.leads.v1';

// Separate from STORAGE_KEY (which only ever holds the CURRENT search's
// result set for one country/type) - this is a running record of every
// lead ever seen, keyed by OSM/manual id, that survives switching country
// or type. Without it, searching a different country replaced `leads`
// wholesale and any outreach progress or enrichment for the leads that had
// been visible a moment ago vanished from both the screen and localStorage
// the instant saveLeads() ran - there was no way back to it even by
// re-searching the original country, since that fresh OSM fetch has no
// memory of stage/msgSentAt either. archive[id] is kept in sync on every
// saveLeads() call and consulted by runSearch() so a lead found again -
// today, next week, or after switching countries and back - always comes
// back with its real progress and any previously-enriched contact details.
const ARCHIVE_KEY = 'smartmenu.leads.archive.v1';
let archive = {};

const FILTERS = {
	all: () => true,
	whatsapp: (lead) => !!lead.whatsapp,
	email: (lead) => !!lead.email,
	phone: (lead) => !!lead.phone,
	instagram: (lead) => !!lead.instagram,
	contact: (lead) => !!(lead.whatsapp || lead.email || lead.phone || lead.instagram),
	missing: (lead) => !(lead.whatsapp || lead.email || lead.phone || lead.instagram)
};

let leads = [];
let currentCountry = COUNTRIES[0];
let currentFilter = 'all';
// 'all', 'sequence', 'reminder', 'final', or `list:<name>` - one tab per
// search ("Germany - Hamburg", "Cyprus - Limassol", ...) showing that
// search's not-yet-contacted leads. See listTabKey().
let currentStageTab = 'all';

// msgStage: 0 = never contacted, 1 = first message sent, 2 = reminder
// sent, 3 = final message sent (done, hidden from every tab). msgSentAt is
// when that last message went out - daysUntilDue() counts FOLLOWUP_DAYS
// forward from it to decide when the next one becomes sendable.
function daysUntilDue(lead) {
	if (!lead.msgSentAt) return 0;
	const elapsedDays = (Date.now() - lead.msgSentAt) / DAY_MS;
	return Math.max(0, Math.ceil(FOLLOWUP_DAYS - elapsedDays));
}

// Which of the four tabs a lead currently belongs in. A lead moves itself
// between "waiting" tabs and "action needed" tabs purely by elapsed time -
// no click needed to advance from Sequence into Reminder, for example.
// A manually-stopped lead (already a customer, asked not to be contacted,
// ...) is treated the same as "done" - hidden from every tab, no more
// follow-ups computed for it - since there's no reliable automatic way to
// tell from here whether someone converted (the lead finder and the real
// order/customer system don't share an ID).
function leadTab(lead) {
	if (lead.stopped) return 'done';
	const stage = lead.msgStage || 0;
	if (stage === 0) return 'new';
	if (stage === 3) return 'done';
	const due = daysUntilDue(lead) <= 0;
	if (stage === 1) return due ? 'reminder' : 'sequence';
	return due ? 'final' : 'reminder';
}

// The message (if any) a click on this lead's WhatsApp button should send
// right now, and what stage that advances it to. Returns null while a lead
// is still waiting out its 7 days - the UI shows a countdown instead of a
// button in that case.
function nextAction(lead) {
	const stage = lead.msgStage || 0;
	if (stage === 0) return { label: 'Send message', templates: MESSAGE_TEMPLATES, subjects: MESSAGE_SUBJECTS, nextStage: 1 };
	if (daysUntilDue(lead) > 0) return null;
	if (stage === 1) return { label: 'Send reminder', templates: REMINDER_TEMPLATES, subjects: REMINDER_SUBJECTS, nextStage: 2 };
	if (stage === 2) return { label: 'Send final', templates: FINAL_TEMPLATES, subjects: FINAL_SUBJECTS, nextStage: 3 };
	return null;
}

// Every lead belongs to the list (= the country/city search) it was found
// by. Leads saved before lists existed get theirs assigned in restoreLeads().
function leadListName(lead) {
	return lead.list || 'Other';
}

function listTabKey(listName) {
	return `list:${listName}`;
}

// "all" isn't a real stage - it's every lead that isn't done/stopped,
// shown together instead of filtered to one pipeline step. A list tab shows
// just that search's leads that haven't been messaged yet (what used to be
// the single "New List" tab, now one per search).
function matchesStageTab(lead, stageTab) {
	const tab = leadTab(lead);
	if (stageTab.startsWith('list:')) return tab === 'new' && leadListName(lead) === stageTab.slice(5);
	return stageTab === 'all' ? tab !== 'done' : tab === stageTab;
}

// Lower number = shown higher up: leads reachable by direct message first
// (WhatsApp + Instagram, then WhatsApp, then Instagram), then email, then
// everything else (phone only, ...). Leads in the same group keep the order
// they were found in.
function contactPriority(lead) {
	if (lead.whatsapp && lead.instagram) return 0;
	if (lead.whatsapp) return 1;
	if (lead.instagram) return 2;
	if (lead.email) return 3;
	return 4;
}

function visibleLeads() {
	return leads
		.filter((lead) => matchesStageTab(lead, currentStageTab))
		.filter(FILTERS[currentFilter] || FILTERS.all)
		.sort((a, b) => contactPriority(a) - contactPriority(b));
}

// `lists` maps each list name to how many of its leads are still "new", in
// the order the lists were first searched.
function stageTabCounts() {
	const counts = { all: 0, new: 0, sequence: 0, reminder: 0, final: 0, done: 0, lists: new Map() };
	leads.forEach((lead) => {
		const tab = leadTab(lead);
		counts[tab] = (counts[tab] || 0) + 1;
		if (tab !== 'done') counts.all += 1;
		const listName = leadListName(lead);
		counts.lists.set(listName, (counts.lists.get(listName) || 0) + (tab === 'new' ? 1 : 0));
	});
	return counts;
}

function saveLeads() {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ countryCode: currentCountry.code, leads }));
	} catch {
		// Storage full or unavailable - losing the cache on next refresh is
		// harmless, so this is deliberately silent.
	}
	updateArchive();
}

// Upserts every current lead into the cross-search archive (see ARCHIVE_KEY
// above) - called from saveLeads() so every place that already saves after
// a stage change, enrichment, or manual add keeps the archive current too,
// with no extra call sites to remember.
function updateArchive() {
	leads.forEach((lead) => {
		archive[lead.id] = {
			name: lead.name,
			msgStage: lead.msgStage || 0,
			msgSentAt: lead.msgSentAt || null,
			stopped: !!lead.stopped,
			email: lead.email || '',
			phone: lead.phone || '',
			whatsapp: lead.whatsapp || '',
			instagram: lead.instagram || ''
		};
	});
	try {
		localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
	} catch {
		// Same reasoning as saveLeads() above.
	}
}

function restoreArchive() {
	try {
		const saved = JSON.parse(localStorage.getItem(ARCHIVE_KEY));
		if (saved && typeof saved === 'object') archive = saved;
	} catch {
		// Corrupt/old cache shape - ignore and start fresh.
	}
}

function restoreLeads() {
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
		if (!saved || !Array.isArray(saved.leads)) return;
		const country = COUNTRIES.find((entry) => entry.code === saved.countryCode);
		// Leads saved before lists existed all came from one country-wide
		// search, so that country's name becomes their list.
		leads = saved.leads.map((lead) => ({ ...lead, enriching: false, list: lead.list || (country ? country.name : 'Other') }));
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
		populateCitySelect();
	});
	currentCountry = COUNTRIES[0];
	populateCitySelect();
}

// Whole country first, then the country's main cities, then a free-text
// escape hatch for any other place.
function populateCitySelect() {
	const select = $('#leadsCity');
	const options = ['<option value="">Whole country</option>']
		.concat((CITIES[currentCountry.code] || []).map((city) => `<option value="${escapeHtml(city)}">${escapeHtml(city)}</option>`))
		.concat(`<option value="${OTHER_CITY}">Other city…</option>`);
	select.innerHTML = options.join('');
	updateOtherCityInput();
}

function updateOtherCityInput() {
	const other = $('#leadsCityOther');
	other.hidden = $('#leadsCity').value !== OTHER_CITY;
	if (!other.hidden) other.focus();
}

// The city to search: '' for the whole country.
function selectedCity() {
	const value = $('#leadsCity').value;
	return value === OTHER_CITY ? $('#leadsCityOther').value.trim() : value;
}

// Most of these are tagged amenity=X in OSM, but hotels use tourism=hotel
// instead - not a real amenity in OSM's schema.
const TYPE_TAG_KEYS = { restaurant: 'amenity', bar: 'amenity', cafe: 'amenity', hotel: 'tourism' };

// With a place (a city, see findCityArea()) the search is limited to that
// city's area - or, when the city only has a map point and no boundary, to a
// CITY_RADIUS_M circle around it; without one it covers the whole country.
const CITY_RADIUS_M = 8000;

function overpassQuery(countryCode, type, place) {
	const key = TYPE_TAG_KEYS[type] || 'amenity';
	if (place && place.lat !== undefined) {
		return `[out:json][timeout:50];
nwr["${key}"="${type}"](around:${CITY_RADIUS_M},${place.lat},${place.lon});
out center ${CITY_RESULT_CAP};`;
	}
	const area = place ? `area(${place.areaId})->.searchArea;` : `area["ISO3166-1"="${countryCode}"][admin_level=2]->.searchArea;`;
	return `[out:json][timeout:50];
${area}
nwr["${key}"="${type}"](area.searchArea);
out center ${place ? CITY_RESULT_CAP : RESULT_CAP};`;
}

// Turns a city name into something Overpass can search in. Nominatim (OSM's
// geocoder) finds the place; Overpass area ids are the OSM relation id +
// 3600000000 (or way id + 2400000000). Prefers the city's admin boundary
// ({ areaId }); when there's only a map point (some cities, e.g. Athens,
// come back that way), returns { lat, lon } so the search can use a radius
// around it instead. Returns null when nothing is found at all.
async function findCityArea(city, countryCode) {
	const search = async (settlementOnly) => {
		const url = `${NOMINATIM_URL}?format=json&limit=5${settlementOnly ? '&featuretype=settlement' : ''}&countrycodes=${countryCode.toLowerCase()}&q=${encodeURIComponent(city)}`;
		const response = await fetch(url);
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		return response.json();
	};
	// Restricting to settlements avoids picking a street or shop of the
	// same name, but misses some places - fall back to an unrestricted search.
	let results = await search(true);
	if (!results.length) results = await search(false);
	// A search for "Limassol" also returns the whole district of that name;
	// the city/town boundary is the one meant, so prefer it.
	const boundaries = results.filter((result) => result.osm_type === 'relation' && result.class === 'boundary');
	const area = boundaries.find((result) => ['city', 'town', 'village', 'municipality'].includes(result.addresstype))
		|| boundaries[0]
		|| results.find((result) => result.osm_type === 'relation' || result.osm_type === 'way');
	// bbox ([south, north, west, east]) and center are only used to lay the
	// TomTom request grid over the city, not for the OpenStreetMap query.
	if (area) {
		return {
			areaId: (area.osm_type === 'relation' ? 3600000000 : 2400000000) + Number(area.osm_id),
			bbox: area.boundingbox ? area.boundingbox.map(Number) : null,
			center: { lat: Number(area.lat), lon: Number(area.lon) }
		};
	}
	const point = results.find((result) => result.lat && result.lon);
	return point ? { lat: Number(point.lat), lon: Number(point.lon), center: { lat: Number(point.lat), lon: Number(point.lon) } } : null;
}

// Tries each mirror in turn (the main instance frequently 504s under load
// for whole-country queries) and returns the first successful response.
async function fetchOverpass(query) {
	let lastError;
	for (const [index, endpoint] of OVERPASS_ENDPOINTS.entries()) {
		try {
			// Without a limit a dead mirror can keep the search "running" for
			// minutes - the main server gets the query's full time, the
			// fallbacks (often down entirely) only a short one.
			const response = await fetch(endpoint, { method: 'POST', body: query, signal: AbortSignal.timeout(index === 0 ? 70000 : 25000) });
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

// Stores just the bare handle (no @, no URL) so it prints cleanly in the
// table/exports and openInstagram() can build the profile link itself -
// strips a full instagram.com URL down to the handle if one was pasted in,
// same idea as normalizeWhatsapp() above.
function normalizeInstagram(raw) {
	if (!raw) return '';
	return String(raw).trim()
		.replace(/^@/, '')
		.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
		.replace(/\/.*$/, '')
		.replace(/[?#].*$/, '');
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

	// Many entries only carry a mobile number (tagged mobile / contact:mobile
	// instead of phone) - counting it gives more places the two contact
	// details they need to be listed.
	const phone = tags.phone || tags['contact:phone'] || tags.mobile || tags['contact:mobile'] || '';
	const website = normalizeWebsite(tags.website || tags['contact:website'] || '');
	const email = tags.email || tags['contact:email'] || '';
	const whatsapp = normalizeWhatsapp(tags['contact:whatsapp']);
	const instagram = normalizeInstagram(tags['contact:instagram'] || tags.instagram || '');

	// A place is only worth listing if it can actually be messaged: it needs
	// an email, WhatsApp number or Instagram handle. A phone number or a
	// website alone doesn't count - there's no call button, and many listings
	// had nothing but a link, which left a row with no working buttons
	// cluttering the results. Only applies to freshly found places; leads
	// already in a list are never dropped by this.
	if (!email && !whatsapp && !instagram) return null;

	return {
		id: `${element.type}/${element.id}`,
		name: tags.name,
		address: buildAddress(tags),
		phone, website, email, whatsapp, instagram,
		// Captured at search time, not read from currentCountry when a message
		// is sent - otherwise switching the country dropdown after searching
		// (without re-searching) would send a still-visible lead's message in
		// the wrong language, since currentCountry would have already moved on.
		lang: currentCountry.lang,
		selected: false,
		enriching: false,
		msgStage: 0,
		msgSentAt: null,
		stopped: false
	};
}

// Every search becomes (or adds to) a list named after the country and
// optional city - "Germany - Hamburg", "Cyprus - Limassol", or just
// "Germany" - and its leads are ADDED to what's already there rather than
// replacing it, so earlier searches (and their outreach progress) stay put.
async function runSearch() {
	const button = $('#leadsSearch');
	if (button.disabled) return;
	button.disabled = true;
	try {
		await performSearch();
	} finally {
		button.disabled = false;
	}
}

async function performSearch() {
	const types = $('#leadsType').value === 'all' ? ['restaurant', 'bar', 'cafe', 'hotel'] : [$('#leadsType').value];
	const status = $('#leadsStatus');
	const city = selectedCity();
	const listName = city ? `${currentCountry.name} - ${city}` : currentCountry.name;
	status.textContent = `Starting search for ${listName}…`;
	const wantTomtom = !!city && tomtomEnabled();
	const tomtomKey = wantTomtom ? getTomtomKey() : '';
	if (wantTomtom && !tomtomKey) notify('No TomTom key entered - searching OpenStreetMap only');

	let place = null;
	if (city) {
		status.textContent = `Looking up ${city}…`;
		try {
			place = await findCityArea(city, currentCountry.code);
		} catch (error) {
			status.textContent = `Could not look up ${city} (${error.message}) - try again shortly.`;
			return;
		}
		if (!place) {
			status.textContent = `Could not find "${city}" in ${currentCountry.name} - check the spelling.`;
			notify(`City "${city}" not found`);
			return;
		}
	}

	// A lead found again (same OSM id) is the same business - it stays in
	// the list it was first found in, with its progress, and only has its
	// blank contact fields filled in from the fresh result.
	const existingById = new Map(leads.map((lead) => [lead.id, lead]));
	const seen = new Set();
	const added = [];
	const failedTypes = [];

	for (const type of types) {
		status.textContent = `Searching ${listName} - ${type}${types.length > 1 ? ` (${types.indexOf(type) + 1}/${types.length})` : ''}…`;
		try {
			let data;
			try {
				data = await fetchOverpass(overpassQuery(currentCountry.code, type, place));
			} catch (error) {
				// The city's whole boundary can be too heavy for Overpass to
				// answer (e.g. a large island municipality) - a circle around
				// the centre is a light query that nearly always goes through.
				if (!(place && place.areaId && place.center)) throw error;
				status.textContent = `Searching ${listName} - ${type}: area search failed, trying the city centre…`;
				data = await fetchOverpass(overpassQuery(currentCountry.code, type, { lat: place.center.lat, lon: place.center.lon }));
			}
			(data.elements || []).forEach((element) => {
				const lead = elementToLead(element);
				if (!lead || seen.has(lead.id)) return;
				seen.add(lead.id);
				const existing = existingById.get(lead.id);
				if (existing) {
					['phone', 'website', 'email', 'whatsapp', 'instagram'].forEach((key) => { existing[key] = existing[key] || lead[key]; });
					return;
				}
				// The archive still covers a lead whose progress was recorded
				// but which is no longer in `leads` - see ARCHIVE_KEY's comment.
				const archived = archive[lead.id];
				if (archived) {
					Object.assign(lead, {
						msgStage: archived.msgStage || 0,
						msgSentAt: archived.msgSentAt || null,
						stopped: !!archived.stopped,
						email: lead.email || archived.email || '',
						phone: lead.phone || archived.phone || '',
						whatsapp: lead.whatsapp || archived.whatsapp || '',
						instagram: lead.instagram || archived.instagram || ''
					});
				}
				lead.list = listName;
				added.push(lead);
			});
		} catch (error) {
			failedTypes.push(type);
		}
	}

	const osmFailed = failedTypes.length === types.length;
	if (osmFailed) {
		status.textContent = `Search failed for ${listName} (${failedTypes.join(', ')}) - Overpass may be busy, try again shortly.`;
		notify('Search failed - Overpass API may be busy, try again shortly');
	} else if (!seen.size) {
		// A place legitimately having zero restaurants/bars/cafes/hotels in
		// OSM essentially never happens - a 0-result response almost always
		// means an Overpass mirror returned an incomplete/empty payload
		// without throwing.
		status.textContent = `0 results for ${listName} - that's unusual, Overpass may have returned an incomplete response. Try searching again.`;
		notify('Search returned nothing unexpectedly - try again');
	} else {
		leads = leads.concat(added);
		if (leads.some((lead) => leadListName(lead) === listName)) currentStageTab = listTabKey(listName);
		status.textContent = `${seen.size} result${seen.size === 1 ? '' : 's'} for ${listName}: ${added.length} new` +
			(seen.size - added.length ? `, ${seen.size - added.length} already in your lists` : '') +
			(failedTypes.length ? ` (${failedTypes.join(', ')} timed out - try again to fill those in)` : '') + '.';
		saveLeads();
		render();
		if (autoEnrichEnabled()) await autoEnrich(added);
	}

	if (tomtomKey) await tomtomStage({ types, place, listName, key: tomtomKey });
}

// quiet: no toast per lead (used by autoEnrich(), which reports progress in
// the status line instead - hundreds of toasts in a row would be noise).
// Reads the lead's website via the scrape-website Edge Function and fills in
// whichever contact fields are still blank. Throws if the site can't be read.
async function applyEnrichment(lead) {
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
	lead.instagram = lead.instagram || normalizeInstagram(data.instagram) || '';
}

async function enrichLead(lead, { quiet = false } = {}) {
	if (!lead.website || lead.enriching) return;
	lead.enriching = true;
	render();
	try {
		await applyEnrichment(lead);
		if (!quiet) notify(`Enriched ${lead.name}`);
		saveLeads();
	} catch (error) {
		if (!quiet) notify(`Could not enrich ${lead.name}: ${error.message}`);
	} finally {
		lead.enriching = false;
		render();
	}
}

const AUTO_ENRICH_KEY = 'smartmenu.leads.autoenrich';

function restoreAutoEnrich() {
	try {
		if (localStorage.getItem(AUTO_ENRICH_KEY) === '0') $('#leadsAutoEnrich').checked = false;
	} catch {
		// Storage unavailable - keep the default (on).
	}
}

function autoEnrichEnabled() {
	return $('#leadsAutoEnrich').checked;
}

// Runs right after a search on the leads it just added: fills in whichever
// of email/WhatsApp/Instagram they're missing from their own websites, one
// at a time (same reasoning as enrichAll()). Unticking the checkbox stops
// it after the lead currently in flight.
async function autoEnrich(newLeads) {
	const targets = newLeads.filter((lead) => lead.website && !(lead.email && lead.whatsapp && lead.instagram));
	if (!targets.length) return;
	const status = $('#leadsStatus');
	const summary = status.textContent;
	let done = 0;
	await runPool(targets, ENRICH_CONCURRENCY, async (lead) => {
		if (!autoEnrichEnabled()) return;
		status.textContent = `${summary} Enriching ${done + 1}/${targets.length}… (untick "Auto-enrich" to stop)`;
		await enrichLead(lead, { quiet: true });
		done += 1;
	});
	status.textContent = `${summary} Enriched ${done} of ${targets.length} from their websites.`;
}

// Runs `worker` over `items` with at most `limit` in flight at once.
async function runPool(items, limit, worker) {
	let next = 0;
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (next < items.length) {
			const item = items[next];
			next += 1;
			await worker(item);
		}
	}));
}

function tomtomEnabled() {
	return $('#leadsTomtom').checked;
}

// The key is typed into a field on the page (and remembered in this browser)
// rather than asked for in a prompt() dialog - those are easy to miss and
// browsers sometimes suppress them silently.
function getTomtomKey() {
	return $('#leadsTomtomKey').value.trim();
}

function restoreTomtomKey() {
	try {
		$('#leadsTomtomKey').value = localStorage.getItem(TOMTOM_KEY_STORAGE) || '';
	} catch {
		// Storage unavailable - the field just starts empty.
	}
}

// A grid of request centres over the city. TomTom returns only the 100
// places nearest to each centre, so one request can't cover a city; the grid
// is limited to a TOMTOM_WINDOW_KM window around the centre (the bounding
// box of a whole city-state or district can be dozens of km wide) and to
// TOMTOM_MAX_POINTS centres per category to stay inside the free daily quota.
function tomtomGrid(place) {
	const center = place.center;
	const cosLat = Math.cos(center.lat * Math.PI / 180);
	const [south, north, west, east] = place.bbox || [center.lat, center.lat, center.lon, center.lon];
	const halfLatKm = Math.min(TOMTOM_WINDOW_KM, Math.max(2.5, (north - south) * 111 / 2));
	const halfLonKm = Math.min(TOMTOM_WINDOW_KM, Math.max(2.5, (east - west) * 111 * cosLat / 2));
	let cell = 4;
	let rows;
	let cols;
	do {
		cell += 1;
		rows = Math.max(1, Math.ceil(halfLatKm * 2 / cell));
		cols = Math.max(1, Math.ceil(halfLonKm * 2 / cell));
	} while (rows * cols > TOMTOM_MAX_POINTS);
	const radius = Math.min(TOMTOM_MAX_RADIUS, Math.max(2500, Math.round(cell * 707)));
	const points = [];
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			points.push({
				lat: center.lat - halfLatKm / 111 + (row + 0.5) * (halfLatKm * 2 / rows) / 111,
				lon: center.lon - halfLonKm / (111 * cosLat) + (col + 0.5) * (halfLonKm * 2 / cols) / (111 * cosLat),
				radius
			});
		}
	}
	return points;
}

async function tomtomSearch(key, type, point) {
	const url = `${TOMTOM_URL}?key=${encodeURIComponent(key)}&lat=${point.lat.toFixed(5)}&lon=${point.lon.toFixed(5)}&radius=${point.radius}&limit=100&categorySet=${TOMTOM_CATEGORY[type]}&language=en-GB`;
	const response = await fetch(url);
	if (response.status === 401 || response.status === 403) {
		const error = new Error('TomTom rejected the API key');
		error.keyRejected = true;
		throw error;
	}
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	const data = await response.json();
	return data.results || [];
}

// Only places with a website are kept: TomTom gives no email/WhatsApp/
// Instagram, so the website is the only way such a place can still reach
// the two contact details a lead needs (see elementToLead()).
function tomtomToLead(result) {
	const poi = result.poi || {};
	if (!poi.name || !poi.url) return null;
	return {
		id: `tt/${result.id}`,
		name: poi.name,
		address: (result.address && result.address.freeformAddress) || '',
		phone: poi.phone || '',
		website: normalizeWebsite(poi.url),
		email: '',
		whatsapp: '',
		instagram: '',
		lang: currentCountry.lang,
		selected: false,
		enriching: false,
		msgStage: 0,
		msgSentAt: null,
		stopped: false
	};
}

const phoneKey = (value) => String(value || '').replace(/\D/g, '').slice(-9);
const nameKey = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');

// Second search source for a city: finds places OpenStreetMap doesn't have,
// drops the ones already in the lists (same phone number anywhere, or same
// name in this same list - so nobody is messaged twice), reads each one's
// website for email/WhatsApp/Instagram, and only adds those that end up
// with a way to message them (email, WhatsApp or Instagram).
async function tomtomStage({ types, place, listName, key }) {
	const status = $('#leadsStatus');
	const base = status.textContent;
	const knownPhones = new Set();
	const knownNames = new Set();
	leads.forEach((lead) => {
		[lead.phone, lead.whatsapp].forEach((number) => { if (phoneKey(number).length >= 7) knownPhones.add(phoneKey(number)); });
		if (leadListName(lead) === listName) knownNames.add(nameKey(lead.name));
	});

	const points = tomtomGrid(place);
	const candidates = [];
	const candidateIds = new Set();
	let keyRejected = false;
	let failedRequests = 0;
	search: for (const type of types) {
		for (let i = 0; i < points.length; i++) {
			if (!tomtomEnabled()) break search;
			status.textContent = `${base} TomTom: ${type}, area ${i + 1}/${points.length}…`;
			try {
				(await tomtomSearch(key, type, points[i])).forEach((result) => {
					const lead = tomtomToLead(result);
					if (!lead || candidateIds.has(lead.id) || knownNames.has(nameKey(lead.name))) return;
					if (phoneKey(lead.phone).length >= 7 && knownPhones.has(phoneKey(lead.phone))) return;
					candidateIds.add(lead.id);
					knownNames.add(nameKey(lead.name));
					if (phoneKey(lead.phone).length >= 7) knownPhones.add(phoneKey(lead.phone));
					lead.list = listName;
					candidates.push(lead);
				});
			} catch (error) {
				if (error.keyRejected) { keyRejected = true; break search; }
				failedRequests += 1;
			}
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
	}

	if (keyRejected) {
		try { localStorage.removeItem(TOMTOM_KEY_STORAGE); } catch { /* nothing stored anyway */ }
		$('#leadsTomtomKey').value = '';
		status.textContent = `${base} TomTom rejected the API key - it was cleared. Check the key (and its domain settings in TomTom) and enter it again.`;
		return;
	}

	let checked = 0;
	let added = 0;
	await runPool(candidates, ENRICH_CONCURRENCY, async (lead) => {
		if (!tomtomEnabled()) return;
		try {
			await applyEnrichment(lead);
		} catch {
			// Site unreachable - judged on what TomTom itself gave.
		}
		checked += 1;
		// Same rule as elementToLead(): keep it only if the website turned up
		// a way to message them.
		if (lead.email || lead.whatsapp || lead.instagram) {
			leads.push(lead);
			added += 1;
		}
		status.textContent = `${base} TomTom: checking websites ${checked}/${candidates.length} - ${added} added (untick "Also search TomTom" to stop)`;
		if (checked % 10 === 0) { saveLeads(); render(); }
	});

	if (added && leads.some((lead) => leadListName(lead) === listName)) currentStageTab = listTabKey(listName);
	saveLeads();
	render();
	status.textContent = `${base} TomTom: ${added} new lead${added === 1 ? '' : 's'} added from ${candidates.length} places with a website` +
		(failedRequests ? ` (${failedRequests} requests failed - search again to fill gaps)` : '') + '.';
}

// Bulk version of the per-row Enrich button - same eligibility (a website,
// not already in flight, still unmessaged) so it never re-scrapes a lead
// whose sequence has already started. Runs one at a time rather than all
// at once, since these all hit the same scrape-website Edge Function and
// a burst of dozens of concurrent requests risks tripping its rate limit
// or overloading whatever's on the other end of each target site.
async function enrichAll() {
	const pool = selectedLeads().length ? selectedLeads() : visibleLeads();
	const targets = pool.filter((lead) => lead.website && !lead.enriching && (lead.msgStage || 0) === 0);
	if (!targets.length) { notify('Nothing to enrich - needs a website and no message sent yet'); return; }
	const button = $('#leadsEnrichAll');
	button.disabled = true;
	for (let i = 0; i < targets.length; i++) {
		$('#leadsStatus').textContent = `Enriching ${i + 1}/${targets.length}…`;
		await enrichLead(targets[i]);
	}
	$('#leadsStatus').textContent = `Enriched ${targets.length} lead${targets.length === 1 ? '' : 's'}.`;
	button.disabled = false;
}

// Chrome silently SUPPRESSES prompt()/confirm() (returns as if the user hit
// Cancel, no dialog ever shown) when called while this tab isn't the active
// one - see the chromestatus link in the console warning this used to
// throw. window.open() below hands focus to the new tab the instant it
// succeeds, so calling confirm() right after it in the same synchronous
// run was silently discarding every "did it send" answer and leaving the
// lead stuck at its current stage forever, even after a real send. This
// waits for the 'focus' event (the user actually switching back here)
// before ever showing that dialog, so it can never be suppressed.
function askIfSent(lead, action, channelName) {
	function ask() {
		window.removeEventListener('focus', ask);
		if (!confirm(`Did that message actually go out to ${lead.name} on ${channelName}?\nCancel keeps this lead where it is - only confirm if it was really sent.`)) return;
		lead.msgStage = action.nextStage;
		lead.msgSentAt = Date.now();
		saveLeads();
		render();
	}
	if (document.hasFocus()) ask();
	else window.addEventListener('focus', ask);
}

function openWhatsapp(lead) {
	const action = nextAction(lead);
	if (!action) { notify('Not due yet'); return; }
	// lead.phone is deliberately not used as a fallback here - it's just a
	// generic phone number with no confirmation it's WhatsApp-reachable, and
	// sending to it would still advance the sequence stage, permanently
	// marking a contact as messaged even though nothing was ever delivered.
	if (!lead.whatsapp) { notify('No confirmed WhatsApp number for this lead yet'); return; }
	const template = action.templates[lead.lang] || action.templates[currentCountry.lang] || action.templates.en;
	const message = template.replace('{site}', SITE_URL);
	const digits = String(lead.whatsapp).replace(/[^\d]/g, '');
	// Shown before opening the chat tab, not after - a dialog fired once
	// that tab has taken focus gets silently suppressed (see askIfSent()).
	prompt('About to open the WhatsApp chat, pre-filled with this message.\nIf it doesn\'t come through, select all the text below and copy it (Ctrl/Cmd+C):', message);
	// api.whatsapp.com/send is used directly instead of wa.me - wa.me is a
	// redirect layer, and handing an emoji-bearing URL through it to the
	// WhatsApp Desktop app on Windows has been observed to corrupt the emoji
	// (mojibake) on the far side; the direct endpoint avoids that extra hop.
	window.open(`https://api.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(message)}`, '_blank');
	askIfSent(lead, action, 'WhatsApp');
}

function openEmail(lead) {
	const action = nextAction(lead);
	if (!action) { notify('Not due yet'); return; }
	if (!lead.email) { notify('No email for this lead yet'); return; }
	const template = action.templates[lead.lang] || action.templates[currentCountry.lang] || action.templates.en;
	const subject = action.subjects[lead.lang] || action.subjects[currentCountry.lang] || action.subjects.en;
	const message = template.replace('{site}', SITE_URL);
	// Shown before opening the mail app, not after - see askIfSent().
	prompt(`About to open your mail app, pre-filled with this message.\nSubject: ${subject}\nIf nothing opens, select all the text below and copy it (Ctrl/Cmd+C):`, message);
	window.open(`mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`, '_blank');
	askIfSent(lead, action, 'email');
}

// Instagram has no equivalent of wa.me/mailto: - no URL scheme opens a DM
// with prefilled text. Copies the message to the clipboard AND shows it in
// a prompt() dialog, then opens the profile so the human can paste it into
// the DM box - or select-and-copy straight out of the dialog if the
// clipboard write silently failed.
function openInstagram(lead) {
	const action = nextAction(lead);
	if (!action) { notify('Not due yet'); return; }
	if (!lead.instagram) { notify('No Instagram handle for this lead yet'); return; }
	const template = action.templates[lead.lang] || action.templates[currentCountry.lang] || action.templates.en;
	const message = template.replace('{site}', SITE_URL);
	// Best-effort, not awaited - the prompt() below (shown before opening
	// the profile tab, see askIfSent()) shows the same text regardless, so
	// this doesn't need to block on it.
	navigator.clipboard.writeText(message).catch(() => {});
	prompt('About to open the Instagram profile. This message is already on your clipboard - paste it into the DM.\nIf that doesn\'t work, select all the text below and copy it (Ctrl/Cmd+C):', message);
	window.open(`https://instagram.com/${encodeURIComponent(lead.instagram)}`, '_blank');
	askIfSent(lead, action, 'Instagram');
}

// Manual "I already sent this" - for when the askIfSent() dialog above never
// got answered (or got lost among several tabs opened in a row) and a message
// really did go out, so the lead is stuck in its old stage. Advances it the
// same way a confirmed askIfSent() would, without reopening the channel.
function markSent(lead) {
	const action = nextAction(lead);
	if (!action) return;
	if (!confirm(`Mark the message to ${lead.name} as sent? Only do this if it really went out.`)) return;
	lead.msgStage = action.nextStage;
	lead.msgSentAt = Date.now();
	saveLeads();
	render();
	notify(`Marked ${lead.name} as sent`);
}

// Manual "this contact already converted / don't follow up" override -
// see leadTab()'s comment for why this isn't detected automatically.
function stopLead(lead) {
	if (!confirm(`Stop the follow-up sequence for ${lead.name}? They'll disappear from all tabs (e.g. because they already ordered).`)) return;
	lead.stopped = true;
	saveLeads();
	render();
	notify(`Stopped follow-ups for ${lead.name}`);
}

// Undo for a lead that got wrongly advanced - e.g. a WhatsApp/email/
// Instagram draft was opened just to test something (or a number turned
// out not to be on WhatsApp) and "did that send?" was mistakenly confirmed.
// Before this, fixing that meant editing msgStage/msgSentAt by hand in the
// browser console (see [[lead-finder-outreach]] memory). Puts the lead back
// to msgStage 0 and clears stopped too, so it's fully back in "New".
function resetLead(lead) {
	if (!confirm(`Reset ${lead.name} back to "New"? Only do this if it was advanced by mistake - this can't be undone.`)) return;
	lead.msgStage = 0;
	lead.msgSentAt = null;
	lead.stopped = false;
	saveLeads();
	render();
	notify(`Reset ${lead.name} to New`);
}

function selectedLeads() {
	return leads.filter((lead) => lead.selected);
}

// Lets the user seed a contact by hand (not found via the OSM search) - it
// joins the same `leads` array at msgStage 0, so it shows up in its own "Manual" list tab
// and runs through the exact same enrich/send/stop pipeline as a searched
// lead. "manual/" ids keep it from ever colliding with an OSM element id.
function openAddContactModal() {
	$('#addContactForm').reset();
	$('#addContactModal').hidden = false;
	$('#contactName').focus();
}

function closeAddContactModal() {
	$('#addContactModal').hidden = true;
}

function addManualContact(event) {
	event.preventDefault();
	const name = $('#contactName').value.trim();
	if (!name) return;
	const lead = {
		id: `manual/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		name,
		address: $('#contactAddress').value.trim(),
		phone: $('#contactPhone').value.trim(),
		website: normalizeWebsite($('#contactWebsite').value.trim()),
		email: $('#contactEmail').value.trim(),
		whatsapp: normalizeWhatsapp($('#contactWhatsapp').value.trim()),
		instagram: normalizeInstagram($('#contactInstagram').value.trim()),
		lang: currentCountry.lang,
		list: 'Manual',
		selected: false,
		enriching: false,
		msgStage: 0,
		msgSentAt: null,
		stopped: false
	};
	leads.push(lead);
	currentStageTab = listTabKey('Manual');
	saveLeads();
	closeAddContactModal();
	render();
	notify(`Added ${lead.name}`);
}

function clearLeads() {
	if (!leads.length) return;
	if (!confirm(`Clear all ${leads.length} leads in every list? This can't be undone - outreach progress will be lost too.`)) return;
	leads = [];
	currentStageTab = 'all';
	localStorage.removeItem(STORAGE_KEY);
	// Also wipes the archive (see ARCHIVE_KEY) - Clear is an explicit,
	// confirmed "lose everything" action, so a lead re-found later should
	// come back as genuinely new, not silently resume its old progress.
	archive = {};
	localStorage.removeItem(ARCHIVE_KEY);
	$('#leadsStatus').textContent = 'Cleared - run a search to start again.';
	render();
}

// File-name part for an export: the list being viewed ("germany-hamburg"),
// or just the tab name for All/Sequence/Reminder/Final.
function exportSlug() {
	const name = currentStageTab.startsWith('list:') ? currentStageTab.slice(5) : currentStageTab;
	return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export';
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
	const header = ['Name', 'Address', 'Phone', 'Email', 'WhatsApp', 'Instagram', 'Website'];
	const keys = ['name', 'address', 'phone', 'email', 'whatsapp', 'instagram', 'website'];
	const headRow = `<tr>${header.map((label) => `<th>${escapeHtml(label)}</th>`).join('')}</tr>`;
	const bodyRows = rows.map((lead) => `<tr>${keys.map((key) => `<td>${escapeHtml(lead[key])}</td>`).join('')}</tr>`).join('');
	const html = `<html><head><meta charset="UTF-8"></head><body><table border="1">${headRow}${bodyRows}</table></body></html>`;
	const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
	const link = document.createElement('a');
	link.href = URL.createObjectURL(blob);
	link.download = `leads-${exportSlug()}.xls`;
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
	const header = ['name', 'address', 'phone', 'email', 'whatsapp', 'instagram', 'website'];
	const csv = [header.join(';')].concat(
		rows.map((lead) => header.map((key) => `"${String(lead[key] || '').replace(/"/g, '""')}"`).join(';'))
	).join('\r\n');
	const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
	const link = document.createElement('a');
	link.href = URL.createObjectURL(blob);
	link.download = `leads-${exportSlug()}.csv`;
	link.click();
	URL.revokeObjectURL(link.href);
	exportNotice(rows);
}

function escapeHtml(value) {
	return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

// Builds the tab row (and its copy in the sidebar): All, one tab per list,
// then the three follow-up stages. Regenerated on every render since the
// set of lists changes with each search.
function updateStageTabs() {
	const counts = stageTabCounts();
	if (currentStageTab.startsWith('list:') && !counts.lists.has(currentStageTab.slice(5))) currentStageTab = 'all';
	const tabs = [{ key: 'all', label: 'All', count: counts.all }]
		.concat(Array.from(counts.lists, ([name, count]) => ({ key: listTabKey(name), label: name, count })))
		.concat(['sequence', 'reminder', 'final'].map((stage) => ({ key: stage, label: stage[0].toUpperCase() + stage.slice(1), count: counts[stage] })));
	const html = tabs.map((tab) => `<button type="button" class="leads-stage-tab${tab.key === currentStageTab ? ' active' : ''}" data-stage="${escapeHtml(tab.key)}">${escapeHtml(tab.label)} <span class="leads-stage-count">${tab.count}</span></button>`).join('');
	document.querySelectorAll('[data-stage-tabs]').forEach((container) => { container.innerHTML = html; });
}

function render() {
	updateStageTabs();
	const body = $('#leadsBody');
	const visible = visibleLeads();
	const totalInTab = leads.filter((lead) => matchesStageTab(lead, currentStageTab)).length;
	$('#leadsCount').textContent = totalInTab && visible.length !== totalInTab
		? `${visible.length} shown / ${totalInTab} in this tab`
		: `${totalInTab} found`;

	if (!leads.length) {
		body.innerHTML = '<tr><td colspan="9" class="leads-empty">Run a search to see results here.</td></tr>';
		return;
	}
	if (!visible.length) {
		body.innerHTML = `<tr><td colspan="9" class="leads-empty">${totalInTab ? 'No results match this filter.' : 'Nothing in this tab yet.'}</td></tr>`;
		return;
	}

	body.innerHTML = visible.map((lead) => {
		const action = nextAction(lead);
		const waitingDays = !action && (lead.msgStage || 0) > 0 && (lead.msgStage || 0) < 3 ? daysUntilDue(lead) : 0;
		// Just the channel name on the button itself (was "Send message ·
		// WhatsApp" etc.) - with three possible channels now, the longer
		// labels no longer fit the Actions column and got visually clipped.
		// The full "which stage" wording still shows on hover via title.
		const waButton = action && lead.whatsapp
			? `<button class="button button-primary" type="button" data-whatsapp="${lead.id}" title="${escapeHtml(action.label)}">WhatsApp</button>`
			: '';
		const emailButton = action && lead.email
			? `<button class="button button-primary" type="button" data-email="${lead.id}" title="${escapeHtml(action.label)}">Email</button>`
			: '';
		const igButton = action && lead.instagram
			? `<button class="button button-primary" type="button" data-instagram="${lead.id}" title="${escapeHtml(action.label)}">Instagram</button>`
			: '';
		// Stacked top to bottom in this order: Enrich, then only the
		// channels this lead actually has (no placeholder text for the ones
		// it lacks - the phone number stays visible in its own column, there
		// is deliberately no Call button), then Sent/Reset/Stop underneath.
		const actionButton = action
			? `${emailButton}${waButton}${igButton}`
			: waitingDays
				? `<span class="leads-empty">Waiting ${waitingDays}d</span>`
				: '';
		const enrichButton = (lead.msgStage || 0) === 0
			? `<button class="button button-ghost" type="button" data-enrich="${lead.id}" ${!lead.website || lead.enriching ? 'disabled' : ''}>${lead.enriching ? 'Enriching…' : 'Enrich'}</button>`
			: '';
		const stopButton = `<button class="button button-danger" type="button" data-stop="${lead.id}" title="Already a customer, or otherwise stop contacting them">Stop</button>`;
		const sentButton = action
			? `<button class="button button-ghost" type="button" data-sent="${lead.id}" title="Already sent it yourself? Mark as sent without reopening the chat">Sent</button>`
			: '';
		const resetButton = ((lead.msgStage || 0) > 0 || lead.stopped)
			? `<button class="button button-ghost" type="button" data-reset="${lead.id}" title="Undo an accidental stage advance - back to New">Reset</button>`
			: '';
		return `
		<tr>
			<td><input type="checkbox" data-select="${lead.id}" ${lead.selected ? 'checked' : ''}></td>
			<td>${escapeHtml(lead.name)}</td>
			<td>${escapeHtml(lead.address) || '<span class="leads-empty">-</span>'}</td>
			<td>${escapeHtml(lead.phone) || '<span class="leads-empty">-</span>'}</td>
			<td>${lead.website ? `<a href="${escapeHtml(lead.website)}" target="_blank" rel="noopener">link</a>` : '<span class="leads-empty">-</span>'}</td>
			<td>${escapeHtml(lead.email) || '<span class="leads-empty">-</span>'}</td>
			<td>${escapeHtml(lead.whatsapp) || '<span class="leads-empty">-</span>'}</td>
			<td>${lead.instagram ? `<a href="https://instagram.com/${encodeURIComponent(lead.instagram)}" target="_blank" rel="noopener">@${escapeHtml(lead.instagram)}</a>` : '<span class="leads-empty">-</span>'}</td>
			<td class="leads-actions-cell">${enrichButton}${actionButton}<div class="leads-actions-secondary">${sentButton}${resetButton}${stopButton}</div></td>
		</tr>
	`;
	}).join('');
}

function wireEvents() {
	$('#leadsSearch').addEventListener('click', runSearch);
	$('#leadsEnrichAll').addEventListener('click', enrichAll);
	$('#leadsExport').addEventListener('click', exportExcel);
	$('#leadsExportCsv').addEventListener('click', exportCsv);
	$('#leadsClear').addEventListener('click', clearLeads);
	$('#leadsAddContact').addEventListener('click', openAddContactModal);
	$('#closeAddContact').addEventListener('click', closeAddContactModal);
	$('#cancelAddContact').addEventListener('click', closeAddContactModal);
	$('#addContactModal').addEventListener('click', (event) => { if (event.target.id === 'addContactModal') closeAddContactModal(); });
	$('#addContactForm').addEventListener('submit', addManualContact);
	$('#leadsSelectAll').addEventListener('change', (event) => {
		visibleLeads().forEach((lead) => { lead.selected = event.target.checked; });
		render();
	});
	$('#leadsFilter').addEventListener('change', (event) => {
		currentFilter = event.target.value;
		render();
	});
	// Tabs are regenerated on every render, so listen on their containers
	// instead of on each button.
	document.querySelectorAll('[data-stage-tabs]').forEach((container) => {
		container.addEventListener('click', (event) => {
			const tab = event.target.closest('.leads-stage-tab');
			if (!tab) return;
			currentStageTab = tab.dataset.stage;
			render();
		});
	});
	$('#leadsCity').addEventListener('change', updateOtherCityInput);
	$('#leadsTomtomKey').addEventListener('change', (event) => {
		try { localStorage.setItem(TOMTOM_KEY_STORAGE, event.target.value.trim()); } catch { /* remembering the key is a convenience only */ }
	});
	$('#leadsAutoEnrich').addEventListener('change', (event) => {
		try { localStorage.setItem(AUTO_ENRICH_KEY, event.target.checked ? '1' : '0'); } catch { /* remembering the choice is a convenience only */ }
	});
	$('#leadsCityOther').addEventListener('keydown', (event) => {
		if (event.key === 'Enter') runSearch();
	});
	$('#leadsBody').addEventListener('click', (event) => {
		const enrichId = event.target.dataset.enrich;
		const whatsappId = event.target.dataset.whatsapp;
		const emailId = event.target.dataset.email;
		const instagramId = event.target.dataset.instagram;
		const stopId = event.target.dataset.stop;
		const resetId = event.target.dataset.reset;
		const sentId = event.target.dataset.sent;
		if (sentId) markSent(leads.find((lead) => lead.id === sentId));
		if (enrichId) enrichLead(leads.find((lead) => lead.id === enrichId));
		if (whatsappId) openWhatsapp(leads.find((lead) => lead.id === whatsappId));
		if (emailId) openEmail(leads.find((lead) => lead.id === emailId));
		if (instagramId) openInstagram(leads.find((lead) => lead.id === instagramId));
		if (stopId) stopLead(leads.find((lead) => lead.id === stopId));
		if (resetId) resetLead(leads.find((lead) => lead.id === resetId));
	});
	$('#leadsBody').addEventListener('change', (event) => {
		const selectId = event.target.dataset.select;
		if (!selectId) return;
		const lead = leads.find((item) => item.id === selectId);
		if (lead) lead.selected = event.target.checked;
	});
}

populateCountrySelect();
restoreArchive();
restoreLeads();
restoreAutoEnrich();
restoreTomtomKey();
wireEvents();
render();
if (leads.length) {
	const listCount = new Set(leads.map(leadListName)).size;
	$('#leadsStatus').textContent = `Restored ${leads.length} lead${leads.length === 1 ? '' : 's'} in ${listCount} list${listCount === 1 ? '' : 's'} from your last session.`;
}
