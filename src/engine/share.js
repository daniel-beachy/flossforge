/**
 * share.js -- designs that survive being sent to somebody.
 *
 * A design plus the size it was made for is small enough to live in a URL
 * fragment, so sharing needs no server, no database and no account: the link
 * *is* the bracelet. Fragments are never sent to the host either, which is a
 * nice side effect when the app is on someone else's Pages domain.
 *
 * Seeds go in the same payload. Given the same prompt and the same seed the
 * offline designer produces the same bracelets, and the seed is shown in the
 * UI so a good result can be got back exactly.
 */

import { newSeed } from './rng.js';

const VERSION = 1;

/** Design + options -> a URL-safe string. */
export function encodeShare({ design, options = {}, seed, prompt }) {
  const payload = {
    v: VERSION,
    d: design,
    o: compactOptions(options),
    s: seed ?? null,
    p: prompt ? String(prompt).slice(0, 300) : undefined,
  };
  return toBase64Url(JSON.stringify(payload));
}

/** The inverse. Returns null rather than throwing on anything unreadable. */
export function decodeShare(text) {
  if (!text) return null;
  try {
    const raw = JSON.parse(fromBase64Url(text.replace(/^#?/, '')));
    if (!raw || typeof raw !== 'object' || !raw.d) return null;
    return {
      version: raw.v ?? 1,
      design: raw.d,
      options: expandOptions(raw.o ?? {}),
      seed: raw.s ?? null,
      prompt: raw.p ?? '',
    };
  } catch {
    return null;
  }
}

/** The full link for a design, based on wherever the app happens to be. */
export function shareUrl(base, share) {
  const url = new URL(base);
  url.hash = `b=${encodeShare(share)}`;
  return url.toString();
}

/** Pull a shared design out of a location hash, if there is one. */
export function readHash(hash) {
  const m = /(?:^|[#&])b=([^&]+)/.exec(hash ?? '');
  return m ? decodeShare(m[1]) : null;
}

export { newSeed };

/* --------------------------------------------------------------- internals */

function compactOptions(o) {
  const out = {};
  if (o.size) out.z = o.size;
  if (o.fit) out.f = o.fit;
  if (o.customInches) out.c = o.customInches;
  return out;
}

function expandOptions(o) {
  const out = {};
  if (o.z) out.size = o.z;
  if (o.f) out.fit = o.f;
  if (o.c) out.customInches = Number(o.c);
  return out;
}

/**
 * base64url over UTF-8. Written by hand because this has to work identically
 * in a browser and under `node --test`, and the two disagree about Buffer.
 */
export function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(b64, 'base64').toString('utf8');
}
