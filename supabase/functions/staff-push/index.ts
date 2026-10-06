// Push notifications for the staff screens (kitchen/bar/cashier and the
// Table Hub) - on top of the chime in staff.js, so a phone in an apron pocket
// or a tablet with its screen off still hears about a new order.
//
// Two kinds of callers:
// - the staff pages (staff.js): GET returns the VAPID public key, POST
//   subscribe/unsubscribe registers this device. The staff link
//   (restaurant_access.token) is the only credential, same as staff-access.
// - order-session and staff-access: POST notify after a guest order, a bill
//   request or a dish marked ready, authenticated with the service role key.
//   They only fire and forget (see notifyStaff there), so nothing in here can
//   ever hold up or break an order.
//
// Sending is plain Web Crypto - RFC 8291 (aes128gcm payload encryption) and
// RFC 8292 (VAPID) - no npm package. The private key only exists as the
// function secret VAPID_PRIVATE_KEY, never in the repo.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', SERVICE_ROLE_KEY);

const VAPID = {
	publicKey: Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
	privateKey: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
	subject: Deno.env.get('VAPID_SUBJECT') ?? 'mailto:info@smartmenusolutions.com'
};

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

const TOKEN_PATTERN = /^[0-9a-f-]{36}$/i;
const STAFF_BASE = 'https://smart-menu-solutions.github.io/smart-menu-builder/';
const LANGUAGES = ['de', 'en', 'it', 'el', 'es', 'fr', 'nl', 'pt'];
// Only real browser push services - a subscription is just a URL this
// function POSTs to, so anything else is refused instead of called.
const PUSH_HOSTS = ['fcm.googleapis.com', 'android.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com'];
// A "new order" that arrives an hour late helps nobody - the push service
// drops it instead of delivering it once the phone is back online.
const TTL_SECONDS = 900;

type Role = 'waiter' | 'kitchen' | 'bar' | 'cashier';
type Station = 'KITCHEN' | 'BAR';
type PushEvent =
	| { type: 'order'; tableId: string; items: { name: string; quantity: number; station: Station }[] }
	| { type: 'bill'; tableId: string }
	| { type: 'ready'; tableId: string; station: Station; count: number };
type PushTarget = { endpoint: string; p256dh: string; auth: string };
type SubscriptionRow = PushTarget & { lang: string; role: Role; access_token: string };
type Translations = Record<string, { items?: Record<string, { name?: string }> }> | null;

// Who hears about what - the same moments staff.js chimes for.
const ROLES_FOR: Record<PushEvent['type'], Role[]> = { order: ['kitchen', 'bar'], bill: ['cashier'], ready: ['waiter'] };

