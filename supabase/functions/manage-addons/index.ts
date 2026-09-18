// Self-service, no-login "add an add-on mid-subscription" flow. Same trust
// model as renewal/get-stats: a uuid token in the URL is the only
// credential - here it's subscriptions.addon_token (deliberately its own
// column, see 0011_midyear_addon_purchase.sql for why).
//
// Two billing shapes, see the ADDONS map below:
// - 'recurring' (Smart Food Match, Analytics Report) uses a real Stripe
//   Subscription Item so Stripe prorates the charge for the rest of the
//   current year automatically, and the add-on then renews correctly with
//   the base plan every year after with no extra bookkeeping here.
// - 'one_time' (photos) is a single invoice item at today's plan price,
//   never added to the subscription, so it doesn't recur next year.

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

const SITE_ORIGIN = 'https://smartmenusolutions.com';
const NOTIFICATION_EMAIL = Deno.env.get('NOTIFICATION_EMAIL') ?? 'smartmenusolutions@outlook.com';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Smart Menu Builder <onboarding@resend.dev>';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_PATTERN = /^[0-9a-f-]{36}$/i;

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

// Photos are billed once, not yearly (a delivered set of photos doesn't
// need to keep being paid for), and the price depends on which plan the
// subscription is on - same three tiers create-checkout-session already
// uses for the same add-on at initial order time.
const PHOTO_ADDON_CENTS_BY_PLAN: Record<string, number> = { start: 1000, pro: 3000, premium: 9000 };

// One entry per purchasable add-on.
// - 'recurring' add-ons use a real, persistent Stripe Price (priceId) added
//   as a Subscription Item, so Stripe prorates it now and renews it with the
//   base plan every year after (itemIdColumn tracks that item for the record).
// - 'one_time' (currently just photos) has no persistent Price and nothing
//   to track for renewal - it's a single invoice item at today's plan price.
const ADDONS: Record<string, { label: string; menusColumn: string } & (
	| { billing: 'recurring'; itemIdColumn: string; priceId: string }
	| { billing: 'one_time' }
)> = {
	smart_food_match: {
		label: 'Smart Food Match',
		menusColumn: 'smart_food_match_enabled',
		billing: 'recurring',
		itemIdColumn: 'smart_food_match_item_id',
		priceId: Deno.env.get('STRIPE_PRICE_SMART_FOOD_MATCH') ?? ''
	},
	analytics_reports: {
		label: 'Weekly Analytics Report',
		menusColumn: 'analytics_reports_enabled',
		billing: 'recurring',
		itemIdColumn: 'analytics_reports_item_id',
		priceId: Deno.env.get('STRIPE_PRICE_ANALYTICS_REPORTS') ?? ''
	},
	photos: {
		label: 'Professional dish photos',
		menusColumn: 'photo_addon_enabled',
		billing: 'one_time'
	}
};

type MenuFlags = { name: string; smart_food_match_enabled: boolean; analytics_reports_enabled: boolean; photo_addon_enabled: boolean };

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => ({
		'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
	}[character] as string));
}

