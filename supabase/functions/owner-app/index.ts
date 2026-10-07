// Data for the "SmartPilot" owner app (owner.html?t=<token>). Same trust
// model as get-stats / renewal: the uuid token in the link is the only
// credential, no login. The token lives in owner_app_links, never on the
// public menus row (see 0035_owner_app.sql).
//
// Returns the menu basics, the latest subscription, the owner's renewal /
// add-on / stats links, the table links for printing table cards and - only
// with Smart WeeklyReport booked, which is what that add-on sells - the last
// 7 days of menu views and the most viewed dishes.

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
	Deno.env.get('SUPABASE_URL') ?? '',
	Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SITE_ORIGIN = 'https://smartmenusolutions.com';
const MENU_BASE = 'https://smart-menu-solutions.github.io/smart-menu-builder/';
// The app's languages; the website pages behind its links (renewal, add-ons,
// stats) only exist in SITE_LANGUAGES, the others get English there.
const LANGUAGES = ['de', 'en', 'el', 'it', 'es', 'fr', 'nl', 'pt'];
const SITE_LANGUAGES = ['de', 'en', 'it'];
const DAYS = 7;

type ViewRow = { day: string; metric_type: string; label: string; view_count: number };
type MenuTranslations = { items?: Record<string, { name?: string }> } | undefined;

function isoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setUTCDate(result.getUTCDate() + days);
	return result;
}

// Mirrors get-stats: dish labels are tracked under the source-menu name, shown
// in the owner's language when the menu has that translation, without a
// leading "1. " numbering.
function dishLabel(translations: MenuTranslations, label: string): string {
	return (translations?.items?.[label]?.name || label).replace(/^\d+\.\s*/, '');
}

function viewStats(rows: ViewRow[], translations: MenuTranslations) {
	const today = new Date();
	const days: { day: string; visits: number }[] = [];
	for (let offset = DAYS - 1; offset >= 0; offset -= 1) days.push({ day: isoDate(addDays(today, -offset)), visits: 0 });
	const from = days[0].day;
	const previousFrom = isoDate(addDays(today, -(2 * DAYS - 1)));
	let previous = 0;
	const dishes = new Map<string, number>();
	for (const row of rows) {
		if (row.metric_type === 'visit') {
			const entry = days.find((day) => day.day === row.day);
			if (entry) entry.visits += row.view_count;
			else if (row.day >= previousFrom && row.day < from) previous += row.view_count;
		} else if (row.metric_type === 'dish' && row.day >= from) {
			dishes.set(row.label, (dishes.get(row.label) || 0) + row.view_count);
		}
	}
	return {
		days,
		total: days.reduce((sum, day) => sum + day.visits, 0),
		previous,
		topDishes: [...dishes.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3)
			.map(([label, count]) => ({ label: dishLabel(translations, label), count }))
	};
}

Deno.serve(async (request) => {
	if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
	if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

	const url = new URL(request.url);
	const token = url.searchParams.get('t') || '';
	if (!TOKEN_PATTERN.test(token)) return json({ error: 'Invalid or missing link.' }, 400);

	const { data: link } = await supabase.from('owner_app_links').select('menu_slug').eq('token', token).maybeSingle();
	if (!link) return json({ error: 'This link is no longer valid.' }, 404);

	const { data: menu } = await supabase
		.from('menus')
		.select('slug, name, logo_url, header_font, languages, is_published, translations, analytics_reports_enabled, smart_food_match_enabled, smartservice_hub_enabled, photo_addon_enabled')
		.eq('slug', link.menu_slug)
		.maybeSingle();
	if (!menu) return json({ error: 'This link is no longer valid.' }, 404);

	// The newest row is the current one - a renewal or an upgrade from Smart
	// Discovery updates it, a menu set up by hand in the builder has none.
	const { data: subscription } = await supabase
		.from('subscriptions')
		.select('plan, status, lang, current_period_end, discovery_started_on, renewal_token, addon_token, stats_token')
		.eq('menu_slug', menu.slug)
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();

	const requested = url.searchParams.get('lang') || '';
	const lang = LANGUAGES.includes(requested) ? requested : (LANGUAGES.includes(subscription?.lang) ? subscription!.lang : 'de');
	const siteLang = SITE_LANGUAGES.includes(lang) ? lang : 'en';
	const languages: string[] = Array.isArray(menu.languages) && menu.languages.length ? menu.languages : ['de'];
	const menuUrl = `${MENU_BASE}menu.html?client=${encodeURIComponent(menu.slug)}&lang=${encodeURIComponent(languages[0])}`;

	let tables: { number: string; url: string }[] = [];
	if (menu.smartservice_hub_enabled) {
		const { data: rows } = await supabase.from('restaurant_tables').select('table_number, link_secret').eq('menu_slug', menu.slug);
		tables = (rows || [])
			.map((row) => ({
				number: String(row.table_number),
				url: `${MENU_BASE}menu.html?client=${encodeURIComponent(menu.slug)}&table=${encodeURIComponent(row.table_number)}&k=${encodeURIComponent(row.link_secret)}`
			}))
			.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
	}

	let stats = null;
	if (menu.analytics_reports_enabled) {
		const { data: rows } = await supabase
			.from('menu_view_daily')
			.select('day, metric_type, label, view_count')
			.eq('menu_slug', menu.slug)
			.gte('day', isoDate(addDays(new Date(), -(2 * DAYS - 1))));
		stats = viewStats(rows || [], (menu.translations as Record<string, MenuTranslations> | null)?.[lang]);
	}

	// Add-ons can only be bought onto a running yearly plan.
	const canBuyAddons = subscription?.status === 'active' && subscription.plan !== 'discovery';
	return json({
		lang,
		name: menu.name,
		slug: menu.slug,
		logoUrl: menu.logo_url || null,
		headerFont: menu.header_font || null,
		languages,
		isPublished: menu.is_published !== false,
		menuUrl,
		addons: {
			weeklyReport: !!menu.analytics_reports_enabled,
			foodMatch: !!menu.smart_food_match_enabled,
			serviceHub: !!menu.smartservice_hub_enabled,
			dishPhoto: !!menu.photo_addon_enabled
		},
		subscription: subscription ? {
			plan: subscription.plan,
			status: subscription.status,
			periodEnd: subscription.current_period_end,
			discoveryStartedOn: subscription.discovery_started_on
		} : null,
		links: {
			renewal: subscription ? `${SITE_ORIGIN}/renewal.html?token=${subscription.renewal_token}&lang=${siteLang}` : null,
			addons: canBuyAddons ? `${SITE_ORIGIN}/addons.html?token=${subscription!.addon_token}&lang=${siteLang}` : null,
			stats: subscription && menu.analytics_reports_enabled ? `${SITE_ORIGIN}/stats.html?token=${subscription.stats_token}&lang=${siteLang}` : null
		},
		tables,
		stats
	});
});

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
	});
}
