const STORAGE_KEY = 'menupilot.clients.v1';
const seedClients = [{ id: 'customer-001', name: 'Taverna Athens', slug: 'taverna-athens', phone: '+30 123456789', whatsapp: '+30 123456789', address: 'Rhodes, Greece', currency: '€', languages: ['en', 'de', 'el'], categories: [{ name: 'Starters', items: [{ name: 'Tzatziki', description: 'Greek yogurt with cucumber and garlic', price: '5.90' }] }, { name: 'Mains', items: [{ name: 'Gyros plate', description: 'With fries and tzatziki', price: '14.90' }] }, { name: 'Drinks', items: [{ name: 'Coca Cola', description: '0.33L', price: '3.50' }] }] }];
const $ = (selector) => document.querySelector(selector);
let clients = loadClients();
let selectedId = clients[0]?.id;
let clientSearch = '';

function slugifyName(value) {
	return String(value || '').trim().toLowerCase()
		.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
		.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-');
}
function normalizeClient(client) {
	return {
		...client,
		name: client.name || 'Unnamed customer',
		slug: client.slug || slugifyName(client.name) || `menu-${Date.now()}`,
		categories: Array.isArray(client.categories) ? client.categories.map((category) => ({
			name: category.name || 'Menu',
			items: Array.isArray(category.items) ? category.items.map((item) => ({ name: item.name || 'Unnamed dish', description: item.description || '', price: item.price || '' })) : []
		})) : [],
		languages: Array.isArray(client.languages) && client.languages.length ? client.languages : ['en'],
		translations: client.translations || {}
	};
}
function loadClients() { try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); return Array.isArray(saved) && saved.length ? saved.map(normalizeClient) : structuredClone(seedClients).map(normalizeClient); } catch { return structuredClone(seedClients).map(normalizeClient); } }
async function saveClients() {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
	if (typeof supabaseClient === 'undefined') return;
	const selectedSlug = selectedClient()?.slug;
	const rows = clients.map((client) => ({
		slug: client.slug,
		name: client.name,
		phone: client.phone || null,
		whatsapp: client.whatsapp || null,
		address: client.address || null,
		currency: client.currency || '€',
		languages: client.languages || ['en', 'de', 'el'],
		translations: client.translations || {},
		categories: client.categories || [],		is_published: true,		updated_at: new Date().toISOString()
	}));
	rows.forEach((row, index) => {
		row.id = isUuid(clients[index].id) ? clients[index].id : crypto.randomUUID();
	});
	const { data, error } = await supabaseClient.from('menus').upsert(rows, { onConflict: 'slug' }).select();
	if (error) throw new Error(`Could not save menus: ${error.message}`);
	if (data?.length) {
		clients = data.map((row) => ({ ...row, id: row.id }));
		selectedId = clients.find((client) => client.slug === selectedSlug)?.id || clients[0]?.id;
		localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
	}
}
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function selectedClient() { return clients.find((client) => client.id === selectedId); }
function menuUrl(client) { return `${window.location.href.replace(/admin\.html.*$/, '')}menu.html?client=${encodeURIComponent(client.slug)}`; }
function notify(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2200); }
function initials(name) { return name.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase(); }

function selectedLanguages() { return [...document.querySelectorAll('input[name="language"]:checked')].map((input) => input.value); }

function parsePdfText(text) {
	const categories = [];
	let category = null;
	const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
	const pricePattern = /(?:\d+[.,]\d{2}\s*(?:€|EUR|\$|USD|£|GBP)?|(?:€|EUR|\$|USD|£|GBP)\s*\d+[.,]\d{2})\s*$/i;
	const knownCategoryPattern = /^(hei(?:ß|ss)e?\s+getränke|kalte\s+getränke|frühstück\s*(?:&|und)\s+snacks?|kuchen\s*(?:&|und)\s+desserts?|spezialitäten|hot\s+drinks?|cold\s+drinks?|breakfast\s*(?:&|and)\s+snacks?|desserts?)$/i;
	const looksLikeCategory = (line) => line.length <= 42 && (knownCategoryPattern.test(line) || (/^[A-ZÄÖÜ][^.!?]{2,41}$/.test(line) && !/\d/.test(line)));
	lines.forEach((line) => {
		const match = line.match(pricePattern);
		if (!match) {
			if (looksLikeCategory(line)) {
				if (category?.items.length) categories.push(category);
				category = { name: line, items: [] };
			}
			return;
		}
		const price = match[0].replace(/[^0-9.,]/g, '').replace(',', '.');
		const name = line.slice(0, match.index).trim();
		if (name) {
			if (!category) category = { name: 'Imported menu', items: [] };
			category.items.push({ name, description: '', price });
		}
	});
	if (category?.items.length) categories.push(category);
	return categories.length ? categories : [{ name: 'Imported menu', items: [{ name: 'Review imported PDF text', description: text.slice(0, 240), price: '0.00' }] }];
}

