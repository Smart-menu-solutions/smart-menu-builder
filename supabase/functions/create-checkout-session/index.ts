import Stripe from 'npm:stripe@16.5.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
	apiVersion: '2024-06-20',
	httpClient: Stripe.createFetchHttpClient()
});

const supabase = createClient(
	Deno.env.get('SUPABASE_URL') ?? '',
	Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// ---------------------------------------------------------------------------
// Upload validation. The order form uploads straight from the browser with the
// public key, and the bucket's MIME allowlist only checks the Content-Type
// header the uploader *declares* - an .exe sent as "application/pdf" was
// accepted. So nothing under pending/ is trusted until this has checked the
// real object: path shape, age, size and the file's own first bytes. Anything
// whose content doesn't match is deleted on the spot. (Same block is copied
// into renewal/index.ts - functions are deployed as single files.)
const UPLOAD_BUCKET = 'menu-pdfs';
// pending/<Date.now()>-<random a-z0-9>-<sanitised name>, as order-form.js and
// renewal-form.js build it. Also enforced by the storage insert policy (0024).
const PENDING_PATH = /^pending\/(\d{13})-([a-z0-9]{1,8})-([A-Za-z0-9._-]{1,200})$/;
const MAX_UPLOAD_AGE_MS = 2 * 60 * 60 * 1000;
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // same as the bucket's file_size_limit
const MAGIC = {
	pdf: [0x25, 0x50, 0x44, 0x46, 0x2d], // "%PDF-"
	zip: [0x50, 0x4b, 0x03, 0x04] // "PK\x03\x04", a local file header
};
type UploadKind = keyof typeof MAGIC;
type UploadRejection = 'path' | 'missing' | 'content';
type UploadCheck = { ok: true } | { ok: false; reason: UploadRejection };

async function validateUpload(path: string, kind: UploadKind): Promise<UploadCheck> {
	const match = PENDING_PATH.exec(path);
	if (!match) return { ok: false, reason: 'path' };
	const uploadedAt = Number(match[1]);
	const now = Date.now();
	if (uploadedAt < now - MAX_UPLOAD_AGE_MS || uploadedAt > now + 5 * 60 * 1000) return { ok: false, reason: 'path' };

	const name = path.slice('pending/'.length);
	const { data: listing, error: listError } = await supabase.storage.from(UPLOAD_BUCKET).list('pending', { search: name, limit: 10 });
	const object = listError ? null : (listing || []).find((entry) => entry.name === name);
	if (!object) return { ok: false, reason: 'missing' };

	const createdAt = Date.parse(object.created_at || '');
	const size = Number(object.metadata?.size ?? 0);
	const head = await readHead(path, MAGIC[kind].length);
	// Couldn't read it (network hiccup, object vanished) - reject this attempt
	// but leave the object alone: only a file that was actually read and
	// turned out to be something else gets deleted.
	if (head === null) return { ok: false, reason: 'missing' };
	const contentOk = MAGIC[kind].every((byte, i) => head[i] === byte);
	if (!contentOk || !(size > 0 && size <= MAX_UPLOAD_BYTES) || !(createdAt >= now - MAX_UPLOAD_AGE_MS)) {
		const { error: removeError } = await supabase.storage.from(UPLOAD_BUCKET).remove([path]);
		if (removeError) console.error('Could not delete rejected upload', path, removeError);
		console.warn('Rejected upload', { path, kind, size, contentOk });
		return { ok: false, reason: 'content' };
	}
	return { ok: true };
}

// Only the first few bytes are needed, so the object is streamed through a
// short-lived signed URL and the stream is cancelled as soon as they're in -
// no point pulling a 50 MB ZIP into memory to look at 4 bytes.
async function readHead(path: string, length: number): Promise<Uint8Array | null> {
	const { data: signed, error } = await supabase.storage.from(UPLOAD_BUCKET).createSignedUrl(path, 60);
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

const UPLOAD_ERRORS: Record<'de' | 'en', Record<UploadRejection, string>> = {
	de: {
		path: 'Der Upload ist ungültig oder abgelaufen. Bitte laden Sie Ihre Datei erneut hoch.',
		missing: 'Die hochgeladene Datei wurde nicht gefunden. Bitte laden Sie sie erneut hoch.',
		content: 'Die hochgeladene Datei ist keine gültige PDF- bzw. ZIP-Datei. Bitte wählen Sie eine andere Datei.'
	},
	en: {
		path: 'The upload is invalid or has expired. Please upload your file again.',
		missing: 'The uploaded file could not be found. Please upload it again.',
		content: 'The uploaded file is not a valid PDF or ZIP file. Please choose a different file.'
	}
};

const SITE_ORIGIN = 'https://smartmenusolutions.com';

const PLAN_PRICING: Record<string, { amountCents: number; label: string; photoAddOnCents: number; smartFoodMatchAddOnCents: number; analyticsReportsAddOnCents: number }> = {
	start: { amountCents: 11900, label: 'Smart Start', photoAddOnCents: 1000, smartFoodMatchAddOnCents: 500, analyticsReportsAddOnCents: 500 },
	pro: { amountCents: 12900, label: 'Smart Pro', photoAddOnCents: 3000, smartFoodMatchAddOnCents: 500, analyticsReportsAddOnCents: 500 },
	premium: { amountCents: 16900, label: 'Smart Premium', photoAddOnCents: 9000, smartFoodMatchAddOnCents: 500, analyticsReportsAddOnCents: 500 }
};

// Flat across every plan (unlike the photo add-on, which scales with plan
// size) - same €89/year regardless of Start/Pro/Premium.
const SMARTSERVICE_HUB_ADDON_CENTS = 8900;

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (request) => {
	if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
	if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

	try {
		const body = await request.json();
		const plan = String(body.plan || '');
		const firstName = String(body.firstName || '').trim();
		const lastName = String(body.lastName || '').trim();
		const email = String(body.email || '').trim();
		const companyName = String(body.companyName || '').trim();
		const phone = String(body.phone || '').trim();
		const pdfPath = String(body.pdfPath || '').trim();
		const photoAddon = Boolean(body.photoAddon);
		const photoZipPath = String(body.photoZipPath || '').trim();
		const smartFoodMatchAddon = Boolean(body.smartFoodMatchAddon);
		const analyticsReportsAddon = Boolean(body.analyticsReportsAddon);
		const smartServiceHubAddon = Boolean(body.smartServiceHubAddon);
		// Defaults to 'de' (not 'en') to match subscriptions.lang's column
		// default - every subscription before this feature existed was
		// effectively German-only, so an unset/unexpected value should fall
		// back to that same historical behavior, not flip to English.
		const lang = String(body.lang || '') === 'en' ? 'en' : 'de';

		const pricing = PLAN_PRICING[plan];
		if (!pricing || !firstName || !lastName || !EMAIL_PATTERN.test(email) || !pdfPath) {
			return json({ error: 'Missing or invalid order details.' }, 400);
		}

		// pdfPath/photoZipPath are just strings from the browser - they only get
		// into the Stripe metadata (and from there into the order email as
		// attachments) once the real objects behind them have passed the check.
		const pdfCheck = await validateUpload(pdfPath, 'pdf');
		if (!pdfCheck.ok) return json({ error: UPLOAD_ERRORS[lang][pdfCheck.reason] }, 400);
		if (photoZipPath) {
			// Must be the ZIP from this same submission: order-form.js names it
			// with the PDF's own pending/<timestamp>-<random>- prefix.
			const [, uploadedAt, random] = PENDING_PATH.exec(pdfPath) ?? [];
			if (photoZipPath !== `pending/${uploadedAt}-${random}-photos.zip`) {
				return json({ error: UPLOAD_ERRORS[lang].path }, 400);
			}
			const zipCheck = await validateUpload(photoZipPath, 'zip');
			if (!zipCheck.ok) return json({ error: UPLOAD_ERRORS[lang][zipCheck.reason] }, 400);
		}

		// Price comes exclusively from the server-side PLAN_PRICING map — the
		// previous version trusted a client-supplied amount, which let a caller
		// pay for "premium" at the "start" price. Same reasoning for the photo
		// add-on: only the boolean flag is trusted from the client, the actual
		// amount is looked up server-side per plan.
		const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [{
			price_data: {
				currency: 'eur',
				unit_amount: pricing.amountCents,
				recurring: { interval: 'year' },
				product_data: { name: `Smart Menu Solutions – ${pricing.label}` }
			},
			quantity: 1
		}];
		if (photoAddon) {
			// One-time charge alongside the recurring plan — Stripe Checkout
			// supports mixing a non-recurring price_data line item into a
			// subscription-mode session; it's billed once at signup only.
			lineItems.push({
				price_data: {
					currency: 'eur',
					unit_amount: pricing.photoAddOnCents,
					product_data: { name: 'Smart DishPhoto™ (one-time)' }
				},
				quantity: 1
			});
		}
		if (smartFoodMatchAddon) {
			// Unlike the photo add-on, this is a standing feature kept switched
			// on for the customer (not a one-off deliverable) - billed yearly
			// alongside the plan itself, as a second recurring line item on the
			// same subscription (same interval, so Stripe renews both together).
			lineItems.push({
				price_data: {
					currency: 'eur',
					unit_amount: pricing.smartFoodMatchAddOnCents,
					recurring: { interval: 'year' },
					product_data: { name: 'Smart FoodMatch™ add-on' }
				},
				quantity: 1
			});
		}
		if (analyticsReportsAddon) {
			// Same shape as the Smart Food Match add-on above: a standing feature,
			// billed yearly as a second recurring line item on the same
			// subscription.
			lineItems.push({
				price_data: {
					currency: 'eur',
					unit_amount: pricing.analyticsReportsAddOnCents,
					recurring: { interval: 'year' },
					product_data: { name: 'Smart WeeklyReport™ add-on' }
				},
				quantity: 1
			});
		}
		if (smartServiceHubAddon) {
			// Same recurring shape again, but flat across all plans - not looked
			// up from `pricing` like the other add-ons above.
			lineItems.push({
				price_data: {
					currency: 'eur',
					unit_amount: SMARTSERVICE_HUB_ADDON_CENTS,
					recurring: { interval: 'year' },
					product_data: { name: 'Smart ServiceHub™ add-on' }
				},
				quantity: 1
			});
		}

		const session = await stripe.checkout.sessions.create({
			mode: 'subscription',
			customer_email: email,
			line_items: lineItems,
			success_url: `${SITE_ORIGIN}/success.html?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${SITE_ORIGIN}/cancel.html`,
			metadata: {
				type: 'initial',
				plan,
				firstName,
				lastName,
				companyName,
				phone,
				email,
				pdfPath,
				photoAddon: String(photoAddon),
				photoZipPath,
				smartFoodMatchAddon: String(smartFoodMatchAddon),
				analyticsReportsAddon: String(analyticsReportsAddon),
				smartServiceHubAddon: String(smartServiceHubAddon),
				lang
			},
			subscription_data: {
				metadata: { type: 'initial', plan, firstName, lastName, companyName, phone, email, pdfPath, photoAddon: String(photoAddon), photoZipPath, smartFoodMatchAddon: String(smartFoodMatchAddon), analyticsReportsAddon: String(analyticsReportsAddon), smartServiceHubAddon: String(smartServiceHubAddon), lang }
			}
		});

		return json({ url: session.url });
	} catch (error) {
		console.error(error);
		return json({ error: 'Could not create checkout session.' }, 500);
	}
});

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
	});
}
