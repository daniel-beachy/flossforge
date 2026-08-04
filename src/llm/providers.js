/**
 * llm/providers.js -- the four APIs you can point this at from a static page.
 *
 * The constraint that decides everything here is CORS. A GitHub Pages site has
 * no server, so the browser calls the model API directly, which only works if
 * the provider sends permissive CORS headers on both the preflight and the
 * real response. I checked each of these by hand from the Pages origin rather
 * than trusting documentation:
 *
 *   Gemini      Access-Control-Allow-Origin echoes the origin        works
 *   Groq        access-control-allow-origin: *                       works
 *   OpenRouter  Access-Control-Allow-Origin: *                       works
 *   Anthropic   * , with the anthropic-dangerous-direct-browser-access
 *               header opting you in to browser calls                works
 *
 * Keys stay in localStorage on the person's own machine and go nowhere except
 * to the provider they belong to. There is no backend to leak them to.
 */

export const PROVIDERS = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    recommended: true,
    vision: true,
    keyUrl: 'https://aistudio.google.com/apikey',
    keyLabel: 'AI Studio API key',
    free: 'Free forever, no card. Around 1,500 requests a day and 10-15 a minute on the Flash models -- far more than this app can use.',
    steps: [
      'Open aistudio.google.com/apikey and sign in with a Google account.',
      'Click "Create API key" and pick or create a project.',
      'Copy the key and paste it below.',
    ],
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', note: 'best designs' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', note: 'fastest' },
      { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', note: 'highest limits' },
    ],
    async listModels(key) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
      if (!res.ok) throw await httpError(res);
      const data = await res.json();
      return (data.models ?? [])
        .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
        .map((m) => ({ id: m.name.replace(/^models\//, ''), label: m.displayName ?? m.name }));
    },
    async complete({ key, model, system, user, images = [], signal, temperature = 0.95 }) {
      const parts = [{ text: user }];
      for (const img of images) parts.push({ inlineData: { mimeType: img.mime, data: img.data } });
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
          signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts }],
            generationConfig: { temperature, responseMimeType: 'application/json', maxOutputTokens: 8192 },
          }),
        },
      );
      if (!res.ok) throw await httpError(res);
      const data = await res.json();
      const cand = data.candidates?.[0];
      if (!cand) throw new Error(data.promptFeedback?.blockReason ? `the model declined: ${data.promptFeedback.blockReason}` : 'the model returned nothing');
      return (cand.content?.parts ?? []).map((p) => p.text ?? '').join('');
    },
  },

  {
    id: 'groq',
    label: 'Groq',
    vision: false,
    keyUrl: 'https://console.groq.com/keys',
    keyLabel: 'Groq API key',
    free: 'Free tier, no card. Roughly 30 requests a minute and 1,000-14,400 a day depending on the model. Very fast.',
    steps: [
      'Open console.groq.com/keys and sign in.',
      'Click "Create API Key", name it anything.',
      'Copy it now -- Groq only shows it once.',
    ],
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', note: 'best designs' },
      { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', note: 'strong' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', note: 'fastest' },
    ],
    async listModels(key) {
      const res = await fetch('https://api.groq.com/openai/v1/models', { headers: { authorization: `Bearer ${key}` } });
      if (!res.ok) throw await httpError(res);
      const data = await res.json();
      return (data.data ?? []).map((m) => ({ id: m.id, label: m.id }));
    },
    complete: openAiStyle('https://api.groq.com/openai/v1/chat/completions'),
  },

  {
    id: 'openrouter',
    label: 'OpenRouter',
    vision: true,
    keyUrl: 'https://openrouter.ai/keys',
    keyLabel: 'OpenRouter API key',
    free: 'Free models marked ":free". 20 requests a minute and 50 a day, or 1,000 a day once you have ever put $10 on the account.',
    steps: [
      'Open openrouter.ai/keys and sign in.',
      'Create a key and copy it.',
      'Any model whose name ends in :free costs nothing.',
    ],
    models: [
      { id: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash (free)', note: 'reads images' },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (free)' },
      { id: 'deepseek/deepseek-chat-v3-0324:free', label: 'DeepSeek V3 (free)' },
    ],
    async listModels(key) {
      const res = await fetch('https://openrouter.ai/api/v1/models', { headers: { authorization: `Bearer ${key}` } });
      if (!res.ok) throw await httpError(res);
      const data = await res.json();
      return (data.data ?? [])
        .filter((m) => m.id.endsWith(':free'))
        .map((m) => ({ id: m.id, label: m.name ?? m.id }));
    },
    complete: openAiStyle('https://openrouter.ai/api/v1/chat/completions', {
      'http-referer': 'https://daniel-beachy.github.io/flossforge/',
      'x-title': 'Flossforge',
    }),
  },

  {
    id: 'anthropic',
    label: 'Anthropic',
    vision: true,
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyLabel: 'Anthropic API key',
    free: 'No permanent free tier -- new accounts get a small starting credit, after that it is paid. Included because it writes the nicest designs.',
    steps: [
      'Open console.anthropic.com/settings/keys.',
      'Create a key and copy it.',
      'Note this one usually costs money.',
    ],
    models: [
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', note: 'cheapest' },
      { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', note: 'best designs' },
    ],
    async listModels(key) {
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      });
      if (!res.ok) throw await httpError(res);
      const data = await res.json();
      return (data.data ?? []).map((m) => ({ id: m.id, label: m.display_name ?? m.id }));
    },
    async complete({ key, model, system, user, images = [], signal, temperature = 1 }) {
      const content = [];
      for (const img of images) content.push({ type: 'image', source: { type: 'base64', media_type: img.mime, data: img.data } });
      content.push({ type: 'text', text: user });
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        signal,
        body: JSON.stringify({ model, max_tokens: 8192, temperature, system, messages: [{ role: 'user', content }] }),
      });
      if (!res.ok) throw await httpError(res);
      const data = await res.json();
      return (data.content ?? []).map((p) => p.text ?? '').join('');
    },
  },
];

