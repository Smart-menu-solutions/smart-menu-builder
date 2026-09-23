// Shared page logic for waiter.html/kitchen.html/bar.html/cashier.html -
// each page sets window.STAFF_ROLE before loading this file, everything
// else (fetch, render, actions, realtime) branches on that one value
// instead of duplicating four near-identical files. See staff-access Edge
// Function for what each role actually receives. "waiter" is the Table Hub:
// a grid of every table (see hubTileMarkup/renderHub) rather than a card
// list, because its whole job is showing which tables are FREE and letting
// staff activate the next one - see 0017_table_hub.sql for why that
// replaced the old per-table QR secret.

const ROLE = window.STAFF_ROLE;
const token = new URLSearchParams(location.search).get('t');
const app = document.querySelector('#app');
const isTicketRole = ROLE === 'kitchen' || ROLE === 'bar';
const isHub = ROLE === 'waiter';
const canAddItems = ROLE === 'bar' || ROLE === 'waiter' || ROLE === 'cashier';
const LANG_STORAGE_KEY = `smartmenu.staff.lang.${ROLE}`;

let menuState = null;
let restaurantName = '';
let languagesState = ['de'];
let translationsState = {};
let openAddFormFor = null;
let guideOpen = false;
let openHubTable = null; // hub only: which table's popup is showing
let totalsOpen = false; // cashier only: the "Gesamtübersicht" popup
const ackDispatchedCount = {}; // hub only: dispatched-item count last seen per table, to know when the bell is "new"