const TEXT: Record<string, Record<string, string>> = {
	de: { table: 'Tisch', order: 'Neue Bestellung', bill: 'Rechnung', billBody: 'Der Tisch möchte bezahlen.', ready: 'Zum Abholen bereit', readyKitchen: 'Küche: {n} fertig', readyBar: 'Bar: {n} fertig', onTitle: '✓ Benachrichtigungen sind an', onBody: 'Neue Meldungen erscheinen ab jetzt auch hier.' },
	en: { table: 'Table', order: 'New order', bill: 'Bill', billBody: 'This table would like to pay.', ready: 'Ready to serve', readyKitchen: 'Kitchen: {n} ready', readyBar: 'Bar: {n} ready', onTitle: '✓ Notifications are on', onBody: 'New alerts will now show up here too.' },
	it: { table: 'Tavolo', order: 'Nuovo ordine', bill: 'Conto', billBody: 'Il tavolo vorrebbe pagare.', ready: 'Pronto da servire', readyKitchen: 'Cucina: {n} pronti', readyBar: 'Bar: {n} pronti', onTitle: '✓ Notifiche attive', onBody: 'Da ora i nuovi avvisi compaiono anche qui.' },
	el: { table: 'Τραπέζι', order: 'Νέα παραγγελία', bill: 'Λογαριασμός', billBody: 'Το τραπέζι θέλει να πληρώσει.', ready: 'Έτοιμο για σερβίρισμα', readyKitchen: 'Κουζίνα: {n} έτοιμα', readyBar: 'Μπαρ: {n} έτοιμα', onTitle: '✓ Οι ειδοποιήσεις είναι ενεργές', onBody: 'Οι νέες ειδοποιήσεις θα εμφανίζονται πλέον και εδώ.' },
	es: { table: 'Mesa', order: 'Nuevo pedido', bill: 'Cuenta', billBody: 'La mesa quiere pagar.', ready: 'Listo para servir', readyKitchen: 'Cocina: {n} listos', readyBar: 'Bar: {n} listos', onTitle: '✓ Notificaciones activadas', onBody: 'A partir de ahora los avisos también aparecen aquí.' },
	fr: { table: 'Table', order: 'Nouvelle commande', bill: 'Addition', billBody: 'La table souhaite payer.', ready: 'Prêt à servir', readyKitchen: 'Cuisine : {n} prêts', readyBar: 'Bar : {n} prêts', onTitle: '✓ Notifications activées', onBody: 'Les nouvelles alertes s’affichent désormais aussi ici.' },
	nl: { table: 'Tafel', order: 'Nieuwe bestelling', bill: 'Rekening', billBody: 'De tafel wil afrekenen.', ready: 'Klaar om te serveren', readyKitchen: 'Keuken: {n} klaar', readyBar: 'Bar: {n} klaar', onTitle: '✓ Meldingen staan aan', onBody: 'Nieuwe meldingen verschijnen vanaf nu ook hier.' },
	pt: { table: 'Mesa', order: 'Novo pedido', bill: 'Conta', billBody: 'A mesa quer pagar.', ready: 'Pronto a servir', readyKitchen: 'Cozinha: {n} prontos', readyBar: 'Bar: {n} prontos', onTitle: '✓ Notificações ativadas', onBody: 'A partir de agora os avisos também aparecem aqui.' }
};

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

// --- Web Push: RFC 8291 encryption + RFC 8292 VAPID, plain Web Crypto -----
// (tested against the RFC 8291 appendix A test vector)
const encoder = new TextEncoder();

function fromBase64Url(value: string): Uint8Array {
	const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
	const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...parts: Uint8Array[]): Uint8Array {
	const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
	let offset = 0;
	for (const part of parts) {
		result.set(part, offset);
		offset += part.length;
	}
	return result;
}

async function hkdf(salt: Uint8Array, secret: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveBits']);
	return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

// The payload as a single aes128gcm record for one subscription (RFC 8291).
// salt and serverKeys are fresh per message - they are parameters only so
// the RFC's own test vector can be replayed against this exact code.
async function encryptPayload(plaintext: Uint8Array, uaPublic: Uint8Array, authSecret: Uint8Array, salt?: Uint8Array, serverKeys?: CryptoKeyPair): Promise<Uint8Array> {
	const recordSalt = salt ?? crypto.getRandomValues(new Uint8Array(16));
	const keys = serverKeys ?? (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair);
	const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', keys.publicKey));
	const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
	const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, keys.privateKey, 256));
	const ikm = await hkdf(authSecret, ecdhSecret, concat(encoder.encode('WebPush: info\0'), uaPublic, asPublic), 32);
	const cek = await hkdf(recordSalt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
	const nonce = await hkdf(recordSalt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12);
	const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
	// 0x02 = padding delimiter of the last (here: only) record
	const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, concat(plaintext, new Uint8Array([2]))));
	// Header: salt, record size 4096, then the key id = our one-off public key.
	const header = new Uint8Array(21);
	header.set(recordSalt);
	new DataView(header.buffer).setUint32(16, 4096);
	header[20] = asPublic.length;
	return concat(header, asPublic, ciphertext);
}

