import Stripe from 'npm:stripe@16.5.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Upload step after payment (upload.html / de/upload.html). The order and
// renewal forms no longer upload anything - Stripe Checkout redirects here
// with ?session_id=..., and the customer's confirmation email links here with
// ?token=<orders.upload_token> for uploading later. Files can only be uploaded
// for a Checkout Session Stripe itself reports as complete (paid), always to
// the fixed paths orders/<session id>/menu.pdf|photos.zip|logo, through one-off
// signed upload URLs - the bucket has no public insert policy any more (0025).
//
// POST { session_id | token, action: 'status' }            -> what the page shows
// POST { session_id | token, action: 'sign', kind }        -> signed upload URL
// POST { session_id | token, action: 'complete' }          -> content check,
//                                                            then the files are
//                                                            emailed to us

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
	apiVersion: '2024-06-20',
	httpClient: Stripe.createFetchHttpClient()
});

const supabase = createClient(
	Deno.env.get('SUPABASE_URL') ?? '',
	Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const NOTIFICATION_EMAIL = Deno.env.get('NOTIFICATION_EMAIL') ?? 'smartmenusolutions@outlook.com';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Smart Menu Builder <onboarding@resend.dev>';

const BUCKET = 'menu-pdfs';
const SESSION_ID_PATTERN = /^cs_(live|test)_[A-Za-z0-9]{10,200}$/;
const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Uploading stays possible for a while after payment (link in the email), but
// not forever.
const MAX_ORDER_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // same as the bucket's file_size_limit
// Resend allows 40 MB per email after base64 (+33 %) - about 30 MB of files.
const ATTACHMENT_BUDGET_BYTES = 25 * 1024 * 1024;
const DOWNLOAD_LINK_SECONDS = 30 * 24 * 60 * 60;
const FILES = {
	pdf: { name: 'menu.pdf', magics: [[0x25, 0x50, 0x44, 0x46, 0x2d]], contentType: 'application/pdf' }, // "%PDF-"
	zip: { name: 'photos.zip', magics: [[0x50, 0x4b, 0x03, 0x04]], contentType: 'application/zip' }, // "PK\x03\x04"
	// Optional customer logo, PNG or JPEG - stored without extension, the
	// attachment gets .png/.jpg from the file's real first bytes.
	logo: { name: 'logo', magics: [[0x89, 0x50, 0x4e, 0x47], [0xff, 0xd8, 0xff]], contentType: 'image/png' }
};
type FileKind = keyof typeof FILES;
const LOGO_TYPES = ['image/png', 'image/jpeg'];

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const MESSAGES = {
	de: {
		notFound: 'Diese Bestellung wurde nicht gefunden oder ist noch nicht bezahlt.',
		expired: 'Dieser Upload-Link ist abgelaufen. Bitte kontaktieren Sie uns.',
		noZip: 'Für diese Bestellung ist kein Foto-Upload gebucht.',
		badLogo: 'Das Logo muss ein PNG- oder JPG-Bild sein.',
		missingPdf: 'Bitte laden Sie zuerst Ihre Speisekarte als PDF hoch.',
		missingZip: 'Bitte laden Sie noch Ihre Fotos als ZIP-Datei hoch.',
		badPdf: 'Die Datei ist keine gültige PDF-Datei. Bitte wählen Sie eine andere Datei.',
		badZip: 'Die Datei ist keine gültige ZIP-Datei. Bitte wählen Sie eine andere Datei.',
		processing: 'Ihre Zahlung wird gerade noch verarbeitet. Einen Moment bitte …',
		failed: 'Das hat leider nicht geklappt. Bitte versuchen Sie es noch einmal.'
	},
	en: {
		notFound: 'This order could not be found or has not been paid yet.',
		expired: 'This upload link has expired. Please contact us.',
		noZip: 'No photo upload is booked for this order.',
		badLogo: 'The logo must be a PNG or JPG image.',
		missingPdf: 'Please upload your menu as a PDF first.',
		missingZip: 'Please also upload your photos as a ZIP file.',
		badPdf: 'The file is not a valid PDF. Please choose a different file.',
		badZip: 'The file is not a valid ZIP file. Please choose a different file.',
		processing: 'Your payment is still being processed. One moment please …',
		failed: 'Something went wrong. Please try again.'
	},
	it: {
		notFound: 'Questo ordine non è stato trovato o non è ancora stato pagato.',
		expired: 'Questo link di caricamento è scaduto. Contattateci.',
		noZip: 'Per questo ordine non è previsto il caricamento delle foto.',
		badLogo: "Il logo deve essere un'immagine PNG o JPG.",
		missingPdf: 'Caricate prima il vostro menu in PDF.',
		missingZip: 'Caricate anche le vostre foto come file ZIP.',
		badPdf: 'Il file non è un PDF valido. Scegliete un altro file.',
		badZip: 'Il file non è un file ZIP valido. Scegliete un altro file.',
		processing: 'Il vostro pagamento è ancora in elaborazione. Un momento, per favore …',
		failed: 'Purtroppo qualcosa non ha funzionato. Riprovate.'
	}
};

// 'it' since the Italian website (2026-10-05); unknown -> 'de' as before.
type Lang = 'de' | 'en' | 'it';
function normalizeLang(value: unknown): Lang {
	return value === 'en' || value === 'it' ? value : 'de';
}

interface OrderContext {
	session: Stripe.Checkout.Session;
	metadata: Record<string, string>;
	type: 'initial' | 'renewal';
	lang: Lang;
	photoAddon: boolean;
	// Smart Discovery includes DishPhoto to try, so photos are optional there.
	zipRequired: boolean;
	hubAddon: boolean;
	folder: string;
	order: { id: string; subscription_id: string | null; files_uploaded_at: string | null; table_numbers: string | null; pos_numbers: string | null } | null;
}

Deno.serve(async (request) => {
	if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
	if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: MESSAGES.en.failed }, 400);
	}
	const requestLang = normalizeLang(body.lang);

	try {
		const context = await resolveOrder(String(body.session_id || ''), String(body.token || ''));
		if (context === 'expired') return json({ error: MESSAGES[requestLang].expired }, 410);
		if (!context) return json({ error: MESSAGES[requestLang].notFound }, 404);
		const text = MESSAGES[context.lang];

		switch (body.action) {
			case 'status':
				return json(await statusOf(context));
			case 'sign': {
				const kind = body.kind === 'zip' ? 'zip' : body.kind === 'pdf' ? 'pdf' : body.kind === 'logo' ? 'logo' : null;
				if (!kind) return json({ error: text.failed }, 400);
				if (kind === 'zip' && !context.photoAddon) return json({ error: text.noZip }, 400);
				const contentType = kind === 'logo' ? (LOGO_TYPES.includes(String(body.contentType)) ? String(body.contentType) : null) : FILES[kind].contentType;
				if (!contentType) return json({ error: text.badLogo }, 400);
				const path = `${context.folder}/${FILES[kind].name}`;
				const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
				if (error || !data) {
					console.error('createSignedUploadUrl failed', path, error);
					return json({ error: text.failed }, 500);
				}
				return json({ path: data.path, token: data.token, contentType });
			}
			case 'complete':
				return await complete(context, body);
			default:
				return json({ error: text.failed }, 400);
		}
	} catch (error) {
		console.error(error);
		return json({ error: MESSAGES[requestLang].failed }, 500);
	}
});

