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

const SITE_ORIGIN = 'https://smart-menu-solutions.github.io/smart-menu-solutions';

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

// Internal "something happened" alert to us, unchanged from before.
async function sendNotification(subscriptionId: string | null, subject: string, lines: Record<string, string>) {
	const html = `<h2>${escapeHtml(subject)}</h2><ul>${
		Object.entries(lines).map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value ?? '-'))}</li>`).join('')
	}</ul>`;
	await sendEmail(NOTIFICATION_EMAIL, subscriptionId, subject, subject, html);
}

// Customer-facing confirmation. NOTE: until a custom domain is verified on
// Resend, the onboarding@resend.dev sandbox sender can only deliver to the
// single address verified on the Resend account — real customer inboxes
// will silently fail (logged as a Resend API error in notifications_log,
// provider_message_id stays null) until that domain verification is done.
async function sendCustomerConfirmation(subscriptionId: string, kind: 'initial' | 'renewal', to: string, contactName: string, plan: string) {
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
	const subject = kind === 'renewal'
		? 'Ihre Verlängerung bei Smart Menu Solutions'
		: 'Ihre Bestellung bei Smart Menu Solutions';
	const intro = kind === 'renewal'
		? 'vielen Dank für die Verlängerung Ihres Abos.'
		: 'vielen Dank für Ihre Bestellung.';
	const html = `
		<p>Hallo ${escapeHtml(contactName || '')},</p>
		<p>${intro} Wir haben Ihre Angaben und Ihr Menü erhalten und melden uns in Kürze mit den nächsten Schritten.</p>
		<p><strong>Plan:</strong> ${escapeHtml(planLabel)}</p>
		<p>Bei Fragen erreichen Sie uns jederzeit unter <a href="mailto:smartmenusolutions@outlook.com">smartmenusolutions@outlook.com</a>.</p>
		<p>Smart Menu Solutions</p>
	`;
	await sendEmail(to, subscriptionId, `Kundenbestätigung: ${subject}`, subject, html);
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
	const today = new Date();
	const periodStart = today.toISOString().slice(0, 10);
	const periodEnd = addDays(today, 365);

	if (type === 'renewal') {
		const subscriptionId = metadata.subscriptionId;
		if (!subscriptionId) {
			console.error('Renewal checkout completed without subscriptionId in metadata', session.id);
			return;
		}
		const { data: existing } = await supabase.from('subscriptions').select('id, plan').eq('id', subscriptionId).maybeSingle();
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
			updated_at: new Date().toISOString()
		}).eq('id', subscriptionId);
		await supabase.from('orders').insert({
			subscription_id: subscriptionId,
			type: 'renewal',
			pdf_path: pdfPath,
			stripe_checkout_session_id: session.id
		});
		const contactName = [metadata.firstName, metadata.lastName].filter(Boolean).join(' ');
		await Promise.all([
			sendNotification(subscriptionId, 'Verlängerung bestätigt', {
				'Subscription-ID': subscriptionId, Plan: plan, Email: email, 'PDF-Pfad': pdfPath
			}),
			sendCustomerConfirmation(subscriptionId, 'renewal', email, contactName, plan)
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
		is_published: false
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
		current_period_end: periodEnd
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

	await Promise.all([
		sendNotification(subscription.id, 'Neue Bestellung eingegangen', {
			Kontakt: contactName,
			Firma: metadata.companyName || '-',
			Email: email,
			Telefon: metadata.phone || '-',
			Plan: plan,
			'Menü-Slug': slug,
			'PDF-Pfad': pdfPath
		}),
		sendCustomerConfirmation(subscription.id, 'initial', email, contactName, plan)
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

	await Promise.all([
		sendNotification(subscription.id, 'Automatische Verlängerung erfolgreich', {
			'Subscription-ID': subscription.id, Plan: subscription.plan
		}),
		sendCustomerConfirmation(subscription.id, 'renewal', subscription.customers?.email ?? '', subscription.customers?.contact_name ?? '', subscription.plan)
	]);
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
	if (invoice.billing_reason !== 'subscription_cycle') return;
	const stripeSubscriptionId = invoice.subscription as string;
	if (!stripeSubscriptionId) return;

	const { data: subscription } = await supabase.from('subscriptions').select('*').eq('stripe_subscription_id', stripeSubscriptionId).maybeSingle();
	if (!subscription) return;

	const today = new Date();
	await supabase.from('subscriptions').update({
		status: 'expired',
		grace_until: addDays(today, 7),
		updated_at: new Date().toISOString()
	}).eq('id', subscription.id);

	await sendNotification(subscription.id, 'Automatische Verlängerung fehlgeschlagen', {
		'Subscription-ID': subscription.id,
		Plan: subscription.plan,
		'Renewal-Link': `${SITE_ORIGIN}/renewal.html?token=${subscription.renewal_token}`
	});
}

async function handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription) {
	const { data: subscription } = await supabase.from('subscriptions').select('id').eq('stripe_subscription_id', stripeSubscription.id).maybeSingle();
	if (!subscription) return;
	await supabase.from('subscriptions').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', subscription.id);
}