function pdfPageText(content) {
	const rows = new Map();
	content.items.forEach((item) => {
		const value = String(item.str || '').trim();
		if (!value) return;
		const y = Math.round((item.transform?.[5] || 0) / 2) * 2;
		const row = rows.get(y) || [];
		row.push({ x: item.transform?.[4] || 0, value });
		rows.set(y, row);
	});
	return [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, row]) => row.sort((a, b) => a.x - b.x).map((item) => item.value).join(' ')).join('\n');
}

async function importPdf() {
	const file = $('#menuPdf').files[0];
	if (!file) return notify('Choose a PDF first');
	$('#importStatus').textContent = 'Reading PDF…';
	try {
		const pdfjs = window.pdfjsLib;
		if (!pdfjs) throw new Error('PDF reader could not be loaded.');
		pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
		const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
		let text = '';
		for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
			const page = await pdf.getPage(pageNumber);
			const content = await page.getTextContent();
			text += `${pdfPageText(content)}\n`;
		}
		if (!text.trim()) {
			$('#importStatus').textContent = 'No text layer found. Running OCR…';
			const tesseract = window.Tesseract;
			if (typeof tesseract.createWorker !== 'function') throw new Error('OCR reader could not be loaded.');
			const worker = await tesseract.createWorker('eng');
			for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
				const page = await pdf.getPage(pageNumber);
				const viewport = page.getViewport({ scale: 1.5 });
				const canvas = document.createElement('canvas');
				canvas.width = viewport.width;
				canvas.height = viewport.height;
				await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
				const result = await worker.recognize(canvas);
				text += `${result.data.text}\n`;
			}
			await worker.terminate();
		}
		if (!text.trim()) throw new Error('No readable text found in this PDF.');
		const client = selectedClient();
		client.categories = parsePdfText(text);
		await saveClients();
		render();
		$('#importStatus').textContent = `Imported ${pdf.numPages} page(s). Check the draft before saving.`;
	} catch (error) {
		$('#importStatus').textContent = `PDF could not be read: ${error.message}`;
		notify(error.message);
	}
}

function updateLanguageState() {
	const client = selectedClient();
	client.languages = selectedLanguages();
	$('#translationStatus').textContent = `${client.languages.length} language(s) selected.`;
}


async function translateText(text, source, target) {
	if (!text) return '';
	if (source === target) return text;
	const fallback = window.MENU_TRANSLATION_FALLBACKS?.[selectedClient()?.slug]?.[target];
	const categoryTranslation = fallback?.categories?.[text];
	const itemTranslation = fallback?.items?.[text];
	if (categoryTranslation) return categoryTranslation;
	if (itemTranslation) return itemTranslation[0];
	for (let attempt = 0; attempt < 3; attempt += 1) {
		try {
			const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const result = await response.json();
			if (result.responseStatus && result.responseStatus !== 200) throw new Error(`Translation status ${result.responseStatus}`);
			return result.responseData?.translatedText || text;
		} catch (error) {
			if (attempt === 2) throw error;
			await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
		}
	}
}

async function translateMenu() {
	const client = selectedClient();
	client.sourceLanguage = $('#sourceLanguage').value;
	const source = client.sourceLanguage;
	const targets = selectedLanguages().filter((language) => language !== source);
	if (!targets.length) return notify('Select at least one target language.');
	$('#translationStatus').textContent = 'Translating menu…';
	try {
		client.translations = client.translations || {};
		let failures = 0;
		for (const language of targets) {
			client.translations[language] = { categories: {}, items: {} };
			for (const category of client.categories) {
				try { client.translations[language].categories[category.name] = { name: await translateText(category.name, source, language) }; } catch { failures += 1; client.translations[language].categories[category.name] = { name: category.name }; }
				for (const item of category.items || []) {
					const fallbackItem = window.MENU_TRANSLATION_FALLBACKS?.[client.slug]?.[language]?.items?.[item.name];
					let name = fallbackItem?.[0] || item.name; let description = fallbackItem?.[1] || item.description;
					if (!fallbackItem) {
						try { name = await translateText(item.name, source, language); } catch { failures += 1; }
						try { description = await translateText(item.description, source, language); } catch { failures += 1; }
					}
					client.translations[language].items[item.name] = { name, description };
				}
			}
		}
		await saveClients();
		$('#translationStatus').textContent = failures ? `Translated to ${targets.join(', ')} with ${failures} item(s) left unchanged.` : `Translated to ${targets.join(', ')}.`;
	} catch (error) {
		$('#translationStatus').textContent = 'Translation failed.';
		notify(error.message);
	}
}

