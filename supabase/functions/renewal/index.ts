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

const PLAN_PRICING: Record<string, { amountCents: number; label: string; photoAddOnCents: number }> = {
	start: { amountCents: 11900, label: 'Smart Start', photoAddOnCents: 1000 },
	pro: { amountCents: 12900, label: 'Smart Pro', photoAddOnCents: 3000 },
	premium: { amountCents: 16900, label: 'Smart Premium', photoAddOnCents: 9000 }
};
// Same add-on prices as create-checkout-session - only sold here when a
// Smart Discovery customer upgrades (a normal renewal keeps its add-ons).
const SFM_ADDON_CENTS = 500;
const ANALYTICS_ADDON_CENTS = 500;
const HUB_ADDON_CENTS = 8900;

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_PATTERN = /^[0-9a-f-]{36}$/i;

Deno.serve(async (request) => {
	if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

	const url = new URL(request.url);

	if (request.method === 'GET') return handleLookup(url);
	if (request.method === 'POST') return handleCreateCheckout(request);
	return json({ error: 'Method not allowed' }, 405);
});

async function handleLookup(url: URL) {
	const token = url.searchParams.get('token') || '';
	if (!TOKEN_PATTERN.test(token)) return json({ error: 'Invalid or missing renewal link.' }, 400);

	const { data: subscription, error } = await supabase
		.from('subscriptions')
		.select('id, plan, status, menu_slug, customer_id, stripe_subscription_id, current_period_end')
		.eq('renewal_token', token)
		.maybeSingle();
	if (error || !subscription) return json({ error: 'This renewal link is no longer valid.' }, 404);

	const { data: customer, error: customerError } = await supabase
		.from('customers')
		.select('contact_name, email, company_name, phone')
		.eq('id', subscription.customer_id)
		.maybeSingle();
	if (customerError || !customer) return json({ error: 'This renewal link is no longer valid.' }, 404);

	const [firstName, ...rest] = (customer.contact_name || '').split(' ');
	return json({
		firstName: firstName || '',
		lastName: rest.join(' '),
		email: customer.email,
		companyName: customer.company_name || '',
		phone: customer.phone || '',
		plan: subscription.plan,
		status: subscription.status,
		menuSlug: subscription.menu_slug,
		// renewal.html shows "nothing to do" instead of the form then.
		autoRenews: renewsAutomatically(subscription),
		periodEnd: subscription.current_period_end
	});
}

// A running yearly plan with a Stripe subscription renews by itself. Paying
// here as well would start a second subscription next to it - charged again
// every year - so this page is only for expired, deactivated or cancelled
// plans, Smart Discovery and plans we set up by hand.
function renewsAutomatically(subscription: { plan: string; status: string; stripe_subscription_id: string | null }): boolean {
	return subscription.plan !== 'discovery' && subscription.status === 'active' && !!subscription.stripe_subscription_id;
}

