import Stripe from 'npm:stripe@16.5.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
	apiVersion: '2024-06-20',
	httpClient: Stripe.createFetchHttpClient()
});
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically into
// every Supabase Edge Function — no manual secret needed for these two.
const supabase = createClient(
	Deno.env.get('SUPABASE_URL') ?? '',
	Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const SITE_ORIGIN = 'https://smartmenusolutions.com';

// Every system notification (order, renewal, expiry, deactivation) goes to
// this single address, not to the customer. Using "smartmenusolutions"
// (with "n") for now because Resend's sandbox sender can only deliver to the
// address verified on the Resend account until a custom domain is verified —
// switch back to "smartmenusolutios" (no "n") once that's set up, if still
// wanted.
const NOTIFICATION_EMAIL = Deno.env.get('NOTIFICATION_EMAIL') ?? 'smartmenusolutions@outlook.com';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Smart Menu Builder <onboarding@resend.dev>';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PLAN_LABELS: Record<string, string> = {
	start: 'Smart Start',
	pro: 'Smart Pro',
	premium: 'Smart Premium'
};

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

function slugify(input: string): string {
	return input
		.toLowerCase()
		.normalize('NFKD').replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-+|-+$)/g, '') || 'menu';
}

function addDays(date: Date, days: number): string {
	const result = new Date(date);
	result.setUTCDate(result.getUTCDate() + days);
	return result.toISOString().slice(0, 10);
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => ({
		'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
	}[character] as string));
}

interface EmailAttachment { filename: string; content: string }

// Chunked to avoid a stack overflow from String.fromCharCode(...bytes) on
// large files (PDFs, photo ZIPs) - spreading a big Uint8Array as arguments
// blows the call stack well before it blows the string length.
function toBase64(bytes: Uint8Array): string {
	let binary = '';
	const chunkSize = 0x8000;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
	}
	return btoa(binary);
}

// Downloads a file the customer already uploaded (menu PDF, photo ZIP) so it
// can ride along as a real email attachment instead of just a storage path
// staff would otherwise have to look up manually. create-checkout-session /
// renewal already checked the file's content before checkout, but this is the
// one place an uploaded file actually reaches a person, so it's checked again
// here: only a pending/ object whose first bytes really are a PDF / ZIP is
// attached, and always under a fixed name (menu.pdf / photos.zip) - never the
// uploader-chosen file name, which could have been "invoice.exe".
const ATTACHMENT_PATH = /^pending\/\d{13}-[a-z0-9]{1,8}-[A-Za-z0-9._-]{1,200}$/;
const ATTACHMENT_TYPES = {
	pdf: { magic: [0x25, 0x50, 0x44, 0x46, 0x2d], filename: 'menu.pdf' },
	zip: { magic: [0x50, 0x4b, 0x03, 0x04], filename: 'photos.zip' }
};

async function fetchAttachment(path: string, kind: keyof typeof ATTACHMENT_TYPES): Promise<EmailAttachment | null> {
	if (!path) return null;
	if (!ATTACHMENT_PATH.test(path)) {
		console.error('Refusing to attach unexpected storage path', path);
		return null;
	}
	const { data, error } = await supabase.storage.from('menu-pdfs').download(path);
	if (error || !data) {
		console.error('Failed to download attachment', path, error);
		return null;
	}
	const bytes = new Uint8Array(await data.arrayBuffer());
	const { magic, filename } = ATTACHMENT_TYPES[kind];
	if (!magic.every((byte, i) => bytes[i] === byte)) {
		console.error('Refusing to attach file whose content is not a', kind, path);
		return null;
	}
	return { filename, content: toBase64(bytes) };
}

async function sendEmail(recipient: string, subscriptionId: string | null, kind: string, subject: string, html: string, attachments?: EmailAttachment[]) {
	let providerMessageId: string | null = null;
	try {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ from: FROM_EMAIL, to: [recipient], subject, html, ...(attachments && attachments.length ? { attachments } : {}) })
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