// The session id comes from Stripe's own redirect (?session_id=), the token
// from the confirmation email; either way the Checkout Session is fetched from
// Stripe and only a completed (paid) one is accepted.
async function resolveOrder(sessionId: string, token: string): Promise<OrderContext | 'expired' | null> {
	let order: OrderContext['order'] = null;
	if (!SESSION_ID_PATTERN.test(sessionId)) {
		if (!TOKEN_PATTERN.test(token)) return null;
		const { data } = await supabase
			.from('orders')
			.select('id, subscription_id, files_uploaded_at, table_numbers, pos_numbers, stripe_checkout_session_id')
			.eq('upload_token', token)
			.maybeSingle();
		if (!data?.stripe_checkout_session_id || !SESSION_ID_PATTERN.test(data.stripe_checkout_session_id)) return null;
		sessionId = data.stripe_checkout_session_id;
		order = data;
	}

	let session: Stripe.Checkout.Session;
	try {
		session = await stripe.checkout.sessions.retrieve(sessionId);
	} catch {
		return null;
	}
	// Plans are subscriptions; the Discovery Pass is a one-off payment.
	const isDiscovery = session.mode === 'payment' && session.metadata?.plan === 'discovery';
	if (session.status !== 'complete' || (session.mode !== 'subscription' && !isDiscovery)) return null;
	if (Date.now() - session.created * 1000 > MAX_ORDER_AGE_MS) return 'expired';

	if (!order) {
		// Can still be null right after checkout if Stripe's webhook hasn't
		// been processed yet - uploading works anyway, the paths only depend on
		// the session id.
		const { data } = await supabase
			.from('orders')
			.select('id, subscription_id, files_uploaded_at, table_numbers, pos_numbers')
			.eq('stripe_checkout_session_id', session.id)
			.maybeSingle();
		order = data;
	}

	const metadata = (session.metadata ?? {}) as Record<string, string>;
	return {
		session,
		metadata,
		type: metadata.type === 'renewal' ? 'renewal' : 'initial',
		lang: normalizeLang(metadata.lang),
		// A Smart Discovery upgrade is a renewal-type checkout that can include DishPhoto.
		photoAddon: (metadata.type !== 'renewal' || metadata.fromDiscovery === 'true') && metadata.photoAddon === 'true',
		zipRequired: metadata.plan !== 'discovery' && (metadata.type !== 'renewal' || metadata.fromDiscovery === 'true') && metadata.photoAddon === 'true',
		hubAddon: (metadata.type !== 'renewal' || metadata.fromDiscovery === 'true') && metadata.smartServiceHubAddon === 'true',
		folder: `orders/${session.id}`,
		order
	};
}

