import Stripe from 'npm:stripe@16.5.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
	apiVersion: '2024-06-20',
	httpClient: Stripe.createFetchHttpClient()
});

const SITE_ORIGIN = 'https://smart-menu-solutions.github.io/smart-menu-solutions';

const PLAN_PRICING: Record<string, { amountCents: number; label: string; photoAddOnCents: number }> = {
	start: { amountCents: 11900, label: 'Smart Start', photoAddOnCents: 1000 },
	pro: { amountCents: 12900, label: 'Smart Pro', photoAddOnCents: 3000 },
	premium: { amountCents: 16900, label: 'Smart Premium', photoAddOnCents: 9000 }
};

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

		const pricing = PLAN_PRICING[plan];
		if (!pricing || !firstName || !lastName || !EMAIL_PATTERN.test(email) || !pdfPath) {
			return json({ error: 'Missing or invalid order details.' }, 400);
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
					product_data: { name: 'Professional dish photos (one-time)' }
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
				photoZipPath
			},
			subscription_data: {
				metadata: { type: 'initial', plan, firstName, lastName, companyName, phone, email, pdfPath, photoAddon: String(photoAddon), photoZipPath }
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