// item.name/product_name is a source-language snapshot (see
// 0015_smartservice_hub.sql) - looked up by that source text, same as
// menu.js's itemTranslation()/categoryName(), so it works even though
// order_items has no language-keyed fields of its own.
function translateName(sourceName) {
	return translationsState?.[currentLang]?.items?.[sourceName]?.name || sourceName;
}
function translateCategoryName(sourceName) {
	return translationsState?.[currentLang]?.categories?.[sourceName]?.name || sourceName;
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

function staffEndpoint() { return `${AUTH_CONFIG.supabaseUrl}/functions/v1/staff-access`; }

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
	const priceMarkup = withPrice ? `<span class="staff-item-price">${((item.unitPriceCents || 0) / 100).toFixed(2)} €</span>` : '';
	return `<div class="staff-item-row ${item.dispatched ? 'is-done' : ''}" ${clickable ? `data-item-id="${item.id}"` : ''}>
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
// for the cashier a clickable shortcut straight to "Tisch schließen" - a
// bell rather than a card-suit emoji, since 💳 doesn't render everywhere
// (shows as a blank/tofu box on some devices) while 🔔 already has to work
// reliably for the Table Hub's own bell.
function billFlagMarkup(table) {
	if (!table.billRequested) return '';
	if (ROLE !== 'cashier') return `<span class="staff-bill-flag" title="${escapeHtml(strings().billFlagHint)}">🔔</span>`;
	return `<button type="button" class="staff-bill-flag" data-close-table="${table.tableId}" title="${escapeHtml(strings().billFlagHint)}">🔔</button>`;
}

function cardMarkup(table) {
	const withPrice = ROLE === 'cashier';
	const bill = billFlagMarkup(table);
	const total = withPrice ? `<span class="staff-card-total">${((table.totalCents || 0) / 100).toFixed(2)} €</span>` : '';
	const rows = sortItems(table.items).map((item) => itemRowMarkup(item, withPrice, isTicketRole)).join('');
	return `<div class="staff-card ${table.billRequested ? 'is-bill-requested' : ''}" data-table-id="${table.tableId}">
		<div class="staff-card-head"><h3>${escapeHtml(strings().table)} ${escapeHtml(String(table.tableNumber))}${bill}</h3>${total}</div>
		<div class="staff-card-rows">${rows}</div>
		${cardActionsMarkup(table)}
	</div>`;
}

// --- Table Hub (waiter role): a grid of every table instead of a card list.
// Tapping a FREE tile activates it right away (no confirmation - it's the
// low-risk direction, closing is what actually settles a bill). Tapping an
// ACTIVE/PAYMENT_PENDING tile opens a popup with that table's order, same
// row markup as the card view. See 0017_table_hub.sql for why FREE tiles
// carry no secret of any kind.
function hubTileMarkup(table) {
	const statusClass = table.status === 'FREE' ? 'hub-tile-free' : table.status === 'PAYMENT_PENDING' ? 'hub-tile-pending' : 'hub-tile-active';
	const dispatchedCount = (table.items || []).filter((item) => item.dispatched).length;
	const bell = table.status !== 'FREE' && dispatchedCount > (ackDispatchedCount[table.tableId] || 0);
	return `<button type="button" class="hub-tile ${statusClass}" data-hub-table="${table.tableId}" data-hub-status="${table.status}">
		${bell ? '<span class="hub-bell" aria-hidden="true">🔔</span>' : ''}
		<span class="hub-tile-number">${escapeHtml(strings().table)} ${escapeHtml(String(table.tableNumber))}</span>
		<span class="hub-tile-status">${escapeHtml(strings().hubStatus?.[table.status] || table.status)}</span>
	</button>`;
}

// Grouped into three rows by status - Frei on top, Aktiv in the middle,
// Besetzt/Rechnung at the bottom - instead of one mixed grid, so a table
// visibly jumps to the row that matches its current status the moment it
// changes, rather than staying in place with just its color/label updating.
const HUB_STATUS_ORDER = ['FREE', 'ACTIVE', 'PAYMENT_PENDING'];
function hubGridMarkup(tables) {
	return HUB_STATUS_ORDER
		.map((status) => tables.filter((table) => table.status === status))
		.filter((group) => group.length)
		.map((group) => `<div class="hub-grid">${group.map(hubTileMarkup).join('')}</div>`)
		.join('');
}

function hubPopupMarkup(table) {
	if (!table) return '';
	const total = `<span class="staff-card-total">${((table.totalCents || 0) / 100).toFixed(2)} €</span>`;
	const rows = sortItems(table.items).map((item) => itemRowMarkup(item, true, false)).join('') || `<p class="staff-empty">${escapeHtml(strings().hubEmptyOrder)}</p>`;
	return `<div class="hub-popup-overlay" id="hubPopupOverlay">
		<div class="hub-popup-box" role="dialog" aria-modal="true">
			<button type="button" class="smart-match-close" id="hubPopupClose" aria-label="Close">✕</button>
			<div class="staff-card-head"><h3>${escapeHtml(strings().table)} ${escapeHtml(String(table.tableNumber))}${billFlagMarkup(table)}</h3>${total}</div>
			<div class="staff-card-rows">${rows}</div>
			<div class="staff-card-actions">
				<button type="button" class="staff-btn" data-toggle-add="${table.tableId}">${escapeHtml(strings().addItem)}</button>
				<button type="button" class="staff-btn staff-btn-primary" data-request-bill="${table.tableId}" ${table.billRequested ? 'disabled' : ''}>${escapeHtml(table.billRequested ? strings().billRequested : strings().requestBill)}</button>
			</div>
			${addFormMarkup(table.tableId)}
		</div>
	</div>`;
}

function totalsPopupMarkup() {
	if (!totalsOpen) return '';
	const grandTotal = lastTables.reduce((sum, table) => sum + (table.totalCents || 0), 0);
	return `<div class="hub-popup-overlay" id="totalsPopupOverlay">
		<div class="hub-popup-box" role="dialog" aria-modal="true">
			<button type="button" class="smart-match-close" id="totalsPopupClose" aria-label="Close">✕</button>
			<h2>${escapeHtml(strings().totalsHeading)}</h2>
			<p class="staff-card-total staff-grand-total">${(grandTotal / 100).toFixed(2)} €</p>
		</div>
	</div>`;
}

function languageSwitcherMarkup() {
	return `<nav class="staff-languages" aria-label="Language">${languagesState.map((language) => `<button type="button" class="staff-lang-btn ${language === currentLang ? 'is-active' : ''}" data-lang="${escapeHtml(language)}">${escapeHtml(language.toUpperCase())}</button>`).join('')}</nav>`;
}

// Small "? Guide" dropdown in the header: a few short bullets per role
// (staff-strings.js -> guide). guideOpen lives outside render() because the
// page re-renders on every live update and would otherwise close it.
function guideMarkup() {
	const points = strings().guide?.[ROLE] || [];
	if (!points.length) return '';
	return `<div class="staff-guide">
		<button type="button" class="staff-guide-btn ${guideOpen ? 'is-open' : ''}" data-guide-toggle aria-expanded="${guideOpen}" aria-controls="staffGuidePanel">? ${escapeHtml(strings().guideButton)}</button>
		<div class="staff-guide-panel" id="staffGuidePanel" ${guideOpen ? '' : 'hidden'}>
			<h2>${escapeHtml(strings().guideTitle)}</h2>
			<ul>${points.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>
		</div>
	</div>`;
}

function headerToolsMarkup() {
	const totalsButton = ROLE === 'cashier' ? `<button type="button" class="staff-btn" data-open-totals>${escapeHtml(strings().totalsButton)}</button>` : '';
	return `${totalsButton}${guideMarkup()}${languageSwitcherMarkup()}`;
}

function render(data) {
	menuState = data.menu || menuState;
	if (data.name) restaurantName = data.name;
	if (data.languages?.length) languagesState = data.languages;
	// The client's language order puts the main language first (see
	// languageDisplayOrder in admin.js) - a saved or default language that
	// isn't one of the client's enabled ones falls back to that main one.
	if (!languagesState.includes(currentLang)) currentLang = languagesState[0];
	if (data.translations) translationsState = data.translations;
	const tables = data.tables || [];
	const body = isHub
		? `${hubGridMarkup(tables)}${hubPopupMarkup(tables.find((table) => table.tableId === openHubTable))}`
		: (tables.length ? `<div class="staff-grid">${tables.map(cardMarkup).join('')}</div>` : `<p class="staff-empty">${escapeHtml(strings().empty)}</p>`) + totalsPopupMarkup();
	app.innerHTML = `
		<header class="staff-header">
			<div><h1>${escapeHtml(strings().roleLabels?.[ROLE] || ROLE)}</h1><p class="staff-sub"><span class="staff-refresh-dot"></span>${escapeHtml(strings().live)}</p></div>
			<div class="staff-brand">
				${restaurantName ? `<p class="staff-brand-name">${escapeHtml(restaurantName)}</p>` : ''}
				<a class="staff-brand-tag" href="https://smart-menu-solutions.github.io/smart-menu-solutions/index.html" target="_blank" rel="noopener"><img src="assets/images/logo-white.png" alt="Smart Menu Solutions logo"><span>Digital menu by Smart Menu Solutions</span></a>
			</div>
			<div class="staff-header-tools">${headerToolsMarkup()}</div>
		</header>
		${body}
	`;
	wireActions();
}

function wireActions() {
	app.addEventListener('click', onAppClick);
}

async function onAppClick(event) {
	const guideToggle = event.target.closest('[data-guide-toggle]');
	const langButton = event.target.closest('[data-lang]');
	const dispatchItem = event.target.closest('[data-item-id]');
	const dispatchAll = event.target.closest('[data-dispatch-all]');
	const toggleAdd = event.target.closest('[data-toggle-add]');
	const addSubmit = event.target.closest('[data-add-submit]');
	const closeTable = event.target.closest('[data-close-table]');
	const removeItem = event.target.closest('[data-remove-item]');
	const requestBill = event.target.closest('[data-request-bill]');
	const hubTile = event.target.closest('[data-hub-table]');
	const hubPopupClose = event.target.closest('#hubPopupClose') || event.target.id === 'hubPopupOverlay' && event.target;
	const openTotals = event.target.closest('[data-open-totals]');
	const totalsClose = event.target.closest('#totalsPopupClose') || event.target.id === 'totalsPopupOverlay' && event.target;

	if (guideToggle) {
		guideOpen = !guideOpen;
		rerender();
		return;
	}

	if (langButton) {
		currentLang = langButton.dataset.lang;
		try { localStorage.setItem(LANG_STORAGE_KEY, currentLang); } catch { /* convenience only */ }
		rerender();
		return;
	}

	if (openTotals) { totalsOpen = true; rerender(); return; }
	if (totalsClose) { totalsOpen = false; rerender(); return; }

	if (hubPopupClose) { openHubTable = null; rerender(); return; }

	try {
		if (hubTile) {
			const tableId = hubTile.dataset.hubTable;
			if (hubTile.dataset.hubStatus === 'FREE') {
				await callStaff({ action: 'activate_table', tableId });
				await refresh();
			} else {
				openHubTable = tableId;
				ackDispatchedCount[tableId] = (lastTables.find((table) => table.tableId === tableId)?.items || []).filter((item) => item.dispatched).length;
				rerender();
			}
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
		}
	} catch (error) {
		alert(error.message);
	}
}

let lastTables = [];

function rerender() {
	render({ tables: lastTables, menu: menuState, languages: languagesState, translations: translationsState });
}

// Close the guide on a click anywhere else, or on Escape.
document.addEventListener('click', (event) => {
	if (guideOpen && !event.target.closest('.staff-guide')) { guideOpen = false; rerender(); }
});
document.addEventListener('keydown', (event) => {
	if (event.key === 'Escape' && guideOpen) { guideOpen = false; rerender(); }
	if (event.key === 'Escape' && openHubTable) { openHubTable = null; rerender(); }
	if (event.key === 'Escape' && totalsOpen) { totalsOpen = false; rerender(); }
});

async function refresh() {
	const response = await fetch(`${staffEndpoint()}?t=${encodeURIComponent(token)}`);
	const data = await response.json().catch(() => ({}));
	if (!response.ok) { app.innerHTML = `<p class="staff-empty">${escapeHtml(data.error || strings().linkInvalid)}</p>`; return; }
	lastTables = data.tables || [];
	// A table popped from the list (closed elsewhere) or is no longer open -
	// don't leave a stale popup showing.
	if (openHubTable && !lastTables.some((table) => table.tableId === openHubTable && table.status !== 'FREE')) openHubTable = null;
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
	// fast, so this polls regardless of whether realtime connected.
	setInterval(refresh, 20000);
}

async function init() {
	if (!token) { app.innerHTML = `<p class="staff-empty">${escapeHtml(strings().linkIncomplete)}</p>`; return; }
	const response = await fetch(`${staffEndpoint()}?t=${encodeURIComponent(token)}`);
	const data = await response.json().catch(() => ({}));
	if (!response.ok) { app.innerHTML = `<p class="staff-empty">${escapeHtml(data.error || strings().linkInvalid)}</p>`; return; }
	lastTables = data.tables || [];
	render(data);
	if (data.menuSlug) subscribeRealtime(data.menuSlug);
}

init();
