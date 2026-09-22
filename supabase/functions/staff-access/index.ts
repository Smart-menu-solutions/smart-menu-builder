// Waiter/kitchen/bar/cashier API for SmartService Hub. A per-role secret
// link (restaurant_access.token) is the only credential - no PIN, no
// Supabase login (see 0015_smartservice_hub.sql and the design notes for
// why). Kitchen/bar group a table's items by serve_table_id (where food
// physically goes); waiter/cashier group by the order_group's own table_id
// (whose bill it's on) - the only place those two differ is a waiter's
// cross-table "gift a round" action, which intentionally keeps the gifted
// items on the *giving* table's bill while routing the kitchen/bar ticket
// to the other table.

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
	Deno.env.get('SUPABASE_URL') ?? '',
	Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

const TOKEN_PATTERN = /^[0-9a-f-]{36}$/i;

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

type OrderItemRow = {
	id: string; product_name: string; unit_price_cents: number; quantity: number; notes: string | null;
	station: 'KITCHEN' | 'BAR'; source: string; round_number: number; dispatched_at: string | null; serve_table_id: string;
};
type OrderGroupRow = { id: string; table_id: string; bill_requested_at: string | null; order_items: OrderItemRow[] };
type MenuItem = { id?: string; name: string; price: string };
type MenuCategory = { name: string; courseType?: string; items?: MenuItem[] };

function findProduct(categories: MenuCategory[], productId: string): { name: string; priceCents: number; station: 'KITCHEN' | 'BAR' } | null {
	for (const category of categories || []) {
		for (const item of category.items || []) {
			if (item.id === productId) {
				const cents = Math.round(parseFloat(String(item.price).replace(',', '.')) * 100);
				return { name: item.name, priceCents: Number.isFinite(cents) ? cents : 0, station: category.courseType === 'drink' ? 'BAR' : 'KITCHEN' };
			}
		}
	}
	return null;
}

async function broadcast(menuSlug: string, payload: Record<string, unknown>) {
	const channel = supabase.channel(`restaurant:${menuSlug}`);
	await channel.send({ type: 'broadcast', event: 'update', payload });
	await supabase.removeChannel(channel);
}

async function resolveAccess(token: string) {
	const { data } = await supabase.from('restaurant_access').select('menu_slug, role').eq('token', token).maybeSingle();
	if (!data) return null;
	const { data: menu } = await supabase.from('menus').select('name, categories, languages, translations, smartservice_hub_enabled').eq('slug', data.menu_slug).maybeSingle();
	if (!menu || !menu.smartservice_hub_enabled) return null;
	return { menuSlug: data.menu_slug as string, role: data.role as 'waiter' | 'kitchen' | 'bar' | 'cashier', menu };
}

function itemView(item: OrderItemRow, withPrice: boolean) {
	return {
		id: item.id, name: item.product_name, quantity: item.quantity, notes: item.notes,
		station: item.station, roundNumber: item.round_number, dispatched: !!item.dispatched_at,
		...(withPrice ? { unitPriceCents: item.unit_price_cents } : {})
	};
}