// Customer-facing HTML signature (not used on the internal owner-notification
// bullet-list emails). Mirrors scratch/email-signature.html exactly, image
// URLs point at the live site so they render in any mail client.
const EMAIL_SIGNATURE = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;margin-top:18px;">
<tr>
<td style="padding:0 18px 0 0;vertical-align:middle;"><img src="https://smartmenusolutions.com/assets/images/logo-signature.png" width="64" height="64" alt="Smart Menu Solutions" style="display:block;border:0;width:64px;height:64px;"></td>
<td style="padding:0 18px 0 0;vertical-align:middle;border-right:1px solid #E7E5E1;width:1px;"></td>
<td style="padding:0 0 0 18px;vertical-align:middle;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
<tr><td style="padding:0;font-size:15px;font-weight:bold;color:#262421;line-height:1.4;">George Tsiafitsas</td></tr>
<tr><td style="padding:0 0 10px 0;font-size:13px;color:#737373;line-height:1.4;">CEO&nbsp;&middot;&nbsp;<span style="color:#F66A09;font-weight:bold;">Smart</span><span style="color:#262421;font-weight:bold;">&nbsp;Menu Solutions</span></td></tr>
<tr><td style="padding:3px 0;font-size:12.5px;color:#737373;line-height:1;"><a href="mailto:smartmenusolutions@outlook.com" style="text-decoration:none;color:#737373;"><img src="https://smartmenusolutions.com/assets/images/signature/icon-email.png" width="16" height="16" alt="" style="display:inline-block;vertical-align:middle;border:0;width:16px;height:16px;margin-right:7px;"><span style="vertical-align:middle;">smartmenusolutions@outlook.com</span></a></td></tr>
<tr><td style="padding:3px 0;font-size:12.5px;color:#737373;line-height:1;"><a href="https://smartmenusolutions.com" style="text-decoration:none;color:#737373;"><img src="https://smartmenusolutions.com/assets/images/signature/icon-website.png" width="16" height="16" alt="" style="display:inline-block;vertical-align:middle;border:0;width:16px;height:16px;margin-right:7px;"><span style="vertical-align:middle;">smartmenusolutions.com</span></a></td></tr>
<tr><td style="padding:9px 0 3px 0;font-size:12.5px;color:#737373;line-height:1;"><a href="https://instagram.com/smartmenusolutions/" style="text-decoration:none;color:#737373;"><img src="https://smartmenusolutions.com/assets/images/signature/icon-instagram.png" width="16" height="16" alt="" style="display:inline-block;vertical-align:middle;border:0;width:16px;height:16px;margin-right:7px;"><span style="vertical-align:middle;">@smartmenusolutions</span></a></td></tr>
<tr><td style="padding:3px 0;font-size:12.5px;color:#737373;line-height:1;"><a href="https://www.tiktok.com/@smartmenusolutions" style="text-decoration:none;color:#737373;"><img src="https://smartmenusolutions.com/assets/images/signature/icon-tiktok.png" width="16" height="16" alt="" style="display:inline-block;vertical-align:middle;border:0;width:16px;height:16px;margin-right:7px;"><span style="vertical-align:middle;">@smartmenusolutions</span></a></td></tr>
<tr><td style="padding:9px 0 0 23px;font-size:12.5px;color:#737373;line-height:1;">Greece</td></tr>
</table>
</td>
</tr>
</table>`;

async function sendEmail(recipient: string, subscriptionId: string | null, kind: string, subject: string, html: string) {
	let providerMessageId: string | null = null;
	try {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ from: FROM_EMAIL, to: [recipient], subject, html })
		});
		const data = await response.json().catch(() => ({}));
		if (response.ok) providerMessageId = data.id ?? null;
		else console.error('Resend API error', response.status, data);
	} catch (error) {
		console.error('Resend request failed', error);
	}

	const { error: logError } = await supabase.from('notifications_log').insert({
		subscription_id: subscriptionId,
		kind,
		sent_to: recipient,
		provider_message_id: providerMessageId
	});
	if (logError) console.error('Failed to write notifications_log', logError);
}

async function sendNotification(subscriptionId: string | null, subject: string, lines: Record<string, string>) {
	const html = `<h2>${escapeHtml(subject)}</h2><ul>${
		Object.entries(lines).map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value ?? '-'))}</li>`).join('')
	}</ul>`;
	await sendEmail(NOTIFICATION_EMAIL, subscriptionId, subject, subject, html);
}

Deno.serve(async (request) => {
	if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

	const url = new URL(request.url);
	if (request.method === 'GET') return handleGet(url);
	if (request.method === 'POST') return handlePost(request);
	return json({ error: 'Method not allowed' }, 405);
});

async function lookupSubscription(token: string) {
	return supabase
		.from('subscriptions')
		.select('id, status, plan, menu_slug, stripe_subscription_id, smart_food_match_item_id, analytics_reports_item_id, customers(stripe_customer_id, contact_name, email), menus(name, smart_food_match_enabled, analytics_reports_enabled, photo_addon_enabled)')
		.eq('addon_token', token)
		.maybeSingle();
}