async function handleCreateCheckout(request: Request) {
	try {
		const body = await request.json();
		const token = String(body.token || '');
		const plan = String(body.plan || '');
		const firstName = String(body.firstName || '').trim();
		const lastName = String(body.lastName || '').trim();
		const email = String(body.email || '').trim();
		const companyName = String(body.companyName || '').trim();
		const phone = String(body.phone || '').trim();
		// 'it' since the Italian website (2026-10-05); unknown -> 'de' as before.
		const requestedLang = String(body.lang || '');
		const lang = requestedLang === 'en' || requestedLang === 'it' ? requestedLang : 'de';

		const pricing = PLAN_PRICING[plan];
		if (!TOKEN_PATTERN.test(token) || !pricing || !firstName || !lastName || !EMAIL_PATTERN.test(email)) {
			return json({ error: 'Missing or invalid renewal details.' }, 400);
		}

		const { data: subscription, error } = await supabase
			.from('subscriptions')
			.select('id, plan, status, stripe_subscription_id')
			.eq('renewal_token', token)
			.maybeSingle();
		if (error || !subscription) return json({ error: 'This renewal link is no longer valid.' }, 404);
		if (renewsAutomatically(subscription)) {
			return json({ error: 'Your subscription is active and renews automatically - there is nothing to renew right now.', autoRenews: true }, 409);
		}

		// Upgrading from Smart Discovery: its €2.99 comes off the first year and
		// the customer picks which of the add-ons they tried to keep - same line
		// items as a first order in create-checkout-session.
		const fromDiscovery = subscription.plan === 'discovery';
		const discounts = fromDiscovery ? [{ coupon: await discoveryCreditCoupon() }] : undefined;
		const addons = {
			photoAddon: fromDiscovery && Boolean(body.photoAddon),
			smartFoodMatchAddon: fromDiscovery && Boolean(body.smartFoodMatchAddon),
			analyticsReportsAddon: fromDiscovery && Boolean(body.analyticsReportsAddon),
			smartServiceHubAddon: fromDiscovery && Boolean(body.smartServiceHubAddon)
		};
		const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [{
			price_data: {
				currency: 'eur',
				unit_amount: pricing.amountCents,
				recurring: { interval: 'year' },
				product_data: { name: `Smart Menu Solutions – ${pricing.label}${fromDiscovery ? '' : ' (Renewal)'}` }
			},
			quantity: 1
		}];
		const yearly = (cents: number, name: string) => lineItems.push({ price_data: { currency: 'eur', unit_amount: cents, recurring: { interval: 'year' }, product_data: { name } }, quantity: 1 });
		if (addons.photoAddon) lineItems.push({ price_data: { currency: 'eur', unit_amount: pricing.photoAddOnCents, product_data: { name: 'Smart DishPhoto™ (one-time)' } }, quantity: 1 });
		if (addons.smartFoodMatchAddon) yearly(SFM_ADDON_CENTS, 'Smart FoodMatch™ add-on');
		if (addons.analyticsReportsAddon) yearly(ANALYTICS_ADDON_CENTS, 'Smart WeeklyReport™ add-on');
		if (addons.smartServiceHubAddon) yearly(HUB_ADDON_CENTS, 'Smart ServiceHub™ add-on');
		const addonMetadata = fromDiscovery
			? { fromDiscovery: 'true', photoAddon: String(addons.photoAddon), smartFoodMatchAddon: String(addons.smartFoodMatchAddon), analyticsReportsAddon: String(addons.analyticsReportsAddon), smartServiceHubAddon: String(addons.smartServiceHubAddon) }
			: {};

		const session = await stripe.checkout.sessions.create({
			mode: 'subscription',
			customer_email: email,
			...(discounts ? { discounts } : {}),
			line_items: lineItems,
			// A new menu PDF is optional and uploaded after payment (upload.html).
			success_url: `${SITE_ORIGIN}/${lang === 'en' ? '' : `${lang}/`}upload.html?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${SITE_ORIGIN}/cancel.html`,
			metadata: {
				type: 'renewal',
				subscriptionId: subscription.id,
				plan,
				firstName,
				lastName,
				companyName,
				phone,
				email,
				lang,
				...addonMetadata
			},
			subscription_data: {
				metadata: { type: 'renewal', subscriptionId: subscription.id, plan, firstName, lastName, companyName, phone, email, lang, ...addonMetadata }
			}
		});

		return json({ url: session.url });
	} catch (error) {
		console.error(error);
		return json({ error: 'Could not start renewal checkout.' }, 500);
	}
}

// One fixed, reusable Stripe coupon (€2.99 off, first invoice only), created
// on first use so it doesn't have to be set up by hand in the dashboard.
const DISCOVERY_COUPON_ID = 'discovery-pass-credit';

async function discoveryCreditCoupon(): Promise<string> {
	try {
		await stripe.coupons.retrieve(DISCOVERY_COUPON_ID);
	} catch {
		await stripe.coupons.create({
			id: DISCOVERY_COUPON_ID,
			amount_off: 299,
			currency: 'eur',
			duration: 'once',
			name: 'Smart Discovery credited'
		});
	}
	return DISCOVERY_COUPON_ID;
}

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
	});
}
