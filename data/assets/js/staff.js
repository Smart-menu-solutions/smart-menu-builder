// Shared page logic for waiter.html/kitchen.html/bar.html/cashier.html -
// each page sets window.STAFF_ROLE before loading this file, everything
// else (fetch, render, actions, realtime) branches on that one value
// instead of duplicating four near-identical files. See staff-access Edge
// Function for what each role actually receives.

const ROLE = window.STAFF_ROLE;
const token = new URLSearchParams(location.search).get('t');
const app = document.querySelector('#app');
const isTicketRole = ROLE === 'kitchen' || ROLE === 'bar';
const canAddItems = ROLE === 'bar' || ROLE === 'waiter' || ROLE === 'cashier';
const LANG_STORAGE_KEY = `smartmenu.staff.lang.${ROLE}`;

let menuState = null;
let restaurantName = '';
let allTablesState = [];
let languagesState = ['de'];
let translationsState = {};
let openAddFormFor = null;
let guideOpen = false;

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
	const serveField = ROLE === 'waiter'
		? `<select data-add-serve><option value="">${escapeHtml(strings().serveHere)}</option>${allTablesState.filter((table) => table.id !== tableId).map((table) => `<option value="${escapeHtml(table.id)}">${escapeHtml(strings().serveAt.replace('{n}', table.tableNumber))}</option>`).join('')}</select>`
		: '';
	return `<div class="staff-add-form ${open ? 'is-open' : ''}" data-add-form="${tableId}">
		<select data-add-product>${menuOptionsMarkup()}</select>
		<input type="number" min="1" value="1" data-add-qty>
		<input type="text" data-add-notes placeholder="${escapeHtml(strings().notesPlaceholder)}">
		${serveField}
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

function cardMarkup(table) {
	const withPrice = ROLE === 'waiter' || ROLE === 'cashier';
	const bill = table.billRequested ? '<span class="staff-bill-flag">💳</span>' : '';
	const total = withPrice ? `<span class="staff-card-total">${((table.totalCents || 0) / 100).toFixed(2)} €</span>` : '';
	const primaryRows = sortItems(table.items).map((item) => itemRowMarkup(item, withPrice, isTicketRole)).join('');
	const secondaryLabel = ROLE === 'kitchen' ? strings().drinksInfoOnly : strings().dishesInfoOnly;
	const secondary = isTicketRole && table.otherItems?.length
		? `<div class="staff-secondary"><p class="staff-secondary-label">${escapeHtml(secondaryLabel)}</p>${sortItems(table.otherItems).map((item) => itemRowMarkup(item, false, false)).join('')}</div>`
		: '';
	return `<div class="staff-card ${table.billRequested ? 'is-bill-requested' : ''}" data-table-id="${table.tableId}">
		<div class="staff-card-head"><h3>${escapeHtml(strings().table)} ${escapeHtml(String(table.tableNumber))}${bill}</h3>${total}</div>
		<div class="staff-card-rows">${primaryRows}</div>
		${secondary}
		${cardActionsMarkup(table)}
	</div>`;
}

function callsMarkup(calls) {
	if (ROLE !== 'waiter' || !calls?.length) return '';
	return `<div class="staff-calls">${calls.map((call) => `
		<div class="staff-call-row" data-call-id="${call.id}">
			<span>${escapeHtml(strings().callRow)}</span>
			<button type="button" class="staff-btn" data-resolve-call="${call.id}">${escapeHtml(strings().resolveCall)}</button>
		</div>`).join('')}</div>`;
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

function render(data) {
	menuState = data.menu || menuState;
	if (data.name) restaurantName = data.name;
	allTablesState = data.allTables || allTablesState;
	if (data.languages?.length) languagesState = data.languages;
	// The client's language order puts the main language first (see
	// languageDisplayOrder in admin.js) - a saved or default language that
	// isn't one of the client's enabled ones falls back to that main one.
	if (!languagesState.includes(currentLang)) currentLang = languagesState[0];
	if (data.translations) translationsState = data.translations;
	const tables = data.tables || [];
	const allCalls = (data.tables || []).flatMap((table) => table.waiterCalls || []);
	app.innerHTML = `
		<header class="staff-header">
			<div><h1>${escapeHtml(strings().roleLabels?.[ROLE] || ROLE)}</h1><p class="staff-sub"><span class="staff-refresh-dot"></span>${escapeHtml(strings().live)}</p></div>
			<div class="staff-brand">
				${restaurantName ? `<p class="staff-brand-name">${escapeHtml(restaurantName)}</p>` : ''}
				<a class="staff-brand-tag" href="https://smart-menu-solutions.github.io/smart-menu-solutions/index.html" target="_blank" rel="noopener"><img src="assets/images/logo-white.png" alt="Smart Menu Solutions logo"><span>Digital menu by Smart Menu Solutions</span></a>
			</div>
			<div class="staff-header-tools">${guideMarkup()}${languageSwitcherMarkup()}</div>
		</header>
		${callsMarkup(allCalls)}
		${tables.length ? `<div class="staff-grid">${tables.map(cardMarkup).join('')}</div>` : `<p class="staff-empty">${escapeHtml(strings().empty)}</p>`}
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
	const resolveCall = event.target.closest('[data-resolve-call]');

	if (guideToggle) {
		guideOpen = !guideOpen;
		rerender();
		return;
	}

	if (langButton) {
		currentLang = langButton.dataset.lang;
		try { localStorage.setItem(LANG_STORAGE_KEY, currentLang); } catch { /* convenience only */ }
		render({ tables: lastTables, menu: menuState, allTables: allTablesState, languages: languagesState, translations: translationsState });
		return;
	}

	try {
		if (dispatchItem && isTicketRole) {
			await callStaff({ action: 'dispatch_item', itemId: dispatchItem.dataset.itemId });
			await refresh();
		} else if (dispatchAll) {
			await callStaff({ action: 'dispatch_all', tableId: dispatchAll.dataset.dispatchAll });
			await refresh();
		} else if (toggleAdd) {
			openAddFormFor = openAddFormFor === toggleAdd.dataset.toggleAdd ? null : toggleAdd.dataset.toggleAdd;
			render({ tables: lastTables, menu: menuState, allTables: allTablesState, languages: languagesState, translations: translationsState });
		} else if (addSubmit) {
			const tableId = addSubmit.dataset.addSubmit;
			const form = app.querySelector(`[data-add-form="${tableId}"]`);
			const productId = form.querySelector('[data-add-product]')?.value;
			const quantity = Number(form.querySelector('[data-add-qty]')?.value) || 1;
			const notes = form.querySelector('[data-add-notes]')?.value || undefined;
			const serveTableId = form.querySelector('[data-add-serve]')?.value || undefined;
			if (!productId) return;
			addSubmit.disabled = true;
			await callStaff({ action: 'add_item', tableId, serveTableId, items: [{ productId, quantity, notes }] });
			openAddFormFor = null;
			await refresh();
		} else if (removeItem && ROLE === 'cashier') {
			if (!confirm(strings().removeConfirm.replace('{item}', removeItem.dataset.removeLabel))) return;
			await callStaff({ action: 'remove_item', itemId: removeItem.dataset.removeItem });
			await refresh();
		} else if (closeTable) {
			if (!confirm(strings().closeConfirm)) return;
			await callStaff({ action: 'close_table', tableId: closeTable.dataset.closeTable });
			await refresh();
		} else if (resolveCall) {
			await callStaff({ action: 'resolve_call', callId: resolveCall.dataset.resolveCall });
			await refresh();
		}
	} catch (error) {
		alert(error.message);
	}
}

let lastTables = [];

function rerender() {
	render({ tables: lastTables, menu: menuState, allTables: allTablesState, languages: languagesState, translations: translationsState });
}

// Close the guide on a click anywhere else, or on Escape.
document.addEventListener('click', (event) => {
	if (guideOpen && !event.target.closest('.staff-guide')) { guideOpen = false; rerender(); }
});
document.addEventListener('keydown', (event) => {
	if (event.key === 'Escape' && guideOpen) { guideOpen = false; rerender(); }
});

async function refresh() {
	const response = await fetch(`${staffEndpoint()}?t=${encodeURIComponent(token)}`);
	const data = await response.json().catch(() => ({}));
	if (!response.ok) { app.innerHTML = `<p class="staff-empty">${escapeHtml(data.error || strings().linkInvalid)}</p>`; return; }
	lastTables = data.tables || [];
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
