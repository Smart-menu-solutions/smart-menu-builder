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
<tr><td style="padding:0 0 10px 0;font-size:15px;font-weight:bold;color:#262421;line-height:1.4;"><span style="color:#F66A09;">Smart</span>&nbsp;Menu Solutions Team</td></tr>
<tr><td style="padding:3px 0;font-size:12.5px;color:#737373;line-height:1;"><a href="mailto:info@smartmenusolutions.com" style="text-decoration:none;color:#737373;"><img src="https://smartmenusolutions.com/assets/images/signature/icon-email.png" width="16" height="16" alt="" style="display:inline-block;vertical-align:middle;border:0;width:16px;height:16px;margin-right:7px;"><span style="vertical-align:middle;">info@smartmenusolutions.com</span></a></td></tr>
<tr><td style="padding:3px 0;font-size:12.5px;color:#737373;line-height:1;"><a href="https://smartmenusolutions.com" style="text-decoration:none;color:#737373;"><img src="https://smartmenusolutions.com/assets/images/signature/icon-website.png" width="16" height="16" alt="" style="display:inline-block;vertical-align:middle;border:0;width:16px;height:16px;margin-right:7px;"><span style="vertical-align:middle;">smartmenusolutions.com</span></a></td></tr>
<tr><td style="padding:9px 0 3px 0;font-size:12.5px;color:#737373;line-height:1;"><a href="https://instagram.com/smartmenusolutions/" style="text-decoration:none;color:#737373;"><img src="https://smartmenusolutions.com/assets/images/signature/icon-instagram.png" width="16" height="16" alt="" style="display:inline-block;vertical-align:middle;border:0;width:16px;height:16px;margin-right:7px;"><span style="vertical-align:middle;">@smartmenusolutions</span></a></td></tr>
<tr><td style="padding:3px 0;font-size:12.5px;color:#737373;line-height:1;"><a href="https://www.tiktok.com/@smartmenusolutions" style="text-decoration:none;color:#737373;"><img src="https://smartmenusolutions.com/assets/images/signature/icon-tiktok.png" width="16" height="16" alt="" style="display:inline-block;vertical-align:middle;border:0;width:16px;height:16px;margin-right:7px;"><span style="vertical-align:middle;">@smartmenusolutions</span></a></td></tr>
</table>
</td>
</tr>
</table>`;

const REPLY_TO_EMAIL = 'info@smartmenusolutions.com';

// Plain-text part sent next to the HTML: spam filters penalise HTML-only mails.
function htmlToText(html: string): string {
	return html
		.replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, '')
		.replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
			const text = label.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
			if (!text) return '';
			return href.startsWith('mailto:') || href.includes(text) ? text : `${text} (${href.replace(/&amp;/g, '&')})`;
		})
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<li[^>]*>/gi, '- ')
		.replace(/<\/(p|h[1-6]|ul|ol)>/gi, '\n\n')
		.replace(/<\/(div|li|tr)>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number(code)))
		.replace(/&amp;/g, '&')
		.replace(/[ \t]+/g, ' ')
		.replace(/ *\n */g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

async function sendEmail(recipient: string, subscriptionId: string | null, kind: string, subject: string, html: string) {
	let providerMessageId: string | null = null;
	try {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ from: FROM_EMAIL, to: [recipient], reply_to: REPLY_TO_EMAIL, subject, html, text: htmlToText(html) })
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
		<p>la vostra prova Smart Discovery per <strong>${escapeHtml(menuName)}</strong> termina domani. Ecco i vostri risultati finora:</p>
		<p style="font-size:22px">Aperture del vostro menu: <strong>${visits}</strong></p>
		${dishes ? `<p><strong>Piatti più visti</strong></p>${dishes}` : ''}
		<p>Volete tenere il vostro menu digitale? Scegliete ora un piano: i vostri 2,99 € vengono scalati e il vostro menu resta online senza interruzioni:</p>
		<p><a href="${renewalUrl}" style="display:inline-block;background:#F66A09;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Continua da 119 € all'anno</a></p>
		<p>Altrimenti dopo domani il vostro menu viene messo in pausa. Con lo stesso link potete riattivarlo in qualsiasi momento.</p>
		<p>Cordiali saluti</p>
		${EMAIL_SIGNATURE}
	`;
	return isEn ? `
		<p>Hi ${escapeHtml(contactName || '')},</p>
		<p>your Smart Discovery trial for <strong>${escapeHtml(menuName)}</strong> ends tomorrow. Here are your results so far:</p>
		<p style="font-size:22px">Menu views: <strong>${visits}</strong></p>
		${dishes ? `<p><strong>Most viewed dishes</strong></p>${dishes}` : ''}
		<p>Want to keep your digital menu? Choose a plan now, your €2.99 is credited and your menu stays online without interruption:</p>
		<p><a href="${renewalUrl}" style="display:inline-block;background:#F66A09;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Continue from €119 a year</a></p>
		<p>Otherwise your menu pauses after tomorrow. You can reactivate it with the same link at any time.</p>
		<p>Best regards</p>
		${EMAIL_SIGNATURE}
	` : discoveryReportHtmlDe(contactName, menuName, visits, topDishes, renewalUrl);
}