function priceLabelFor(addon: typeof ADDONS[string], plan: string): string {
	if (addon.billing === 'recurring') return '€5.00 / year';
	const cents = PHOTO_ADDON_CENTS_BY_PLAN[plan] ?? 0;
	return `€${(cents / 100).toFixed(2)} (one-time)`;
}

async function handleGet(url: URL) {
	const token = url.searchParams.get('token') || '';
	if (!TOKEN_PATTERN.test(token)) return json({ error: 'Invalid or missing link.' }, 400);

	const { data: subscription, error } = await lookupSubscription(token);
	if (error || !subscription) return json({ error: 'This link is no longer valid.' }, 404);

	const menu = subscription.menus as MenuFlags | null;
	return json({
		status: subscription.status,
		addons: Object.entries(ADDONS).map(([key, addon]) => ({
			key,
			label: addon.label,
			priceLabel: priceLabelFor(addon, subscription.plan),
			active: !!menu?.[addon.menusColumn as keyof MenuFlags]
		}))
	});
}

async function handlePost(request: Request) {
	let body: { token?: string; addon?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid request.' }, 400);
	}

	const token = String(body.token || '');
	const addonKey = String(body.addon || '');
	const addon = ADDONS[addonKey];
	if (!TOKEN_PATTERN.test(token) || !addon) return json({ error: 'Invalid request.' }, 400);
	if (addon.billing === 'recurring' && !addon.priceId) {
		console.error(`Missing Stripe price id for add-on ${addonKey}`);
		return json({ error: 'This add-on is not available right now.' }, 500);
	}

	const { data: subscription, error } = await lookupSubscription(token);
	if (error || !subscription) return json({ error: 'This link is no longer valid.' }, 404);
	if (subscription.status !== 'active') return json({ error: 'Your subscription is not currently active.' }, 400);

	const menu = subscription.menus as MenuFlags | null;
	if (menu?.[addon.menusColumn as keyof MenuFlags]) {
		return json({ error: 'This add-on is already active on your plan.' }, 400);
	}

	const customer = subscription.customers as { stripe_customer_id: string; contact_name: string; email: string } | null;
	if (!customer?.stripe_customer_id) return json({ error: 'This link is no longer valid.' }, 404);

	let item: Stripe.SubscriptionItem | null = null;
	let invoiceItem: Stripe.InvoiceItem | null = null;

	if (addon.billing === 'recurring') {
		try {
			item = await stripe.subscriptionItems.create(
				{ subscription: subscription.stripe_subscription_id, price: addon.priceId, proration_behavior: 'create_prorations' },
				{ idempotencyKey: `addon-item:${subscription.id}:${addonKey}` }
			);
		} catch (stripeError) {
			console.error('subscriptionItems.create failed', stripeError);
			return json({ error: 'Could not start the add-on purchase.' }, 500);
		}
	} else {
		// One-time add-on (photos): a plain invoice item at today's plan price,
		// not tied to the subscription - so it never recurs next year.
		const cents = PHOTO_ADDON_CENTS_BY_PLAN[subscription.plan] ?? 0;
		if (!cents) {
			console.error(`No one-time price configured for plan ${subscription.plan}`);
			return json({ error: 'This add-on is not available right now.' }, 500);
		}
		try {
			invoiceItem = await stripe.invoiceItems.create(
				{ customer: customer.stripe_customer_id, currency: 'eur', unit_amount: cents, description: `${addon.label} (one-time)` },
				{ idempotencyKey: `addon-item:${subscription.id}:${addonKey}` }
			);
		} catch (stripeError) {
			console.error('invoiceItems.create failed', stripeError);
			return json({ error: 'Could not start the add-on purchase.' }, 500);
		}
	}

	let paid: Stripe.Invoice;
	try {
		const invoice = await stripe.invoices.create(
			{
				customer: customer.stripe_customer_id,
				...(addon.billing === 'recurring' ? { subscription: subscription.stripe_subscription_id } : {}),
				auto_advance: false,
				collection_method: 'charge_automatically',
				// Without this, invoices.create() can silently skip the pending
				// item we just created above and produce an empty, already-"paid"
				// €0 invoice instead of actually charging anything.
				pending_invoice_items_behavior: 'include_and_require',
				metadata: { type: addon.billing === 'recurring' ? 'addon-midyear' : 'addon-onetime', addon: addonKey, subscriptionId: subscription.id }
			},
			{ idempotencyKey: `addon-invoice:${subscription.id}:${addonKey}` }
		);
		const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
		paid = await stripe.invoices.pay(finalized.id);
		if (paid.status !== 'paid') throw new Error(`Invoice status after pay(): ${paid.status}`);
	} catch (paymentError) {
		console.error('Add-on payment failed', paymentError);
		// Don't leave an unpaid item behind - a subscription item would
		// otherwise still renew (and get billed) again next year; a stray
		// one-time invoice item would get swept into the customer's next
		// real invoice (e.g. next year's renewal) if left pending.
		if (item) await stripe.subscriptionItems.del(item.id, { proration_behavior: 'none' }).catch((rollbackError) => console.error('Rollback failed', rollbackError));
		if (invoiceItem) await stripe.invoiceItems.del(invoiceItem.id).catch((rollbackError) => console.error('Rollback failed', rollbackError));
		return json({ error: 'Payment could not be completed. Please try again or contact support.' }, 402);
	}

	try {
		const { error: menuError } = await supabase.from('menus').update({ [addon.menusColumn]: true }).eq('slug', subscription.menu_slug);
		if (menuError) throw menuError;
		if (addon.billing === 'recurring' && item) {
			const { error: subError } = await supabase.from('subscriptions').update({ [addon.itemIdColumn]: item.id, updated_at: new Date().toISOString() }).eq('id', subscription.id);
			if (subError) throw subError;
		}
	} catch (dbError) {
		console.error('Post-payment DB update failed', dbError);
		await sendNotification(subscription.id, 'Add-on bezahlt, DB-Update fehlgeschlagen', {
			'Subscription-ID': subscription.id,
			Addon: addonKey,
			'Stripe Item': item?.id ?? invoiceItem?.id ?? '-',
			'Rechnung': paid.id
		});
		return json({ error: 'Payment succeeded but activation failed - our team has been notified and will fix this shortly.' }, 500);
	}

	await Promise.all([
		sendNotification(subscription.id, 'Add-on nachträglich gebucht', {
			'Subscription-ID': subscription.id,
			Kunde: customer.contact_name || '-',
			Addon: addon.label,
			Betrag: `${((paid.amount_paid ?? 0) / 100).toFixed(2)} €`
		}),
		EMAIL_PATTERN.test(customer.email)
			? sendEmail(
				customer.email,
				subscription.id,
				'Add-on hinzugefügt',
				`${addon.label} wurde hinzugefügt`,
				`<p>Hallo ${escapeHtml(customer.contact_name || '')},</p>
				<p><strong>${escapeHtml(addon.label)}</strong> ist jetzt für <strong>${escapeHtml(menu?.name || '')}</strong> aktiv.</p>
				<p>${addon.billing === 'recurring'
					? `Berechnet wurde der anteilige Betrag für den Rest Ihres laufenden Abo-Jahres: <strong>${((paid.amount_paid ?? 0) / 100).toFixed(2)} €</strong>. Ab der nächsten Verlängerung läuft es automatisch mit Ihrem Tarif zusammen weiter.`
					: `Berechnet wurde der einmalige Betrag von <strong>${((paid.amount_paid ?? 0) / 100).toFixed(2)} €</strong>. Wir melden uns in Kürze, um die Fotos für Ihre Speisekarte zu organisieren.`
				}</p>
				<p>Mit freundlichen Grüßen<br>Smart Menu Solutions</p>`
			)
			: Promise.resolve()
	]);

	return json({ success: true, addon: addonKey, amountChargedCents: paid.amount_paid ?? 0 });
}

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
	});
}
