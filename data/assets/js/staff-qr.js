/* staff-qr.html#role=kitchen&t=<token>&lang=de&n=Küche&r=El%20Greco - one
   ServiceHub station's QR card in the browser, opened by the "QR code"
   button of the onboarding email (admin.js staffQrPageUrl). The owner shows
   it on the PC screen and scans it with the station's phone or tablet, or
   downloads it for printing. Everything comes from the #hash, which never
   reaches a server, and only our own staff links (role + uuid token) are
   drawn - the page can't be used to put someone else's link into a QR. */
(function () {
	const ROLES = ['waiter', 'kitchen', 'bar', 'cashier'];
	const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	const hash = new URLSearchParams(location.hash.slice(1));
	const lang = window.STAFF_STRINGS[hash.get('lang')] ? hash.get('lang') : 'de';
	const strings = window.STAFF_STRINGS[lang];
	const role = hash.get('role') || '';
	const token = hash.get('t') || '';
	const name = (hash.get('n') || strings.roleLabels?.[role] || role).slice(0, 60);
	const restaurant = (hash.get('r') || '').slice(0, 80);
	const app = document.getElementById('app');
	document.documentElement.lang = lang;

	function message(text) {
		const paragraph = document.createElement('p');
		paragraph.className = 'qr-error';
		paragraph.textContent = text;
		app.replaceChildren(paragraph);
	}

	async function show() {
		if (!ROLES.includes(role) || !TOKEN_PATTERN.test(token)) {
			message(strings.linkIncomplete);
			return;
		}
		const link = `${location.href.replace(/staff-qr\.html.*$/, '')}${role}.html?t=${token}`;
		document.title = `${name}${restaurant ? ` · ${restaurant}` : ''} — Smart ServiceHub™`;
		// The card is drawn in Open Sans - wait for it, or the canvas falls
		// back to Arial.
		await Promise.all([document.fonts.load('700 40px "Open Sans"'), document.fonts.load('400 40px "Open Sans"')]).catch(() => null);
		const canvas = await SmartQrCard.draw({ eyebrow: 'Smart ServiceHub™', title: name, subtitle: restaurant, link, text: { scan: strings.qrScan, personal: strings.qrPersonal } });
		canvas.className = 'qr-card';
		canvas.setAttribute('role', 'img');
		canvas.setAttribute('aria-label', `${name} – QR`);
		const hint = document.createElement('p');
		hint.className = 'qr-hint';
		hint.textContent = strings.qrPageHint;
		const download = document.createElement('button');
		download.type = 'button';
		download.className = 'qr-download';
		download.textContent = strings.qrDownload;
		download.addEventListener('click', () => {
			canvas.toBlob((blob) => {
				if (!blob) return;
				const station = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || role;
				const blobUrl = URL.createObjectURL(blob);
				const anchor = document.createElement('a');
				anchor.href = blobUrl;
				anchor.download = `servicehub-${station}.png`;
				document.body.appendChild(anchor);
				anchor.click();
				anchor.remove();
				URL.revokeObjectURL(blobUrl);
			}, 'image/png');
		});
		app.replaceChildren(canvas, hint, download);
	}

	show();
})();
