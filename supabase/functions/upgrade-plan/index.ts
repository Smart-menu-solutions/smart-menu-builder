// Self-service plan upgrade for a running yearly plan: the SmartPilot™
// "Upgrade" button opens upgrade.html?token=<addon_token>. Same trust model
// and billing shape as manage-addons - subscriptions.addon_token is the only
// credential (it may charge the saved card directly, see
// 0011_midyear_addon_purchase.sql), Stripe prorates the price difference for
// the rest of the current plan year and we charge it right away. If that
// payment fails, the subscription goes back to the old plan and nothing is
// left pending. The renewal date stays the same; from then on the new plan's
// yearly price applies.
//
// GET  ?token=...                        -> current plan + the higher plans,
//                                           each with the amount due now
// POST { token, plan, prorationDate }    -> upgrade + charge + emails
//
// Smart Discovery is not upgraded here: it has no Stripe subscription yet,
// its upgrade is a first purchase through renewal.html.

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

// Same yearly prices as create-checkout-session / renewal; items, updates and
// languages mirror the plan cards on pricing-plans.html (for the email).
const PLANS: Record<string, { label: string; cents: number; rank: number; items: number; updates: number; languages: number }> = {
	start: { label: 'Smart Start', cents: 11900, rank: 1, items: 50, updates: 1, languages: 1 },
	pro: { label: 'Smart Pro', cents: 12900, rank: 2, items: 150, updates: 3, languages: 3 },
	premium: { label: 'Smart Premium', cents: 16900, rank: 3, items: 450, updates: 6, languages: 6 }
};
// Checkout names the plan's subscription item "Smart Menu Solutions – Smart
// <Plan>" (renewals add " (Renewal)"); the add-on items are "... add-on".
const PLAN_PRODUCT_PREFIX = 'Smart Menu Solutions – ';
// The charge reuses the proration date of the preview the customer saw, so the
// amount matches it exactly - for half an hour, after that it's recalculated.
const PREVIEW_MAX_AGE_SECONDS = 30 * 60;

