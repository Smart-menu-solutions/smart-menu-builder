// Shared page logic for waiter.html/kitchen.html/bar.html/cashier.html -
// each page sets window.STAFF_ROLE before loading this file, everything
// else (fetch, render, actions, realtime) branches on that one value
// instead of duplicating four near-identical files. See staff-access Edge
// Function for what each role actually receives. "waiter" is the Table Hub:
// a grid of every table (see hubTileMarkup/renderHub) rather than a card
// list, because its whole job is showing which tables are FREE and letting
// staff activate the next one - see 0017_table_hub.sql for why that
// replaced the old per-table QR secret.
//
// Layout (every role): a light sidebar on the left - logo, station name,
// the help sections as fold-out panels, language switcher - and the
// station's own view on the right. The Table Hub additionally gets a side
// column (live activity, station status, today's order summary) and a row
// of shortcut tiles under the floor.

const ROLE = window.STAFF_ROLE;
const token = new URLSearchParams(location.search).get('t');
const app = document.querySelector('#app');
const isTicketRole = ROLE === 'kitchen' || ROLE === 'bar';
const isHub = ROLE === 'waiter';
const canAddItems = ROLE === 'bar' || ROLE === 'waiter' || ROLE === 'cashier';
const LANG_STORAGE_KEY = `smartmenu.staff.lang.${ROLE}`;
const [ROLE_TITLE, PRODUCT_TITLE = 'Smart ServiceHub™'] = document.title.split(' — ');

let menuState = null;
let restaurantName = '';
let accessLabel = '';
let languagesState = ['de'];
let translationsState = {};
let openAddFormFor = null;
let openHubTable = null; // hub only: which table's popup is showing
let openHubTableWasFree = false; // ...and whether it was opened as a FREE tile
let totalsOpen = false; // cashier + hub: the "Gesamtübersicht" popup
let openOrdersOpen = false; // hub only: every open table's order in one popup
let historyOpen = false; // hub only: today's full activity list
// Sidebar fold-out panels (role guide + the 10-step walkthrough). Kept
// outside render() because the page re-renders on every live update and
// would otherwise snap them shut.
const helpOpen = { guide: false, workflow: false };
// Hub only, from staff-access (see buildActivity there): today's events
// and totals. Undefined until the server sends them - older deployments
// don't, and the side column then just shows its empty state.
let activityState = [];
let summaryState = null;

// hub only: dispatched-item count last seen per table, to know when the
// bell is "new" - persisted per token (not just kept in memory), otherwise
// every page reload (tablet woke up, browser refreshed, shift change) would
// re-show the bell on every table that already has a ready item sitting on
// it, even one staff already saw and is just waiting to be picked up.
const ACK_STORAGE_KEY = `smartmenu.staff.ack.${token}`;
function loadAckDispatchedCount() {
	try {
		const raw = localStorage.getItem(ACK_STORAGE_KEY);
		const parsed = raw ? JSON.parse(raw) : null;
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch { return {}; }
}
const ackDispatchedCount = loadAckDispatchedCount();
function saveAckDispatchedCount() {
	try { localStorage.setItem(ACK_STORAGE_KEY, JSON.stringify(ackDispatchedCount)); } catch { /* convenience only */ }
}

// hub only: a short "ding-dong" whenever something new is ready to pick up
// (a new 🛎️). Synthesised with Web Audio - no sound file to load. Browsers
// only allow audio after the user has interacted with the page, so the
// AudioContext is created/resumed on the first tap or key press; until then
// a new bell is only visual. On by default, switchable in the sidebar.
const SOUND_STORAGE_KEY = `smartmenu.staff.sound.${ROLE}`;
let soundOn = (() => { try { return localStorage.getItem(SOUND_STORAGE_KEY) !== 'off'; } catch { return true; } })();
let audioContext = null;
function unlockAudio() {
	try {
		audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
		if (audioContext.state === 'suspended') audioContext.resume();
	} catch { /* no Web Audio - bells stay visual only */ }
}
document.addEventListener('pointerdown', unlockAudio);
document.addEventListener('keydown', unlockAudio);

function playChime() {
	if (!soundOn || !audioContext || audioContext.state !== 'running') return;
	const start = audioContext.currentTime + 0.02;
	[[1318.5, 0], [987.8, 0.3]].forEach(([frequency, delay]) => {
		const oscillator = audioContext.createOscillator();
		const gain = audioContext.createGain();
		oscillator.type = 'sine';
		oscillator.frequency.value = frequency;
		gain.gain.setValueAtTime(0.0001, start + delay);
		gain.gain.exponentialRampToValueAtTime(0.4, start + delay + 0.02);
		gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + 1.2);
		oscillator.connect(gain).connect(audioContext.destination);
		oscillator.start(start + delay);
		oscillator.stop(start + delay + 1.25);
	});
}

// Rings when any open table has more ready (dispatched) items than at the
// last refresh while its bell is showing - not on the first load, so
// opening the page doesn't ring for bells that were already there.
let lastDispatchedByTable = null;
function chimeForNewReadyItems(tables) {
	if (!isHub) return;
	const counts = new Map(tables.map((table) => [table.tableId, (table.items || []).filter((item) => item.dispatched).length]));
	if (lastDispatchedByTable && tables.some((table) => hubTileHasBell(table) && counts.get(table.tableId) > (lastDispatchedByTable.get(table.tableId) || 0))) playChime();
	lastDispatchedByTable = counts;
}

