// Proxies menu-translation requests to DeepL. DeepL's API doesn't support
// direct browser calls (no CORS, and exposing the key client-side would let
// anyone steal it from the page source) — this function holds the API key
// server-side and the admin dashboard calls this instead of DeepL directly.
//
// Replaces MyMemory as the primary translator: MyMemory is free and needs
// no key, but as a crowd-sourced translation-memory API it frequently
// returns wrong words (not just wrong casing) for short, ambiguous menu
// category names. admin.js falls back to MyMemory only if this function
// errors or the language pair isn't one DeepL supports.

const DEEPL_API_KEY = Deno.env.get('DEEPL_API_KEY') ?? '';
// API Free keys are always suffixed ":fx" and only work against the
// api-free host; a Pro key (no suffix) needs api.deepl.com instead. Reading
// this from the key itself means upgrading the DeepL plan later needs no
// code change, just a new secret.
const DEEPL_API_URL = DEEPL_API_KEY.endsWith(':fx')
	? 'https://api-free.deepl.com/v2/translate'
	: 'https://api.deepl.com/v2/translate';

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// menu.html/admin.js use lowercase ISO codes (en, de, el, ...); DeepL wants
// uppercase, and a handful of languages need a regional variant specifically
// for target_lang (source_lang accepts the bare code for all of these).
const TARGET_LANG_MAP: Record<string, string> = {
	en: 'EN-GB', de: 'DE', el: 'EL', es: 'ES', it: 'IT', fr: 'FR',
	pt: 'PT-PT', nl: 'NL', pl: 'PL', tr: 'TR', ru: 'RU', ar: 'AR',
	zh: 'ZH', ja: 'JA', ko: 'KO'
};
const SOURCE_LANG_MAP: Record<string, string> = {
	en: 'EN', de: 'DE', el: 'EL', es: 'ES', it: 'IT', fr: 'FR',
	pt: 'PT', nl: 'NL', pl: 'PL', tr: 'TR', ru: 'RU', ar: 'AR',
	zh: 'ZH', ja: 'JA', ko: 'KO'
};

Deno.serve(async (request) => {
	if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
	if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
	if (!DEEPL_API_KEY) return json({ error: 'Translation is not configured.' }, 500);

	try {
		const body = await request.json();
		const text = String(body.text || '').trim();
		const source = String(body.source || '').toLowerCase();
		const target = String(body.target || '').toLowerCase();
		if (!text) return json({ translatedText: '' });

		const targetLang = TARGET_LANG_MAP[target];
		const sourceLang = SOURCE_LANG_MAP[source];
		if (!targetLang) return json({ error: `Unsupported target language: ${target}` }, 400);

		const response = await fetch(DEEPL_API_URL, {
			method: 'POST',
			headers: {
				Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				text: [text],
				target_lang: targetLang,
				...(sourceLang ? { source_lang: sourceLang } : {})
			})
		});

		if (!response.ok) {
			const detail = await response.text().catch(() => '');
			console.error('DeepL API error', response.status, detail);
			return json({ error: `DeepL API error ${response.status}` }, 502);
		}

		const data = await response.json();
		const translatedText = data?.translations?.[0]?.text ?? '';
		return json({ translatedText });
	} catch (error) {
		console.error(error);
		return json({ error: 'Translation failed.' }, 500);
	}
});

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
	});
}
