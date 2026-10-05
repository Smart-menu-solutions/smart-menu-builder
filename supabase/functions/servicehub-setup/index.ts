import { createClient } from 'npm:@supabase/supabase-js@2';

// servicehub-setup.html - once we have set up a Smart ServiceHub menu, the
// customer gets a link with ?token=<menus.setup_token> (builder, Add-ons tab).
// The page lists every dish with description and price; the customer types
// the dish's number in their own till next to it, plus their tables.
//
// POST { token, action: 'load' } -> venue, dishes (+ current till numbers),
//                                   tables already set up, tables from the order
// POST { token, action: 'save', tables, numbers: { <dish id>: '350' } }
//      -> missing tables are created right away; the till numbers are stored
//         in servicehub_setup_submissions and written into the dishes by the
//         builder the next time it opens (see 0034_servicehub_setup.sql);
//         we get an email with everything.

const supabase = createClient(
	Deno.env.get('SUPABASE_URL') ?? '',
	Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const NOTIFICATION_EMAIL = Deno.env.get('NOTIFICATION_EMAIL') ?? 'smartmenusolutions@outlook.com';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Smart Menu Builder <onboarding@resend.dev>';

const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TABLES = 200;
const MAX_NUMBER_LENGTH = 20; // same as the builder's Kassen-Nr field

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface MenuItem { id?: string; name?: string; description?: string; price?: string; posNumber?: string }
interface MenuCategory { name?: string; items?: MenuItem[] }
interface Menu { slug: string; name: string; currency: string | null; categories: MenuCategory[] | null; smartservice_hub_enabled: boolean }

Deno.serve(async (request) => {
	if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
	if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Bad request' }, 400);
	}

	try {
		const token = String(body.token || '');
		if (!TOKEN_PATTERN.test(token)) return json({ error: 'Not found' }, 404);
		const { data: menu } = await supabase
			.from('menus')
			.select('slug, name, currency, categories, smartservice_hub_enabled')
			.eq('setup_token', token)
			.maybeSingle<Menu>();
		// Tables and till numbers only mean something with Smart ServiceHub.
		if (!menu || !menu.smartservice_hub_enabled) return json({ error: 'Not found' }, 404);

		if (body.action === 'load') return json(await load(menu));
		if (body.action === 'save') return await save(menu, body);
		return json({ error: 'Bad request' }, 400);
	} catch (error) {
		console.error(error);
		return json({ error: 'Failed' }, 500);
	}
});

function dishesOf(menu: Menu) {
	return (menu.categories || []).map((category) => ({
		name: String(category.name || ''),
		items: (category.items || []).filter((item) => item.id).map((item) => ({
			id: String(item.id),
			name: String(item.name || ''),
			description: String(item.description || ''),
			price: String(item.price || ''),
			posNumber: String(item.posNumber || '')
		}))
	})).filter((category) => category.items.length);
}

async function existingTables(slug: string): Promise<string[]> {
	const { data } = await supabase.from('restaurant_tables').select('table_number').eq('menu_slug', slug);
	return (data || []).map((row) => String(row.table_number))
		.sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
}

async function load(menu: Menu) {
	const sections = dishesOf(menu);
	// Sent but not in the builder yet: show what they sent, not the old value.
	const { data: open } = await supabase
		.from('servicehub_setup_submissions')
		.select('numbers')
		.eq('menu_slug', menu.slug)
		.is('applied_at', null)
		.order('created_at', { ascending: true });
	const pending: Record<string, string> = Object.assign({}, ...(open || []).map((row) => row.numbers || {}));
	sections.forEach((section) => section.items.forEach((item) => {
		if (item.id in pending) item.posNumber = String(pending[item.id] ?? '');
	}));

	// Table numbers typed on the upload page after ordering, if any.
	let tablesText = '';
	const { data: subscriptions } = await supabase.from('subscriptions').select('id').eq('menu_slug', menu.slug);
	const subscriptionIds = (subscriptions || []).map((row) => row.id);
	if (subscriptionIds.length) {
		const { data: orders } = await supabase
			.from('orders')
			.select('table_numbers')
			.in('subscription_id', subscriptionIds)
			.not('table_numbers', 'is', null)
			.order('created_at', { ascending: false })
			.limit(1);
		tablesText = orders?.[0]?.table_numbers || '';
	}

	return {
		venue: menu.name,
		currency: menu.currency || '€',
		tables: await existingTables(menu.slug),
		tablesText,
		sections
	};
}