type SubscriptionRow = {
	id: string;
	status: string;
	plan: string;
	lang: string | null;
	menu_slug: string;
	current_period_end: string | null;
	stripe_subscription_id: string | null;
	customers: { stripe_customer_id: string | null; contact_name: string | null; email: string | null } | null;
	menus: { name: string } | null;
};

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
<tr><td style="padding:0 0 10px 0;font-size:15px;font-weight:bold;color:#262421;line-height:1.4;"><span style="color:#F66A09;">Smart</span>&nbsp;Menu Solutions Team</td></tr>
<tr><td style="padding:3px 0;font-size:12.5px;color:#737373;line-height:1;"><a href="mailto:info@smartmenusolutions.com" style="text-decoration:none;color:#737373;"><img src="https://smartmenusolutions.com/assets/images/signature/icon-email.png" width="16" height="16" alt="" style="display:inline-block;vertical-align:middle;border:0;width:16px;height:16px;margin-right:7px;"><span style="vertical-align:middle;">info@smartmenusolutions.com</span></a></td></tr>
<tr><td style="padding:3px 0;font-size:12.5px;color:#737373;line-height:1;"><a href="https://smartmenusolutions.com" style="text-decoration:none;color:#737373;"><img src="https://smartmenusolutions.com/assets/images/signature/icon-website.png" width="16" height="16" alt="" style="display:inline-block;vertical-align:middle;border:0;width:16px;height:16px;margin-right:7px;"><span style="vertical-align:middle;">smartmenusolutions.com</span></a></td></tr>
<tr><td style="padding:9px 0 3px 0;font-size:12.5px;color:#737373;line-height:1;"><a href="https://instagram.com/smartmenusolutions/" style="text-decoration:none;color:#737373;"><img src="https://smartmenusolutions.com/assets/images/signature/icon-instagram.png" width="16" height="16" alt="" style="display:inline-block;vertical-align:middle;border:0;width:16px;height:16px;margin-right:7px;"><span style="vertical-align:middle;">@smartmenusolutions</span></a></td></tr>
<tr><td style="padding:3px 0;font-size:12.5px;color:#737373;line-height:1;"><a href="https://www.tiktok.com/@smartmenusolutions" style="text-decoration:none;color:#737373;"><img src="https://smartmenusolutions.com/assets/images/signature/icon-tiktok.png" width="16" height="16" alt="" style="display:inline-block;vertical-align:middle;border:0;width:16px;height:16px;margin-right:7px;"><span style="vertical-align:middle;">@smartmenusolutions</span></a></td></tr>
</table>
</td>
</tr>
</table>`;

const REPLY_TO_EMAIL = 'info@smartmenusolutions.com';

// Plain-text part sent next to the HTML: spam filters penalise HTML-only mails.
function htmlToText(html: string): string {
	return html
		.replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, '')
		.replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
			const text = label.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
			if (!text) return '';
			return href.startsWith('mailto:') || href.includes(text) ? text : `${text} (${href.replace(/&amp;/g, '&')})`;
		})
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<li[^>]*>/gi, '- ')
		.replace(/<\/(p|h[1-6]|ul|ol)>/gi, '\n\n')
		.replace(/<\/(div|li|tr)>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number(code)))
		.replace(/&amp;/g, '&')
		.replace(/[ \t]+/g, ' ')
		.replace(/ *\n */g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

async function sendEmail(recipient: string, subscriptionId: string | null, kind: string, subject: string, html: string) {
	let providerMessageId: string | null = null;
	try {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ from: FROM_EMAIL, to: [recipient], reply_to: REPLY_TO_EMAIL, subject, html, text: htmlToText(html) })
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

function normalizeLang(value: unknown): 'de' | 'en' | 'it' {
	return value === 'en' || value === 'it' ? value : 'de';
}

function formatAmount(cents: number, lang: string): string {
	const amount = (cents / 100).toFixed(2);
	return lang === 'en' ? `€${amount}` : `${amount.replace('.', ',')} €`;
}

function formatDay(isoDay: string | null, lang: string): string {
	if (!isoDay) return '';
	const [year, month, day] = isoDay.slice(0, 10).split('-');
	return lang === 'de' ? `${day}.${month}.${year}` : `${day}/${month}/${year}`;
}

function higherPlans(plan: string): string[] {
	const current = PLANS[plan];
	return current ? Object.keys(PLANS).filter((key) => PLANS[key].rank > current.rank) : [];
}

async function lookupSubscription(token: string): Promise<SubscriptionRow | null> {
	const { data, error } = await supabase
		.from('subscriptions')
		.select('id, status, plan, lang, menu_slug, current_period_end, stripe_subscription_id, customers(stripe_customer_id, contact_name, email), menus(name)')
		.eq('addon_token', token)
		.maybeSingle();
	if (error) console.error('Subscription lookup failed', error);
	return (data as SubscriptionRow | null) ?? null;
}

// Why this subscription can't be upgraded here - or null if it can.
function blockedReason(row: SubscriptionRow): string | null {
	if (row.plan === 'discovery') return 'discovery';
	if (row.status !== 'active') return 'inactive';
	if (!PLANS[row.plan]) return 'unknown-plan';
	if (!higherPlans(row.plan).length) return 'top';
	if (!row.stripe_subscription_id || !row.customers?.stripe_customer_id) return 'manual';
	return null;
}

// The plan's own item on the Stripe subscription (each add-on is an item too).
async function findPlanItem(stripeSubscriptionId: string, plan: string): Promise<Stripe.SubscriptionItem | null> {
	const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, { expand: ['items.data.price.product'] });
	const byName = subscription.items.data.find((item) => {
		const product = item.price.product as Stripe.Product | Stripe.DeletedProduct | string;
		return typeof product === 'object' && !product.deleted && product.name.startsWith(PLAN_PRODUCT_PREFIX);
	});
	if (byName) return byName;
	// Fallback: the yearly item at the plan's price - no add-on costs that much.
	return subscription.items.data.find((item) => item.price.unit_amount === PLANS[plan]?.cents && item.price.recurring?.interval === 'year') ?? null;
}

function productIdOf(item: Stripe.SubscriptionItem): string {
	const product = item.price.product as Stripe.Product | Stripe.DeletedProduct | string;
	return typeof product === 'string' ? product : product.id;
}

// One fixed Stripe product per plan, created on first use (like renewal's
// Discovery coupon), so an upgraded item and its invoices carry the new
// plan's name instead of the old one.
async function planProductId(plan: string): Promise<string> {
	const id = `smart-menu-plan-${plan}`;
	try {
		await stripe.products.retrieve(id);
	} catch {
		try {
			await stripe.products.create({ id, name: `${PLAN_PRODUCT_PREFIX}${PLANS[plan].label}` });
		} catch (error) {
			// A parallel request may have created it in the meantime.
			await stripe.products.retrieve(id).catch(() => { throw error; });
		}
	}
	return id;
}

function yearlyPrice(product: string, cents: number) {
	return { currency: 'eur', product, unit_amount: cents, recurring: { interval: 'year' as const } };
}

Deno.serve(async (request) => {
	if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
	if (request.method === 'GET') return handleGet(new URL(request.url));
	if (request.method === 'POST') return handlePost(request);
	return json({ error: 'Method not allowed' }, 405);
});

async function handleGet(url: URL) {
	const token = url.searchParams.get('token') || '';
	if (!TOKEN_PATTERN.test(token)) return json({ error: 'Invalid or missing link.' }, 400);
	const row = await lookupSubscription(token);
	if (!row) return json({ error: 'This link is no longer valid.' }, 404);

	const base = { plan: row.plan, status: row.status, periodEnd: row.current_period_end, menuName: row.menus?.name ?? '' };
	const blocked = blockedReason(row);
	if (blocked) return json({ ...base, blocked, options: [] });

	const prorationDate = Math.floor(Date.now() / 1000);
	try {
		const item = await findPlanItem(row.stripe_subscription_id!, row.plan);
		if (!item) return json({ ...base, blocked: 'manual', options: [] });
		const options = [];
		for (const plan of higherPlans(row.plan)) {
			const preview = await stripe.invoices.retrieveUpcoming({
				customer: row.customers!.stripe_customer_id!,
				subscription: row.stripe_subscription_id!,
				subscription_items: [{ id: item.id, price_data: yearlyPrice(await planProductId(plan), PLANS[plan].cents) }],
				subscription_proration_date: prorationDate
			});
			// Only the proration lines count: the credit for the old plan's unused
			// time and the new plan's price for that same time. The rest of the
			// preview is next year's regular renewal.
			const dueNowCents = preview.lines.data.filter((line) => line.proration).reduce((sum, line) => sum + line.amount, 0);
			options.push({
				plan,
				label: PLANS[plan].label,
				yearlyCents: PLANS[plan].cents,
				dueNowCents: Math.max(0, dueNowCents),
				items: PLANS[plan].items,
				updates: PLANS[plan].updates,
				languages: PLANS[plan].languages
			});
		}
		return json({ ...base, blocked: null, prorationDate, options });
	} catch (error) {
		console.error('Upgrade preview failed', error);
		return json({ error: 'Could not load the upgrade options.' }, 500);
	}
}

async function handlePost(request: Request) {
	let body: { token?: string; plan?: string; prorationDate?: number };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid request.' }, 400);
	}
	const token = String(body.token || '');
	const target = String(body.plan || '');
	if (!TOKEN_PATTERN.test(token) || !PLANS[target]) return json({ error: 'Invalid request.' }, 400);

	const row = await lookupSubscription(token);
	if (!row) return json({ error: 'This link is no longer valid.' }, 404);
	const blocked = blockedReason(row);
	if (blocked) return json({ error: 'This plan cannot be upgraded here.', blocked }, 400);
	if (!higherPlans(row.plan).includes(target)) return json({ error: 'Please choose a higher plan.' }, 400);

	const now = Math.floor(Date.now() / 1000);
	const requested = Number(body.prorationDate);
	const prorationDate = Number.isInteger(requested) && requested <= now && now - requested <= PREVIEW_MAX_AGE_SECONDS ? requested : now;
	const customerId = row.customers!.stripe_customer_id!;
	const stripeSubscriptionId = row.stripe_subscription_id!;
	const fromLabel = PLANS[row.plan].label;
	const toLabel = PLANS[target].label;

	let item: Stripe.SubscriptionItem | null = null;
	try {
		item = await findPlanItem(stripeSubscriptionId, row.plan);
	} catch (error) {
		console.error('Plan item lookup failed', error);
	}
	if (!item) return json({ error: 'Could not start the upgrade.' }, 500);
	const oldProduct = productIdOf(item);
	const oldCents = item.price.unit_amount ?? PLANS[row.plan].cents;

	// One attempt per subscription, target plan and preview, so a double click
	// can't charge twice. After an error the page loads a fresh preview.
	const attempt = `plan-upgrade:${row.id}:${target}:${prorationDate}`;
	try {
		await stripe.subscriptions.update(stripeSubscriptionId, {
			items: [{ id: item.id, price_data: yearlyPrice(await planProductId(target), PLANS[target].cents) }],
			proration_behavior: 'create_prorations',
			proration_date: prorationDate
		}, { idempotencyKey: `${attempt}:update` });
	} catch (error) {
		console.error('subscriptions.update failed', error);
		return json({ error: 'Could not start the upgrade.' }, 500);
	}

	let invoiceId: string | null = null;
	let paid: Stripe.Invoice;
	try {
		const invoice = await stripe.invoices.create({
			customer: customerId,
			subscription: stripeSubscriptionId,
			auto_advance: false,
			collection_method: 'charge_automatically',
			// As in manage-addons: without it the pending proration items could be
			// skipped and an empty €0 invoice "paid" instead.
			pending_invoice_items_behavior: 'include_and_require',
			description: `Upgrade ${fromLabel} → ${toLabel}`,
			metadata: { type: 'plan-upgrade', from: row.plan, to: target, subscriptionId: row.id }
		}, { idempotencyKey: `${attempt}:invoice` });
		invoiceId = invoice.id;
		const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
		paid = await stripe.invoices.pay(finalized.id);
		if (paid.status !== 'paid') throw new Error(`Invoice status after pay(): ${paid.status}`);
	} catch (paymentError) {
		console.error('Upgrade payment failed', paymentError);
		const restored = await rollBack(stripeSubscriptionId, customerId, item.id, oldProduct, oldCents, invoiceId);
		if (!restored) {
			await sendNotification(row.id, 'Upgrade-Zahlung fehlgeschlagen, Rückbau unvollständig', {
				'Subscription-ID': row.id,
				'Stripe-Abo': stripeSubscriptionId,
				Von: fromLabel,
				Auf: toLabel,
				Rechnung: invoiceId ?? '-'
			});
		}
		return json({ error: 'The payment could not be completed, so your plan has not been changed. Please check your card or contact us.' }, 402);
	}

	const amountCents = paid.amount_paid ?? 0;
	const { error: dbError } = await supabase.from('subscriptions').update({ plan: target, updated_at: new Date().toISOString() }).eq('id', row.id);
	if (dbError) {
		console.error('Post-payment DB update failed', dbError);
		await sendNotification(row.id, 'Upgrade bezahlt, DB-Update fehlgeschlagen', {
			'Subscription-ID': row.id,
			Von: fromLabel,
			Auf: toLabel,
			Rechnung: paid.id
		});
		return json({ error: 'Payment succeeded but the plan change could not be saved - our team has been notified and will fix this shortly.' }, 500);
	}

	const lang = normalizeLang(row.lang);
	const customer = row.customers!;
	const menuName = row.menus?.name ?? '';
	await Promise.all([
		sendNotification(row.id, 'Tarif-Upgrade', {
			'Subscription-ID': row.id,
			Kunde: customer.contact_name || '-',
			Lokal: menuName || '-',
			Von: fromLabel,
			Auf: toLabel,
			Betrag: formatAmount(amountCents, 'de')
		}),
		customer.email && EMAIL_PATTERN.test(customer.email)
			? sendEmail(customer.email, row.id, 'Kundenmail: Tarif-Upgrade', upgradeSubject(lang, toLabel), upgradeHtml(lang, customer.contact_name || '', menuName, target, amountCents, row.current_period_end))
			: Promise.resolve()
	]);

	return json({ success: true, plan: target, label: toLabel, amountChargedCents: amountCents });
}

// Puts the subscription back on the old plan and leaves nothing pending: the
// failed invoice is voided (a draft deleted) and leftover proration items are
// removed - otherwise they would end up on next year's renewal invoice.
// Returns false if something couldn't be undone (we get an email then).
async function rollBack(stripeSubscriptionId: string, customerId: string, itemId: string, oldProduct: string, oldCents: number, invoiceId: string | null): Promise<boolean> {
	let ok = true;
	if (invoiceId) {
		try {
			const invoice = await stripe.invoices.retrieve(invoiceId);
			if (invoice.status === 'draft') await stripe.invoices.del(invoiceId);
			else if (invoice.status === 'open') await stripe.invoices.voidInvoice(invoiceId);
		} catch (error) {
			console.error('Rollback: invoice cleanup failed', error);
			ok = false;
		}
	}
	try {
		const pending = await stripe.invoiceItems.list({ customer: customerId, pending: true, limit: 100 });
		for (const entry of pending.data) {
			const subscription = typeof entry.subscription === 'string' ? entry.subscription : entry.subscription?.id;
			if (subscription === stripeSubscriptionId && entry.proration) await stripe.invoiceItems.del(entry.id);
		}
	} catch (error) {
		console.error('Rollback: removing proration items failed', error);
		ok = false;
	}
	try {
		await stripe.subscriptions.update(stripeSubscriptionId, {
			items: [{ id: itemId, price_data: yearlyPrice(oldProduct, oldCents) }],
			proration_behavior: 'none'
		});
	} catch (error) {
		console.error('Rollback: restoring the old plan failed', error);
		ok = false;
	}
	return ok;
}

function upgradeSubject(lang: string, label: string): string {
	return lang === 'it' ? `Il vostro upgrade a ${label}` : lang === 'en' ? `Your upgrade to ${label}` : `Ihr Upgrade auf ${label}`;
}

function upgradeHtml(lang: string, contactName: string, menuName: string, plan: string, amountCents: number, periodEnd: string | null): string {
	const p = PLANS[plan];
	const name = escapeHtml(contactName);
	const menu = escapeHtml(menuName);
	const amount = formatAmount(amountCents, lang);
	const yearly = formatAmount(p.cents, lang);
	const date = formatDay(periodEnd, lang);
	if (lang === 'it') return `
		<p>Buongiorno ${name},</p>
		<p>il vostro piano per <strong>${menu}</strong> ora è <strong>${p.label}</strong>.</p>
		<p>Abbiamo addebitato l'importo proporzionale per il resto del vostro anno di abbonamento in corso: <strong>${amount}</strong>.${date ? ` Dal prossimo rinnovo del ${date} si applica il prezzo annuale di ${yearly}.` : ''}</p>
		<p>Il vostro piano ora include fino a ${p.items} piatti, ${p.updates} aggiornamenti del menu al mese e ${p.languages} lingue aggiuntive.</p>
		<p>Inviateci la vostra prossima modifica semplicemente rispondendo a questa e-mail, oppure direttamente dalla vostra app SmartPilot™.</p>
		<p>Cordiali saluti</p>
		${EMAIL_SIGNATURE}
	`;
	if (lang === 'en') return `
		<p>Hi ${name},</p>
		<p>your plan for <strong>${menu}</strong> is now <strong>${p.label}</strong>.</p>
		<p>We've charged the pro-rated amount for the rest of your current plan year: <strong>${amount}</strong>.${date ? ` From your next renewal on ${date}, the yearly price of ${yearly} applies.` : ''}</p>
		<p>Your plan now includes up to ${p.items} menu items, ${p.updates} menu updates a month and ${p.languages} extra languages.</p>
		<p>Just send us your next change as a reply to this email – or straight from your SmartPilot™ app.</p>
		<p>Best regards</p>
		${EMAIL_SIGNATURE}
	`;
	return `
		<p>Hallo ${name},</p>
		<p>Ihr Tarif für <strong>${menu}</strong> ist jetzt <strong>${p.label}</strong>.</p>
		<p>Berechnet wurde der anteilige Betrag für den Rest Ihres laufenden Abo-Jahres: <strong>${amount}</strong>.${date ? ` Ab der nächsten Verlängerung am ${date} gilt der Jahrespreis von ${yearly}.` : ''}</p>
		<p>Das ist jetzt in Ihrem Tarif enthalten: bis zu ${p.items} Gerichte, ${p.updates} Änderungen der Speisekarte pro Monat und ${p.languages} zusätzliche Sprachen.</p>
		<p>Schicken Sie uns Ihre nächste Änderung einfach als Antwort auf diese E-Mail – oder direkt aus Ihrer App SmartPilot™.</p>
		<p>Mit freundlichen Grüßen</p>
		${EMAIL_SIGNATURE}
	`;
}

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
	});
}
