/* QR codes and printable table cards, shared by the builder (admin.html) and
   the owner app (owner.html). Needs vendor/qrcode.js loaded first.

   QR codes are drawn right here in the browser - the links they hold (a
   table's carries its link_secret) are never sent to a QR image service. */
(function () {
	function escapeHtml(value) {
		return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
	}

	// marginModules is the white quiet zone, in QR modules.
	function drawQr(text, size, ecc, marginModules) {
		qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
		const qr = qrcode(0, ecc);
		qr.addData(text, 'Byte');
		qr.make();
		const count = qr.getModuleCount();
		const cell = Math.max(1, Math.floor(size / (count + marginModules * 2)));
		const offset = Math.floor((size - cell * count) / 2);
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = size;
		const ctx = canvas.getContext('2d');
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, size, size);
		ctx.fillStyle = '#000000';
		for (let row = 0; row < count; row += 1) {
			for (let col = 0; col < count; col += 1) {
				if (qr.isDark(row, col)) ctx.fillRect(offset + col * cell, offset + row * cell, cell, cell);
			}
		}
		return canvas;
	}

	// A table's QR with its number drawn into the middle of the code (ecc=H
	// tolerates the covered part), so two printed codes can't get mixed up -
	// used for the table email images and the printed table cards alike.
	function drawTableQr(url, label, size, marginModules) {
		const canvas = drawQr(url, size, 'H', marginModules);
		const ctx = canvas.getContext('2d');
		// Largest bold font whose box stays within ~42% of the width (a longer
		// label like "T12" or "Terrasse 3" shrinks to fit instead of covering more).
		let fontSize = Math.round(size * 0.2);
		ctx.font = `700 ${fontSize}px Arial, Helvetica, sans-serif`;
		while (ctx.measureText(label).width > size * 0.34 && fontSize > 18) {
			fontSize -= 2;
			ctx.font = `700 ${fontSize}px Arial, Helvetica, sans-serif`;
		}
		const padX = fontSize * 0.35;
		const boxW = ctx.measureText(label).width + padX * 2;
		const boxH = fontSize * 1.3;
		const x = (size - boxW) / 2;
		const y = (size - boxH) / 2;
		ctx.fillStyle = '#ffffff';
		ctx.strokeStyle = '#262421';
		ctx.lineWidth = Math.max(2, size / 120);
		ctx.beginPath();
		if (ctx.roundRect) ctx.roundRect(x, y, boxW, boxH, fontSize * 0.15); else ctx.rect(x, y, boxW, boxH);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = '#262421';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(label, size / 2, size / 2 + fontSize * 0.05);
		return canvas;
	}

	// Printable table cards: A6 cards, four per A4 sheet, cut along the dashed
	// lines. Card texts follow the menu's main language (languages[0]), the
	// toolbar above the sheets follows the page that opens it. A ServiceHub
	// menu gets one "scan & order" card per table (its own link, number in the
	// code) plus one sheet of general menu cards for the entrance, bar or
	// window - a general card on a table would let guests view but not order.
	const CARD_TEXT = {
		de: { kicker: 'Unsere Speisekarte', title: 'Einfach scannen', how: 'Handykamera öffnen und scannen – ohne App', langs: 'In {n} Sprachen', table: 'Tisch', tableTitle: 'Scannen & bestellen', tableHow: 'Speisekarte ansehen, bestellen, Rechnung anfordern', foot: 'Digitale Speisekarte von Smart Menu Solutions' },
		en: { kicker: 'Our menu', title: 'Just scan', how: 'Open your phone camera and scan – no app needed', langs: 'In {n} languages', table: 'Table', tableTitle: 'Scan & order', tableHow: 'View the menu, order, ask for the bill', foot: 'Digital menu by Smart Menu Solutions' },
		it: { kicker: 'Il nostro menu', title: 'Basta scansionare', how: 'Aprite la fotocamera e scansionate – senza app', langs: 'In {n} lingue', table: 'Tavolo', tableTitle: 'Scansionate e ordinate', tableHow: 'Guardate il menu, ordinate, chiedete il conto', foot: 'Menu digitale di Smart Menu Solutions' },
		el: { kicker: 'Το μενού μας', title: 'Απλώς σκανάρετε', how: 'Ανοίξτε την κάμερα του κινητού και σκανάρετε – χωρίς εφαρμογή', langs: 'Σε {n} γλώσσες', table: 'Τραπέζι', tableTitle: 'Σκανάρετε & παραγγείλετε', tableHow: 'Δείτε το μενού, παραγγείλετε, ζητήστε τον λογαριασμό', foot: 'Ψηφιακό μενού από τη Smart Menu Solutions' },
		es: { kicker: 'Nuestra carta', title: 'Simplemente escanee', how: 'Abra la cámara del móvil y escanee – sin app', langs: 'En {n} idiomas', table: 'Mesa', tableTitle: 'Escanee y pida', tableHow: 'Vea la carta, pida, solicite la cuenta', foot: 'Carta digital de Smart Menu Solutions' },
		fr: { kicker: 'Notre carte', title: 'Scannez simplement', how: "Ouvrez l'appareil photo et scannez – sans application", langs: 'En {n} langues', table: 'Table', tableTitle: 'Scannez & commandez', tableHow: "Consultez la carte, commandez, demandez l'addition", foot: 'Carte digitale par Smart Menu Solutions' },
		nl: { kicker: 'Onze menukaart', title: 'Gewoon scannen', how: 'Open de camera van uw telefoon en scan – geen app nodig', langs: 'In {n} talen', table: 'Tafel', tableTitle: 'Scannen & bestellen', tableHow: 'Menukaart bekijken, bestellen, de rekening vragen', foot: 'Digitale menukaart van Smart Menu Solutions' },
		pt: { kicker: 'O nosso menu', title: 'Basta digitalizar', how: 'Abra a câmara do telemóvel e digitalize – sem app', langs: 'Em {n} idiomas', table: 'Mesa', tableTitle: 'Digitalize e peça', tableHow: 'Veja o menu, faça o pedido, peça a conta', foot: 'Menu digital da Smart Menu Solutions' }
	};
	// Each language in its own name, so a guest spots theirs at a glance.
	const LANGUAGE_NAMES = { de: 'Deutsch', en: 'English', it: 'Italiano', el: 'Ελληνικά', es: 'Español', fr: 'Français', nl: 'Nederlands', pt: 'Português' };
	// Same keys as menu.js HEADER_FONTS - the restaurant name in the menu's own header font.
	const NAME_FONTS = { playfair: "'Playfair Display', Georgia, serif", montserrat: "'Montserrat', sans-serif", poppins: "'Poppins', sans-serif", dancing: "'Dancing Script', cursive", oswald: "'Oswald', sans-serif" };
	const PHONE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></svg>';

	function cardHtml(menu, text, qrSrc, tableNumber) {
		const languages = (menu.languages || []).filter((lang) => LANGUAGE_NAMES[lang]);
		const langLine = languages.length > 1
			? `<p class="card__langs"><b>${escapeHtml(text.langs.replace('{n}', languages.length))}:</b> ${languages.map((lang) => LANGUAGE_NAMES[lang]).join(' · ')}</p>`
			: '';
		const isTable = tableNumber !== undefined;
		// "Tisch 12", but a named table ("Terrasse 1") stays as it is.
		const tableLabel = isTable && /^\d+$/.test(String(tableNumber)) ? `${text.table} ${tableNumber}` : tableNumber;
		return `<div class="card">
			${menu.logoUrl ? `<img class="card__logo" src="${escapeHtml(menu.logoUrl)}" alt="">` : ''}
			<p class="card__name">${escapeHtml(menu.name)}</p>
			<div class="card__rule"></div>
			<p class="card__kicker">${escapeHtml(isTable ? tableLabel : text.kicker)}</p>
			<p class="card__title">${escapeHtml(isTable ? text.tableTitle : text.title)}</p>
			<div class="card__qr"><img src="${qrSrc}" alt=""><span></span></div>
			<p class="card__how">${PHONE_ICON}${escapeHtml(isTable ? text.tableHow : text.how)}</p>
			${langLine}
			<p class="card__foot">${escapeHtml(text.foot)}</p>
		</div>`;
	}

	// win: a window the caller opened right inside the click (popup blockers
	// only allow window.open during the user's gesture).
	// menu: { name, logoUrl, headerFont, languages, menuUrl }
	// tables: [{ number, url }] in print order, [] without ServiceHub
	// ui: { title, print, summaryTables, summaryMenu, hint } in the page's language
	function writeCards(win, menu, tables, ui) {
		const lang = (menu.languages && menu.languages[0]) || 'de';
		const text = CARD_TEXT[lang] || CARD_TEXT.en;
		const cards = tables.map((table) => cardHtml(menu, text, drawTableQr(table.url, String(table.number), 600, 0).toDataURL('image/png'), table.number));
		const sheets = [];
		for (let i = 0; i < cards.length; i += 4) sheets.push(cards.slice(i, i + 4).join(''));
		sheets.push(cardHtml(menu, text, drawQr(menu.menuUrl, 600, 'M', 0).toDataURL('image/png')).repeat(4));
		const summary = tables.length
			? ui.summaryTables.replace('{tables}', tables.length).replace('{sheets}', sheets.length)
			: ui.summaryMenu;
		const title = ui.title.replace('{name}', menu.name);
		const asset = (path) => new URL(path, window.location.href).href;
		const nameFont = NAME_FONTS[menu.headerFont] || NAME_FONTS.playfair;
		win.document.write(`<!DOCTYPE html><html lang="${escapeHtml(lang)}"><head><meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1">
			<title>${escapeHtml(title)}</title>
			<link rel="stylesheet" href="${asset('assets/fonts/fonts-menu-headers.css')}">
			<link rel="stylesheet" href="${asset('assets/fonts/fonts-opensans.css')}">
			<style>
			*{box-sizing:border-box}
			body{margin:0;background:#ece9e4;font-family:'Open Sans',Arial,sans-serif;color:#262421}
			.toolbar{max-width:210mm;margin:0 auto;padding:24px 16px 18px}
			.toolbar h1{font:700 20px 'Poppins','Open Sans',sans-serif;margin:0 0 4px}
			.toolbar p{margin:0 0 12px;color:#6f6a63;font-size:13px;line-height:1.5}
			.toolbar button{font:600 14px 'Poppins','Open Sans',sans-serif;background:#f66a09;color:#fff;border:0;border-radius:999px;padding:10px 20px;cursor:pointer}
			.sheet{width:210mm;height:297mm;margin:0 auto 24px;background:#fff;display:grid;grid-template-columns:105mm 105mm;grid-template-rows:148.5mm 148.5mm;position:relative;box-shadow:0 10px 30px -12px rgba(0,0,0,.35)}
			.sheet::before,.sheet::after{content:"";position:absolute;z-index:1;border:0 dashed #c9c4bd}
			.sheet::before{left:105mm;top:0;bottom:0;border-left-width:.3mm}
			.sheet::after{top:148.5mm;left:0;right:0;border-top-width:.3mm}
			.card{width:105mm;height:148.5mm;display:flex;flex-direction:column;align-items:center;text-align:center;padding:9mm 9mm 6mm;overflow:hidden}
			.card__logo{height:19mm;width:auto;max-width:45mm;object-fit:contain}
			.card__name{font-family:${nameFont};font-weight:600;font-size:19pt;line-height:1.1;margin:1.5mm 0 0}
			.card__rule{width:12mm;height:.5mm;background:#262421;margin:3mm 0;border-radius:1mm}
			.card__kicker{font:600 7pt 'Poppins','Open Sans',sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#6f6a63;margin:0}
			.card__title{font:700 15pt 'Poppins','Open Sans',sans-serif;margin:.8mm 0 3mm}
			.card__qr{position:relative;width:60mm;height:60mm;padding:2.8mm;flex-shrink:0}
			.card__qr img{width:100%;height:100%;display:block;image-rendering:pixelated}
			.card__qr::before,.card__qr::after,.card__qr span::before,.card__qr span::after{content:"";position:absolute;width:6mm;height:6mm;border:0 solid #262421}
			.card__qr::before{top:0;left:0;border-top-width:.7mm;border-left-width:.7mm;border-top-left-radius:2mm}
			.card__qr::after{top:0;right:0;border-top-width:.7mm;border-right-width:.7mm;border-top-right-radius:2mm}
			.card__qr span::before{bottom:0;left:0;border-bottom-width:.7mm;border-left-width:.7mm;border-bottom-left-radius:2mm}
			.card__qr span::after{bottom:0;right:0;border-bottom-width:.7mm;border-right-width:.7mm;border-bottom-right-radius:2mm}
			.card__how{display:flex;align-items:center;justify-content:center;gap:1.6mm;font-size:7.6pt;margin:3.2mm 0 0}
			.card__how svg{width:3.6mm;height:3.6mm;flex-shrink:0}
			.card__langs{font-size:6.6pt;color:#6f6a63;margin:1.6mm 0 0;line-height:1.45}
			.card__langs b{color:#262421;font-weight:600}
			.card__foot{margin:auto 0 0;font-size:5.4pt;color:#a39d95;letter-spacing:.02em}
			@media screen and (max-width:820px){ body{overflow-x:auto} }
			@media print{
				@page{size:A4;margin:0}
				body{background:#fff}
				.toolbar{display:none}
				.sheet{margin:0;box-shadow:none;break-after:page}
				.sheet:last-child{break-after:auto}
			}
			</style></head><body>
			<div class="toolbar">
				<h1>${escapeHtml(title)}</h1>
				<p>${escapeHtml(summary)} ${escapeHtml(ui.hint)}</p>
				<button type="button" onclick="window.print()">${escapeHtml(ui.print)}</button>
			</div>
			${sheets.map((sheet) => `<div class="sheet">${sheet}</div>`).join('')}
			</body></html>`);
		win.document.close();
	}

	window.SmartQr = { draw: drawQr, drawTable: drawTableQr };
	window.SmartTableCards = { write: writeCards };
})();