// Internal "something happened" alert to us.
async function sendNotification(subscriptionId: string | null, subject: string, lines: Record<string, string>, attachments?: EmailAttachment[]) {
	const html = `<h2>${escapeHtml(subject)}</h2><ul>${
		Object.entries(lines).map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value ?? '-'))}</li>`).join('')
	}</ul>`;
	await sendEmail(NOTIFICATION_EMAIL, subscriptionId, subject, subject, html, attachments);
}

// Customer-facing confirmation. NOTE: until a custom domain is verified on
// Resend, the onboarding@resend.dev sandbox sender can only deliver to the
// single address verified on the Resend account — real customer inboxes
// will silently fail (logged as a Resend API error in notifications_log,
// provider_message_id stays null) until that domain verification is done.
async function sendCustomerConfirmation(subscriptionId: string, kind: 'initial' | 'renewal', to: string, contactName: string, plan: string, addonToken: string, lang: string) {
	if (!EMAIL_PATTERN.test(to)) {
		console.error('Skipping customer confirmation: no valid email on file', subscriptionId);
		await supabase.from('notifications_log').insert({
			subscription_id: subscriptionId,
			kind: `Kundenbestätigung übersprungen (ungültige E-Mail): ${kind}`,
			sent_to: to || '(leer)',
			provider_message_id: null
		});
		return;
	}
	const planLabel = PLAN_LABELS[plan] || plan;
	const isEn = lang === 'en';
	const subject = isEn
		? (kind === 'renewal' ? 'Your renewal at Smart Menu Solutions' : 'Your order at Smart Menu Solutions')
		: (kind === 'renewal' ? 'Ihre Verlängerung bei Smart Menu Solutions' : 'Ihre Bestellung bei Smart Menu Solutions');
	const intro = isEn
		? (kind === 'renewal' ? 'thank you for renewing your subscription.' : 'thank you for your order.')
		: (kind === 'renewal' ? 'vielen Dank für die Verlängerung Ihres Abos.' : 'vielen Dank für Ihre Bestellung.');
	const html = isEn ? `
		<p>Hi ${escapeHtml(contactName || '')},</p>
		<p>${intro} We've received your details and menu and will get back to you shortly with the next steps.</p>
		<p><strong>Plan:</strong> ${escapeHtml(planLabel)}</p>
		<p>If you haven't booked Smart FoodMatch™, Smart WeeklyReport™ or Smart DishPhoto™ yet, you can add them anytime: <a href="${SITE_ORIGIN}/addons.html?token=${addonToken}">Manage add-ons</a></p>
		<p>If you have any questions, reach us anytime at <a href="mailto:smartmenusolutions@outlook.com">smartmenusolutions@outlook.com</a>.</p>
		<p>Best regards</p>
		${EMAIL_SIGNATURE}
	` : `
		<p>Hallo ${escapeHtml(contactName || '')},</p>
		<p>${intro} Wir haben Ihre Angaben und Ihr Menü erhalten und melden uns in Kürze mit den nächsten Schritten.</p>
		<p><strong>Plan:</strong> ${escapeHtml(planLabel)}</p>
		<p>Falls Sie Smart FoodMatch™, Smart WeeklyReport™ oder Smart DishPhoto™ noch nicht gebucht haben, können Sie das jederzeit nachholen: <a href="${SITE_ORIGIN}/addons.html?token=${addonToken}">Zusatzmodule verwalten</a></p>
		<p>Bei Fragen erreichen Sie uns jederzeit unter <a href="mailto:smartmenusolutions@outlook.com">smartmenusolutions@outlook.com</a>.</p>
		<p>Mit freundlichen Grüßen</p>
		${EMAIL_SIGNATURE}
	`;
	await sendEmail(to, subscriptionId, `Kundenbestätigung: ${subject}`, subject, html);
}

// Sent the moment an automatic renewal payment fails — this is the start of
// the 7-day grace period, the menu is still online at this point (only
// check-subscriptions taking it offline after the grace period runs out).
async function sendPaymentFailedEmail(subscriptionId: string, to: string, contactName: string, renewalToken: string, lang: string) {
	if (!EMAIL_PATTERN.test(to)) {
		console.error('Skipping payment-failed customer email: no valid email on file', subscriptionId);
		return;
	}
	const isEn = lang === 'en';
	const subject = isEn ? 'Your renewal has failed – action needed' : 'Ihre Verlängerung ist fehlgeschlagen – bitte handeln';
	const renewalUrl = `${SITE_ORIGIN}/renewal.html?token=${renewalToken}`;
	const html = isEn ? `
		<p>Hi ${escapeHtml(contactName || '')},</p>
		<p>unfortunately, the automatic payment for renewing your subscription could not be processed.</p>
		<p>Your menu will stay online for another 7 days so you have time to sort this out. Please renew your subscription via the link below to avoid any interruption:</p>
		<p><a href="${renewalUrl}">Renew now</a></p>
		<p>If you have any questions, reach us anytime at <a href="mailto:smartmenusolutions@outlook.com">smartmenusolutions@outlook.com</a>.</p>
		<p>Best regards</p>
		${EMAIL_SIGNATURE}
	` : `
		<p>Hallo ${escapeHtml(contactName || '')},</p>
		<p>leider konnte die automatische Zahlung für die Verlängerung Ihres Abos nicht durchgeführt werden.</p>
		<p>Ihr Menü bleibt noch 7 Tage online, damit Sie das in Ruhe klären können. Bitte verlängern Sie Ihr Abo über folgenden Link, um eine Unterbrechung zu vermeiden:</p>
		<p><a href="${renewalUrl}">Jetzt verlängern</a></p>
		<p>Bei Fragen erreichen Sie uns jederzeit unter <a href="mailto:smartmenusolutions@outlook.com">smartmenusolutions@outlook.com</a>.</p>
		<p>Mit freundlichen Grüßen</p>
		${EMAIL_SIGNATURE}
	`;
	await sendEmail(to, subscriptionId, 'Kundenmail: Zahlung fehlgeschlagen', subject, html);
}

Deno.serve(async (request) => {
	const signature = request.headers.get('stripe-signature') ?? '';
	const rawBody = await request.text();

	let event: Stripe.Event;
	try {
		event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
	} catch (error) {
		console.error('Webhook signature verification failed', error);
		return new Response('Invalid signature', { status: 400 });
	}

	try {
		switch (event.type) {
			case 'checkout.session.completed':
				await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
				break;
			case 'invoice.payment_succeeded':
				await handleInvoiceSucceeded(event.data.object as Stripe.Invoice);
				break;
			case 'invoice.payment_failed':
				await handleInvoiceFailed(event.data.object as Stripe.Invoice);
				break;
			case 'customer.subscription.deleted':
				await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
				break;
			default:
				break;
		}
	} catch (error) {
		console.error(`Error handling ${event.type}`, error);
		return new Response('Handler error', { status: 500 });
	}

	return new Response(JSON.stringify({ received: true }), { status: 200 });
});

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
	if (session.mode !== 'subscription') return;

	// Stripe redelivers webhook events at least once (e.g. if a slow Resend
	// call pushes this handler past Stripe's response timeout), so the same
	// checkout.session.completed can arrive twice. Without this guard a
	// retry would insert a second customer/subscription/order row set and
	// send the customer a duplicate confirmation email.
	const { data: existingOrder } = await supabase
		.from('orders')
		.select('id')
		.eq('stripe_checkout_session_id', session.id)
		.maybeSingle();
	if (existingOrder) {
		console.log('Duplicate checkout.session.completed delivery, skipping', session.id);
		return;
	}

	const metadata = session.metadata ?? {};
	const type = metadata.type === 'renewal' ? 'renewal' : 'initial';
	const plan = metadata.plan || 'start';
	const pdfPath = metadata.pdfPath || '';
	const email = metadata.email || session.customer_details?.email || '';
	// Defaults to 'de' to match subscriptions.lang's column default - see
	// create-checkout-session/renewal for where this is actually set.
	const lang = metadata.lang === 'en' ? 'en' : 'de';
	const today = new Date();
	const periodStart = today.toISOString().slice(0, 10);
	const periodEnd = addDays(today, 365);

	if (type === 'renewal') {
		const subscriptionId = metadata.subscriptionId;
		if (!subscriptionId) {
			console.error('Renewal checkout completed without subscriptionId in metadata', session.id);
			return;
		}
		const { data: existing } = await supabase.from('subscriptions').select('id, plan, menu_slug, addon_token').eq('id', subscriptionId).maybeSingle();
		if (!existing) {
			console.error('Renewal checkout references unknown subscription', subscriptionId);
			return;
		}
		await supabase.from('subscriptions').update({
			plan,
			status: 'active',
			stripe_subscription_id: session.subscription as string,
			current_period_start: periodStart,
			current_period_end: periodEnd,
			grace_until: null,
			lang,
			updated_at: new Date().toISOString()
		}).eq('id', subscriptionId);
		// Paying via the renewal link is how a deactivated menu comes back online.
		await supabase.from('menus').update({ is_published: true }).eq('slug', existing.menu_slug);
		await supabase.from('orders').insert({
			subscription_id: subscriptionId,
			type: 'renewal',
			pdf_path: pdfPath,
			stripe_checkout_session_id: session.id
		});
		const contactName = [metadata.firstName, metadata.lastName].filter(Boolean).join(' ');
		const renewalAttachment = await fetchAttachment(pdfPath, 'pdf');
		await Promise.all([
			sendNotification(subscriptionId, 'Verlängerung bestätigt', {
				'Subscription-ID': subscriptionId, Plan: plan, Email: email, 'PDF-Pfad': pdfPath
			}, renewalAttachment ? [renewalAttachment] : undefined),
			sendCustomerConfirmation(subscriptionId, 'renewal', email, contactName, plan, existing.addon_token, lang)
		]);
		return;
	}

	// Initial order: create customer, a draft (unpublished) menu row, the
	// subscription, and the order record referencing the uploaded PDF.
	const contactName = [metadata.firstName, metadata.lastName].filter(Boolean).join(' ') || 'Unbekannt';
	const { data: customer, error: customerError } = await supabase.from('customers').insert({
		contact_name: contactName,
		email,
		company_name: metadata.companyName || null,
		phone: metadata.phone || null,
		stripe_customer_id: session.customer as string
	}).select().single();
	if (customerError || !customer) {
		console.error('Failed to insert customer', customerError);
		return;
	}

	const slug = `${slugify(metadata.companyName || contactName)}-${crypto.randomUUID().slice(0, 6)}`;
	const { error: menuError } = await supabase.from('menus').insert({
		slug,
		name: metadata.companyName || contactName,
		currency: '€',
		categories: [],
		languages: ['de', 'en'],
		is_published: false,
		analytics_reports_enabled: metadata.analyticsReportsAddon === 'true',
		photo_addon_enabled: metadata.photoAddon === 'true',
		smart_food_match_enabled: metadata.smartFoodMatchAddon === 'true',
		smartservice_hub_enabled: metadata.smartServiceHubAddon === 'true'
	});
	if (menuError) {
		console.error('Failed to insert draft menu', menuError);
		return;
	}

	const { data: subscription, error: subscriptionError } = await supabase.from('subscriptions').insert({
		customer_id: customer.id,
		menu_slug: slug,
		plan,
		status: 'active',
		stripe_subscription_id: session.subscription as string,
		current_period_start: periodStart,
		current_period_end: periodEnd,
		lang
	}).select().single();
	if (subscriptionError || !subscription) {
		console.error('Failed to insert subscription', subscriptionError);
		return;
	}

	await supabase.from('orders').insert({
		subscription_id: subscription.id,
		type: 'initial',
		pdf_path: pdfPath,
		stripe_checkout_session_id: session.id
	});

	const orderAttachments = (await Promise.all([
		fetchAttachment(pdfPath, 'pdf'),
		fetchAttachment(metadata.photoZipPath || '', 'zip')
	])).filter((attachment): attachment is EmailAttachment => attachment !== null);

	await Promise.all([
		sendNotification(subscription.id, 'Neue Bestellung eingegangen', {
			Kontakt: contactName,
			Firma: metadata.companyName || '-',
			Email: email,
			Telefon: metadata.phone || '-',
			Plan: plan,
			'Smart DishPhoto™': metadata.photoAddon === 'true' ? 'Ja' : 'Nein',
			'Smart FoodMatch™': metadata.smartFoodMatchAddon === 'true' ? 'Ja' : 'Nein',
			'Smart WeeklyReport™': metadata.analyticsReportsAddon === 'true' ? 'Ja' : 'Nein',
			'Smart ServiceHub™': metadata.smartServiceHubAddon === 'true' ? 'Ja' : 'Nein',
			...(metadata.photoZipPath ? { 'Foto-ZIP': metadata.photoZipPath } : {}),
			'Menü-Slug': slug,
			'PDF-Pfad': pdfPath
		}, orderAttachments),
		sendCustomerConfirmation(subscription.id, 'initial', email, contactName, plan, subscription.addon_token, lang)
	]);
}

// Renewal invoices only — the very first invoice of a subscription is already
// handled by checkout.session.completed, so subscription_create is ignored
// here to avoid a race between the two events creating duplicate state.
async function handleInvoiceSucceeded(invoice: Stripe.Invoice) {
	if (invoice.billing_reason !== 'subscription_cycle') return;
	const stripeSubscriptionId = invoice.subscription as string;
	if (!stripeSubscriptionId) return;

	const { data: subscription } = await supabase
		.from('subscriptions')
		.select('*, customers(contact_name, email)')
		.eq('stripe_subscription_id', stripeSubscriptionId)
		.maybeSingle();
	if (!subscription) return;

	const today = new Date();
	await supabase.from('subscriptions').update({
		status: 'active',
		current_period_start: today.toISOString().slice(0, 10),
		current_period_end: addDays(today, 365),
		grace_until: null,
		updated_at: new Date().toISOString()
	}).eq('id', subscription.id);
	// In case this subscription had already been deactivated (menu offline)
	// before the automatic renewal invoice succeeded.
	await supabase.from('menus').update({ is_published: true }).eq('slug', subscription.menu_slug);

	await Promise.all([
		sendNotification(subscription.id, 'Automatische Verlängerung erfolgreich', {
			'Subscription-ID': subscription.id, Plan: subscription.plan
		}),
		sendCustomerConfirmation(subscription.id, 'renewal', subscription.customers?.email ?? '', subscription.customers?.contact_name ?? '', subscription.plan, subscription.addon_token, subscription.lang)
	]);
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
	if (invoice.billing_reason !== 'subscription_cycle') return;
	const stripeSubscriptionId = invoice.subscription as string;
	if (!stripeSubscriptionId) return;

	const { data: subscription } = await supabase
		.from('subscriptions')
		.select('*, customers(contact_name, email)')
		.eq('stripe_subscription_id', stripeSubscriptionId)
		.maybeSingle();
	if (!subscription) return;

	const today = new Date();
	await supabase.from('subscriptions').update({
		status: 'expired',
		grace_until: addDays(today, 7),
		updated_at: new Date().toISOString()
	}).eq('id', subscription.id);

	await Promise.all([
		sendNotification(subscription.id, 'Automatische Verlängerung fehlgeschlagen', {
			'Subscription-ID': subscription.id,
			Plan: subscription.plan,
			'Renewal-Link': `${SITE_ORIGIN}/renewal.html?token=${subscription.renewal_token}`
		}),
		sendPaymentFailedEmail(subscription.id, subscription.customers?.email ?? '', subscription.customers?.contact_name ?? '', subscription.renewal_token, subscription.lang)
	]);
}

async function handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription) {
	const { data: subscription } = await supabase.from('subscriptions').select('id, menu_slug').eq('stripe_subscription_id', stripeSubscription.id).maybeSingle();
	if (!subscription) return;
	await supabase.from('subscriptions').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', subscription.id);
	// A cancelled subscription is a stronger end-state than "deactivated" —
	// keeping the menu published here while deactivation takes it offline
	// would be inconsistent. Analytics reports are cleared here too, so a
	// cancelled customer stops getting the weekly email from the next
	// Monday's send-weekly-report run onward.
	await supabase.from('menus').update({ is_published: false, analytics_reports_enabled: false }).eq('slug', subscription.menu_slug);
}
