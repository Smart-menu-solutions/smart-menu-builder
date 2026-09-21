// Guest-facing ordering API for SmartService Hub. The table's qr_token in
// the URL is the only credential - no login, same trust model as
// renewal/get-stats/manage-addons. Every read/write for a table's live
// order goes through here; the browser never talks to the order tables
// directly (see 0015_smartservice_hub.sql for why).

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

type MenuItem = { id?: string; name: string; price: string };
type MenuCategory = { name: string; courseType?: string; items?: MenuItem[] };

// courseType is tagged per section in the builder ('drink' for anything the
// bar makes, everything else defaults to the kitchen) - see
// smartServiceHubQualifies() in admin.js, which is what warns the owner
// before this lookup can ever fail on a real order.
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

async function resolveTable(token: string) {
	const { data: table } = await supabase.from('restaurant_tables').select('id, menu_slug, table_number, status').eq('qr_token', token).maybeSingle();
	if (!table) return null;
	// Full row (select=*), same columns menu.js's read-only fetch already
	// renders (logo, header styling, address, phone...) - the ordering page
	// reuses the exact same renderMenu()/buildCategory() functions, so it
	// needs the same shape, not just categories/languages/translations.
	const { data: menu } = await supabase.from('menus').select('*').eq('slug', table.menu_slug).maybeSingle();
	if (!menu || !menu.smartservice_hub_enabled) return null;
	return { table, menu };
}

async function currentOrder(tableId: string) {
	const { data: group } = await supabase.from('order_groups').select('id, bill_requested_at, opened_at').eq('table_id', tableId).eq('status', 'OPEN').maybeSingle();
	if (!group) return null;
	const { data: items } = await supabase.from('order_items').select('id, product_name, unit_price_cents, quantity, notes, station, source, round_number, dispatched_at, serve_table_id').eq('order_group_id', group.id).order('created_at');
	return { id: group.id, billRequestedAt: group.bill_requested_at, items: items || [] };
}

async function broadcast(menuSlug: string, payload: Record<string, unknown>) {
	const channel = supabase.channel(`restaurant:${menuSlug}`);
	await channel.send({ type: 'broadcast', event: 'update', payload });
	await supabase.removeChannel(channel);
}

Deno.serve(async (request) => {
	if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

	if (request.method === 'GET') {
		const token = new URL(request.url).searchParams.get('t') || '';
		if (!TOKEN_PATTERN.test(token)) return json({ error: 'Invalid or missing link.' }, 400);
		const resolved = await resolveTable(token);
		if (!resolved) return json({ error: 'This link is no longer valid.' }, 404);
		const order = await currentOrder(resolved.table.id);
		return json({
			table: { id: resolved.table.id, tableNumber: resolved.table.table_number },
			menu: resolved.menu,
			order
		});
	}

	if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

	let body: { token?: string; action?: string; items?: { productId?: string; quantity?: number; notes?: string }[] };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid request.' }, 400);
	}

	const token = String(body.token || '');
	if (!TOKEN_PATTERN.test(token)) return json({ error: 'Invalid or missing link.' }, 400);
	const resolved = await resolveTable(token);
	if (!resolved) return json({ error: 'This link is no longer valid.' }, 404);
	const { table, menu } = resolved;

	if (body.action === 'call_waiter') {
		const { error } = await supabase.from('waiter_calls').insert({ table_id: table.id });
		if (error) return json({ error: error.message }, 500);
		await broadcast(table.menu_slug, { type: 'waiter_call', tableId: table.id });
		return json({ success: true });
	}

	if (body.action === 'request_bill') {
		const { data: group } = await supabase.from('order_groups').select('id').eq('table_id', table.id).eq('status', 'OPEN').maybeSingle();
		if (!group) return json({ error: 'No open order for this table yet.' }, 400);
		const { error } = await supabase.from('order_groups').update({ bill_requested_at: new Date().toISOString() }).eq('id', group.id);
		if (error) return json({ error: error.message }, 500);
		await broadcast(table.menu_slug, { type: 'bill_requested', tableId: table.id });
		return json({ success: true });
	}

	// Default action: place an order (first order or a Nachbestellung - same
	// append-only insert either way, see 0015_smartservice_hub.sql).
	const requested = Array.isArray(body.items) ? body.items : [];
	if (!requested.length) return json({ error: 'No items to order.' }, 400);

	let group = (await supabase.from('order_groups').select('id').eq('table_id', table.id).eq('status', 'OPEN').maybeSingle()).data;
	if (!group) {
		const { data: created, error: createError } = await supabase.from('order_groups').insert({ table_id: table.id, menu_slug: table.menu_slug }).select('id').single();
		if (createError) return json({ error: 'Could not start an order for this table.' }, 500);
		group = created;
	}

	const { data: existingItems } = await supabase.from('order_items').select('round_number').eq('order_group_id', group.id).order('round_number', { ascending: false }).limit(1);
	const roundNumber = existingItems && existingItems.length ? existingItems[0].round_number + 1 : 1;

	const rows = [];
	for (const requestedItem of requested) {
		const product = findProduct(menu.categories, String(requestedItem.productId || ''));
		if (!product) return json({ error: 'One of the items is no longer on the menu - please refresh and try again.' }, 400);
		const quantity = Math.max(1, Math.min(20, Number(requestedItem.quantity) || 1));
		rows.push({
			order_group_id: group.id,
			serve_table_id: table.id,
			product_id: String(requestedItem.productId),
			product_name: product.name,
			unit_price_cents: product.priceCents,
			station: product.station,
			quantity,
			notes: requestedItem.notes ? String(requestedItem.notes).slice(0, 200) : null,
			source: 'GUEST',
			round_number: roundNumber
		});
	}

	const { error: insertError } = await supabase.from('order_items').insert(rows);
	if (insertError) return json({ error: insertError.message }, 500);

	await broadcast(table.menu_slug, { type: 'order_placed', tableId: table.id });
	const order = await currentOrder(table.id);
	return json({ order });
});
