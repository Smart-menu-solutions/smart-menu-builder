const app = document.querySelector('#app');
const slug = new URLSearchParams(location.search).get('client');

function escapeHtml(value) {
	return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
		'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
	}[character]));
}

function renderMenu(client) {
	document.title = `${client.name} — Digital menu`;
	const phone = client.phone ? `<a href="tel:${encodeURIComponent(client.phone)}">Call</a>` : '';
	const whatsapp = client.whatsapp ? `<a href="https://wa.me/${client.whatsapp.replace(/\D/g, '')}">WhatsApp</a>` : '';
	const map = client.address ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}">Directions</a>` : '';
	const categories = (client.categories || []).map((category) => `
		<section class="category">
			<h2>${escapeHtml(category.name)}</h2>
			${(category.items || []).map((item) => `
				<article class="item">
					<div class="item-header"><h3>${escapeHtml(item.name)}</h3><span class="price">${escapeHtml(item.price)} ${escapeHtml(client.currency || '€')}</span></div>
					${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
				</article>`).join('')}
		</section>`).join('');
	app.innerHTML = `
		<header class="menu-hero"><h1>${escapeHtml(client.name)}</h1>
			${client.address ? `<p>${escapeHtml(client.address)}</p>` : ''}
			<nav class="actions" aria-label="Contact">${phone}${whatsapp}${map}</nav>
		</header>
		<div class="menu-container">${categories || '<p class="message">Menu coming soon.</p>'}</div>
		<footer class="menu-footer"><p>${escapeHtml(client.name)}</p><p>Digital menu by Smart Menu Solutions</p></footer>`;
}

async function loadMenu() {
	if (!slug) throw new Error('This menu link is missing its client identifier.');
	const response = await fetch(`${AUTH_CONFIG.supabaseUrl}/rest/v1/menus?slug=eq.${encodeURIComponent(slug)}&is_published=eq.true&select=*`, {
		headers: { apikey: AUTH_CONFIG.supabasePublishableKey, Accept: 'application/json' }
	});
	if (!response.ok) throw new Error('The menu could not be loaded.');
	const menus = await response.json();
	if (!menus.length) throw new Error('This menu is not available.');
	renderMenu(menus[0]);
}

loadMenu().catch((error) => { app.innerHTML = `<p class="message error">${escapeHtml(error.message)}</p>`; });
