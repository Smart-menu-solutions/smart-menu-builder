import Stripe from 'https://esm.sh/stripe@16.5.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient()
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await request.json();
    const plan = String(body.plan || '');
    const amount = Number(body.amount);
    const amountCents = Math.round(amount * 100);
    const email = String(body.email || '').trim();
    const firstName = String(body.firstName || '').trim();
    const lastName = String(body.lastName || '').trim();

    if (!['start', 'pro', 'premium'].includes(plan) || !Number.isFinite(amount) || amountCents < 11900 || amountCents > 1000000 || !email || !firstName || !lastName) {
      return json({ error: 'Enter a valid amount between EUR 119 and EUR 10,000.' }, 400);
    }

    const origin = 'https://smart-menu-solutions.github.io/smart-menu-solutions';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price_data: { currency: 'eur', unit_amount: amountCents, product_data: { name: `Smart Menu Solutions - ${plan}` } }, quantity: 1 }],
      customer_email: email,
      payment_intent_data: {
        receipt_email: email
      },
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel.html`,
      metadata: {
        plan,
        firstName,
        lastName,
        pdfFileName: String(body.pdfFileName || '')
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
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
