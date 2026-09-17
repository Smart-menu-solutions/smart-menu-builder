import Stripe from 'npm:stripe@16.5.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
	apiVersion: '2024-06-20',
	httpClient: Stripe.createFetchHttpClient()
});

const SITE_ORIGIN = 'https://smartmenusolutions.com';

const PLAN_PRICING: Record<string, { amountCents: number; label: string; photoAddOnCents: number; smartFoodMatchAddOnCents: number; analyticsReportsAddOnCents: number }> = {
	start: { amountCents: 11900, label: 'Smart Start', photoAddOnCents: 1000, smartFoodMatchAddOnCents: 500, analyticsReportsAddOnCents: 500 },
	pro: { amountCents: 12900, label: 'Smart Pro', photoAddOnCents: 3000, smartFoodMatchAddOnCents: 500, analyticsReportsAddOnCents: 500 },
	premium: { amountCents: 16900, label: 'Smart Premium', photoAddOnCents: 9000, smartFoodMatchAddOnCents: 500, analyticsReportsAddOnCents: 500 }
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
		const smartFoodMatchAddon = Boolean(body.smartFoodMatchAddon);
		const analyticsReportsAddon = Boolean(body.analyticsReportsAddon);

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
					product_data: { name: 'Smart Food Match add-on' }
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
					product_data: { name: 'Weekly Analytics Report add-on' }
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
				analyticsReportsAddon: String(analyticsReportsAddon)
			},
			subscription_data: {
				metadata: { type: 'initial', plan, firstName, lastName, companyName, phone, email, pdfPath, photoAddon: String(photoAddon), photoZipPath, smartFoodMatchAddon: String(smartFoodMatchAddon), analyticsReportsAddon: String(analyticsReportsAddon) }
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