async function buildView(menuSlug: string, role: string) {
	const [{ data: tables }, { data: groups }, { data: calls }] = await Promise.all([
		supabase.from('restaurant_tables').select('id, table_number').eq('menu_slug', menuSlug).order('table_number'),
		supabase.from('order_groups').select('id, table_id, bill_requested_at, order_items(id, product_name, unit_price_cents, quantity, notes, station, source, round_number, dispatched_at, serve_table_id)').eq('menu_slug', menuSlug).eq('status', 'OPEN'),
		supabase.from('waiter_calls').select('id, table_id, created_at').is('resolved_at', null)
	]);
	const tableNumberById = new Map((tables || []).map((table) => [table.id, table.table_number]));
	const openGroups = (groups || []) as OrderGroupRow[];

	if (role === 'kitchen' || role === 'bar') {
		const ownStation = role === 'kitchen' ? 'KITCHEN' : 'BAR';
		const byTable = new Map<string, { own: OrderItemRow[]; other: OrderItemRow[] }>();
		for (const group of openGroups) {
			for (const item of group.order_items || []) {
				const bucket = byTable.get(item.serve_table_id) || { own: [], other: [] };
				(item.station === ownStation ? bucket.own : bucket.other).push(item);
				byTable.set(item.serve_table_id, bucket);
			}
		}
		const cards = [...byTable.entries()]
			.filter(([, bucket]) => bucket.own.length || bucket.other.length)
			.map(([tableId, bucket]) => ({
				tableId, tableNumber: tableNumberById.get(tableId) || '?',
				items: bucket.own.map((item) => itemView(item, false)),
				otherItems: bucket.other.map((item) => itemView(item, false))
			}));
		return { role, tables: cards, allTables: (tables || []).map((table) => ({ id: table.id, tableNumber: table.table_number })) };
	}

	// waiter/cashier: grouped by the order_group's own table (whose bill it
	// is), with prices and a total - see file header for why this differs
	// from kitchen/bar's serve_table_id grouping.
	const cards = openGroups
		.filter((group) => (group.order_items || []).length)
		.map((group) => {
			const items = group.order_items || [];
			return {
				tableId: group.table_id, tableNumber: tableNumberById.get(group.table_id) || '?',
				orderGroupId: group.id, billRequested: !!group.bill_requested_at,
				items: items.map((item) => itemView(item, true)),
				totalCents: items.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0),
				waiterCalls: role === 'waiter' ? (calls || []).filter((call) => call.table_id === group.table_id).map((call) => ({ id: call.id, createdAt: call.created_at })) : undefined
			};
		});
	return { role, tables: cards };
}

