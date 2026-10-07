/* A link as a printable QR card (PNG): logo, an optional small orange line,
   title, subtitle, the QR code and two lines of how-to underneath. Used by
   the builder's QR downloads (SmartPilot, every staff station) and by
   staff-qr.html, which the onboarding email's "QR code" buttons open. Drawn
   locally with SmartQr (table-cards.js on top of the vendored qrcode.js) -
   these links are personal and never go to a QR service. Pages load it
   from the builder root, next to assets/icons/. */
(function () {
	function loadImage(src) {
		return new Promise((resolve) => {
			const image = new Image();
			image.onload = () => resolve(image);
			image.onerror = () => resolve(null);
			image.src = src;
		});
	}

	// Largest font size (down to 60% of the wanted one) that fits maxWidth.
	function fillFittedText(ctx, text, x, y, maxWidth, size, weight, color) {
		let current = size;
		do {
			ctx.font = `${weight} ${current}px "Open Sans", Arial, sans-serif`;
			current -= 2;
		} while (ctx.measureText(text).width > maxWidth && current > size * 0.6);
		ctx.fillStyle = color;
		ctx.fillText(text, x, y, maxWidth);
	}

	async function draw({ eyebrow, title, subtitle, link, text }) {
		const canvas = document.createElement('canvas');
		canvas.width = 1000;
		canvas.height = 1360;
		const ctx = canvas.getContext('2d');
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		const icon = await loadImage('assets/icons/icon-192.png');
		if (icon) ctx.drawImage(icon, 440, 50, 120, 120);
		ctx.textAlign = 'center';
		if (eyebrow) fillFittedText(ctx, eyebrow.toUpperCase(), 500, 222, 900, 26, 'bold', '#f66a09');
		fillFittedText(ctx, title, 500, 292, 900, 66, 'bold', '#262421');
		fillFittedText(ctx, subtitle, 500, 350, 900, 38, 'normal', '#6f6a63');
		ctx.drawImage(SmartQr.draw(link, 760, 'M', 4), 120, 392);
		fillFittedText(ctx, text.scan, 500, 1222, 900, 34, 'bold', '#262421');
		fillFittedText(ctx, text.personal, 500, 1280, 900, 27, 'normal', '#9b958d');
		return canvas;
	}

	async function blob(options) {
		const canvas = await draw(options);
		return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
	}

	window.SmartQrCard = { draw, blob };
})();