async function listFiles(folder: string): Promise<Record<string, number>> {
	const { data } = await supabase.storage.from(BUCKET).list(folder, { limit: 10 });
	const sizes: Record<string, number> = {};
	for (const entry of data || []) sizes[entry.name] = Number(entry.metadata?.size ?? 0);
	return sizes;
}

async function statusOf(context: OrderContext) {
	const files = await listFiles(context.folder);
	return {
		type: context.type,
		lang: context.lang,
		firstName: context.metadata.firstName || '',
		photoAddon: context.photoAddon,
		zipRequired: context.zipRequired,
		hubAddon: context.hubAddon,
		files: { pdf: FILES.pdf.name in files, zip: FILES.zip.name in files, logo: FILES.logo.name in files },
		// Filled in again when the customer comes back through the email link,
		// so a second upload doesn't blank what they typed the first time.
		tableNumbers: context.hubAddon ? context.order?.table_numbers || '' : '',
		posNumbers: context.hubAddon ? context.order?.pos_numbers || '' : '',
		completed: Boolean(context.order?.files_uploaded_at)
	};
}

// Reads just the first bytes of an uploaded file through a short-lived signed
// URL. null = couldn't read it (not the same as "wrong content").
async function readHead(path: string, length: number): Promise<Uint8Array | null> {
	const { data: signed, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
	if (error || !signed?.signedUrl) return null;
	const response = await fetch(signed.signedUrl, { headers: { Range: `bytes=0-${length - 1}` } });
	if (!response.ok || !response.body) return null;
	const reader = response.body.getReader();
	const head = new Uint8Array(length);
	let filled = 0;
	try {
		while (filled < length) {
			const { value, done } = await reader.read();
			if (done || !value) break;
			const take = Math.min(value.length, length - filled);
			head.set(value.subarray(0, take), filled);
			filled += take;
		}
	} finally {
		reader.cancel().catch(() => {});
	}
	return filled === length ? head : null;
}

// 'ok' | 'missing' | 'bad' (bad files are deleted so they can't linger).
async function checkFile(folder: string, kind: FileKind, sizes: Record<string, number>): Promise<'ok' | 'missing' | 'bad'> {
	const { name, magics } = FILES[kind];
	if (!(name in sizes)) return 'missing';
	const path = `${folder}/${name}`;
	const head = await readHead(path, Math.min(...magics.map((magic) => magic.length)));
	if (head === null) return 'missing';
	const size = sizes[name];
	if (magics.some((magic) => magic.every((byte, i) => i >= head.length || head[i] === byte)) && size > 0 && size <= MAX_UPLOAD_BYTES) return 'ok';
	const { error } = await supabase.storage.from(BUCKET).remove([path]);
	if (error) console.error('Could not delete rejected upload', path, error);
	console.warn('Rejected upload', { path, size });
	return 'bad';
}

async function complete(context: OrderContext, body: Record<string, unknown>) {
	const text = MESSAGES[context.lang];
	// Paid, but Stripe's webhook hasn't created the order row yet (usually a
	// matter of seconds) - upload.html retries on 409 + retry.
	if (!context.order) return json({ error: text.processing, retry: true }, 409);
	const sizes = await listFiles(context.folder);

	// Renewals may keep their current menu, so the PDF is optional there.
	const pdf = await checkFile(context.folder, 'pdf', sizes);
	if (pdf === 'bad') return json({ error: text.badPdf }, 400);
	if (pdf === 'missing' && context.type === 'initial') return json({ error: text.missingPdf }, 400);
	let zip: 'ok' | 'missing' | 'bad' = 'missing';
	if (context.photoAddon) {
		zip = await checkFile(context.folder, 'zip', sizes);
		if (zip === 'bad') return json({ error: text.badZip }, 400);
		if (zip === 'missing' && context.zipRequired) return json({ error: text.missingZip }, 400);
	}
	const logo = await checkFile(context.folder, 'logo', sizes);
	if (logo === 'bad') return json({ error: text.badLogo }, 400);
	// Only asked for with Smart ServiceHub - which table QR codes to set up.
	// Free text (e.g. "1-8, 12, Terrasse 1") - tables are often not numbered 1..N.
	const tableNumbers = context.hubAddon ? String(body.tableNumbers ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 300) : '';
	// Till numbers per dish, one per line ("Rindersuppe 350") - line breaks
	// stay, the builder reads them line by line.
	const posNumbers = context.hubAddon ? String(body.posNumbers ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').trim().slice(0, 5000) : '';

	const pdfPath = `${context.folder}/${FILES.pdf.name}`;
	const zipPath = zip === 'ok' ? `${context.folder}/${FILES.zip.name}` : null;
	const again = Boolean(context.order?.files_uploaded_at);
	if (context.order) {
		// Saved on the order before any email goes out: on 2026-10-05 the table
		// numbers only lived in the notification email, and were lost with it.
		const { error: updateError } = await supabase.from('orders').update({
			files_uploaded_at: new Date().toISOString(),
			...(pdf === 'ok' ? { pdf_path: pdfPath } : {}),
			photo_zip_path: zipPath,
			...(context.hubAddon ? { table_numbers: tableNumbers || null, pos_numbers: posNumbers || null } : {})
		}).eq('id', context.order.id);
		if (updateError) console.error('orders update failed', context.order.id, updateError);
	}

	let menuSlug = '-';
	if (context.order?.subscription_id) {
		const { data } = await supabase.from('subscriptions').select('menu_slug').eq('id', context.order.subscription_id).maybeSingle();
		menuSlug = data?.menu_slug || '-';
	}

	// Resend rejects the whole email above 40 MB including the base64 overhead
	// (a 27 MB photo ZIP + 4 MB PDF did exactly that on 2026-10-05), so files
	// are attached smallest first up to ATTACHMENT_BUDGET_BYTES and the rest
	// goes into the email as a signed download link instead.
	const attachments: EmailAttachment[] = [];
	const links: Partial<Record<FileKind, string>> = {};
	const ready = ([['pdf', pdf], ['zip', zip], ['logo', logo]] as const)
		.filter(([, status]) => status === 'ok')
		.map(([kind]) => ({ kind, size: sizes[FILES[kind].name] ?? 0 }))
		.sort((a, b) => a.size - b.size);
	let attachedBytes = 0;
	for (const { kind, size } of ready) {
		const path = `${context.folder}/${FILES[kind].name}`;
		if (attachedBytes + size > ATTACHMENT_BUDGET_BYTES) {
			const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, DOWNLOAD_LINK_SECONDS);
			links[kind] = signed?.signedUrl || `kein Link möglich - Datei liegt im Speicher unter ${path}`;
			continue;
		}
		const { data } = await supabase.storage.from(BUCKET).download(path);
		if (!data) continue;
		const bytes = new Uint8Array(await data.arrayBuffer());
		const filename = kind === 'logo' ? (bytes[0] === 0x89 ? 'logo.png' : 'logo.jpg') : FILES[kind].name;
		attachments.push({ filename, content: toBase64(bytes) });
		attachedBytes += size;
	}
	const delivered = (kind: FileKind, label: string) => links[kind] ? `${label} – Download (30 Tage gültig): ${links[kind]}` : `${label} (Anhang)`;

	const m = context.metadata;
	const subject = context.type === 'renewal'
		? (pdf === 'ok' ? 'Neue Speisekarte zur Verlängerung' : 'Verlängerung: keine neue Speisekarte')
		: (again ? 'Dateien zur Bestellung erneut hochgeladen' : 'Dateien zur Bestellung eingegangen');
	await sendNotification(context.order?.subscription_id ?? null, subject, {
		Kontakt: [m.firstName, m.lastName].filter(Boolean).join(' ') || '-',
		Firma: m.companyName || '-',
		Email: m.email || context.session.customer_details?.email || '-',
		Plan: m.plan || '-',
		'Menü-Slug': menuSlug,
		Speisekarte: pdf === 'ok' ? delivered('pdf', 'menu.pdf') : 'keine neue',
		...(context.photoAddon ? { 'Foto-ZIP': zip === 'ok' ? delivered('zip', 'photos.zip') : '-' } : {}),
		Logo: logo === 'ok' ? delivered('logo', 'Logo') : '-',
		...(context.hubAddon ? { 'Tischnummern (ServiceHub)': tableNumbers || 'nicht angegeben' } : {}),
		...(context.hubAddon ? { 'Kassennummern (ServiceHub)': posNumbers ? `\n${posNumbers}` : 'nicht angegeben' } : {}),
		'Stripe-Checkout': context.session.id
	}, attachments);

	return json({ ok: true });
}

interface EmailAttachment { filename: string; content: string }

// Chunked so String.fromCharCode(...bytes) doesn't blow the call stack on big
// files (same as stripe-webhook).
function toBase64(bytes: Uint8Array): string {
	let binary = '';
	const chunkSize = 0x8000;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
	}
	return btoa(binary);
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => ({
		'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
	}[character] as string));
}

// Same internal notification format and notifications_log entry as
// stripe-webhook's sendNotification().
async function sendNotification(subscriptionId: string | null, subject: string, lines: Record<string, string>, attachments: EmailAttachment[]) {
	const html = `<h2>${escapeHtml(subject)}</h2><ul>${
		Object.entries(lines).map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value ?? '-')).replace(/\n/g, '<br>')}</li>`).join('')
	}</ul>`;
	let providerMessageId: string | null = null;
	try {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ from: FROM_EMAIL, to: [NOTIFICATION_EMAIL], subject, html, ...(attachments.length ? { attachments } : {}) })
		});
		const data = await response.json().catch(() => ({}));
		if (response.ok) providerMessageId = data.id ?? null;
		else console.error('Resend API error', response.status, data);
	} catch (error) {
		console.error('Resend request failed', error);
	}
	const { error: logError } = await supabase.from('notifications_log').insert({
		subscription_id: subscriptionId,
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
