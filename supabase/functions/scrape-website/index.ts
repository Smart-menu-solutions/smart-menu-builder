// Fetches a lead's own website server-side and pulls out an email, phone
// number, and WhatsApp link if present. Runs as an Edge Function rather
// than client-side because arbitrary third-party sites don't send CORS
// headers permitting our origin, so a browser fetch would just fail.

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_PATTERN = /\+?\d[\d\s()\-]{7,}\d/;
const WHATSAPP_PATTERN = /https:\/\/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)[\d+]+/;

Deno.serve(async (request) => {
	if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
	if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

	try {
		const body = await request.json();
		const url = String(body.url || '').trim();
		if (!url || !/^https?:\/\//i.test(url)) return json({ error: 'A valid http(s) URL is required.' }, 400);

		// A handful of small business sites still only serve plain http, or
		// their https cert is broken - retry with the other scheme once
		// before giving up, instead of failing on the first attempt.
		const candidates = [url, url.startsWith('https://') ? url.replace('https://', 'http://') : url.replace('http://', 'https://')];
		let html = '';
		let lastError = '';
		for (const candidate of candidates) {
			try {
				const response = await fetch(candidate, {
					signal: AbortSignal.timeout(8000),
					headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartMenuLeadFinder/1.0)' }
				});
				if (!response.ok) { lastError = `Site returned HTTP ${response.status}`; continue; }
				html = await response.text();
				break;
			} catch (error) {
				lastError = error instanceof Error && error.name === 'TimeoutError' ? 'Site took too long to respond' : `Could not reach ${candidate}`;
			}
		}
		if (!html) return json({ error: lastError || 'Could not read that website' }, 502);

		const email = html.match(EMAIL_PATTERN)?.[0] || '';
		const whatsapp = html.match(WHATSAPP_PATTERN)?.[0] || '';
		const phone = html.match(PHONE_PATTERN)?.[0]?.trim() || '';

		return json({ email, phone, whatsapp });
	} catch (error) {
		console.error(error);
		const message = error instanceof Error && error.name === 'TimeoutError' ? 'Site took too long to respond' : 'Could not read that website';
		return json({ error: message }, 502);
	}
});

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
	});
}