function render() {
	const client = selectedClient() || clients[0]; if (!client) return;
	selectedId = client.id;
	$('#clientCount').textContent = clients.length; $('#navClientCount').textContent = clients.length;
	$('#sectionCount').textContent = clients.reduce((total, item) => total + item.categories.length, 0); $('#qrCount').textContent = clients.length;
	const visibleClients = clients.filter((item) => `${item.name} ${item.slug}`.toLowerCase().includes(clientSearch.toLowerCase()));
	$('#clientList').innerHTML = visibleClients.map((item) => `<div class="client-row ${item.id === selectedId ? 'selected' : ''}" data-client="${item.id}"><span class="client-avatar">${initials(item.name)}</span><span><strong>${escapeHtml(item.name)}</strong><small>${item.categories.length} sections</small></span><i class="client-status"></i></div>`).join('') || '<p class="client-empty">No clients found.</p>';
	document.querySelectorAll('[data-client]').forEach((row) => row.addEventListener('click', () => { selectedId = row.dataset.client; render(); }));
	$('#editorTitle').textContent = client.name; $('#businessName').value = client.name; $('#slug').value = client.slug; $('#slug').dataset.manual = slugifyName(client.name) !== client.slug ? 'true' : 'false'; $('#phone').value = client.phone || ''; $('#whatsapp').value = client.whatsapp || ''; $('#address').value = client.address || ''; $('#currency').value = client.currency || '€';
	document.querySelectorAll('input[name="language"]').forEach((input) => { input.checked = (client.languages || ['en', 'de', 'el']).includes(input.value); });
	$('#sourceLanguage').value = client.sourceLanguage || 'de';
	$('#categoryEditor').innerHTML = client.categories.map((category, categoryIndex) => `<div class="category-block"><div class="category-top"><input data-category-name="${categoryIndex}" value="${escapeAttr(category.name)}" aria-label="Section name"><span class="category-move"><button class="move-category" data-move-category="up-${categoryIndex}" title="Move section up" aria-label="Move section up">↑</button><button class="move-category" data-move-category="down-${categoryIndex}" title="Move section down" aria-label="Move section down">↓</button></span><button class="remove-button" data-remove-category="${categoryIndex}" title="Remove section">×</button></div><div class="category-items">${category.items.map((item, itemIndex) => `<div class="item-row"><input data-item-name="${categoryIndex}-${itemIndex}" value="${escapeAttr(item.name)}" placeholder="Dish name" aria-label="Dish name"><input data-item-description="${categoryIndex}-${itemIndex}" value="${escapeAttr(item.description)}" placeholder="Description" aria-label="Dish description"><input data-item-price="${categoryIndex}-${itemIndex}" value="${escapeAttr(item.price)}" placeholder="0.00" aria-label="Price"><button class="remove-button" data-remove-item="${categoryIndex}-${itemIndex}" title="Remove dish">×</button></div>`).join('')}</div><button type="button" class="add-item" data-add-item="${categoryIndex}">＋ Add dish</button></div>`).join('');
	document.querySelectorAll('[data-remove-category]').forEach((button) => button.addEventListener('click', () => { client.categories.splice(Number(button.dataset.removeCategory), 1); saveClients(); render(); }));
	document.querySelectorAll('[data-move-category]').forEach((button) => button.addEventListener('click', () => { const [direction, indexText] = button.dataset.moveCategory.split('-'); const index = Number(indexText); const target = direction === 'up' ? index - 1 : index + 1; if (target < 0 || target >= client.categories.length) return; [client.categories[index], client.categories[target]] = [client.categories[target], client.categories[index]]; saveClients().then(render).catch((error) => notify(error.message)); }));
	document.querySelectorAll('[data-remove-item]').forEach((button) => button.addEventListener('click', () => { const [categoryIndex, itemIndex] = button.dataset.removeItem.split('-').map(Number); client.categories[categoryIndex].items.splice(itemIndex, 1); saveClients(); render(); }));
	document.querySelectorAll('[data-add-item]').forEach((button) => button.addEventListener('click', () => { client.categories[Number(button.dataset.addItem)].items.push({ name: 'New dish', description: '', price: '0.00' }); saveClients(); render(); }));
	const url = menuUrl(client); $('#qrUrl').textContent = url; $('#previewMenu').href = url; $('#qrImage').src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=12&data=${encodeURIComponent(url)}`;
}
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }
function escapeAttr(value) { return escapeHtml(value); }
async function readForm() { const client = selectedClient(); client.name = $('#businessName').value.trim() || 'Unnamed customer'; client.slug = slugifyName($('#slug').value) || slugifyName(client.name) || `menu-${Date.now()}`; client.phone = $('#phone').value.trim(); client.whatsapp = $('#whatsapp').value.trim(); client.address = $('#address').value.trim(); client.currency = $('#currency').value; document.querySelectorAll('[data-category-name]').forEach((input) => { client.categories[Number(input.dataset.categoryName)].name = input.value.trim() || 'Untitled section'; }); document.querySelectorAll('[data-item-name]').forEach((input) => { const [categoryIndex, itemIndex] = input.dataset.itemName.split('-').map(Number); client.categories[categoryIndex].items[itemIndex].name = input.value.trim() || 'Untitled dish'; }); document.querySelectorAll('[data-item-description]').forEach((input) => { const [categoryIndex, itemIndex] = input.dataset.itemDescription.split('-').map(Number); client.categories[categoryIndex].items[itemIndex].description = input.value.trim(); }); document.querySelectorAll('[data-item-price]').forEach((input) => { const [categoryIndex, itemIndex] = input.dataset.itemPrice.split('-').map(Number); client.categories[categoryIndex].items[itemIndex].price = input.value.trim(); }); try { await saveClients(); render(); $('#savedState').textContent = 'Saved just now'; notify(`${client.name} saved`); } catch (error) { notify(error.message); } }
async function addClient() { const client = { id: `client-${Date.now()}`, name: 'New customer', slug: `new-customer-${Date.now()}`, phone: '', whatsapp: '', address: '', currency: '€', languages: selectedLanguages().length ? selectedLanguages() : ['en'], categories: [{ name: 'Menu', items: [{ name: 'Signature dish', description: 'Describe this dish', price: '0.00' }] }] }; clients.push(client); selectedId = client.id; try { await saveClients(); render(); notify('New customer created'); } catch (error) { notify(error.message); } }

$('#businessName').addEventListener('input', () => { const slugInput = $('#slug'); if (slugInput.dataset.manual !== 'true') slugInput.value = slugifyName($('#businessName').value); }); $('#slug').addEventListener('input', () => { $('#slug').dataset.manual = 'true'; }); $('#clientForm').addEventListener('submit', (event) => { event.preventDefault(); readForm(); }); $('#addClient').addEventListener('click', addClient); $('#addClientTop').addEventListener('click', addClient); $('#addCategory').addEventListener('click', () => { selectedClient().categories.push({ name: 'New section', items: [] }); saveClients().then(render).catch((error) => notify(error.message)); }); $('#deleteClient').addEventListener('click', () => { if (clients.length === 1) return notify('Keep at least one client in the workspace'); if (!confirm('Delete this client and their menu?')) return; clients = clients.filter((client) => client.id !== selectedId); selectedId = clients[0].id; saveClients().then(render).catch((error) => notify(error.message)); notify('Client deleted'); }); $('#copyUrl').addEventListener('click', async () => { await navigator.clipboard.writeText($('#qrUrl').textContent); notify('Menu link copied'); }); $('#downloadQr').addEventListener('click', () => { const link = document.createElement('a'); link.href = $('#qrImage').src; link.download = `${selectedClient().slug}-qr.png`; link.target = '_blank'; link.click(); });
function exportMenu() { const client = selectedClient(); const blob = new Blob([JSON.stringify({ name: client.name, slug: client.slug, categories: client.categories }, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${client.slug}-menu.json`; link.click(); URL.revokeObjectURL(link.href); }
$('#exportMenu').addEventListener('click', exportMenu); $('#importMenu').addEventListener('click', () => $('#menuJson').click()); $('#menuJson').addEventListener('change', async () => { const file = $('#menuJson').files[0]; if (!file) return; try { const imported = JSON.parse(await file.text()); const client = selectedClient(); client.categories = normalizeClient({ categories: imported.categories }).categories; if (imported.name) client.name = imported.name; if (imported.slug) client.slug = slugifyName(imported.slug); await saveClients(); render(); notify('Menu JSON imported'); } catch (error) { notify(`JSON import failed: ${error.message}`); } });
async function syncFromSupabase() {
	if (typeof supabaseClient === 'undefined') return;
	const { data, error } = await supabaseClient.from('menus').select('*').order('created_at');
	if (error) { notify(`Could not load menus: ${error.message}`); return; }
	if (data?.length) {
		clients = data.filter((client) => client.slug !== 'new-venue-3');
		selectedId = clients[0].id;
		localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
		render();
	} else if (clients.length) {
		try { await saveClients(); render(); } catch (error) { notify(error.message); }
	}
}
render();
syncFromSupabase();

document.querySelectorAll('input[name="language"]').forEach((input) => input.addEventListener('change', () => { updateLanguageState(); saveClients().catch((error) => notify(error.message)); }));
$('#importPdf').addEventListener('click', importPdf);
$('#translateMenu').addEventListener('click', translateMenu);
$('#clientSearch').addEventListener('input', (event) => { clientSearch = event.target.value; render(); });