// "1–8, 12, Terrasse 1" -> ['1', …, '8', '12', 'Terrasse 1'] - the same rules
// as parseTableList() in the builder's admin.js.
function parseTableList(text: string): string[] {
	const tables: string[] = [];
	text.split(/[,;\n]+/).map((part) => part.trim()).filter(Boolean).forEach((part) => {
		const range = part.match(/^(\d+)\s*(?:-|–|—|bis|to|a)\s*(\d+)$/i);
		if (range && Number(range[2]) >= Number(range[1]) && Number(range[2]) - Number(range[1]) < MAX_TABLES) {
			for (let n = Number(range[1]); n <= Number(range[2]); n += 1) tables.push(String(n));
		} else {
			tables.push(part.slice(0, 20));
		}
	});
	return [...new Set(tables)];
}

function clean(value: unknown, max: number): string {
	return String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
}

async function save(menu: Menu, body: Record<string, unknown>) {
	const sections = dishesOf(menu);
	const dishById = new Map(sections.flatMap((section) => section.items).map((item) => [item.id, item]));

	// Only ids of this menu's dishes, nothing else gets stored.
	const sent = (body.numbers && typeof body.numbers === 'object') ? body.numbers as Record<string, unknown> : {};
	const numbers: Record<string, string> = {};
	for (const [id, value] of Object.entries(sent)) {
		if (dishById.has(id)) numbers[id] = clean(value, MAX_NUMBER_LENGTH);
	}

	const tablesText = clean(body.tables, 300);
	const have = new Set(await existingTables(menu.slug));
	const missing = parseTableList(tablesText).filter((number) => !have.has(number)).slice(0, Math.max(0, MAX_TABLES - have.size));
	if (missing.length) {
		const { error } = await supabase.from('restaurant_tables').insert(missing.map((number) => ({ menu_slug: menu.slug, table_number: number })));
		if (error) {
			console.error('restaurant_tables insert failed', menu.slug, error);
			return json({ error: 'Failed' }, 500);
		}
	}

	const { error: insertError } = await supabase.from('servicehub_setup_submissions').insert({
		menu_slug: menu.slug,
		numbers,
		tables_text: tablesText || null,
		tables_created: missing
	});
	if (insertError) {
		console.error('servicehub_setup_submissions insert failed', menu.slug, insertError);
		return json({ error: 'Failed' }, 500);
	}

	const lines = sections.flatMap((section) => section.items
		.filter((item) => numbers[item.id])
		.map((item) => `${section.name} – ${item.name}: ${numbers[item.id]}`));
	await sendNotification(menu.slug, `Tische & Kassennummern eingegangen – ${menu.name}`, {
		Lokal: menu.name,
		'Menü-Slug': menu.slug,
		Tische: tablesText || 'nicht angegeben',
		'Neu angelegte Tische': missing.length ? missing.join(', ') : 'keine',
		Kassennummern: lines.length ? `\n${lines.join('\n')}` : 'keine',
		Hinweis: 'Die Kassennummern trägt der Builder beim nächsten Öffnen selbst bei den Gerichten ein.'
	});

	return json({ ok: true, tablesCreated: missing.length });
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => ({
		'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
	}[character] as string));
}

// Same internal notification format and notifications_log entry as
// order-upload's sendNotification().
async function sendNotification(slug: string, subject: string, lines: Record<string, string>) {
	const html = `<h2>${escapeHtml(subject)}</h2><ul>${
		Object.entries(lines).map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value ?? '-')).replace(/\n/g, '<br>')}</li>`).join('')
	}</ul>`;
	let providerMessageId: string | null = null;
	try {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ from: FROM_EMAIL, to: [NOTIFICATION_EMAIL], subject, html })
		});
		const data = await response.json().catch(() => ({}));
		if (response.ok) providerMessageId = data.id ?? null;
		else console.error('Resend API error', response.status, data);
	} catch (error) {
		console.error('Resend request failed', error);
	}
	const { data: subscription } = await supabase
		.from('subscriptions')
		.select('id')
		.eq('menu_slug', slug)
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();
	const { error: logError } = await supabase.from('notifications_log').insert({
		subscription_id: subscription?.id ?? null,
		kind: subject,
		sent_to: NOTIFICATION_EMAIL,
		provider_message_id: providerMessageId
	});
	if (logError) console.error('Failed to write notifications_log', logError);
}

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
	});
}
