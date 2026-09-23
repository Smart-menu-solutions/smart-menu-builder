// Guest-facing ordering API for SmartService Hub. The table's number in the
// URL is not a secret (it's printed on the table) - anyone can look at a
// table's menu. What guards actual writes is the session id: staff activate
// a table from the Table Hub, which opens a fresh order_groups row; its id
// (a random UUID, never shown to the guest - the browser just holds it in
// memory/localStorage after the first fetch) is required on every write. A
// closed table has no such row, so a stale id from a departed guest's phone
// stops matching anything the moment staff free the table - no rotating
// per-table secret or reprinted sticker needed. See 0017_table_hub.sql.

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

async function resolveTable(slug: string, tableNumber: string) {
	const { data: menu } = await supabase.from('menus').select('*').eq('slug', slug).maybeSingle();
	if (!menu || !menu.smartservice_hub_enabled) return null;
	const { data: table } = await supabase.from('restaurant_tables').select('id, menu_slug, table_number, status').eq('menu_slug', slug).eq('table_number', tableNumber).maybeSingle();
	if (!table) return null;
	return { table, menu };
}

async function openGroup(tableId: string) {
	const { data: group } = await supabase.from('order_groups').select('id, bill_requested_at').eq('table_id', tableId).eq('status', 'OPEN').maybeSingle();
	return group;
}

async function currentOrder(orderGroupId: string) {
	const { data: items } = await supabase.from('order_items').select('id, product_name, unit_price_cents, quantity, notes, station, source, round_number, dispatched_at').eq('order_group_id', orderGroupId).order('created_at');
	return items || [];
}

async function broadcast(menuSlug: string, payload: Record<string, unknown>) {
	const channel = supabase.channel(`restaurant:${menuSlug}`);
	await channel.send({ type: 'broadcast', event: 'update', payload });
	await supabase.removeChannel(channel);
}

Deno.serve(async (request) => {
	if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

	if (request.method === 'GET') {
		const url = new URL(request.url);
		const slug = url.searchParams.get('slug') || '';
		const tableNumber = url.searchParams.get('table') || '';
		if (!slug || !tableNumber) return json({ error: 'Invalid or missing link.' }, 400);
		const resolved = await resolveTable(slug, tableNumber);
		if (!resolved) return json({ error: 'This table does not exist.' }, 404);
		const { table, menu } = resolved;
		const group = table.status !== 'FREE' ? await openGroup(table.id) : null;
		return json({
			table: { id: table.id, tableNumber: table.table_number },
			menu,
			active: !!group,
			sessionId: group?.id || null,
			order: group ? { billRequestedAt: group.bill_requested_at, items: await currentOrder(group.id) } : null
		});
	}

	if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

	let body: { slug?: string; table?: string; sessionId?: string; action?: string; items?: { productId?: string; quantity?: number; notes?: string }[] };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid request.' }, 400);
	}

	const slug = String(body.slug || '');
	const tableNumber = String(body.table || '');
	const sessionId = String(body.sessionId || '');
	if (!slug || !tableNumber || !sessionId) return json({ error: 'Invalid or missing link.' }, 400);
	const resolved = await resolveTable(slug, tableNumber);
	if (!resolved) return json({ error: 'This table does not exist.' }, 404);
	const { table, menu } = resolved;

	const group = await openGroup(table.id);
	if (!group || group.id !== sessionId) return json({ error: 'This session has ended - please ask staff to activate the table again.' }, 404);

	if (body.action === 'request_bill') {
		const { error } = await supabase.from('order_groups').update({ bill_requested_at: new Date().toISOString() }).eq('id', group.id);
		if (error) return json({ error: error.message }, 500);
		await supabase.from('restaurant_tables').update({ status: 'PAYMENT_PENDING' }).eq('id', table.id);
		await broadcast(table.menu_slug, { type: 'bill_requested', tableId: table.id });
		return json({ success: true });
	}

	// Default action: place an order (first order or a Nachbestellung - same
	// append-only insert either way, see 0015_smartservice_hub.sql).
	const requested = Array.isArray(body.items) ? body.items : [];
	if (!requested.length) return json({ error: 'No items to order.' }, 400);

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
	return json({ order: { billRequestedAt: group.bill_requested_at, items: await currentOrder(group.id) } });
});
