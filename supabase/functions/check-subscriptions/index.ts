import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
	Deno.env.get('SUPABASE_URL') ?? '',
	Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const SITE_ORIGIN = 'https://smartmenusolutions.com';
const NOTIFICATION_EMAIL = Deno.env.get('NOTIFICATION_EMAIL') ?? 'smartmenusolutions@outlook.com';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Smart Menu Builder <onboarding@resend.dev>';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Customer language: 'it' since the Italian website (2026-10-05). Anything
// unknown falls back to 'de', subscriptions.lang's column default.
function normalizeLang(value: unknown): 'de' | 'en' | 'it' {
	return value === 'en' || value === 'it' ? value : 'de';
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => ({
		'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
	}[character] as string));
}

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

async function sendNotification(subscriptionId: string | null, subject: string, lines: Record<string, string>) {
	const html = `<h2>${escapeHtml(subject)}</h2><ul>${
		Object.entries(lines).map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value ?? '-'))}</li>`).join('')
	}</ul>`;
	await sendEmail(NOTIFICATION_EMAIL, subscriptionId, subject, subject, html);
}

// Sent to the customer once the 7-day grace period has run out and the menu
// has just been taken offline.
async function sendDeactivatedEmail(subscriptionId: string, to: string, contactName: string, renewalToken: string, lang: string) {
	if (!EMAIL_PATTERN.test(to)) {
		console.error('Skipping deactivation customer email: no valid email on file', subscriptionId);
		return;
	}
	const isEn = lang === 'en';
	const isIt = lang === 'it';
	const subject = isIt ? 'Il vostro abbonamento è stato disattivato' : isEn ? 'Your subscription has been deactivated' : 'Ihr Abo wurde deaktiviert';
	const renewalUrl = `${SITE_ORIGIN}/renewal.html?token=${renewalToken}&lang=${normalizeLang(lang)}`;
	const html = isIt ? `
		<p>Buongiorno ${escapeHtml(contactName || '')},</p>
		<p>poiché il pagamento del rinnovo non è andato a buon fine, il vostro abbonamento è stato disattivato e il vostro menu non è più raggiungibile tramite il QR code.</p>
		<p>Potete riattivare il vostro abbonamento in qualsiasi momento tramite il link qui sotto:</p>
		<p><a href="${renewalUrl}">Riattiva l'abbonamento</a></p>
		<p>Per qualsiasi domanda potete scriverci in qualsiasi momento a <a href="mailto:info@smartmenusolutions.com">info@smartmenusolutions.com</a>.</p>
		<p>Cordiali saluti</p>
		${EMAIL_SIGNATURE}
	` : isEn ? `
		<p>Hi ${escapeHtml(contactName || '')},</p>
		<p>since the payment for your renewal didn't go through, your subscription has now been deactivated and your menu is no longer reachable via the QR code.</p>
		<p>You can reactivate your subscription anytime via the link below:</p>
		<p><a href="${renewalUrl}">Reactivate subscription</a></p>
		<p>If you have any questions, reach us anytime at <a href="mailto:info@smartmenusolutions.com">info@smartmenusolutions.com</a>.</p>
		<p>Best regards</p>
		${EMAIL_SIGNATURE}
	` : `
		<p>Hallo ${escapeHtml(contactName || '')},</p>
		<p>da die Zahlung für Ihre Verlängerung ausblieb, wurde Ihr Abo nun deaktiviert und Ihr Menü ist über den QR-Code nicht mehr erreichbar.</p>
		<p>Sie können Ihr Abo jederzeit über folgenden Link reaktivieren:</p>
		<p><a href="${renewalUrl}">Abo reaktivieren</a></p>
		<p>Bei Fragen erreichen Sie uns jederzeit unter <a href="mailto:info@smartmenusolutions.com">info@smartmenusolutions.com</a>.</p>
		<p>Mit freundlichen Grüßen</p>
		${EMAIL_SIGNATURE}
	`;
	await sendEmail(to, subscriptionId, 'Kundenmail: Abo deaktiviert', subject, html);
}

const DISCOVERY_DAYS = 7;
// The report goes out on day 6 so the customer still has a day before the
// menu pauses to decide.
const DISCOVERY_REPORT_DAY = 6;

function addDaysIso(isoDay: string, days: number): string {
	const result = new Date(`${isoDay}T00:00:00Z`);
	result.setUTCDate(result.getUTCDate() + days);
	return result.toISOString().slice(0, 10);
}

type ViewRow = { metric_type: string; label: string; view_count: number };

function discoveryReportHtml(contactName: string, menuName: string, visits: number, topDishes: { label: string; count: number }[], renewalUrl: string, lang: string): string {
	const isEn = lang === 'en';
	const dishes = topDishes.length
		? `<ol>${topDishes.map((dish) => `<li>${escapeHtml(dish.label)} – ${dish.count}×</li>`).join('')}</ol>`
		: '';
	if (lang === 'it') return `
		<p>Buongiorno ${escapeHtml(contactName || '')},</p>
		<p>la vostra prova Smart Discovery per <strong>${escapeHtml(menuName)}</strong> termina domani. Ecco cosa è successo finora:</p>
		<p style="font-size:22px"><strong>${visits}</strong> volte i vostri ospiti hanno aperto il vostro menu.</p>
		${dishes ? `<p><strong>Piatti più visti</strong></p>${dishes}` : ''}
		<p>Volete tenere il vostro menu digitale? Scegliete ora un piano: i vostri 2,99 € vengono scalati e il vostro menu resta online senza interruzioni:</p>
		<p><a href="${renewalUrl}" style="display:inline-block;background:#F66A09;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Continua da 119 € all'anno</a></p>
		<p>Altrimenti dopo domani il vostro menu viene messo in pausa. Con lo stesso link potete riattivarlo in qualsiasi momento.</p>
		<p>Cordiali saluti</p>
		${EMAIL_SIGNATURE}
	`;
	return isEn ? `
		<p>Hi ${escapeHtml(contactName || '')},</p>
		<p>your Smart Discovery trial for <strong>${escapeHtml(menuName)}</strong> ends tomorrow. Here's what happened so far:</p>
		<p style="font-size:22px"><strong>${visits}</strong> times your guests opened your menu.</p>
		${dishes ? `<p><strong>Most viewed dishes</strong></p>${dishes}` : ''}
		<p>Want to keep your digital menu? Choose a plan now, your €2.99 is credited and your menu stays online without interruption:</p>
		<p><a href="${renewalUrl}" style="display:inline-block;background:#F66A09;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Continue from €119 a year</a></p>
		<p>Otherwise your menu pauses after tomorrow. You can reactivate it with the same link at any time.</p>
		<p>Best regards</p>
		${EMAIL_SIGNATURE}
	` : `
		<p>Hallo ${escapeHtml(contactName || '')},</p>
		<p>Ihr Test mit Smart Discovery für <strong>${escapeHtml(menuName)}</strong> endet morgen. Das ist bisher passiert:</p>
		<p style="font-size:22px"><strong>${visits}</strong>-mal haben Ihre Gäste Ihre Speisekarte geöffnet.</p>
		${dishes ? `<p><strong>Meistgesehene Gerichte</strong></p>${dishes}` : ''}
		<p>Möchten Sie Ihre digitale Speisekarte behalten? Wählen Sie jetzt einen Tarif, Ihre 2,99 € werden angerechnet und Ihre Karte bleibt ohne Unterbrechung online:</p>
		<p><a href="${renewalUrl}" style="display:inline-block;background:#F66A09;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Weitermachen ab 119 € im Jahr</a></p>
		<p>Sonst wird Ihre Karte nach morgen pausiert. Mit demselben Link können Sie sie jederzeit wieder aktivieren.</p>
		<p>Mit freundlichen Grüßen</p>
		${EMAIL_SIGNATURE}
	`;
}

function discoveryEndedHtml(contactName: string, renewalUrl: string, lang: string): string {
	const isEn = lang === 'en';
	if (lang === 'it') return `
		<p>Buongiorno ${escapeHtml(contactName || '')},</p>
		<p>la vostra prova Smart Discovery è terminata e il vostro menu ora è in pausa. Gli ospiti che scansionano il vostro QR code vedono un breve avviso che il menu non è disponibile.</p>
		<p>Il vostro menu e il vostro QR code restano salvati. Scegliete un piano e tutto torna subito online; i vostri 2,99 € vengono scalati:</p>
		<p><a href="${renewalUrl}">Riattiva il mio menu</a></p>
		<p>Cordiali saluti</p>
		${EMAIL_SIGNATURE}
	`;
	return isEn ? `
		<p>Hi ${escapeHtml(contactName || '')},</p>
		<p>your Smart Discovery trial has ended and your menu is now paused. Guests who scan your QR code will see a short "not available" note.</p>
		<p>Your menu and QR code are kept. Choose a plan and everything is back online right away, your €2.99 is credited:</p>
		<p><a href="${renewalUrl}">Reactivate my menu</a></p>
		<p>Best regards</p>
		${EMAIL_SIGNATURE}
	` : `
		<p>Hallo ${escapeHtml(contactName || '')},</p>
		<p>Ihr Test mit Smart Discovery ist abgelaufen und Ihre Speisekarte ist jetzt pausiert. Gäste, die Ihren QR-Code scannen, sehen einen kurzen Hinweis, dass die Karte nicht verfügbar ist.</p>
		<p>Ihre Karte und Ihr QR-Code bleiben gespeichert. Wählen Sie einen Tarif, dann ist alles sofort wieder online, Ihre 2,99 € werden angerechnet:</p>
		<p><a href="${renewalUrl}">Speisekarte wieder aktivieren</a></p>
		<p>Mit freundlichen Grüßen</p>
		${EMAIL_SIGNATURE}
	`;
}

// Discovery Pass lifecycle, run once a day alongside the grace-period check:
// 1. stamp discovery_started_on the first day the menu is published (we set
//    menus up by hand, so the customer's 7 days start when it's really live),
// 2. on day 6 send the report with the view counts and the upgrade link,
// 3. after day 7 take the menu offline. An upgrade (renewal link) changes the
//    plan away from 'discovery', so upgraded passes simply drop out of here.
async function runDiscoveryPasses(today: string) {
	const counts = { started: 0, reported: 0, ended: 0 };
	const { data: passes, error } = await supabase
		.from('subscriptions')
		.select('id, menu_slug, lang, renewal_token, discovery_started_on, discovery_report_sent_at, customers(contact_name, email), menus!inner(name, is_published)')
		.eq('plan', 'discovery')
		.eq('status', 'active');
	if (error) {
		console.error('Failed to query discovery passes', error);
		return counts;
	}

	for (const pass of passes ?? []) {
		const menu = pass.menus as { name: string; is_published: boolean } | null;
		const customer = pass.customers as { contact_name: string; email: string } | null;
		const renewalUrl = `${SITE_ORIGIN}/renewal.html?token=${pass.renewal_token}&lang=${normalizeLang(pass.lang)}`;

		if (!pass.discovery_started_on) {
			if (!menu?.is_published) continue;
			await supabase.from('subscriptions').update({
				discovery_started_on: today,
				current_period_start: today,
				current_period_end: addDaysIso(today, DISCOVERY_DAYS),
				updated_at: new Date().toISOString()
			}).eq('id', pass.id);
			counts.started += 1;
			continue;
		}

		const endDay = addDaysIso(pass.discovery_started_on, DISCOVERY_DAYS);
		const reportDay = addDaysIso(pass.discovery_started_on, DISCOVERY_REPORT_DAY - 1);

		if (today >= endDay) {
			await supabase.from('subscriptions').update({ status: 'deactivated', updated_at: new Date().toISOString() }).eq('id', pass.id);
			await supabase.from('menus').update({ is_published: false }).eq('slug', pass.menu_slug);
			await sendNotification(pass.id, 'Smart Discovery abgelaufen (kein Upgrade)', {
				Lokal: menu?.name ?? '-', Kontakt: customer?.contact_name ?? '-', Email: customer?.email ?? '-', 'Renewal-Link': renewalUrl
			});
			if (customer?.email && EMAIL_PATTERN.test(customer.email)) {
				await sendEmail(customer.email, pass.id, 'Kundenmail: Smart Discovery abgelaufen',
					pass.lang === 'it' ? 'La vostra prova Smart Discovery è terminata' : pass.lang === 'en' ? 'Your Smart Discovery trial has ended' : 'Ihr Test mit Smart Discovery ist abgelaufen',
					discoveryEndedHtml(customer.contact_name, renewalUrl, pass.lang));
			}
			counts.ended += 1;
			continue;
		}

		if (today >= reportDay && !pass.discovery_report_sent_at) {
			const { data: rows } = await supabase
				.from('menu_view_daily')
				.select('metric_type, label, view_count')
				.eq('menu_slug', pass.menu_slug)
				.gte('day', pass.discovery_started_on)
				.lte('day', today);
			const viewRows = (rows ?? []) as ViewRow[];
			const visits = viewRows.reduce((sum, row) => row.metric_type === 'visit' ? sum + row.view_count : sum, 0);
			const dishTotals = new Map<string, number>();
			for (const row of viewRows) if (row.metric_type === 'dish') dishTotals.set(row.label, (dishTotals.get(row.label) || 0) + row.view_count);
			const topDishes = [...dishTotals.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 3);

			if (customer?.email && EMAIL_PATTERN.test(customer.email)) {
				await sendEmail(customer.email, pass.id, 'Kundenmail: Smart-Discovery-Bericht',
					pass.lang === 'it' ? `Il vostro menu è stato aperto ${visits} volte – il vostro report Smart Discovery` : pass.lang === 'en' ? `${visits} guests opened your menu – your Smart Discovery report` : `${visits}-mal wurde Ihre Speisekarte geöffnet – Ihr Smart-Discovery-Bericht`,
					discoveryReportHtml(customer.contact_name, menu?.name ?? '', visits, topDishes, renewalUrl, pass.lang));
			}
			await supabase.from('subscriptions').update({ discovery_report_sent_at: new Date().toISOString() }).eq('id', pass.id);
			await sendNotification(pass.id, 'Smart-Discovery-Bericht verschickt', {
				Lokal: menu?.name ?? '-', Aufrufe: String(visits), Email: customer?.email ?? '-'
			});
			counts.reported += 1;
		}
	}
	return counts;
}

// Daily job (triggered by Supabase Cron): the 7-day grace period after
// expiry is enforced here — invoice.payment_failed (in stripe-webhook)
// already moved these subscriptions to status "expired" with a
// grace_until date, so this only has to find the ones whose grace period
// has run out and flip them to "deactivated".
Deno.serve(async (request) => {
	// Only the Supabase Cron job may trigger this (see 0021_cron_secret.sql):
	// the function runs without JWT verification, so without this check
	// anyone who found the URL could set it off again and again.
	const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
	if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret) {
		return new Response(JSON.stringify({ error: 'Not authorized.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
	}
	const today = new Date().toISOString().slice(0, 10);

	const { data: toDeactivate, error } = await supabase
		.from('subscriptions')
		.select('id, plan, renewal_token, menu_slug, lang, customers(contact_name, email)')
		.eq('status', 'expired')
		.lt('grace_until', today);

	if (error) {
		console.error('Failed to query expired subscriptions', error);
		return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
	}

	for (const subscription of toDeactivate ?? []) {
		await supabase.from('subscriptions').update({
			status: 'deactivated',
			updated_at: new Date().toISOString()
		}).eq('id', subscription.id);

		// Grace period is over — take the menu offline until the customer renews.
		await supabase.from('menus').update({ is_published: false }).eq('slug', subscription.menu_slug);

		await Promise.all([
			sendNotification(subscription.id, 'Abo automatisch deaktiviert', {
				'Subscription-ID': subscription.id,
				Plan: subscription.plan,
				'Renewal-Link': `${SITE_ORIGIN}/renewal.html?token=${subscription.renewal_token}`
			}),
			sendDeactivatedEmail(subscription.id, subscription.customers?.email ?? '', subscription.customers?.contact_name ?? '', subscription.renewal_token, subscription.lang)
		]);
	}

	const discovery = await runDiscoveryPasses(today);

	return new Response(JSON.stringify({ checked: true, deactivated: (toDeactivate ?? []).length, discovery }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
});
