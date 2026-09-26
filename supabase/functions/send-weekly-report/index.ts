// Weekly job (triggered by Supabase Cron, see
// 0010_schedule_weekly_report.sql - Monday 03:15 UTC, 15 min after
// check-subscriptions' daily 03:00 run): emails every customer with the
// Analytics Report add-on active a summary of the just-completed week, with
// a link to the full stats.html dashboard. Also prunes menu_view_daily rows
// older than 35 days, folding retention cleanup into the existing weekly
// cadence instead of adding a second cron job.

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
	Deno.env.get('SUPABASE_URL') ?? '',
	Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const SITE_ORIGIN = 'https://smartmenusolutions.com';
const GOOGLE_REVIEW_URL = 'https://g.page/r/CeQGeIap64TYEBM/review';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Smart Menu Builder <onboarding@resend.dev>';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RETENTION_DAYS = 35;

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => ({
		'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
	}[character] as string));
}

// Mirrors stripe-webhook/check-subscriptions/manage-addons's EMAIL_SIGNATURE
// exactly - see scratch/email-signature.html for the source.
const EMAIL_SIGNATURE = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;margin-top:18px;">
<tr>
<td style="padding:0 18px 0 0;vertical-align:middle;"><img src="https://smartmenusolutions.com/assets/images/logo-signature.png" width="64" height="64" alt="Smart Menu Solutions" style="display:block;border:0;width:64px;height:64px;"></td>
<td style="padding:0 18px 0 0;vertical-align:middle;border-right:1px solid #E7E5E1;width:1px;"></td>
<td style="padding:0 0 0 18px;vertical-align:middle;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
<tr><td style="padding:0;font-size:15px;font-weight:bold;color:#262421;line-height:1.4;">George Tsiafitsas</td></tr>
<tr><td style="padding:0 0 10px 0;font-size:13px;color:#737373;line-height:1.4;">CEO&nbsp;&middot;&nbsp;<span style="color:#F66A09;font-weight:bold;">Smart</span><span style="color:#262421;font-weight:bold;">&nbsp;Menu Solutions</span></td></tr>
<tr><td style="padding:3px 0;font-size:12.5px;color:#737373;line-height:1;"><a href="mailto:info@smartmenusolutions.com" style="text-decoration:none;color:#737373;"><img src="https://smartmenusolutions.com/assets/images/signature/icon-email.png" width="16" height="16" alt="" style="display:inline-block;vertical-align:middle;border:0;width:16px;height:16px;margin-right:7px;"><span style="vertical-align:middle;">info@smartmenusolutions.com</span></a></td></tr>
<tr><td style="padding:3px 0;font-size:12.5px;color:#737373;line-height:1;"><a href="https://smartmenusolutions.com" style="text-decoration:none;color:#737373;"><img src="https://smartmenusolutions.com/assets/images/signature/icon-website.png" width="16" height="16" alt="" style="display:inline-block;vertical-align:middle;border:0;width:16px;height:16px;margin-right:7px;"><span style="vertical-align:middle;">smartmenusolutions.com</span></a></td></tr>
<tr><td style="padding:9px 0 3px 0;font-size:12.5px;color:#737373;line-height:1;"><a href="https://instagram.com/smartmenusolutions/" style="text-decoration:none;color:#737373;"><img src="https://smartmenusolutions.com/assets/images/signature/icon-instagram.png" width="16" height="16" alt="" style="display:inline-block;vertical-align:middle;border:0;width:16px;height:16px;margin-right:7px;"><span style="vertical-align:middle;">@smartmenusolutions</span></a></td></tr>
<tr><td style="padding:3px 0;font-size:12.5px;color:#737373;line-height:1;"><a href="https://www.tiktok.com/@smartmenusolutions" style="text-decoration:none;color:#737373;"><img src="https://smartmenusolutions.com/assets/images/signature/icon-tiktok.png" width="16" height="16" alt="" style="display:inline-block;vertical-align:middle;border:0;width:16px;height:16px;margin-right:7px;"><span style="vertical-align:middle;">@smartmenusolutions</span></a></td></tr>
<tr><td style="padding:9px 0 0 23px;font-size:12.5px;color:#737373;line-height:1;">Greece</td></tr>
</table>
</td>
</tr>
</table>`;

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

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setUTCDate(result.getUTCDate() + days);
	return result;
}

function isoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function topLabels(rows: { day: string; metric_type: string; label: string; view_count: number }[], metricType: string, from: string, to: string, limit: number) {
	const totals = new Map<string, number>();
	for (const row of rows) {
		if (row.metric_type !== metricType || row.day < from || row.day > to) continue;
		totals.set(row.label, (totals.get(row.label) || 0) + row.view_count);
	}
	return [...totals.entries()]
		.map(([label, count]) => ({ label, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, limit);
}

function sumVisits(rows: { day: string; metric_type: string; view_count: number }[], from: string, to: string) {
	return rows.reduce((sum, row) => row.metric_type === 'visit' && row.day >= from && row.day <= to ? sum + row.view_count : sum, 0);
}

function trendLine(current: number, previous: number, lang: string): string {
	const isEn = lang === 'en';
	if (previous === 0) return current > 0 ? (isEn ? 'New this week' : 'Neu diese Woche') : '';
	const change = Math.round(((current - previous) / previous) * 100);
	if (change > 0) return isEn ? `▲ ${change}% more than last week` : `▲ ${change}% mehr als letzte Woche`;
	if (change < 0) return isEn ? `▼ ${Math.abs(change)}% less than last week` : `▼ ${Math.abs(change)}% weniger als letzte Woche`;
	return isEn ? 'Same as last week' : 'Gleich wie letzte Woche';
}

function reportHtml(menuName: string, rangeStart: string, rangeEnd: string, totalVisits: number, previousWeekVisits: number, topCategories: { label: string; count: number }[], topDishes: { label: string; count: number }[], statsUrl: string, lang: string): string {
	const isEn = lang === 'en';
	const trend = trendLine(totalVisits, previousWeekVisits, lang);
	const listItems = (items: { label: string; count: number }[]) => items.length
		? items.map((item) => `<li>${escapeHtml(item.label)} - ${item.count}×</li>`).join('')
		: `<li>${isEn ? 'No views yet this week.' : 'Noch keine Aufrufe diese Woche.'}</li>`;
	return isEn ? `
		<p>Hi,</p>
		<p>here's the weekly report for <strong>${escapeHtml(menuName)}</strong> (${rangeStart} to ${rangeEnd}):</p>
		<p style="font-size:20px"><strong>${totalVisits}</strong> visits${trend ? ` <span style="color:#666">(${escapeHtml(trend)})</span>` : ''}</p>
		<p><strong>Top categories</strong></p>
		<ul>${listItems(topCategories)}</ul>
		<p><strong>Top dishes</strong></p>
		<ul>${listItems(topDishes)}</ul>
		<p><a href="${statsUrl}">View full stats</a></p>
		<p>Happy with Smart Menu Solutions? We'd be grateful for a <a href="${GOOGLE_REVIEW_URL}">review on Google</a>.</p>
		<p>Best regards</p>
		${EMAIL_SIGNATURE}
	` : `
		<p>Hallo,</p>
		<p>hier ist der Wochenbericht für <strong>${escapeHtml(menuName)}</strong> (${rangeStart} bis ${rangeEnd}):</p>
		<p style="font-size:20px"><strong>${totalVisits}</strong> Besuche${trend ? ` <span style="color:#666">(${escapeHtml(trend)})</span>` : ''}</p>
		<p><strong>Meistgesehene Kategorien</strong></p>
		<ul>${listItems(topCategories)}</ul>
		<p><strong>Meistgesehene Gerichte</strong></p>
		<ul>${listItems(topDishes)}</ul>
		<p><a href="${statsUrl}">Vollständige Statistik ansehen</a></p>
		<p>Sind Sie zufrieden mit Smart Menu Solutions? Über eine <a href="${GOOGLE_REVIEW_URL}">Bewertung auf Google</a> freuen wir uns sehr.</p>
		<p>Mit freundlichen Grüßen</p>
		${EMAIL_SIGNATURE}
	`;
}

Deno.serve(async (request) => {
	// Only the Supabase Cron job may trigger this (see 0021_cron_secret.sql):
	// the function runs without JWT verification, so without this check
	// anyone who found the URL could set it off again and again.
	const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
	if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret) {
		return new Response(JSON.stringify({ error: 'Not authorized.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
	}
	const today = new Date();
	const rangeEnd = isoDate(addDays(today, -1));
	const rangeStart = isoDate(addDays(today, -7));
	const previousRangeEnd = isoDate(addDays(today, -8));
	const previousRangeStart = isoDate(addDays(today, -14));

	const { data: subscriptions, error } = await supabase
		.from('subscriptions')
		.select('id, menu_slug, stats_token, lang, customers(contact_name, email), menus!inner(name, analytics_reports_enabled)')
		.eq('status', 'active')
		.eq('menus.analytics_reports_enabled', true);

	if (error) {
		console.error('Failed to query analytics-report subscribers', error);
		return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
	}

	let sent = 0;
	for (const subscription of subscriptions ?? []) {
		const customer = subscription.customers as { contact_name: string; email: string } | null;
		const menu = subscription.menus as { name: string } | null;
		if (!customer?.email || !EMAIL_PATTERN.test(customer.email) || !menu) continue;

		const { data: rows } = await supabase
			.from('menu_view_daily')
			.select('day, metric_type, label, view_count')
			.eq('menu_slug', subscription.menu_slug)
			.gte('day', previousRangeStart)
			.lte('day', rangeEnd);
		const allRows = rows ?? [];

		const totalVisits = sumVisits(allRows, rangeStart, rangeEnd);
		const previousWeekVisits = sumVisits(allRows, previousRangeStart, previousRangeEnd);
		const topCategories = topLabels(allRows, 'category', rangeStart, rangeEnd, 3);
		const topDishes = topLabels(allRows, 'dish', rangeStart, rangeEnd, 3);
		const statsUrl = `${SITE_ORIGIN}/stats.html?token=${subscription.stats_token}`;

		const isEn = subscription.lang === 'en';
		await sendEmail(
			customer.email,
			subscription.id,
			'Wochenbericht: Analytics',
			isEn ? `Smart WeeklyReport™: ${menu.name}` : `Smart WeeklyReport™: ${menu.name}`,
			reportHtml(menu.name, rangeStart, rangeEnd, totalVisits, previousWeekVisits, topCategories, topDishes, statsUrl, subscription.lang)
		);
		sent += 1;
	}

	const cutoff = isoDate(addDays(today, -RETENTION_DAYS));
	const { error: pruneError } = await supabase.from('menu_view_daily').delete().lt('day', cutoff);
	if (pruneError) console.error('Failed to prune old menu_view_daily rows', pruneError);

	return new Response(JSON.stringify({ sent }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
