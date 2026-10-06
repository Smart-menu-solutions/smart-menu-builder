// Guest-facing ordering API for SmartService Hub. The table's number in the
// URL is printed openly on the table, so it's not treated as a secret by
// itself - the link also carries link_secret (see 0019_table_link_secret.sql
// and resolveTable() below), a second, long random value required on every
// call, which is what actually keeps one table's menu link from working for
// another. What guards actual writes on top of that is the session id:
// staff activate a table from the Table Hub, which opens a fresh
// order_groups row; its id is required on every write, but is only ever
// handed to a caller who already proved they hold that table's link_secret.
// A closed table has no open order_groups row, so a stale id from a
// departed guest's phone stops matching anything the moment staff free the
// table - no rotating per-table secret or reprinted sticker needed.
// See 0017_table_hub.sql.

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

// One cart is a handful of lines - this only stops a single request from
// flooding the kitchen with thousands of rows.
const MAX_ITEMS_PER_ORDER = 50;

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

// The table number alone (printed openly, never rotates) used to be the
// only thing gating this table's order data and write access - but the
// GET response below hands back sessionId, which is all a write needs, so
// guessing another table's number was enough to read AND order onto their
// tab. link_secret closes that: a long random value that also never
// rotates (so the printed/scanned link still never needs reprinting), set
// once per table (see 0019_table_link_secret.sql) and required alongside
// the table number on every call.
const TABLE_LINK_SECRET_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveTable(slug: string, tableNumber: string, linkSecret: string) {
	if (!TABLE_LINK_SECRET_PATTERN.test(linkSecret)) return null;
	const { data: menu } = await supabase.from('menus').select('*').eq('slug', slug).maybeSingle();
	// is_published too: expiry, cancellation and the end of a Discovery Pass
	// only unpublish the menu (check-subscriptions/stripe-webhook) - without
	// this, ordering kept working for a customer who no longer pays.
	if (!menu || !menu.smartservice_hub_enabled || !menu.is_published) return null;
	const { data: table } = await supabase.from('restaurant_tables').select('id, menu_slug, table_number, status').eq('menu_slug', slug).eq('table_number', tableNumber).eq('link_secret', linkSecret).maybeSingle();
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

// The realtime channel name carries a random per-restaurant key (see
// 0032_realtime_channel_key.sql) - the slug alone is public, so anyone could
// have listened in on order activity or sent fake events. Only callers who
// passed resolveTable() get the name. Same helper as in staff-access.
async function channelName(menuSlug: string): Promise<string | null> {
	const lookup = () => supabase.from('restaurant_channels').select('channel_key').eq('menu_slug', menuSlug).maybeSingle();
	let { data } = await lookup();
	if (!data) {
		// First use for this restaurant - a concurrent insert just loses the race.
		await supabase.from('restaurant_channels').insert({ menu_slug: menuSlug });
		({ data } = await lookup());
	}
	return data ? `restaurant:${menuSlug}:${data.channel_key}` : null;
}

// Rollout only: also announce on the old slug-only channel until every open
// guest/staff page has reloaded the new menu.js/staff.js. Set to false
// afterwards - then the public channel carries nothing any more.
const SEND_LEGACY_CHANNEL = false;

async function broadcast(menuSlug: string, payload: Record<string, unknown>) {
	const names = [await channelName(menuSlug), SEND_LEGACY_CHANNEL ? `restaurant:${menuSlug}` : null];
	for (const name of names) {
		if (!name) continue;
		const channel = supabase.channel(name);
		await channel.send({ type: 'broadcast', event: 'update', payload });
		await supabase.removeChannel(channel);
	}
}

// Push to the staff phones (staff-push Edge Function). Kept alive past the
// response with waitUntil and never awaited, so a slow or failing push
// service can't delay or break the guest's order. Same helper as in
// staff-access.
function notifyStaff(menuSlug: string, event: Record<string, unknown>) {
	const task = fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/staff-push`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}` },
		body: JSON.stringify({ action: 'notify', menuSlug, event })
	}).then((response) => response.body?.cancel()).catch(() => {});
	try {
		(globalThis as { EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void } }).EdgeRuntime?.waitUntil(task);
	} catch { /* the push is a nice-to-have - the order already went through */ }
}

Deno.serve(async (request) => {
	if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

	if (request.method === 'GET') {
		const url = new URL(request.url);
		const slug = url.searchParams.get('slug') || '';
		const tableNumber = url.searchParams.get('table') || '';
		const linkSecret = url.searchParams.get('k') || '';
		if (!slug || !tableNumber) return json({ error: 'Invalid or missing link.' }, 400);
		const resolved = await resolveTable(slug, tableNumber, linkSecret);
		if (!resolved) return json({ error: 'This table does not exist.' }, 404);
		const { table, menu } = resolved;
		const group = table.status !== 'FREE' ? await openGroup(table.id) : null;
		// setup_token is the secret behind servicehub-setup.html (0034) - it
		// must never reach a guest's phone with the rest of the menu row.
		const { setup_token: _setupToken, ...guestMenu } = menu;
		return json({
			table: { id: table.id, tableNumber: table.table_number },
			menu: guestMenu,
			channel: await channelName(table.menu_slug),
			active: !!group,
			sessionId: group?.id || null,
			order: group ? { billRequestedAt: group.bill_requested_at, items: await currentOrder(group.id) } : null
		});
	}

	if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

	let body: { slug?: string; table?: string; k?: string; sessionId?: string; action?: string; items?: { productId?: string; quantity?: number; notes?: string }[] };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid request.' }, 400);
	}

	const slug = String(body.slug || '');
	const tableNumber = String(body.table || '');
	const linkSecret = String(body.k || '');
	const sessionId = String(body.sessionId || '');
	if (!slug || !tableNumber || !sessionId) return json({ error: 'Invalid or missing link.' }, 400);
	const resolved = await resolveTable(slug, tableNumber, linkSecret);
	if (!resolved) return json({ error: 'This table does not exist.' }, 404);
	const { table, menu } = resolved;

	const group = await openGroup(table.id);
	if (!group || group.id !== sessionId) return json({ error: 'This session has ended - please ask staff to activate the table again.' }, 404);

	if (body.action === 'request_bill') {
		const { error } = await supabase.from('order_groups').update({ bill_requested_at: new Date().toISOString() }).eq('id', group.id);
		if (error) return json({ error: error.message }, 500);
		await supabase.from('restaurant_tables').update({ status: 'PAYMENT_PENDING' }).eq('id', table.id);
		await broadcast(table.menu_slug, { type: 'bill_requested', tableId: table.id });
		notifyStaff(table.menu_slug, { type: 'bill', tableId: table.id });
		return json({ success: true });
	}

	// Default action: place an order (first order or a Nachbestellung - same
	// append-only insert either way, see 0015_smartservice_hub.sql).
	const requested = Array.isArray(body.items) ? body.items : [];
	if (!requested.length) return json({ error: 'No items to order.' }, 400);
	if (requested.length > MAX_ITEMS_PER_ORDER) return json({ error: 'Too many items in one order - please send it in smaller parts.' }, 400);

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
	notifyStaff(table.menu_slug, { type: 'order', tableId: table.id, items: rows.map((row) => ({ name: row.product_name, quantity: row.quantity, station: row.station })) });
	return json({ order: { billRequestedAt: group.bill_requested_at, items: await currentOrder(group.id) } });
});