Deno.serve(async (request) => {
	if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

	if (request.method === 'GET') {
		const token = new URL(request.url).searchParams.get('t') || '';
		if (!TOKEN_PATTERN.test(token)) return json({ error: 'Invalid or missing link.' }, 400);
		const access = await resolveAccess(token);
		if (!access) return json({ error: 'This link is no longer valid.' }, 404);
		const view = await buildView(access.menuSlug, access.role);
		// Only waiter/bar/cashier can add_item, so only they need the menu to
		// pick products from - kitchen/bar's own ticket view never needs it.
		// languages/translations are small, so every role gets them: the UI
		// language switcher (staff-strings.js) plus translating each order
		// line's dish name - order_items.product_name is stored as a
		// source-language snapshot (see 0015_smartservice_hub.sql), so the
		// same translations lookup menu.js uses (by source name, not id)
		// works here too via staff.js's translateName().
		const menu = ['waiter', 'bar', 'cashier'].includes(access.role) ? { categories: access.menu.categories } : undefined;
		// name goes to every role (header branding), unlike categories above
		// which only waiter/bar/cashier need for picking products to add.
		return json({ ...view, menu, name: access.menu.name, languages: access.menu.languages, translations: access.menu.translations, menuSlug: access.menuSlug });
	}

	if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

	let body: {
		token?: string; action?: string; tableId?: string; itemId?: string; callId?: string;
		serveTableId?: string; items?: { productId?: string; quantity?: number; notes?: string }[];
	};
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid request.' }, 400);
	}

	const token = String(body.token || '');
	if (!TOKEN_PATTERN.test(token)) return json({ error: 'Invalid or missing link.' }, 400);
	const access = await resolveAccess(token);
	if (!access) return json({ error: 'This link is no longer valid.' }, 404);
	const { menuSlug, role, menu } = access;

	if (body.action === 'dispatch_item' || body.action === 'dispatch_all') {
		if (role !== 'kitchen' && role !== 'bar') return json({ error: 'Not allowed for this role.' }, 403);
		const ownStation = role === 'kitchen' ? 'KITCHEN' : 'BAR';
		let query = supabase.from('order_items').update({ dispatched_at: new Date().toISOString() }).is('dispatched_at', null).eq('station', ownStation);
		query = body.action === 'dispatch_item' ? query.eq('id', String(body.itemId || '')) : query.eq('serve_table_id', String(body.tableId || ''));
		const { error } = await query;
		if (error) return json({ error: error.message }, 500);
		await broadcast(menuSlug, { type: 'dispatched', tableId: body.tableId });
		return json({ success: true });
	}

	if (body.action === 'add_item') {
		if (!['waiter', 'bar', 'cashier'].includes(role)) return json({ error: 'Not allowed for this role.' }, 403);
		const tableId = String(body.tableId || '');
		const serveTableId = body.serveTableId ? String(body.serveTableId) : tableId;
		if (!tableId) return json({ error: 'Missing table.' }, 400);
		const requested = Array.isArray(body.items) ? body.items : [];
		if (!requested.length) return json({ error: 'No items to add.' }, 400);

		let group = (await supabase.from('order_groups').select('id').eq('table_id', tableId).eq('status', 'OPEN').maybeSingle()).data;
		if (!group) {
			const { data: created, error: createError } = await supabase.from('order_groups').insert({ table_id: tableId, menu_slug: menuSlug }).select('id').single();
			if (createError) return json({ error: 'Could not start an order for this table.' }, 500);
			group = created;
		}
		const { data: existingItems } = await supabase.from('order_items').select('round_number').eq('order_group_id', group.id).order('round_number', { ascending: false }).limit(1);
		const roundNumber = existingItems && existingItems.length ? existingItems[0].round_number + 1 : 1;

		const rows = [];
		for (const requestedItem of requested) {
			const product = findProduct(menu.categories, String(requestedItem.productId || ''));
			if (!product) return json({ error: 'One of the items is no longer on the menu.' }, 400);
			rows.push({
				order_group_id: group.id, serve_table_id: serveTableId, product_id: String(requestedItem.productId),
				product_name: product.name, unit_price_cents: product.priceCents, station: product.station,
				quantity: Math.max(1, Math.min(20, Number(requestedItem.quantity) || 1)),
				notes: requestedItem.notes ? String(requestedItem.notes).slice(0, 200) : null,
				source: role.toUpperCase(), round_number: roundNumber
			});
		}
		const { error: insertError } = await supabase.from('order_items').insert(rows);
		if (insertError) return json({ error: insertError.message }, 500);
		await broadcast(menuSlug, { type: 'order_placed', tableId: serveTableId });
		return json({ success: true });
	}

	if (body.action === 'remove_item') {
		// Cashier only: the cashier owns the bill, so only they can take a line
		// off it (a sent order can't be undone by the guest or by kitchen/bar/waiter).
		if (role !== 'cashier') return json({ error: 'Not allowed for this role.' }, 403);
		const itemId = String(body.itemId || '');
		const { data: item } = await supabase.from('order_items').select('id, order_group_id, serve_table_id').eq('id', itemId).maybeSingle();
		if (!item) return json({ error: 'Item not found.' }, 404);
		const { data: group } = await supabase.from('order_groups').select('menu_slug, status').eq('id', item.order_group_id).maybeSingle();
		if (!group || group.menu_slug !== menuSlug || group.status !== 'OPEN') return json({ error: 'Item not found.' }, 404);
		const { error } = await supabase.from('order_items').delete().eq('id', item.id);
		if (error) return json({ error: error.message }, 500);
		await broadcast(menuSlug, { type: 'item_removed', tableId: item.serve_table_id });
		return json({ success: true });
	}

	if (body.action === 'resolve_call') {
		if (role !== 'waiter') return json({ error: 'Not allowed for this role.' }, 403);
		const { error } = await supabase.from('waiter_calls').update({ resolved_at: new Date().toISOString() }).eq('id', String(body.callId || ''));
		if (error) return json({ error: error.message }, 500);
		return json({ success: true });
	}

	if (body.action === 'close_table') {
		if (role !== 'cashier') return json({ error: 'Not allowed for this role.' }, 403);
		const tableId = String(body.tableId || '');
		const { data: group } = await supabase.from('order_groups').select('id').eq('table_id', tableId).eq('status', 'OPEN').maybeSingle();
		if (!group) return json({ error: 'No open order for this table.' }, 400);
		const { error: groupError } = await supabase.from('order_groups').update({ status: 'PAID', closed_at: new Date().toISOString() }).eq('id', group.id);
		if (groupError) return json({ error: groupError.message }, 500);
		// Rotating the qr_token here (not just resetting status) is what makes
		// an old photographed QR code stop working the moment this table's
		// round is settled - see 0015_smartservice_hub.sql.
		const { error: tableError } = await supabase.from('restaurant_tables').update({ status: 'FREE', qr_token: crypto.randomUUID() }).eq('id', tableId);
		if (tableError) return json({ error: tableError.message }, 500);
		await broadcast(menuSlug, { type: 'table_closed', tableId });
		return json({ success: true });
	}

	return json({ error: 'Unknown action.' }, 400);
});