// item.name/product_name is a source-language snapshot (see
// 0015_smartservice_hub.sql) - looked up by that source text, same as
// menu.js's itemTranslation()/categoryName(), so it works even though
// order_items has no language-keyed fields of its own.
function translateName(sourceName) {
	return translationsState?.[currentLang]?.items?.[sourceName]?.name || sourceName;
}
let currentLang = (() => {
	try { return localStorage.getItem(LANG_STORAGE_KEY) || 'de'; } catch { return 'de'; }
})();

function escapeHtml(value) {
	return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

// Dish names are never translated (see staff-strings.js) - only UI chrome.
function strings() {
	const catalog = window.STAFF_STRINGS || {};
	return catalog[currentLang] || catalog.de || {};
}

function formatMoney(cents) {
	return `${((cents || 0) / 100).toFixed(2)} €`;
}

// Start of the local day - the server counts "today" from here, so a
// Greek and a German restaurant both see their own midnight.
function localMidnightIso() {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

function timeAgo(iso) {
	const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
	if (minutes < 1) return strings().timeJustNow;
	if (minutes < 60) return strings().timeMinutes.replace('{n}', minutes);
	return strings().timeHours.replace('{n}', Math.floor(minutes / 60));
}

// Line icons (24px viewBox, stroke = currentColor) for the sidebar, panel
// headers, activity feed and the walkthrough - inline so they need no
// extra request and pick up whatever color the surrounding text has.
const ICONS = {
	floor: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
	orders: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
	history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
	totals: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
	help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5h.01"/>',
	chevron: '<path d="m6 9 6 6 6-6"/>',
	qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
	tap: '<path d="M9 11V5a2 2 0 1 1 4 0v6"/><path d="M13 9a2 2 0 1 1 4 0v3a7 7 0 0 1-7 7h-.5A5.5 5.5 0 0 1 5 16l-1.5-3a1.8 1.8 0 0 1 3-2L9 13"/>',
	people: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M15 14.5a5 5 0 0 1 6 5.5"/>',
	route: '<path d="M12 3v18M3 12h18M12 3 9 6M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
	chef: '<path d="M6 14a4 4 0 1 1 1.5-7.7A4.5 4.5 0 0 1 16.5 6 4 4 0 1 1 18 14v6H6z"/><path d="M6 17h12"/>',
	eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
	repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
	receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
	card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
	check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
	bag: '<path d="M6 8h12l-1 12H7z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
	bell: '<path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16z"/><path d="M10 21h4"/>',
	open: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 12h8M12 8v8"/>',
	kitchen: '<path d="M6 14a4 4 0 1 1 1.5-7.7A4.5 4.5 0 0 1 16.5 6 4 4 0 1 1 18 14v6H6z"/>',
	bar: '<path d="M5 4h14l-7 8z"/><path d="M12 12v8M8 20h8"/>',
	hub: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
	cashier: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
	sound: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>',
	mute: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="m17 9 5 6M22 9l-5 6"/>'
};
function icon(name, size = 20) {
	return `<svg class="sh-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}
// One icon per walkthrough step, same order as staff-strings.js workflow[].
const WORKFLOW_ICONS = ['qr', 'tap', 'people', 'route', 'chef', 'eye', 'repeat', 'receipt', 'card', 'check'];

function staffEndpoint() { return `${AUTH_CONFIG.supabaseUrl}/functions/v1/staff-access`; }
function viewUrl() {
	const since = isHub ? `&since=${encodeURIComponent(localMidnightIso())}` : '';
	return `${staffEndpoint()}?t=${encodeURIComponent(token)}${since}`;
}

async function callStaff(body) {
	const response = await fetch(staffEndpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, ...body }) });
	const data = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error(data.error || strings().actionFailed);
	return data;
}

function sortItems(items) {
	return [...items].sort((a, b) => (!!a.dispatched === !!b.dispatched ? 0 : a.dispatched ? 1 : -1));
}

function itemRowMarkup(item, withPrice, clickable) {
	const priceMarkup = withPrice ? `<span class="staff-item-price">${formatMoney(item.unitPriceCents)}</span>` : '';
	return `<div class="staff-item-row ${item.dispatched ? 'is-done' : ''} ${clickable ? 'is-clickable' : ''}" ${clickable ? `data-item-id="${item.id}"` : ''}>
		<span class="status-dot ${item.dispatched ? 'dot-green' : 'dot-red'}"></span>
		<span class="staff-item-name">${item.quantity}× ${escapeHtml(translateName(item.name))}${item.notes ? ` <em>(${escapeHtml(item.notes)})</em>` : ''}</span>
		${priceMarkup}
		${ROLE === 'cashier' ? `<button type="button" class="staff-item-remove" data-remove-item="${item.id}" data-remove-label="${escapeHtml(`${item.quantity}× ${translateName(item.name)}`)}" title="${escapeHtml(strings().removeItem)}" aria-label="${escapeHtml(strings().removeItem)}">✕</button>` : ''}
	</div>`;
}

function menuOptionsMarkup() {
	if (!menuState) return '';
	return (menuState.categories || []).filter((category) => (category.items || []).some((item) => item.id)).map((category) => `
		<optgroup label="${escapeHtml(translateName(category.name))}">
			${(category.items || []).filter((item) => item.id).map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(translateName(item.name))} — ${escapeHtml(item.price)} €</option>`).join('')}
		</optgroup>`).join('');
}

function addFormMarkup(tableId) {
	const open = openAddFormFor === tableId;
	return `<div class="staff-add-form ${open ? 'is-open' : ''}" data-add-form="${tableId}">
		<select data-add-product>${menuOptionsMarkup()}</select>
		<input type="number" min="1" value="1" data-add-qty>
		<input type="text" data-add-notes placeholder="${escapeHtml(strings().notesPlaceholder)}">
		<button type="button" class="staff-btn staff-btn-primary" data-add-submit="${tableId}">${escapeHtml(strings().add)}</button>
	</div>`;
}

function cardActionsMarkup(table) {
	const buttons = [];
	if (isTicketRole) {
		const hasOpen = table.items.some((item) => !item.dispatched);
		buttons.push(`<button type="button" class="staff-btn staff-btn-primary" data-dispatch-all="${table.tableId}" ${hasOpen ? '' : 'disabled'}>${escapeHtml(strings().allDone)}</button>`);
	}
	if (canAddItems) buttons.push(`<button type="button" class="staff-btn" data-toggle-add="${table.tableId}">${escapeHtml(strings().addItem)}</button>`);
	if (ROLE === 'cashier') buttons.push(`<button type="button" class="staff-btn staff-btn-primary" data-close-table="${table.tableId}">${escapeHtml(strings().closeTable)}</button>`);
	return `<div class="staff-card-actions">${buttons.join('')}</div>${canAddItems ? addFormMarkup(table.tableId) : ''}`;
}

// The bill-requested flag: a plain span for roles that can't act on it, but
// for the cashier a clickable shortcut straight to "Tisch schließen" - 💳
// there reads as "this is the payment step", while every other role keeps
// the service bell (🛎️), which fits a "guest wants something" notice better.
function billFlagMarkup(table) {
	if (!table.billRequested) return '';
	if (ROLE !== 'cashier') return `<span class="staff-bill-flag" title="${escapeHtml(strings().billFlagHint)}">🛎️</span>`;
	return `<button type="button" class="staff-bill-flag" data-close-table="${table.tableId}" title="${escapeHtml(strings().billFlagHint)}">💳</button>`;
}

function cardMarkup(table) {
	const withPrice = ROLE === 'cashier';
	const bill = billFlagMarkup(table);
	const total = withPrice ? `<span class="staff-card-total">${formatMoney(table.totalCents)}</span>` : '';
	const rows = sortItems(table.items).map((item) => itemRowMarkup(item, withPrice, isTicketRole)).join('');
	const openCount = table.items.filter((item) => !item.dispatched).length;
	const badge = isTicketRole && openCount ? `<span class="staff-card-badge">${escapeHtml(strings().statusOpen.replace('{n}', openCount))}</span>` : '';
	return `<div class="staff-card ${table.billRequested ? 'is-bill-requested' : ''}" data-table-id="${table.tableId}">
		<div class="staff-card-head"><h3><span class="staff-card-label">${escapeHtml(strings().table)}</span> ${escapeHtml(String(table.tableNumber))}${bill}</h3>${total}${badge}</div>
		<div class="staff-card-rows">${rows}</div>
		${cardActionsMarkup(table)}
	</div>`;
}

// Cashier only: bill-requested tables get their own row up top, same "group
// into rows instead of just recoloring in place" idea as the Table Hub's
// three status rows - so the ones actually waiting to be paid don't get
// lost among every other still-running table. Kitchen/bar keep one flat
// grid, since their cards have no billRequested field to group by.
function cardGridMarkup(tables) {
	if (ROLE !== 'cashier') return `<div class="staff-grid">${tables.map(cardMarkup).join('')}</div>`;
	return [tables.filter((table) => table.billRequested), tables.filter((table) => !table.billRequested)]
		.filter((group) => group.length)
		.map((group) => `<div class="staff-grid">${group.map(cardMarkup).join('')}</div>`)
		.join('');
}

// --- Table Hub (waiter role): a grid of every table instead of a card list.
// Tapping any tile opens a popup: for a FREE table just the "Aktivieren"
// confirm step, for an ACTIVE/PAYMENT_PENDING one that table's order, same
// row markup as the card view. See 0017_table_hub.sql for why FREE tiles
// carry no secret of any kind. Colors stay green/orange/red by status.
// No amounts on the tiles: the hub tablet often stands at the entrance where
// guests can see it - a table's total only shows in its popup.
function hubTileHasBell(table) {
	const dispatchedCount = (table.items || []).filter((item) => item.dispatched).length;
	return table.status !== 'FREE' && dispatchedCount > (ackDispatchedCount[table.tableId] || 0);
}

function hubTileMarkup(table) {
	const statusClass = table.status === 'FREE' ? 'hub-tile-free' : table.status === 'PAYMENT_PENDING' ? 'hub-tile-pending' : 'hub-tile-active';
	return `<button type="button" class="hub-tile ${statusClass}" data-hub-table="${table.tableId}" data-hub-status="${table.status}">
		${hubTileHasBell(table) ? '<span class="hub-bell" aria-hidden="true">🛎️</span>' : ''}
		<span class="hub-tile-label">${escapeHtml(strings().table)}</span>
		<span class="hub-tile-number">${escapeHtml(String(table.tableNumber))}</span>
		<span class="hub-tile-status"><span class="hub-tile-dot"></span>${escapeHtml(strings().hubStatus?.[table.status] || table.status)}</span>
	</button>`;
}

// Grouped into three rows by status - Frei on top, Aktiv in the middle,
// Besetzt/Rechnung at the bottom - instead of one mixed grid, so a table
// visibly jumps to the row that matches its current status the moment it
// changes, rather than staying in place with just its color/label updating.
const HUB_STATUS_ORDER = ['FREE', 'ACTIVE', 'PAYMENT_PENDING'];
function hubGridMarkup(tables) {
	if (!tables.length) return `<p class="staff-empty">${escapeHtml(strings().noTables)}</p>`;
	return HUB_STATUS_ORDER
		.map((status) => tables.filter((table) => table.status === status))
		.filter((group) => group.length)
		.map((group) => `<div class="hub-grid">${group.map(hubTileMarkup).join('')}</div>`)
		.join('');
}

function popupMarkup(id, content) {
	return `<div class="hub-popup-overlay" id="${id}Overlay">
		<div class="hub-popup-box" role="dialog" aria-modal="true">
			<button type="button" class="smart-match-close" id="${id}Close" aria-label="Close">✕</button>
			${content}
		</div>
	</div>`;
}

function hubPopupMarkup(table) {
	if (!table) return '';
	// A free table just gets a confirm step - tap the tile, see which table
	// it is, press "Aktivieren" to actually open it. No server call happens
	// until that button is pressed, so tapping the wrong tile by mistake is
	// a no-op (close with ✕), not something that needs undoing afterwards.
	if (table.status === 'FREE') {
		return popupMarkup('hubPopup', `
			<div class="staff-card-head"><h3>${escapeHtml(strings().table)} ${escapeHtml(String(table.tableNumber))}</h3></div>
			<div class="staff-card-actions">
				<button type="button" class="staff-btn staff-btn-primary" data-activate-table="${table.tableId}">${escapeHtml(strings().activateTable)}</button>
			</div>`);
	}
	const total = `<span class="staff-card-total">${formatMoney(table.totalCents)}</span>`;
	const rows = sortItems(table.items).map((item) => itemRowMarkup(item, true, false)).join('') || `<p class="staff-empty">${escapeHtml(strings().hubEmptyOrder)}</p>`;
	// Only offered while the table is still genuinely empty - a wrong tile
	// tapped by mistake shouldn't need a trip to the cashier to undo. Once
	// there's an order, only close_table (cashier) can free the table again.
	const deactivate = !table.items.length
		? `<button type="button" class="staff-btn" data-deactivate-table="${table.tableId}">${escapeHtml(strings().deactivateTable)}</button>`
		: '';
	return popupMarkup('hubPopup', `
		<div class="staff-card-head"><h3>${escapeHtml(strings().table)} ${escapeHtml(String(table.tableNumber))}${billFlagMarkup(table)}</h3>${total}</div>
		<div class="staff-card-rows">${rows}</div>
		<div class="staff-card-actions">
			<button type="button" class="staff-btn" data-toggle-add="${table.tableId}">${escapeHtml(strings().addItem)}</button>
			<button type="button" class="staff-btn staff-btn-primary" data-request-bill="${table.tableId}" ${table.billRequested ? 'disabled' : ''}>${escapeHtml(table.billRequested ? strings().billRequested : strings().requestBill)}</button>
			${deactivate}
		</div>
		${addFormMarkup(table.tableId)}`);
}

function totalsPopupMarkup() {
	if (!totalsOpen) return '';
	const grandTotal = lastTables.reduce((sum, table) => sum + (table.totalCents || 0), 0);
	return popupMarkup('totalsPopup', `
		<h2>${escapeHtml(strings().totalsHeading)}</h2>
		<p class="staff-card-total staff-grand-total">${formatMoney(grandTotal)}</p>`);
}

// Hub only: every table that currently has an order, read-only, so staff
// can scan all running orders at once instead of opening tile by tile.
function openOrdersPopupMarkup() {
	if (!openOrdersOpen) return '';
	const tables = lastTables.filter((table) => table.status !== 'FREE' && (table.items || []).length);
	const content = tables.length
		? tables.map((table) => `<div class="sh-popup-section">
			<div class="staff-card-head"><h3>${escapeHtml(strings().table)} ${escapeHtml(String(table.tableNumber))}${billFlagMarkup(table)}</h3><span class="staff-card-total">${formatMoney(table.totalCents)}</span></div>
			<div class="staff-card-rows">${sortItems(table.items).map((item) => itemRowMarkup(item, true, false)).join('')}</div>
		</div>`).join('')
		: `<p class="staff-empty">${escapeHtml(strings().noOpenOrders)}</p>`;
	return popupMarkup('openOrdersPopup', `<h2>${escapeHtml(strings().tileOpenOrders)}</h2>${content}`);
}

function historyPopupMarkup() {
	if (!historyOpen) return '';
	return popupMarkup('historyPopup', `<h2>${escapeHtml(strings().historyTitle)}</h2>${activityListMarkup(activityState)}`);
}

// --- Hub side column ---------------------------------------------------
// Event types come from staff-access buildActivity(); the text is built
// here so it follows the language switcher like everything else.
function activityText(event) {
	const itemList = (event.items || []).map((item) => `${item.quantity}× ${translateName(item.name)}`).join(', ');
	switch (event.type) {
		case 'opened': return strings().evOpened;
		case 'order': return (event.source === 'GUEST' ? strings().evOrderGuest : strings().evOrderStaff.replace('{who}', strings().roleLabels?.[event.source === 'CASHIER' ? 'cashier' : event.source === 'BAR' ? 'bar' : 'waiter'] || event.source)).replace('{items}', itemList);
		case 'ready': return (event.station === 'BAR' ? strings().evReadyBar : strings().evReadyKitchen).replace('{n}', event.count);
		case 'bill': return strings().evBill;
		case 'closed': return strings().evClosed; // no amount - the hub may be visible to guests
		default: return '';
	}
}
const ACTIVITY_ICONS = { opened: 'open', order: 'bag', ready: 'bell', bill: 'receipt', closed: 'check' };

function activityListMarkup(events) {
	if (!events.length) return `<p class="sh-muted">${escapeHtml(strings().noActivity)}</p>`;
	return `<ul class="sh-activity">${events.map((event) => `<li>
		<span class="sh-activity-icon sh-ev-${event.type}">${icon(ACTIVITY_ICONS[event.type] || 'bag', 18)}</span>
		<span class="sh-activity-body"><strong>${escapeHtml(strings().table)} ${escapeHtml(String(event.tableNumber))}</strong><span>${escapeHtml(activityText(event))}</span></span>
		<time class="sh-activity-time">${escapeHtml(timeAgo(event.at))}</time>
	</li>`).join('')}</ul>`;
}

// Worked out from the tables already on screen - no extra server data: open
// (not yet dispatched) items per station, active tables, bills waiting.
function stationStatusMarkup(tables) {
	const openItems = (station) => tables.reduce((sum, table) => sum + (table.items || []).filter((item) => item.station === station && !item.dispatched).reduce((n, item) => n + item.quantity, 0), 0);
	const rows = [
		{ key: 'kitchen', value: strings().statusOpen.replace('{n}', openItems('KITCHEN')) },
		{ key: 'bar', value: strings().statusOpen.replace('{n}', openItems('BAR')) },
		{ key: 'hub', label: strings().roleLabels?.waiter, value: strings().statusActiveTables.replace('{n}', tables.filter((table) => table.status !== 'FREE').length) },
		{ key: 'cashier', value: strings().statusBills.replace('{n}', tables.filter((table) => table.billRequested).length) }
	];
	return `<ul class="sh-status">${rows.map((row) => `<li>
		<span class="sh-status-icon">${icon(row.key, 18)}</span>
		<span class="sh-status-name">${escapeHtml(row.label || strings().roleLabels?.[row.key] || row.key)}</span>
		<span class="sh-status-value">${escapeHtml(row.value)}</span>
	</li>`).join('')}</ul>`;
}

// Donut: today's ordered items by who entered them - guests via the QR menu
// (orange) vs staff (dark). Plain SVG circle segments, no chart library.
function summaryMarkup(summary) {
	if (!summary) return `<p class="sh-muted">${escapeHtml(strings().noActivity)}</p>`;
	const guest = summary.guestItems || 0;
	const staff = summary.staffItems || 0;
	const total = guest + staff;
	const circumference = 2 * Math.PI * 42;
	const guestLength = total ? (guest / total) * circumference : 0;
	return `<div class="sh-summary">
		<svg class="sh-donut" viewBox="0 0 100 100" role="img" aria-label="${escapeHtml(`${strings().qrOrders}: ${guest}, ${strings().staffOrders}: ${staff}`)}">
			<circle cx="50" cy="50" r="42" fill="none" stroke="${total ? '#262421' : '#e7e5e1'}" stroke-width="12"/>
			${guest ? `<circle cx="50" cy="50" r="42" fill="none" stroke="#f66a09" stroke-width="12" stroke-dasharray="${guestLength} ${circumference}" transform="rotate(-90 50 50)"/>` : ''}
			<text x="50" y="50" text-anchor="middle" class="sh-donut-number">${total}</text>
			<text x="50" y="64" text-anchor="middle" class="sh-donut-label">${escapeHtml(strings().itemsLabel)}</text>
		</svg>
		<ul class="sh-legend">
			<li><span class="sh-swatch sh-swatch-guest"></span><span>${escapeHtml(strings().qrOrders)}</span><strong>${guest}</strong></li>
			<li><span class="sh-swatch sh-swatch-staff"></span><span>${escapeHtml(strings().staffOrders)}</span><strong>${staff}</strong></li>
		</ul>
	</div>`;
}

function hubSideMarkup(tables) {
	return `<aside class="sh-side">
		<section class="sh-panel">
			<div class="sh-panel-head"><h2>${escapeHtml(strings().activityTitle)}</h2>${activityState.length > 5 ? `<button type="button" class="sh-link" data-open-history>${escapeHtml(strings().viewAll)}</button>` : ''}</div>
			${activityListMarkup(activityState.slice(0, 5))}
		</section>
		<section class="sh-panel">
			<div class="sh-panel-head"><h2>${escapeHtml(strings().statusTitle)}</h2></div>
			${stationStatusMarkup(tables)}
		</section>
		<section class="sh-panel">
			<div class="sh-panel-head"><h2>${escapeHtml(strings().summaryTitle)}</h2><span class="sh-muted">${escapeHtml(strings().today)}</span></div>
			${summaryMarkup(summaryState)}
		</section>
	</aside>`;
}

function hubTilesMarkup() {
	const tiles = [
		{ attr: 'data-open-orders', iconName: 'orders', title: strings().tileOpenOrders, sub: strings().tileOpenOrdersSub },
		{ attr: 'data-open-history', iconName: 'history', title: strings().historyTitle, sub: strings().tileHistorySub },
		{ attr: 'data-open-totals', iconName: 'totals', title: strings().tileTotals, sub: strings().tileTotalsSub },
		{ attr: 'data-show-workflow', iconName: 'help', title: strings().tileHelp, sub: strings().tileHelpSub }
	];
	return `<div class="sh-tiles">${tiles.map((tile) => `<button type="button" class="sh-tile" ${tile.attr}>
		<span class="sh-tile-icon">${icon(tile.iconName, 22)}</span>
		<span><strong>${escapeHtml(tile.title)}</strong><small>${escapeHtml(tile.sub)}</small></span>
	</button>`).join('')}</div>`;
}

// --- Sidebar -------------------------------------------------------------
function languageSwitcherMarkup() {
	return `<nav class="staff-languages" aria-label="Language">${languagesState.map((language) => `<button type="button" class="staff-lang-btn ${language === currentLang ? 'is-active' : ''}" data-lang="${escapeHtml(language)}">${escapeHtml(language.toUpperCase())}</button>`).join('')}</nav>`;
}

// Privacy policy + imprint - German has its own legal pages, every other
// language links the English ones.
function legalLinksMarkup() {
	const base = `https://smartmenusolutions.com/${currentLang === 'de' ? 'de/' : ''}`;
	return `<nav class="sh-legal"><a href="${base}privacy-policy.html" target="_blank" rel="noopener">${escapeHtml(strings().privacyLink)}</a> · <a href="${base}imprint.html" target="_blank" rel="noopener">${escapeHtml(strings().imprintLink)}</a></nav>`;
}

// A fold-out help section: the button stays put, the content unrolls
// underneath it in the sidebar - no popup covering the station's view.
function foldoutMarkup(key, title, content) {
	const open = helpOpen[key];
	return `<div class="sh-foldout ${open ? 'is-open' : ''}">
		<button type="button" class="sh-foldout-btn" data-help-toggle="${key}" aria-expanded="${open}" aria-controls="shFold-${key}">
			${icon(key === 'workflow' ? 'history' : 'help', 18)}<span>${escapeHtml(title)}</span>${icon('chevron', 16)}
		</button>
		<div class="sh-foldout-body" id="shFold-${key}" ${open ? '' : 'hidden'}>${content}</div>
	</div>`;
}

function guideContent() {
	const points = strings().guide?.[ROLE] || [];
	return `<ul class="sh-guide-list">${points.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>`;
}

// The end-to-end walkthrough (guest scan -> activation -> order ->
// kitchen/bar -> bill -> close): numbered orange steps with an icon, a
// short bold title (workflowSteps) and the longer explanation (workflow).
function workflowContent() {
	const steps = strings().workflow || [];
	const titles = strings().workflowSteps || [];
	return `<ol class="sh-steps">${steps.map((step, index) => `<li>
		<span class="sh-step-number">${index + 1}</span>
		<span class="sh-step-icon">${icon(WORKFLOW_ICONS[index] || 'check', 22)}</span>
		<span class="sh-step-text">${titles[index] ? `<strong>${escapeHtml(titles[index])}</strong>` : ''}<span>${escapeHtml(step)}</span></span>
	</li>`).join('')}</ol>`;
}

function sidebarMarkup() {
	const totalsButton = (ROLE === 'cashier' || isHub)
		? `<button type="button" class="sh-nav-btn" data-open-totals>${icon('totals', 18)}<span>${escapeHtml(strings().tileTotals)}</span></button>`
		: '';
	const soundButton = isHub
		? `<button type="button" class="sh-nav-btn ${soundOn ? '' : 'is-off'}" data-sound-toggle aria-pressed="${soundOn}">${icon(soundOn ? 'sound' : 'mute', 18)}<span>${escapeHtml(soundOn ? strings().chimeOn : strings().chimeOff)}</span></button>`
		: '';
	return `<aside class="sh-sidebar">
		<a class="sh-logo" href="https://smartmenusolutions.com/" target="_blank" rel="noopener">
			<img src="assets/images/logo-mark.png" alt="">
			<span><span class="sh-logo-smart">Smart</span><span class="sh-logo-menu">Menu</span><br>Solutions</span>
		</a>
		<p class="sh-eyebrow">Smart ServiceHub™</p>
		<h1 class="sh-station">${escapeHtml(accessLabel || strings().roleLabels?.[ROLE] || ROLE)}</h1>
		${restaurantName ? `<p class="sh-restaurant">${escapeHtml(restaurantName)}</p>` : ''}
		<p class="staff-sub"><span class="staff-refresh-dot"></span>${escapeHtml(strings().live)}</p>
		<div class="sh-nav">
			${totalsButton}
			${soundButton}
			${foldoutMarkup('guide', strings().guideButton, guideContent())}
			${foldoutMarkup('workflow', strings().workflowButton, workflowContent())}
		</div>
		<div class="sh-sidebar-foot">${languageSwitcherMarkup()}${legalLinksMarkup()}</div>
	</aside>`;
}

function mainMarkup(tables) {
	if (isHub) {
		return `<div class="sh-hub">
			<div class="sh-hub-main">
				<section class="sh-panel sh-floor">
					<div class="sh-panel-head"><h2>${icon('floor', 22)}${escapeHtml(strings().floorTitle)}</h2>
						<span class="sh-legend-inline">${HUB_STATUS_ORDER.map((status) => `<span class="sh-legend-dot sh-legend-${status.toLowerCase()}">${escapeHtml(strings().hubStatus?.[status] || status)}</span>`).join('')}</span>
					</div>
					${hubGridMarkup(tables)}
				</section>
				${hubTilesMarkup()}
			</div>
			${hubSideMarkup(tables)}
		</div>`;
	}
	return `<section class="sh-panel sh-orders">
		<div class="sh-panel-head"><h2>${icon(ROLE === 'cashier' ? 'receipt' : 'orders', 22)}${escapeHtml(strings().ordersTitle)}</h2></div>
		${tables.length ? cardGridMarkup(tables) : `<p class="staff-empty">${escapeHtml(strings().empty)}</p>`}
	</section>`;
}

function render(data) {
	menuState = data.menu || menuState;
	// An extra link the owner named, e.g. "Beach Bar" (see
	// 0023_multiple_staff_access.sql) - shown instead of the role's name.
	if (data.label !== undefined) accessLabel = data.label || '';
	if (data.activity !== undefined) activityState = Array.isArray(data.activity) ? data.activity : [];
	if (data.summary !== undefined) summaryState = data.summary || null;
	if (data.name) {
		restaurantName = data.name;
		// "Küche · El Greco — Smart ServiceHub™" - pwa.js names the installed
		// staff app after the part before " — ".
		const title = `${accessLabel || ROLE_TITLE} · ${restaurantName} — ${PRODUCT_TITLE}`;
		if (document.title !== title) document.title = title;
	}
	if (data.languages?.length) languagesState = data.languages;
	// The client's language order puts the main language first (see
	// languageDisplayOrder in admin.js) - a saved or default language that
	// isn't one of the client's enabled ones falls back to that main one.
	if (!languagesState.includes(currentLang)) currentLang = languagesState[0];
	document.documentElement.lang = currentLang;
	if (data.translations) translationsState = data.translations;
	const tables = data.tables || [];
	const popups = [
		isHub ? hubPopupMarkup(tables.find((table) => table.tableId === openHubTable)) : '',
		totalsPopupMarkup(), openOrdersPopupMarkup(), historyPopupMarkup()
	].join('');
	app.innerHTML = `<div class="sh-layout ${isHub ? 'is-hub' : ''}">
		${sidebarMarkup()}
		<main class="sh-main">${mainMarkup(tables)}</main>
	</div>${popups}`;
	wireActions();
}

function wireActions() {
	app.addEventListener('click', onAppClick);
}

async function onAppClick(event) {
	const helpToggle = event.target.closest('[data-help-toggle]');
	const showWorkflow = event.target.closest('[data-show-workflow]');
	const langButton = event.target.closest('[data-lang]');
	const dispatchItem = event.target.closest('[data-item-id]');
	const dispatchAll = event.target.closest('[data-dispatch-all]');
	const toggleAdd = event.target.closest('[data-toggle-add]');
	const addSubmit = event.target.closest('[data-add-submit]');
	const closeTable = event.target.closest('[data-close-table]');
	const deactivateTable = event.target.closest('[data-deactivate-table]');
	const activateTable = event.target.closest('[data-activate-table]');
	const removeItem = event.target.closest('[data-remove-item]');
	const requestBill = event.target.closest('[data-request-bill]');
	const hubTile = event.target.closest('[data-hub-table]');
	const popupClosed = (id) => event.target.closest(`#${id}Close`) || event.target.id === `${id}Overlay`;

	if (helpToggle) {
		const key = helpToggle.dataset.helpToggle;
		helpOpen[key] = !helpOpen[key];
		rerender();
		return;
	}
	// The hub's "So funktioniert's" tile: unroll the walkthrough in the
	// sidebar and bring it into view (on a phone the sidebar sits on top).
	if (showWorkflow) {
		helpOpen.workflow = true;
		rerender();
		app.querySelector('#shFold-workflow')?.closest('.sh-foldout')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		return;
	}

	if (event.target.closest('[data-sound-toggle]')) {
		soundOn = !soundOn;
		try { localStorage.setItem(SOUND_STORAGE_KEY, soundOn ? 'on' : 'off'); } catch { /* convenience only */ }
		unlockAudio();
		rerender();
		// Short preview when switching on, so staff hear what to listen for.
		if (soundOn) setTimeout(playChime, 120);
		return;
	}

	if (langButton) {
		currentLang = langButton.dataset.lang;
		try { localStorage.setItem(LANG_STORAGE_KEY, currentLang); } catch { /* convenience only */ }
		rerender();
		return;
	}

	if (event.target.closest('[data-open-totals]')) { totalsOpen = true; rerender(); return; }
	if (popupClosed('totalsPopup')) { totalsOpen = false; rerender(); return; }
	if (event.target.closest('[data-open-orders]')) { openOrdersOpen = true; rerender(); return; }
	if (popupClosed('openOrdersPopup')) { openOrdersOpen = false; rerender(); return; }
	if (event.target.closest('[data-open-history]')) { historyOpen = true; rerender(); return; }
	if (popupClosed('historyPopup')) { historyOpen = false; rerender(); return; }
	if (popupClosed('hubPopup')) { openHubTable = null; rerender(); return; }

	try {
		if (hubTile) {
			// Free tiles just open the confirm popup below (data-activate-table
			// is what actually calls the server) - no activation happens from
			// this tap alone, so the wrong tile is a harmless close (✕).
			const tableId = hubTile.dataset.hubTable;
			openHubTable = tableId;
			openHubTableWasFree = hubTile.dataset.hubStatus === 'FREE';
			if (hubTile.dataset.hubStatus !== 'FREE') {
				ackDispatchedCount[tableId] = (lastTables.find((table) => table.tableId === tableId)?.items || []).filter((item) => item.dispatched).length;
				saveAckDispatchedCount();
			}
			rerender();
		} else if (activateTable) {
			await callStaff({ action: 'activate_table', tableId: activateTable.dataset.activateTable });
			// The popup stays open and turns into the now-active table's order.
			openHubTableWasFree = false;
			await refresh();
		} else if (dispatchItem && isTicketRole) {
			await callStaff({ action: 'dispatch_item', itemId: dispatchItem.dataset.itemId });
			await refresh();
		} else if (dispatchAll) {
			await callStaff({ action: 'dispatch_all', tableId: dispatchAll.dataset.dispatchAll });
			await refresh();
		} else if (toggleAdd) {
			openAddFormFor = openAddFormFor === toggleAdd.dataset.toggleAdd ? null : toggleAdd.dataset.toggleAdd;
			rerender();
		} else if (addSubmit) {
			const tableId = addSubmit.dataset.addSubmit;
			const form = app.querySelector(`[data-add-form="${tableId}"]`);
			const productId = form.querySelector('[data-add-product]')?.value;
			const quantity = Number(form.querySelector('[data-add-qty]')?.value) || 1;
			const notes = form.querySelector('[data-add-notes]')?.value || undefined;
			if (!productId) return;
			addSubmit.disabled = true;
			await callStaff({ action: 'add_item', tableId, items: [{ productId, quantity, notes }] });
			openAddFormFor = null;
			await refresh();
		} else if (requestBill) {
			await callStaff({ action: 'request_bill', tableId: requestBill.dataset.requestBill });
			await refresh();
		} else if (removeItem && ROLE === 'cashier') {
			if (!confirm(strings().removeConfirm.replace('{item}', removeItem.dataset.removeLabel))) return;
			await callStaff({ action: 'remove_item', itemId: removeItem.dataset.removeItem });
			await refresh();
		} else if (closeTable) {
			if (!confirm(strings().closeConfirm)) return;
			await callStaff({ action: 'close_table', tableId: closeTable.dataset.closeTable });
			await refresh();
		} else if (deactivateTable) {
			await callStaff({ action: 'deactivate_table', tableId: deactivateTable.dataset.deactivateTable });
			await refresh();
		}
	} catch (error) {
		alert(error.message);
	}
}

let lastTables = [];

function rerender() {
	render({ tables: lastTables, menu: menuState, languages: languagesState, translations: translationsState });
}

document.addEventListener('keydown', (event) => {
	if (event.key !== 'Escape') return;
	if (openHubTable || totalsOpen || openOrdersOpen || historyOpen) {
		openHubTable = null; totalsOpen = false; openOrdersOpen = false; historyOpen = false;
		rerender();
	}
});

async function refresh() {
	const response = await fetch(viewUrl());
	const data = await response.json().catch(() => ({}));
	if (!response.ok) { app.innerHTML = `<p class="staff-empty">${escapeHtml(data.error || strings().linkInvalid)}</p>`; return; }
	lastTables = data.tables || [];
	chimeForNewReadyItems(lastTables);
	// A table popped from the list, or an open table's popup whose table got
	// closed elsewhere (it's FREE now) - don't leave a stale popup showing.
	// A FREE table's own "Aktivieren" confirm popup stays open.
	if (openHubTable) {
		const current = lastTables.find((table) => table.tableId === openHubTable);
		if (!current || (current.status === 'FREE' && !openHubTableWasFree)) openHubTable = null;
	}
	render(data);
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

async function subscribeRealtime(menuSlug) {
	try {
		await loadSupabaseJs();
		const client = window.supabase.createClient(AUTH_CONFIG.supabaseUrl, AUTH_CONFIG.supabasePublishableKey);
		client.channel(`restaurant:${menuSlug}`)
			.on('broadcast', { event: 'update' }, () => refresh())
			.on('broadcast', { event: 'menu_updated' }, () => refresh())
			.subscribe();
	} catch { /* falls back to the polling interval below */ }
	// Cheap safety net in case a broadcast is ever missed (network hiccup,
	// tab was backgrounded) - staff screens need to stay correct, not just
	// fast, so this polls regardless of whether realtime connected. Also
	// keeps the hub's "vor 3 Min." activity times current.
	setInterval(refresh, 20000);
}

async function init() {
	if (!token) { app.innerHTML = `<p class="staff-empty">${escapeHtml(strings().linkIncomplete)}</p>`; return; }
	const response = await fetch(viewUrl());
	const data = await response.json().catch(() => ({}));
	if (!response.ok) { app.innerHTML = `<p class="staff-empty">${escapeHtml(data.error || strings().linkInvalid)}</p>`; return; }
	lastTables = data.tables || [];
	chimeForNewReadyItems(lastTables);
	render(data);
	if (data.menuSlug) subscribeRealtime(data.menuSlug);
}

// No connection (e.g. the installed app opened offline from its cached
// shell): say so instead of "Laden…" forever, and start over once back online.
init().catch(() => {
	app.innerHTML = `<p class="staff-empty">${escapeHtml(strings().offline || strings().linkInvalid)}</p>`;
	window.addEventListener('online', () => location.reload(), { once: true });
});
