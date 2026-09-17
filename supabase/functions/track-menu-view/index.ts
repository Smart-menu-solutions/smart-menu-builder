// Receives one beacon per menu visit from menu.js (see startViewTracking())
// and counts it into menu_view_daily via the increment_menu_views() DB
// function. Runs with verify_jwt = false (see supabase/config.toml) because
// the primary caller is navigator.sendBeacon(), which cannot attach any
// custom headers (no Authorization, no apikey) - the same reason
// stripe-webhook and check-subscriptions already run without JWT
// verification and rely on the body/payload itself for trust, not headers.

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
	Deno.env.get('SUPABASE_URL') ?? '',
	Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const MAX_CATEGORIES = 100;
const MAX_DISHES = 500;
const MAX_RECOMMENDATIONS = 50;

Deno.serve(async (request) => {
	if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
	if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

	try {
		// sendBeacon's Blob is sent as text/plain (a CORS-safelisted content
		// type, to avoid a preflight OPTIONS round trip a beacon can't satisfy
		// anyway) - read as raw text and parse ourselves rather than trusting
		// request.json(), which depends on a correctly-declared Content-Type.
		const raw = await request.text();
		const body = raw ? JSON.parse(raw) : {};
		const menuSlug = String(body.menuSlug || '').trim();
		if (!menuSlug) return json({ error: 'Missing menuSlug' }, 400);

		// Dedupe + cap defensively before it ever reaches the DB function - both
		// to bound the array size against abuse and because
		// increment_menu_views()'s ON CONFLICT DO UPDATE can't affect the same
		// row twice within one statement.
		const categories = [...new Set(Array.isArray(body.categories) ? body.categories.map(String) : [])].slice(0, MAX_CATEGORIES);
		const dishes = [...new Set(Array.isArray(body.dishes) ? body.dishes.map(String) : [])].slice(0, MAX_DISHES);
		const recommendations = [...new Set(Array.isArray(body.recommendations) ? body.recommendations.map(String) : [])].slice(0, MAX_RECOMMENDATIONS);

		// Only count views for menus that are actually live and have the
		// add-on active - also means a slug probe never reveals anything via
		// the response (always the same 204, active or not).
		const { data: menu } = await supabase
			.from('menus')
			.select('slug')
			.eq('slug', menuSlug)
			.eq('is_published', true)
			.eq('analytics_reports_enabled', true)
			.maybeSingle();
		if (!menu) return new Response(null, { status: 204, headers: CORS_HEADERS });

		const today = new Date().toISOString().slice(0, 10);
		const { error } = await supabase.rpc('increment_menu_views', {
			p_menu_slug: menuSlug,
			p_day: today,
			p_visit: true,
			p_categories: categories,
			p_dishes: dishes,
			p_recommendations: recommendations
		});
		if (error) console.error('increment_menu_views failed', error);

		return new Response(null, { status: 204, headers: CORS_HEADERS });
	} catch (error) {
		console.error(error);
		// A tracking beacon failing should never surface as a visible error to
		// a real visitor - always 204, log server-side only.
		return new Response(null, { status: 204, headers: CORS_HEADERS });
	}
});

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
	});
}