// German report. With 0 views the results block and the "guests already
// found your menu" lines are left out, they would not be true.
function discoveryReportHtmlDe(contactName: string, menuName: string, visits: number, topDishes: { label: string; count: number }[], renewalUrl: string): string {
	const dishes = topDishes.length
		? `<p style="margin:12px 0 4px">Beliebteste Gerichte:</p><ul style="margin:0;padding-left:20px">${topDishes.map((dish) => `<li>${escapeHtml(dish.label)} (${dish.count} ${dish.count === 1 ? 'Aufruf' : 'Aufrufe'})</li>`).join('')}</ul>`
		: '';
	const results = visits > 0 ? `
		<p>In den letzten Tagen haben bereits Gäste Ihre digitale Speisekarte entdeckt:</p>
		<div style="background:#FFF4EC;border-radius:10px;padding:16px 20px;margin:16px 0">
			<p style="margin:0 0 10px;font-weight:bold">📊 Ihre Ergebnisse auf einen Blick</p>
			<p style="margin:0;font-size:22px"><strong>${visits}</strong> ${visits === 1 ? 'Speisekarten-Aufruf' : 'Speisekarten-Aufrufe'}</p>
			${dishes}
		</div>
		<p>Das zeigt: Interessenten interessieren sich bereits für Ihr Angebot.</p>` : '';
	return `
		<p>Hallo ${escapeHtml(contactName || '')},</p>
		<p>Ihre Testphase mit Smart Discovery für <strong>${escapeHtml(menuName)}</strong> endet morgen.</p>
		${results}
		<p>Möchten Sie Ihre digitale Speisekarte weiterhin online und für Gäste sichtbar halten? Wählen Sie einfach Ihren Tarif aus. Die bereits gezahlten 2,99 € werden selbstverständlich angerechnet.</p>
		<p><a href="${renewalUrl}" style="display:inline-block;background:#F66A09;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Jetzt weitermachen ab 119 € pro Jahr</a></p>
		<p>So bleibt Ihre Speisekarte ohne Unterbrechung online und weiterhin für neue Gäste erreichbar.</p>
		<p>Sollten Sie sich aktuell noch nicht entscheiden wollen, wird Ihre Speisekarte nach Ablauf der Testphase pausiert. Über denselben Link können Sie sie jederzeit wieder aktivieren.</p>
		<p>Vielen Dank für Ihr Vertrauen.</p>
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
					pass.lang === 'it' ? 'Smart Discovery – La vostra prova termina a breve: informazioni sull\'upgrade e sui vostri risultati' : pass.lang === 'en' ? 'Smart Discovery – Your trial ends soon: upgrade information and your results' : 'Smart Discovery – Ihre Testphase endet bald: Informationen zum Upgrade und Ihren Ergebnissen',
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

// Reminder before a yearly plan renews by itself: once per plan year, 30 days
// ahead, with the amount from Stripe's upcoming invoice. Plans cancelled for
// the end of the period get none; a failed Stripe lookup is simply tried
// again the next day.
const RENEWAL_REMINDER_DAYS = 30;
const RENEWAL_REMINDER_KIND = 'Kundenmail: Verlängerungs-Erinnerung';
const PLAN_LABELS: Record<string, string> = { start: 'Smart Start', pro: 'Smart Pro', premium: 'Smart Premium' };

function formatAmount(cents: number, lang: string): string {
	const amount = (cents / 100).toFixed(2);
	return lang === 'en' ? `€${amount}` : `${amount.replace('.', ',')} €`;
}

function formatDay(isoDay: string, lang: string): string {
	const [year, month, day] = isoDay.slice(0, 10).split('-');
	return lang === 'de' ? `${day}.${month}.${year}` : `${day}/${month}/${year}`;
}

function renewalReminderSubject(lang: string, date: string): string {
	return lang === 'it' ? `Il vostro abbonamento si rinnova il ${date}` : lang === 'en' ? `Your subscription renews on ${date}` : `Ihr Abo verlängert sich am ${date}`;
}

function renewalReminderHtml(lang: string, contactName: string, menuName: string, plan: string, date: string, amount: string, upgradeUrl: string | null, addonsUrl: string): string {
	const name = escapeHtml(contactName || '');
	const menu = escapeHtml(menuName || '');
	const label = PLAN_LABELS[plan] ?? plan;
	if (lang === 'it') return `
		<p>Buongiorno ${name},</p>
		<p>il vostro piano <strong>${label}</strong> per <strong>${menu}</strong> si rinnova automaticamente per un altro anno il <strong>${date}</strong>. Addebiteremo allora <strong>${amount}</strong> sul vostro metodo di pagamento salvato.</p>
		<p>Non dovete fare nulla: il vostro menu resta online senza interruzioni.</p>
		<p>Volete cambiare qualcosa prima?</p>
		<ul>
			${upgradeUrl ? `<li><a href="${upgradeUrl}">Passare a un piano più grande</a></li>` : ''}
			<li><a href="${addonsUrl}">Aggiungere degli add-on</a></li>
		</ul>
		<p>Se non desiderate rinnovare, rispondete a questa e-mail prima del ${date}.</p>
		<p>Cordiali saluti</p>
		${EMAIL_SIGNATURE}
	`;
	if (lang === 'en') return `
		<p>Hi ${name},</p>
		<p>your <strong>${label}</strong> plan for <strong>${menu}</strong> renews automatically for another year on <strong>${date}</strong>. We'll then charge <strong>${amount}</strong> to your saved payment method.</p>
		<p>There's nothing you need to do – your menu stays online without interruption.</p>
		<p>Would you like to change something first?</p>
		<ul>
			${upgradeUrl ? `<li><a href="${upgradeUrl}">Move to a bigger plan</a></li>` : ''}
			<li><a href="${addonsUrl}">Add add-ons</a></li>
		</ul>
		<p>If you don't want to renew, please reply to this email before ${date}.</p>
		<p>Best regards</p>
		${EMAIL_SIGNATURE}
	`;
	return `
		<p>Hallo ${name},</p>
		<p>Ihr Tarif <strong>${label}</strong> für <strong>${menu}</strong> verlängert sich am <strong>${date}</strong> automatisch um ein weiteres Jahr. Abgebucht werden dann <strong>${amount}</strong> von Ihrer hinterlegten Zahlungsmethode.</p>
		<p>Sie müssen nichts tun – Ihre Speisekarte bleibt ohne Unterbrechung online.</p>
		<p>Möchten Sie vorher etwas ändern?</p>
		<ul>
			${upgradeUrl ? `<li><a href="${upgradeUrl}">In einen größeren Tarif wechseln</a></li>` : ''}
			<li><a href="${addonsUrl}">Zusatzmodule hinzufügen</a></li>
		</ul>
		<p>Wenn Sie nicht verlängern möchten, antworten Sie bitte vor dem ${date} auf diese E-Mail.</p>
		<p>Mit freundlichen Grüßen</p>
		${EMAIL_SIGNATURE}
	`;
}

async function runRenewalReminders(today: string) {
	let reminded = 0;
	const { data: due, error } = await supabase
		.from('subscriptions')
		.select('id, plan, lang, current_period_end, stripe_subscription_id, addon_token, customers(contact_name, email), menus(name)')
		.eq('status', 'active')
		.in('plan', ['start', 'pro', 'premium'])
		.not('stripe_subscription_id', 'is', null)
		.gt('current_period_end', today)
		.lte('current_period_end', addDaysIso(today, RENEWAL_REMINDER_DAYS));
	if (error) {
		console.error('Failed to query subscriptions due for a renewal reminder', error);
		return reminded;
	}

	for (const subscription of due ?? []) {
		const customer = subscription.customers as { contact_name: string; email: string } | null;
		const menu = subscription.menus as { name: string } | null;
		if (!customer?.email || !EMAIL_PATTERN.test(customer.email)) continue;
		const periodEnd = String(subscription.current_period_end).slice(0, 10);

		// Once per plan year.
		const { data: sent } = await supabase
			.from('notifications_log')
			.select('id')
			.eq('subscription_id', subscription.id)
			.eq('kind', RENEWAL_REMINDER_KIND)
			.gte('created_at', `${addDaysIso(periodEnd, -(RENEWAL_REMINDER_DAYS + 5))}T00:00:00Z`)
			.limit(1);
		if (sent?.length) continue;

		let amountCents: number;
		try {
			const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
			if (stripeSubscription.status !== 'active' || stripeSubscription.cancel_at_period_end) continue;
			const upcoming = await stripe.invoices.retrieveUpcoming({ subscription: subscription.stripe_subscription_id });
			amountCents = upcoming.amount_due;
		} catch (stripeError) {
			console.error('Renewal reminder: Stripe lookup failed', subscription.id, stripeError);
			continue;
		}

		const lang = normalizeLang(subscription.lang);
		const date = formatDay(periodEnd, lang);
		const upgradeUrl = subscription.plan === 'premium' ? null : `${SITE_ORIGIN}/upgrade.html?token=${subscription.addon_token}&lang=${lang}`;
		const addonsUrl = `${SITE_ORIGIN}/addons.html?token=${subscription.addon_token}&lang=${lang}`;
		await sendEmail(customer.email, subscription.id, RENEWAL_REMINDER_KIND, renewalReminderSubject(lang, date),
			renewalReminderHtml(lang, customer.contact_name, menu?.name ?? '', subscription.plan, date, formatAmount(amountCents, lang), upgradeUrl, addonsUrl));
		reminded += 1;
	}
	return reminded;
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
	const reminders = await runRenewalReminders(today);

	return new Response(JSON.stringify({ checked: true, deactivated: (toDeactivate ?? []).length, discovery, reminders }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
});
