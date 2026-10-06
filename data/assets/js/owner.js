/* "SmartPilot" - the restaurant owner's app (owner.html?t=<token>).
   Everything comes from the owner-app Edge Function; the token in the link
   is the only credential (see 0035_owner_app.sql). Installable via pwa.js /
   manifest-owner.webmanifest, which keeps ?t= in the installed app's start
   URL. Texts in de/en/it - the languages our customer emails use. */
(function () {
	const params = new URLSearchParams(location.search);
	const token = params.get('t') || '';
	const LANGS = ['de', 'en', 'it'];
	const LOCALES = { de: 'de-DE', en: 'en-GB', it: 'it-IT' };
	const SITE = 'https://smartmenusolutions.com';
	const CONTACT = 'info@smartmenusolutions.com';
	const PLAN_NAMES = { start: 'Smart Start', pro: 'Smart Pro', premium: 'Smart Premium', discovery: 'Smart Discovery' };

	const TEXT = {
		de: {
			appName: 'SmartPilot', shortName: 'SmartPilot', loading: 'Wird geladen …',
			invalidTitle: 'Link nicht gültig', invalid: 'Bitte wenden Sie sich an {contact}.',
			offlineTitle: 'Keine Verbindung', offline: 'Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.', retry: 'Erneut versuchen',
			online: '● Online', notOnline: '● Offline',
			installTitle: 'Als App installieren', installText: 'Immer griffbereit auf Ihrem Startbildschirm.', install: 'Installieren',
			installIos: 'Tippen Sie unten auf das Teilen-Symbol und dann auf „Zum Home-Bildschirm“.',
			views: 'Aufrufe der Speisekarte · letzte 7 Tage', vsPrev: '{p} % zur Vorwoche', noViews: 'In den letzten 7 Tagen gab es noch keine Aufrufe.',
			topDishes: 'Beliebteste Gerichte', fullReport: 'Ganzer Bericht →',
			lockedTitle: 'Wie oft wird Ihre Speisekarte geöffnet?', lockedText: 'Mit Smart WeeklyReport™ sehen Sie hier jede Woche Ihre Aufrufe und Ihre beliebtesten Gerichte.',
			lockedButton: 'WeeklyReport hinzufügen', lockedAsk: 'Bei uns anfragen',
			plan: 'Ihr Paket', activeUntil: 'aktiv bis {date}', expiredOn: 'abgelaufen am {date} – bitte verlängern', inactive: 'nicht aktiv',
			discoveryWaiting: 'startet, sobald Ihre Speisekarte online ist', discoveryDay: 'Tag {n} von 7 · offline ab {date}', discoveryEnded: 'beendet am {date}',
			addons: 'Zusatzmodule',
			openMenu: 'Speisekarte öffnen', qr: 'QR-Code', tableCards: 'Tischkarten', change: 'Änderung schicken', addonsTile: 'Zusatzmodule', renew: 'Verlängern', upgrade: 'Upgrade',
			changeSubject: 'Änderung Speisekarte – {name}', changeBody: 'Hallo Smart Menu Solutions Team,\n\nbitte ändern Sie in unserer Speisekarte Folgendes:\n\n',
			questions: 'Fragen? {contact}', privacy: 'Datenschutz', privacyPath: '/de/privacy-policy.html',
			popupBlocked: 'Bitte erlauben Sie Pop-ups für diese Seite.',
			cards: { title: 'Tischkarten – {name}', print: 'Drucken / als PDF speichern', summaryTables: '{tables} Tische mit „Scannen & bestellen“, dazu ein Blatt „Einfach scannen“ für Eingang, Bar oder Fenster – {sheets} Blätter A4.', summaryMenu: 'Ein Blatt A4 mit 4 Karten „Einfach scannen“.', hint: 'Entlang der gestrichelten Linien schneiden, am besten dickeres Papier (ab 250 g/m²). Im Druckdialog Skalierung 100 % wählen.' }
		},
		en: {
			appName: 'SmartPilot', shortName: 'SmartPilot', loading: 'Loading …',
			invalidTitle: 'Link not valid', invalid: 'Please contact {contact}.',
			offlineTitle: 'No connection', offline: 'Please check your internet connection and try again.', retry: 'Try again',
			online: '● Online', notOnline: '● Offline',
			installTitle: 'Install as an app', installText: 'Always at hand on your home screen.', install: 'Install',
			installIos: 'Tap the share icon at the bottom, then "Add to Home Screen".',
			views: 'Menu views · last 7 days', vsPrev: '{p} % vs. last week', noViews: 'No views in the last 7 days yet.',
			topDishes: 'Most popular dishes', fullReport: 'Full report →',
			lockedTitle: 'How often is your menu opened?', lockedText: 'With Smart WeeklyReport™ you see your views and your most popular dishes here every week.',
			lockedButton: 'Add WeeklyReport', lockedAsk: 'Ask us',
			plan: 'Your plan', activeUntil: 'active until {date}', expiredOn: 'expired on {date} – please renew', inactive: 'not active',
			discoveryWaiting: 'starts once your menu is online', discoveryDay: 'Day {n} of 7 · offline from {date}', discoveryEnded: 'ended on {date}',
			addons: 'Add-ons',
			openMenu: 'Open menu', qr: 'QR code', tableCards: 'Table cards', change: 'Send a change', addonsTile: 'Add-ons', renew: 'Renew', upgrade: 'Upgrade',
			changeSubject: 'Menu change – {name}', changeBody: 'Hello Smart Menu Solutions team,\n\nplease change the following in our menu:\n\n',
			questions: 'Questions? {contact}', privacy: 'Privacy', privacyPath: '/privacy-policy.html',
			popupBlocked: 'Please allow pop-ups for this page.',
			cards: { title: 'Table cards – {name}', print: 'Print / save as PDF', summaryTables: '{tables} tables with "Scan & order", plus one sheet of "Just scan" cards for the entrance, bar or window – {sheets} A4 sheets.', summaryMenu: 'One A4 sheet with 4 "Just scan" cards.', hint: 'Cut along the dashed lines, ideally on thicker paper (250 g/m² or more). Choose 100% scale in the print dialog.' }
		},
		it: {
			appName: 'SmartPilot', shortName: 'SmartPilot', loading: 'Caricamento …',
			invalidTitle: 'Link non valido', invalid: 'Contattateci a {contact}.',
			offlineTitle: 'Nessuna connessione', offline: 'Controllate la connessione a internet e riprovate.', retry: 'Riprova',
			online: '● Online', notOnline: '● Offline',
			installTitle: 'Installa come app', installText: 'Sempre a portata di mano sulla schermata Home.', install: 'Installa',
			installIos: 'Toccate l\'icona di condivisione in basso e poi "Aggiungi alla schermata Home".',
			views: 'Visite al menu · ultimi 7 giorni', vsPrev: '{p} % rispetto alla settimana scorsa', noViews: 'Nessuna visita negli ultimi 7 giorni.',
			topDishes: 'Piatti più visti', fullReport: 'Report completo →',
			lockedTitle: 'Quante volte viene aperto il vostro menu?', lockedText: 'Con Smart WeeklyReport™ vedete qui ogni settimana le visite e i piatti più visti.',
			lockedButton: 'Aggiungi WeeklyReport', lockedAsk: 'Scriveteci',
			plan: 'Il vostro piano', activeUntil: 'attivo fino al {date}', expiredOn: 'scaduto il {date} – rinnovate', inactive: 'non attivo',
			discoveryWaiting: 'inizia quando il vostro menu è online', discoveryDay: 'Giorno {n} di 7 · offline dal {date}', discoveryEnded: 'terminato il {date}',
			addons: 'Add-on',
			openMenu: 'Apri il menu', qr: 'QR code', tableCards: 'Segnatavolo', change: 'Invia una modifica', addonsTile: 'Add-on', renew: 'Rinnova', upgrade: 'Upgrade',
			changeSubject: 'Modifica menu – {name}', changeBody: 'Buongiorno Smart Menu Solutions Team,\n\nvi preghiamo di modificare nel nostro menu:\n\n',
			questions: 'Domande? {contact}', privacy: 'Privacy', privacyPath: '/it/privacy-policy.html',
			popupBlocked: 'Consentite i pop-up per questa pagina.',
			cards: { title: 'Segnatavolo – {name}', print: 'Stampa / salva come PDF', summaryTables: '{tables} tavoli con "Scansionate e ordinate", più un foglio "Basta scansionare" per ingresso, bar o vetrina – {sheets} fogli A4.', summaryMenu: 'Un foglio A4 con 4 segnatavolo "Basta scansionare".', hint: 'Tagliate lungo le linee tratteggiate, meglio su carta più spessa (da 250 g/m²). Nella finestra di stampa scegliete scala 100 %.' }
		}
	};

	const ICONS = {
		menu: '<path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>',
		qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M20 20h.01M17 17h3v3"/>',
		cards: '<path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
		change: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
		addons: '<path d="M12 3v18M3 12h18"/>',
		renew: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'
	};

	let lang = LANGS.includes(params.get('lang')) ? params.get('lang') : null;
	let data = null;
	let installPrompt = null;
	const app = document.getElementById('app');

	function t() { return TEXT[lang || 'de']; }
	function escapeHtml(value) {
		return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
	}
	function icon(name) {
		return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
	}
	function formatDate(iso) {
		const date = new Date(`${iso}T12:00:00Z`);
		return date.toLocaleDateString(LOCALES[lang], { day: '2-digit', month: '2-digit', year: 'numeric' });
	}
	function addDays(iso, days) {
		const date = new Date(`${iso}T12:00:00Z`);
		date.setUTCDate(date.getUTCDate() + days);
		return date.toISOString().slice(0, 10);
	}
	function weekday(iso) {
		return new Date(`${iso}T12:00:00Z`).toLocaleDateString(LOCALES[lang], { weekday: 'short' }).replace('.', '');
	}

	function setLanguage(next) {
		lang = LANGS.includes(next) ? next : 'de';
		document.documentElement.lang = lang;
		// Read by pwa.js when it rebuilds the manifest on the title change below.
		const manifest = document.querySelector('link[rel="manifest"]');
		if (manifest) manifest.dataset.shortName = t().shortName;
		const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
		if (appleTitle) appleTitle.content = t().shortName;
	}

	function showMessage(title, text, retry) {
		app.innerHTML = `<div class="owner-error"><b>${escapeHtml(title)}</b>${escapeHtml(text)}${retry ? `<p><button type="button" class="o-btn" id="retry">${escapeHtml(t().retry)}</button></p>` : ''}</div>`;
		if (retry) document.getElementById('retry').addEventListener('click', load);
	}

	async function load() {
		setLanguage(lang || (navigator.language || 'de').slice(0, 2));
		app.innerHTML = `<p class="owner-loading">${escapeHtml(t().loading)}</p>`;
		if (!/^[0-9a-f-]{36}$/i.test(token)) {
			showMessage(t().invalidTitle, t().invalid.replace('{contact}', CONTACT));
			return;
		}
		let response;
		try {
			const query = new URLSearchParams({ t: token });
			if (params.get('lang')) query.set('lang', params.get('lang'));
			response = await fetch(`${AUTH_CONFIG.supabaseUrl}/functions/v1/owner-app?${query}`, { cache: 'no-store' });
		} catch {
			showMessage(t().offlineTitle, t().offline, true);
			return;
		}
		if (response.status === 400 || response.status === 404) {
			showMessage(t().invalidTitle, t().invalid.replace('{contact}', CONTACT));
			return;
		}
		if (!response.ok) {
			showMessage(t().offlineTitle, t().offline, true);
			return;
		}
		data = await response.json();
		// No ?lang= in the link: the language the customer ordered in.
		if (!params.get('lang')) setLanguage(data.lang);
		document.title = `${data.name} · ${t().appName}`;
		render();
	}

	function statsHtml() {
		const text = t();
		if (!data.stats) {
			// An expired or ended plan needs renewing first, not an add-on offer.
			if (data.subscription && data.subscription.status !== 'active') return '';
			const action = data.links.addons
				? `<a class="o-btn" href="${escapeHtml(data.links.addons)}">${escapeHtml(text.lockedButton)}</a>`
				: `<a class="o-btn" href="mailto:${CONTACT}?subject=${encodeURIComponent(`Smart WeeklyReport – ${data.name}`)}">${escapeHtml(text.lockedAsk)}</a>`;
			return `<section class="o-card o-locked"><h3>${escapeHtml(text.lockedTitle)}</h3><p>${escapeHtml(text.lockedText)}</p>${action}</section>`;
		}
		const { days, total, previous, topDishes } = data.stats;
		const max = Math.max(1, ...days.map((day) => day.visits));
		const sorted = [...days].map((day) => day.visits).sort((a, b) => b - a);
		const highlight = sorted[1] > 0 ? sorted[1] : sorted[0];
		let trend = '';
		if (previous > 0) {
			const change = Math.round(((total - previous) / previous) * 100);
			trend = `<span class="o-trend${change < 0 ? ' o-trend--down' : ''}">${change < 0 ? '▼' : '▲'} ${escapeHtml(text.vsPrev.replace('{p}', Math.abs(change)))}</span>`;
		}
		const bars = days.map((day) => `<div class="${day.visits > 0 && day.visits >= highlight ? 'hi' : ''}" style="height:${Math.max(4, Math.round((day.visits / max) * 100))}%" title="${day.visits}"></div>`).join('');
		const labels = days.map((day) => `<span>${escapeHtml(weekday(day.day))}</span>`).join('');
		const dishes = topDishes.length
			? `<ul class="o-list">${topDishes.map((dish, index) => `<li><b>${index + 1}. ${escapeHtml(dish.label)}</b><span>${dish.count}×</span></li>`).join('')}</ul>`
			: '';
		return `<section class="o-card">
			<h2>${escapeHtml(text.views)}</h2>
			<div class="o-big"><b>${total}</b>${trend}</div>
			${total ? `<div class="o-bars">${bars}</div><div class="o-days">${labels}</div>` : `<p class="o-empty">${escapeHtml(text.noViews)}</p>`}
		</section>
		${dishes ? `<section class="o-card"><h2>${escapeHtml(text.topDishes)}</h2>${dishes}${data.links.stats ? `<a class="o-more" href="${escapeHtml(data.links.stats)}">${escapeHtml(text.fullReport)}</a>` : ''}</section>` : ''}`;
	}

	function planHtml() {
		const text = t();
		const sub = data.subscription;
		if (!sub) return '';
		let detail = ''; // HTML, escaped below
		if (sub.plan === 'discovery') {
			if (!sub.discoveryStartedOn) detail = escapeHtml(text.discoveryWaiting);
			else {
				const end = addDays(sub.discoveryStartedOn, 7);
				const today = new Date().toISOString().slice(0, 10);
				const day = Math.floor((Date.parse(today) - Date.parse(sub.discoveryStartedOn)) / 86400000) + 1;
				detail = escapeHtml(today >= end || sub.status !== 'active'
					? text.discoveryEnded.replace('{date}', formatDate(end))
					: text.discoveryDay.replace('{n}', Math.min(7, Math.max(1, day))).replace('{date}', formatDate(end)));
			}
		} else if (sub.status === 'active') detail = escapeHtml(text.activeUntil.replace('{date}', formatDate(sub.periodEnd)));
		else if (sub.status === 'expired') detail = `<span class="o-warn">${escapeHtml(text.expiredOn.replace('{date}', formatDate(sub.periodEnd)))}</span>`;
		else detail = escapeHtml(text.inactive);
		const addons = [
			['weeklyReport', 'Smart WeeklyReport™'],
			['foodMatch', 'Smart FoodMatch™'],
			['dishPhoto', 'Smart DishPhoto™'],
			['serviceHub', 'Smart ServiceHub™']
		].map(([key, label]) => `<span class="o-chip${data.addons[key] ? ' o-chip--on' : ''}">${data.addons[key] ? '✓ ' : ''}${label}</span>`).join('');
		return `<section class="o-card">
			<div class="o-plan"><div><h2>${escapeHtml(text.plan)}</h2><b>${escapeHtml(PLAN_NAMES[sub.plan] || sub.plan)}</b></div><span>${detail}</span></div>
			<div class="o-chips" aria-label="${escapeHtml(text.addons)}">${addons}</div>
		</section>`;
	}

	function tilesHtml() {
		const text = t();
		const tiles = [
			`<a class="o-tile" href="${escapeHtml(data.menuUrl)}" target="_blank" rel="noopener">${icon('menu')}${escapeHtml(text.openMenu)}</a>`,
			`<button type="button" class="o-tile" id="downloadQr">${icon('qr')}${escapeHtml(text.qr)}</button>`,
			`<button type="button" class="o-tile" id="tableCards">${icon('cards')}${escapeHtml(text.tableCards)}</button>`,
			`<a class="o-tile" href="mailto:${CONTACT}?subject=${encodeURIComponent(text.changeSubject.replace('{name}', data.name))}&body=${encodeURIComponent(text.changeBody)}">${icon('change')}${escapeHtml(text.change)}</a>`
		];
		if (data.links.addons) tiles.push(`<a class="o-tile" href="${escapeHtml(data.links.addons)}">${icon('addons')}${escapeHtml(text.addonsTile)}</a>`);
		if (data.links.renewal) tiles.push(`<a class="o-tile" href="${escapeHtml(data.links.renewal)}">${icon('renew')}${escapeHtml(data.subscription?.plan === 'discovery' ? text.upgrade : text.renew)}</a>`);
		return `<nav class="o-tiles">${tiles.join('')}</nav>`;
	}

	function isStandalone() {
		return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
	}
	function installDismissed() {
		try { return localStorage.getItem('smartmenu.owner.installDismissed') === '1'; } catch { return false; }
	}
	function installHtml() {
		if (isStandalone() || installDismissed()) return '';
		const text = t();
		const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
		if (isIos) {
			return `<div class="o-install" id="install"><img src="assets/icons/icon-192.png" alt=""><p><b>${escapeHtml(text.installTitle)}</b>${escapeHtml(text.installIos)}</p><button type="button" class="o-install-close" id="installClose" aria-label="×">×</button></div>`;
		}
		if (!installPrompt) return '';
		return `<div class="o-install" id="install"><img src="assets/icons/icon-192.png" alt=""><p><b>${escapeHtml(text.installTitle)}</b>${escapeHtml(text.installText)}</p><button type="button" class="o-btn" id="installButton">${escapeHtml(text.install)}</button><button type="button" class="o-install-close" id="installClose" aria-label="×">×</button></div>`;
	}

	function render() {
		const text = t();
		const head = data.logoUrl
			? `<img src="${escapeHtml(data.logoUrl)}" alt="">`
			: `<span class="o-initial">${escapeHtml((data.name || '?').trim().charAt(0).toUpperCase())}</span>`;
		app.innerHTML = `
			${installHtml()}
			<header class="o-head">${head}<div><h1>${escapeHtml(text.appName)}</h1><p>${escapeHtml(data.name)}</p></div><span class="o-status${data.isPublished ? '' : ' o-status--off'}">${escapeHtml(data.isPublished ? text.online : text.notOnline)}</span></header>
			${statsHtml()}
			${planHtml()}
			${tilesHtml()}
			<footer class="o-foot">${escapeHtml(text.questions).replace('{contact}', `<a href="mailto:${CONTACT}">${CONTACT}</a>`)}<br><a href="${SITE}${text.privacyPath}" target="_blank" rel="noopener">${escapeHtml(text.privacy)}</a></footer>`;
		bind();
	}

	function bind() {
		const text = t();
		document.getElementById('downloadQr').addEventListener('click', () => {
			const link = document.createElement('a');
			link.href = SmartQr.draw(data.menuUrl, 1200, 'M', 4).toDataURL('image/png');
			link.download = `${data.slug}-qr.png`;
			document.body.appendChild(link);
			link.click();
			link.remove();
		});
		document.getElementById('tableCards').addEventListener('click', () => {
			const win = window.open('', '_blank');
			if (!win) { alert(text.popupBlocked); return; }
			SmartTableCards.write(win, { name: data.name, logoUrl: data.logoUrl, headerFont: data.headerFont, languages: data.languages, menuUrl: data.menuUrl }, data.tables, text.cards);
		});
		const close = document.getElementById('installClose');
		if (close) close.addEventListener('click', () => {
			try { localStorage.setItem('smartmenu.owner.installDismissed', '1'); } catch { /* convenience only */ }
			document.getElementById('install').remove();
		});
		const install = document.getElementById('installButton');
		if (install) install.addEventListener('click', async () => {
			if (!installPrompt) return;
			installPrompt.prompt();
			await installPrompt.userChoice.catch(() => null);
			installPrompt = null;
			document.getElementById('install')?.remove();
		});
	}

	// Chrome/Edge/Android offer their own install dialog - kept for the
	// banner's button instead of the browser's mini-infobar.
	window.addEventListener('beforeinstallprompt', (event) => {
		event.preventDefault();
		installPrompt = event;
		if (data && !document.getElementById('install')) render();
	});
	window.addEventListener('appinstalled', () => document.getElementById('install')?.remove());

	load();
})();
