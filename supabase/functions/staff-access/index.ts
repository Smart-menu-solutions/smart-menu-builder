// Waiter/kitchen/bar/cashier API for SmartService Hub. A per-role secret
// link (restaurant_access.token) is the only credential - no PIN, no
// Supabase login (see 0015_smartservice_hub.sql and the design notes for
// why). The "waiter" role is the Table Hub: a grid of every table with its
// status (FREE/ACTIVE/PAYMENT_PENDING), which is the only place a table
// moves from FREE to ACTIVE (see activate_table below) - guests never
// choose or type anything, they just get told to ask staff when their
// table isn't active yet (see order-session). There's no more cross-table
// "gift a round": add_item always bills and serves the same table, so
// kitchen/bar no longer need to bucket a table's items into "own" vs
// "other station serving here".

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
	station: 'KITCHEN' | 'BAR'; source: string; round_number: number; dispatched_at: string | null;
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

// Every tableId/itemId in a POST body comes from the caller, so it has to be
// checked against the restaurant the staff token belongs to - otherwise one
// restaurant's staff link could act on another restaurant's table just by
// knowing its id (table ids travel in the public realtime broadcasts).
async function tableBelongsTo(tableId: string, menuSlug: string) {
	if (!TOKEN_PATTERN.test(tableId)) return false;
	const { data } = await supabase.from('restaurant_tables').select('id').eq('id', tableId).eq('menu_slug', menuSlug).maybeSingle();
	return !!data;
}

function itemView(item: OrderItemRow, withPrice: boolean) {
	return {
		id: item.id, name: item.product_name, quantity: item.quantity, notes: item.notes,
		station: item.station, roundNumber: item.round_number, dispatched: !!item.dispatched_at,
		...(withPrice ? { unitPriceCents: item.unit_price_cents } : {})
	};
}