// RFC 8292: a short-lived JWT for the push service's origin, signed with the
// key pair the browser subscribed with (applicationServerKey in staff.js).
async function vapidAuthorization(endpoint: string, publicKey: string, privateKey: string, subject: string): Promise<string> {
	const point = fromBase64Url(publicKey);
	const jwk = { kty: 'EC', crv: 'P-256', x: toBase64Url(point.slice(1, 33)), y: toBase64Url(point.slice(33, 65)), d: privateKey };
	const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
	const segment = (value: unknown) => toBase64Url(encoder.encode(JSON.stringify(value)));
	const unsigned = `${segment({ typ: 'JWT', alg: 'ES256' })}.${segment({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })}`;
	const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(unsigned)));
	return `vapid t=${unsigned}.${toBase64Url(signature)}, k=${publicKey}`;
}
// --- end Web Push ----------------------------------------------------------

// The push service's HTTP status (201 = accepted), 0 if it couldn't be reached.
async function sendPush(target: PushTarget, payload: Record<string, unknown>): Promise<number> {
	try {
		const body = await encryptPayload(encoder.encode(JSON.stringify(payload)), fromBase64Url(target.p256dh), fromBase64Url(target.auth));
		const response = await fetch(target.endpoint, {
			method: 'POST',
			headers: {
				Authorization: await vapidAuthorization(target.endpoint, VAPID.publicKey, VAPID.privateKey, VAPID.subject),
				'Content-Encoding': 'aes128gcm',
				'Content-Type': 'application/octet-stream',
				TTL: String(TTL_SECONDS),
				Urgency: 'high'
			},
			body
		});
		await response.body?.cancel();
		return response.status;
	} catch {
		return 0;
	}
}

// Tapping the notification opens (or focuses) that device's own staff screen.
function staffUrl(role: Role, token: string) {
	return `${STAFF_BASE}${role}.html?t=${encodeURIComponent(token)}`;
}

// Dish names are stored as source-language snapshots (see staff.js
// translateName) - shown in the language the staff screen was set to.
function dishName(translations: Translations, lang: string, name: string) {
	return translations?.[lang]?.items?.[name]?.name || name;
}

function messageFor(event: PushEvent, role: Role, lang: string, tableNumber: string, translations: Translations) {
	const text = TEXT[lang] || TEXT.de;
	const table = `${text.table} ${tableNumber}`;
	if (event.type === 'order') {
		const station: Station = role === 'bar' ? 'BAR' : 'KITCHEN';
		const items = (event.items || []).filter((item) => item.station === station);
		if (!items.length) return null;
		const body = items.map((item) => `${item.quantity}× ${dishName(translations, lang, item.name)}`).join(', ');
		return { title: `${table} · ${text.order}`, body: body.length > 160 ? `${body.slice(0, 159)}…` : body };
	}
	if (event.type === 'bill') return { title: `${table} · ${text.bill}`, body: text.billBody, tag: `bill-${event.tableId}` };
	return { title: `${table} · ${text.ready}`, body: (event.station === 'BAR' ? text.readyBar : text.readyKitchen).replace('{n}', String(event.count)), tag: `ready-${event.tableId}` };
}

async function notify(menuSlug: string, event: PushEvent | undefined, excludeAccessToken?: string) {
	const roles = event ? ROLES_FOR[event.type] : undefined;
	if (!event || !roles || !TOKEN_PATTERN.test(String(event.tableId || ''))) return { sent: 0 };
	const { data: rows } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth, lang, role, access_token').eq('menu_slug', menuSlug).in('role', roles);
	// The device that made the change doesn't need to be told about it.
	const targets = ((rows || []) as SubscriptionRow[]).filter((row) => row.access_token !== excludeAccessToken);
	if (!targets.length) return { sent: 0 };
	const [{ data: table }, { data: menu }] = await Promise.all([
		supabase.from('restaurant_tables').select('table_number').eq('id', event.tableId).eq('menu_slug', menuSlug).maybeSingle(),
		supabase.from('menus').select('translations').eq('slug', menuSlug).maybeSingle()
	]);
	if (!table) return { sent: 0 };
	const statuses = await Promise.all(targets.map(async (row) => {
		const message = messageFor(event, row.role, row.lang, String(table.table_number), (menu?.translations ?? null) as Translations);
		if (!message) return 0;
		const status = await sendPush(row, { ...message, url: staffUrl(row.role, row.access_token) });
		// Gone for good (app removed, permission withdrawn) - forget the device.
		if (status === 404 || status === 410) await supabase.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
		return status;
	}));
	return { sent: statuses.filter((status) => status >= 200 && status < 300).length };
}