export const PROVIDER_BY_ID = new Map(PROVIDERS.map((p) => [p.id, p]));

/** Groq and OpenRouter both speak the OpenAI chat shape. */
function openAiStyle(url, extraHeaders = {}) {
  return async ({ key, model, system, user, images = [], signal, temperature = 0.95 }) => {
    const content = images.length
      ? [{ type: 'text', text: user }, ...images.map((i) => ({ type: 'image_url', image_url: { url: `data:${i.mime};base64,${i.data}` } }))]
      : user;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`, ...extraHeaders },
      signal,
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: 8192,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content }],
      }),
    });
    if (!res.ok) throw await httpError(res);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  };
}

/** Turn an API error into something a person can act on. */
async function httpError(res) {
  let detail = '';
  try {
    const body = await res.json();
    detail = body?.error?.message ?? body?.message ?? JSON.stringify(body).slice(0, 200);
  } catch {
    detail = await res.text().catch(() => '');
  }
  const err = new Error(friendly(res.status, detail));
  err.status = res.status;
  err.retryable = res.status === 429 || res.status >= 500;
  err.detail = detail;
  return err;
}

function friendly(status, detail) {
  if (status === 401 || status === 403) return `The API key was rejected. Check you pasted the whole thing and that it is for the provider you picked. (${detail})`;
  if (status === 404) return `That model name does not exist for this key. Try "Refresh models". (${detail})`;
  if (status === 429) return `Rate limit reached. Wait a minute, or switch model. (${detail})`;
  if (status >= 500) return `The provider is having trouble right now. (${status})`;
  return detail || `Request failed with ${status}`;
}

/**
 * Models rewrite JSON in all sorts of ways -- fenced, prefaced, trailing
 * commas. Get the object out anyway rather than failing the whole generation.
 */
export function extractJson(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  const direct = tryParse(cleaned);
  if (direct) return direct;
  const start = cleaned.search(/[[{]/);
  if (start < 0) return null;
  const open = cleaned[start];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return tryParse(cleaned.slice(start, i + 1));
    }
  }
  return tryParse(cleaned.slice(start) + close.repeat(Math.max(0, depth)));
}

function tryParse(s) {
  try { return JSON.parse(s); } catch { /* fall through */ }
  try { return JSON.parse(s.replace(/,\s*([}\]])/g, '$1')); } catch { return null; }
}
