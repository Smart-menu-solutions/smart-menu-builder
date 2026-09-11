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

const SITE_ORIGIN = 'https://smart-menu-solutions.github.io/smart-menu-solutions';

const PLAN_PRICING: Record<string, { amountCents: number; label: string }> = {
	start: { amountCents: 11900, label: 'Smart Start' },
	pro: { amountCents: 12900, label: 'Smart Pro' },
	premium: { amountCents: 16900, label: 'Smart Premium' }
};

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
		.select('id, plan, status, menu_slug, customer_id')
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
		menuSlug: subscription.menu_slug
	});
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
		const pdfPath = String(body.pdfPath || '').trim();

		const pricing = PLAN_PRICING[plan];
		if (!TOKEN_PATTERN.test(token) || !pricing || !firstName || !lastName || !EMAIL_PATTERN.test(email) || !pdfPath) {
			return json({ error: 'Missing or invalid renewal details.' }, 400);
		}

		const { data: subscription, error } = await supabase
			.from('subscriptions')
			.select('id')
			.eq('renewal_token', token)
			.maybeSingle();
		if (error || !subscription) return json({ error: 'This renewal link is no longer valid.' }, 404);

		const session = await stripe.checkout.sessions.create({
			mode: 'subscription',
			customer_email: email,
			line_items: [{
				price_data: {
					currency: 'eur',
					unit_amount: pricing.amountCents,
					recurring: { interval: 'year' },
					product_data: { name: `Smart Menu Solutions – ${pricing.label} (Renewal)` }
				},
				quantity: 1
			}],
			success_url: `${SITE_ORIGIN}/success.html?session_id={CHECKOUT_SESSION_ID}`,
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
				pdfPath
			},
			subscription_data: {
				metadata: { type: 'renewal', subscriptionId: subscription.id, plan, firstName, lastName, companyName, phone, email, pdfPath }
			}
		});

		return json({ url: session.url });
	} catch (error) {
		console.error(error);
		return json({ error: 'Could not start renewal checkout.' }, 500);
	}
}

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
	});
}