async function resolveAccess(token: string) {
	const { data } = await supabase.from('restaurant_access').select('id, menu_slug, role').eq('token', token).maybeSingle();
	if (!data) return null;
	// Same rule as staff-access: no ServiceHub (or no published menu), no staff screens.
	const { data: menu } = await supabase.from('menus').select('smartservice_hub_enabled, is_published').eq('slug', data.menu_slug).maybeSingle();
	if (!menu || !menu.smartservice_hub_enabled || !menu.is_published) return null;
	return { id: data.id as string, menuSlug: data.menu_slug as string, role: data.role as Role };
}

function validSubscription(value: unknown): PushTarget | null {
	const subscription = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
	const endpoint = String(subscription?.endpoint || '');
	const p256dh = String(subscription?.keys?.p256dh || '');
	const auth = String(subscription?.keys?.auth || '');
	try {
		const url = new URL(endpoint);
		if (url.protocol !== 'https:' || endpoint.length > 1000) return null;
		if (!PUSH_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) return null;
		const key = fromBase64Url(p256dh);
		if (key.length !== 65 || key[0] !== 4 || fromBase64Url(auth).length !== 16) return null;
	} catch {
		return null;
	}
	return { endpoint, p256dh, auth };
}

Deno.serve(async (request) => {
	if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
	// The public half of the VAPID key pair - staff.js subscribes with it.
	if (request.method === 'GET') return json({ publicKey: VAPID.publicKey });
	if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

	let body: { action?: string; token?: string; subscription?: unknown; endpoint?: string; lang?: string; test?: boolean; menuSlug?: string; event?: PushEvent; excludeAccessToken?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid request.' }, 400);
	}

	if (body.action === 'notify') {
		if (!SERVICE_ROLE_KEY || request.headers.get('Authorization') !== `Bearer ${SERVICE_ROLE_KEY}`) return json({ error: 'Not allowed.' }, 401);
		return json(await notify(String(body.menuSlug || ''), body.event, body.excludeAccessToken));
	}

	const token = String(body.token || '');
	if (!TOKEN_PATTERN.test(token)) return json({ error: 'Invalid or missing link.' }, 400);
	const access = await resolveAccess(token);
	if (!access) return json({ error: 'This link is no longer valid.' }, 404);

	if (body.action === 'subscribe') {
		const subscription = validSubscription(body.subscription);
		if (!subscription) return json({ error: 'Invalid push subscription.' }, 400);
		const lang = LANGUAGES.includes(String(body.lang)) ? String(body.lang) : 'de';
		// One row per device (endpoint): switching links or languages just updates it.
		const { error } = await supabase.from('push_subscriptions').upsert({
			...subscription, access_id: access.id, access_token: token, menu_slug: access.menuSlug, role: access.role, lang, updated_at: new Date().toISOString()
		}, { onConflict: 'endpoint' });
		if (error) return json({ error: error.message }, 500);
		// A first message right away, so whoever switched it on sees that it works.
		const text = TEXT[lang];
		const test = body.test ? await sendPush(subscription, { title: text.onTitle, body: text.onBody, tag: 'push-on', url: staffUrl(access.role, token) }) : null;
		return json({ success: true, test });
	}

	if (body.action === 'unsubscribe') {
		await supabase.from('push_subscriptions').delete().eq('endpoint', String(body.endpoint || '')).eq('access_id', access.id);
		return json({ success: true });
	}

	return json({ error: 'Unknown action.' }, 400);
});