async function buildView(menuSlug: string, role: string) {
	const [{ data: tables }, { data: groups }] = await Promise.all([
		supabase.from('restaurant_tables').select('id, table_number, status').eq('menu_slug', menuSlug).order('table_number'),
		supabase.from('order_groups').select('id, table_id, bill_requested_at, order_items(id, product_name, unit_price_cents, quantity, notes, station, source, round_number, dispatched_at)').eq('menu_slug', menuSlug).eq('status', 'OPEN')
	]);
	const openGroups = (groups || []) as OrderGroupRow[];
	const groupByTable = new Map(openGroups.map((group) => [group.table_id, group]));

	if (role === 'kitchen' || role === 'bar') {
		const ownStation = role === 'kitchen' ? 'KITCHEN' : 'BAR';
		const cards = (tables || [])
			.map((table) => {
				const items = (groupByTable.get(table.id)?.order_items || []).filter((item) => item.station === ownStation);
				return { tableId: table.id, tableNumber: table.table_number, items: items.map((item) => itemView(item, false)) };
			})
			.filter((card) => card.items.length);
		return { role, tables: cards };
	}

	// waiter: the Table Hub - every table, including free ones, so staff can
	// activate from the grid. cashier: every non-free table too (not just
	// ones with items) - an activated table that never got an order still
	// needs to be closable, or it would be stuck ACTIVE forever with no way
	// back to FREE.
	const tableCards = (tables || [])
		.filter((table) => role === 'waiter' || table.status !== 'FREE')
		.map((table) => {
			const group = groupByTable.get(table.id);
			const items = group?.order_items || [];
			return {
				tableId: table.id, tableNumber: table.table_number, status: table.status,
				billRequested: !!group?.bill_requested_at,
				items: items.map((item) => itemView(item, true)),
				totalCents: items.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0),
				hasReadyItem: items.some((item) => item.dispatched_at)
			};
		});
	return { role, tables: tableCards };
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
		token?: string; action?: string; tableId?: string; itemId?: string;
		items?: { productId?: string; quantity?: number; notes?: string }[];
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
		if (body.action === 'dispatch_item') {
			const { data: item } = await supabase.from('order_items').select('serve_table_id').eq('id', String(body.itemId || '')).maybeSingle();
			if (!item || !(await tableBelongsTo(item.serve_table_id, menuSlug))) return json({ error: 'Item not found.' }, 404);
		} else if (!(await tableBelongsTo(String(body.tableId || ''), menuSlug))) {
			return json({ error: 'Table not found.' }, 404);
		}
		const ownStation = role === 'kitchen' ? 'KITCHEN' : 'BAR';
		let query = supabase.from('order_items').update({ dispatched_at: new Date().toISOString() }).is('dispatched_at', null).eq('station', ownStation);
		query = body.action === 'dispatch_item' ? query.eq('id', String(body.itemId || '')) : query.eq('serve_table_id', String(body.tableId || ''));
		const { error } = await query;
		if (error) return json({ error: error.message }, 500);
		await broadcast(menuSlug, { type: 'dispatched', tableId: body.tableId });
		return json({ success: true });
	}

	if (body.action === 'activate_table') {
		if (role !== 'waiter') return json({ error: 'Not allowed for this role.' }, 403);
		const tableId = String(body.tableId || '');
		const { data: table } = await supabase.from('restaurant_tables').select('id, status').eq('id', tableId).eq('menu_slug', menuSlug).maybeSingle();
		if (!table) return json({ error: 'Table not found.' }, 404);
		if (table.status !== 'FREE') return json({ error: 'Table is already active.' }, 400);
		const { error: groupError } = await supabase.from('order_groups').insert({ table_id: tableId, menu_slug: menuSlug });
		if (groupError) {
			// Unique-open-group index race: another device activated this exact
			// table in the same instant (see 0015_smartservice_hub.sql) - treat
			// it the same as "already active" rather than a real error.
			const alreadyActive = groupError.code === '23505';
			return json({ error: alreadyActive ? 'Table is already active.' : groupError.message }, alreadyActive ? 400 : 500);
		}
		const { error: tableError } = await supabase.from('restaurant_tables').update({ status: 'ACTIVE' }).eq('id', tableId);
		if (tableError) return json({ error: tableError.message }, 500);
		await broadcast(menuSlug, { type: 'table_activated', tableId });
		return json({ success: true });
	}

	if (body.action === 'deactivate_table') {
		// Undoes a mis-tapped FREE tile without a trip through the cashier's
		// close flow - only while the table is still genuinely empty, so an
		// in-progress order can never be silently dropped this way (that's
		// still close_table, cashier-only, on purpose).
		if (role !== 'waiter') return json({ error: 'Not allowed for this role.' }, 403);
		const tableId = String(body.tableId || '');
		if (!(await tableBelongsTo(tableId, menuSlug))) return json({ error: 'Table not found.' }, 404);
		const { data: group } = await supabase.from('order_groups').select('id, order_items(id)').eq('table_id', tableId).eq('status', 'OPEN').maybeSingle();
		if (!group) return json({ error: 'No open order for this table.' }, 400);
		if ((group.order_items || []).length) return json({ error: 'This table already has items - ask the cashier to close it.' }, 400);
		const { error: groupError } = await supabase.from('order_groups').update({ status: 'CANCELLED', closed_at: new Date().toISOString() }).eq('id', group.id);
		if (groupError) return json({ error: groupError.message }, 500);
		const { error: tableError } = await supabase.from('restaurant_tables').update({ status: 'FREE' }).eq('id', tableId);
		if (tableError) return json({ error: tableError.message }, 500);
		await broadcast(menuSlug, { type: 'table_deactivated', tableId });
		return json({ success: true });
	}

	if (body.action === 'request_bill') {
		// Lets the Admin Hub flag a table as wanting to pay even when the
		// guest never touches "Rechnung anfordern" themselves (they just told
		// the waiter directly) - same effect as the guest-facing action in
		// order-session: turns the tile red so the cashier notices it.
		if (!['waiter', 'cashier'].includes(role)) return json({ error: 'Not allowed for this role.' }, 403);
		const tableId = String(body.tableId || '');
		if (!(await tableBelongsTo(tableId, menuSlug))) return json({ error: 'Table not found.' }, 404);
		const { data: group } = await supabase.from('order_groups').select('id').eq('table_id', tableId).eq('status', 'OPEN').maybeSingle();
		if (!group) return json({ error: 'This table is not active yet.' }, 400);
		const { error } = await supabase.from('order_groups').update({ bill_requested_at: new Date().toISOString() }).eq('id', group.id);
		if (error) return json({ error: error.message }, 500);
		await supabase.from('restaurant_tables').update({ status: 'PAYMENT_PENDING' }).eq('id', tableId);
		await broadcast(menuSlug, { type: 'bill_requested', tableId });
		return json({ success: true });
	}

	if (body.action === 'add_item') {
		if (!['waiter', 'bar', 'cashier'].includes(role)) return json({ error: 'Not allowed for this role.' }, 403);
		const tableId = String(body.tableId || '');
		if (!tableId) return json({ error: 'Missing table.' }, 400);
		if (!(await tableBelongsTo(tableId, menuSlug))) return json({ error: 'Table not found.' }, 404);
		const requested = Array.isArray(body.items) ? body.items : [];
		if (!requested.length) return json({ error: 'No items to add.' }, 400);

		const { data: group } = await supabase.from('order_groups').select('id').eq('table_id', tableId).eq('status', 'OPEN').maybeSingle();
		if (!group) return json({ error: 'This table is not active yet.' }, 400);
		const { data: existingItems } = await supabase.from('order_items').select('round_number').eq('order_group_id', group.id).order('round_number', { ascending: false }).limit(1);
		const roundNumber = existingItems && existingItems.length ? existingItems[0].round_number + 1 : 1;

		const rows = [];
		for (const requestedItem of requested) {
			const product = findProduct(menu.categories, String(requestedItem.productId || ''));
			if (!product) return json({ error: 'One of the items is no longer on the menu.' }, 400);
			rows.push({
				order_group_id: group.id, serve_table_id: tableId, product_id: String(requestedItem.productId),
				product_name: product.name, unit_price_cents: product.priceCents, station: product.station,
				quantity: Math.max(1, Math.min(20, Number(requestedItem.quantity) || 1)),
				notes: requestedItem.notes ? String(requestedItem.notes).slice(0, 200) : null,
				source: role.toUpperCase(), round_number: roundNumber
			});
		}
		const { error: insertError } = await supabase.from('order_items').insert(rows);
		if (insertError) return json({ error: insertError.message }, 500);
		await broadcast(menuSlug, { type: 'order_placed', tableId });
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

	if (body.action === 'close_table') {
		if (role !== 'cashier') return json({ error: 'Not allowed for this role.' }, 403);
		const tableId = String(body.tableId || '');
		if (!(await tableBelongsTo(tableId, menuSlug))) return json({ error: 'Table not found.' }, 404);
		const { data: group } = await supabase.from('order_groups').select('id').eq('table_id', tableId).eq('status', 'OPEN').maybeSingle();
		if (!group) return json({ error: 'No open order for this table.' }, 400);
		const { error: groupError } = await supabase.from('order_groups').update({ status: 'PAID', closed_at: new Date().toISOString() }).eq('id', group.id);
		if (groupError) return json({ error: groupError.message }, 500);
		const { error: tableError } = await supabase.from('restaurant_tables').update({ status: 'FREE' }).eq('id', tableId);
		if (tableError) return json({ error: tableError.message }, 500);
		await broadcast(menuSlug, { type: 'table_closed', tableId });
		return json({ success: true });
	}

	return json({ error: 'Unknown action.' }, 400);
});
