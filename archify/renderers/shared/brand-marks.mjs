import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { BRAND_MARKS } from './generated-brand-marks.mjs';
import { genericIconsEnabled, inferGenericIcon } from './generic-icons.mjs';
import { findPackIcon, listPackIcons, loadPackIcon, packSourceUrl, suggestPackIcons } from './icon-packs.mjs';
import { throwDiagnosticError } from './diagnostics.mjs';
import { esc, textUnits } from './utils.mjs';

const COLLECTIONS = Object.freeze({
  architecture: 'components',
  workflow: 'nodes',
  sequence: 'participants',
  dataflow: 'nodes',
  lifecycle: 'states',
});
const MARK_BY_LOOKUP = new Map();
const MARK_BY_DOMAIN = new Map();
const RESOLVED_BY_NODE = new WeakMap();
const RESOLVED_MARK = Symbol('archify.brandMark');
const MAX_HTML_BYTES = 256 * 1024;
const MAX_IMAGE_BYTES = 1024 * 1024;
const MAX_CAPTURE_CONCURRENCY = 3;
const DEFAULT_CAPTURE_TIMEOUT_MS = 8000;
const USER_AGENT = 'Archify/2.15 brand-preview';

function lookupForms(value) {
  const raw = String(value ?? '').trim().toLocaleLowerCase('en-US');
  if (!raw) return [];
  const dashed = raw.replace(/[\s_]+/g, '-');
  const compact = raw.replace(/[\s_.-]+/g, '');
  return [...new Set([raw, dashed, compact])];
}

for (const mark of BRAND_MARKS) {
  for (const value of [mark.id, mark.title, ...mark.aliases]) {
    for (const form of lookupForms(value)) {
      if (!MARK_BY_LOOKUP.has(form)) MARK_BY_LOOKUP.set(form, mark);
    }
  }
  for (const domain of mark.domains) MARK_BY_DOMAIN.set(domain, mark);
}

function asUrl(value) {
  try {
    const url = new URL(String(value));
    return ['https:', 'http:'].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

// Public provenance is separate from the URL used to reproduce a pinned asset.
export function normalizeBrandSourceUrl(value) {
  const url = asUrl(value);
  if (!url) return null;
  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = '';
  return url.href;
}

function domainMark(hostname) {
  const host = hostname.toLocaleLowerCase('en-US').replace(/\.$/, '');
  const candidates = [...MARK_BY_DOMAIN.entries()]
    .filter(([domain]) => host === domain || host.endsWith(`.${domain}`))
    .sort(([left], [right]) => right.length - left.length);
  return candidates[0]?.[1] || null;
}

export function findBrandMark(value) {
  const url = asUrl(value);
  if (url) return domainMark(url.hostname);
  for (const form of lookupForms(value)) {
    const mark = MARK_BY_LOOKUP.get(form);
    if (mark) return mark;
  }
  return null;
}

export function listBrandMarks(query = '') {
  const needle = String(query).trim().toLocaleLowerCase('en-US');
  const brands = BRAND_MARKS.filter((mark) => {
    if (!needle) return true;
    return [mark.id, mark.title, mark.category, ...mark.aliases, ...mark.domains]
      .some((value) => String(value).toLocaleLowerCase('en-US').includes(needle));
  }).map(({ path, ...mark }) => mark);
  // Simform fork: Microsoft icon packs (Azure, M365, Entra, Fabric, Dynamics 365).
  return [...brands, ...listPackIcons(query)];
}

function ipv4Private(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0 && (c === 0 || c === 2))
    || (a === 192 && b === 88 && c === 99)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113);
}

function ipv6Private(address) {
  const normalized = address.toLocaleLowerCase('en-US').split('%')[0];
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('ff') || /^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith('64:ff9b:') || normalized.startsWith('100:')
    || normalized.startsWith('2001:db8:') || normalized.startsWith('2002:')) return true;
  const mappedDotted = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedDotted) return ipv4Private(mappedDotted[1]);
  const mappedHex = normalized.match(/::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const high = Number.parseInt(mappedHex[1], 16);
    const low = Number.parseInt(mappedHex[2], 16);
    return ipv4Private(`${high >>> 8}.${high & 255}.${low >>> 8}.${low & 255}`);
  }
  const compatibleHex = normalized.match(/^::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (compatibleHex) {
    const high = Number.parseInt(compatibleHex[1], 16);
    const low = Number.parseInt(compatibleHex[2], 16);
    return ipv4Private(`${high >>> 8}.${high & 255}.${low >>> 8}.${low & 255}`);
  }
  return false;
}

export function isPrivateBrandAddress(address) {
  const family = net.isIP(address);
  return family === 4 ? ipv4Private(address) : (family === 6 ? ipv6Private(address) : true);
}

function validateUrlShape(url, allowPrivate = process.env.ARCHIFY_BRAND_ALLOW_PRIVATE === '1') {
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('only HTTP(S) brand links are supported');
  if (url.username || url.password) throw new Error('brand links cannot contain credentials');
  const expectedPort = url.protocol === 'https:' ? '443' : '80';
  if (!allowPrivate && url.port && url.port !== expectedPort) {
    throw new Error('brand links must use a standard web port');
  }
  const host = url.hostname.toLocaleLowerCase('en-US').replace(/\.$/, '').replace(/^\[|\]$/g, '');
  if (!allowPrivate && (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local'))) {
    throw new Error('private brand links are not fetched');
  }
  return host;
}

function beforeDeadline(promise, deadline) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return Promise.reject(new Error('brand capture timed out'));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('brand capture timed out')), remaining);
    timer.unref?.();
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

async function resolveRequestTarget(url, deadline) {
  const allowPrivate = process.env.ARCHIFY_BRAND_ALLOW_PRIVATE === '1';
  const host = validateUrlShape(url, allowPrivate);
  const directFamily = net.isIP(host);
  const addresses = directFamily
    ? [{ address: host, family: directFamily }]
    : await beforeDeadline(lookup(host, { all: true, verbatim: true }), deadline);
  if (!addresses.length || (!allowPrivate && addresses.some(({ address }) => isPrivateBrandAddress(address)))) {
    throw new Error('private brand links are not fetched');
  }
  return addresses[0];
}

function timeoutSignal(milliseconds) {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(milliseconds);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), milliseconds);
  timer.unref?.();
  return controller.signal;
}

function captureTimeoutMilliseconds() {
  const configured = Number(process.env.ARCHIFY_BRAND_CAPTURE_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return DEFAULT_CAPTURE_TIMEOUT_MS;
  return Math.max(100, Math.min(30000, Math.round(configured)));
}

function requestPinned(url, accept, target, deadline) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.request(url, {
      method: 'GET',
      signal: timeoutSignal(Math.max(1, Math.min(4500, deadline - Date.now()))),
      headers: { accept, 'accept-encoding': 'identity', 'user-agent': USER_AGENT },
      // Reuse the exact public address that passed validation. This closes the
      // DNS-rebinding gap between checking a hostname and opening its socket.
      lookup(_hostname, options, callback) {
        if (options?.all) callback(null, [target]);
        else callback(null, target.address, target.family);
      },
    }, (response) => {
      const status = response.statusCode || 0;
      resolve({
        status,
        ok: status >= 200 && status < 300,
        headers: {
          get(name) {
            const value = response.headers[String(name).toLocaleLowerCase('en-US')];
            return Array.isArray(value) ? value.join(', ') : (value ?? null);
          },
        },
        body: response,
      });
    });
    request.on('error', reject);
    request.end();
  });
}

async function checkedFetch(input, accept, deadline) {
  let current = new URL(input);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    if (Date.now() >= deadline) throw new Error('brand capture timed out');
    const target = await resolveRequestTarget(current, deadline);
    const response = await requestPinned(current, accept, target, deadline);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      response.body.resume();
      if (!location || redirects === 3) throw new Error('brand link redirected too many times');
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) {
      response.body.resume();
      throw new Error(`brand link returned HTTP ${response.status}`);
    }
    // Raw HTTP responses are not decompressed. Check successful bodies before
    // HTML discovery or image validation so byte limits and digests stay valid.
    const contentEncoding = (response.headers.get('content-encoding') || '').trim().toLowerCase();
    if (contentEncoding && contentEncoding !== 'identity') {
      response.body.destroy();
      throw new Error(`unsupported brand content encoding ${contentEncoding}`);
    }
    return { response, finalUrl: current };
  }
  throw new Error('brand link redirected too many times');
}

async function readLimited(response, maximum) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maximum) {
    response.body?.destroy?.();
    throw new Error('brand asset is too large');
  }
  if (response.body && typeof response.body[Symbol.asyncIterator] === 'function') {
    const chunks = [];
    let total = 0;
    for await (const value of response.body) {
      total += value.byteLength;
      if (total > maximum) {
        response.body.destroy?.();
        throw new Error('brand asset is too large');
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, total);
  }
  if (!response.body?.getReader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maximum) throw new Error('brand asset is too large');
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximum) {
      await reader.cancel();
      throw new Error('brand asset is too large');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

// Read only the bounded head, independent of network chunk boundaries. Scan
// bytes once so many tiny chunks cannot cause repeated concatenation/rescanning.
// Collect link tags in the same pass: markup in comments, raw text, attributes
// or templates must not become an icon candidate or an early head ending.
async function readHtmlHeadLinks(response, maximum, mediaType) {
  const chunks = response.body && typeof response.body[Symbol.asyncIterator] === 'function'
    ? response.body : [await readLimited(response, maximum)];
  const buffer = Buffer.alloc(maximum);
  const links = [];
  let total = 0;
  let tagStart = -1;
  let quote = 0;
  let comment = false;
  let rawClosing = '';
  let matched = 0;
  let templateDepth = 0;
  for await (const value of chunks) {
    const chunk = Buffer.from(value);
    const length = Math.min(chunk.length, maximum - total);
    chunk.copy(buffer, total, 0, length);
    for (let offset = 0; offset < length; offset++) {
      const byte = chunk[offset];
      const position = total + offset;
      if (comment) {
        if (byte === 0x3e && buffer[position - 1] === 0x2d && buffer[position - 2] === 0x2d) comment = false;
        continue;
      }
      if (rawClosing) {
        const lower = byte >= 65 && byte <= 90 ? byte + 32 : byte;
        if (matched === rawClosing.length && [9, 10, 12, 13, 32, 47, 62].includes(byte)) {
          tagStart = position - matched;
          rawClosing = '';
          matched = 0;
        } else {
          matched = lower === rawClosing.charCodeAt(matched) ? matched + 1 : (byte === 0x3c ? 1 : 0);
          continue;
        }
      }
      if (tagStart < 0) {
        if (byte === 0x3c) tagStart = position;
        continue;
      }
      if (position === tagStart + 1 && !((byte >= 65 && byte <= 90) || (byte >= 97 && byte <= 122) || [33, 47, 63].includes(byte))) {
        tagStart = byte === 0x3c ? position : -1;
        continue;
      }
      if (position === tagStart + 3 && buffer[tagStart + 1] === 0x21 && buffer[tagStart + 2] === 0x2d && byte === 0x2d) {
        comment = true;
        tagStart = -1;
        continue;
      }
      if (quote) {
        if (byte === quote) quote = 0;
        continue;
      }
      if (byte === 0x22 || byte === 0x27) {
        quote = byte;
        continue;
      }
      if (byte === 0x3e) {
        const tag = buffer.toString('utf8', tagStart, position + 1);
        if (!templateDepth && /^<\/head[\t\n\f\r ]*>$/i.test(tag)) {
          response.body?.destroy?.();
          return links;
        }
        const emptyXhtmlElement = mediaType === 'application/xhtml+xml' && tag.endsWith('/>');
        if (!emptyXhtmlElement && /^<template(?=[\t\n\f\r />])/i.test(tag)) templateDepth += 1;
        else if (/^<\/template(?=[\t\n\f\r />])/i.test(tag)) templateDepth = Math.max(0, templateDepth - 1);
        else if (!templateDepth && /^<link(?=[\t\n\f\r />])/i.test(tag)) links.push(tag);
        const raw = /^<(script|style|title|textarea|xmp|iframe|noembed|noframes)(?=[\t\n\f\r />])/i.exec(tag)
          || (mediaType === 'text/html' && /^<(noscript)(?=[\t\n\f\r />])/i.exec(tag));
        if (raw && !emptyXhtmlElement) rawClosing = `</${raw[1].toLowerCase()}`;
        tagStart = -1;
      }
    }
    total += length;
    if (chunk.length > length) {
      response.body?.destroy?.();
      throw new Error('brand asset is too large');
    }
  }
  return links;
}

function linkAttribute(tag, name) {
  // Consume entire attributes so data-href and quoted examples cannot supply
  // a real href. As in HTML, the first occurrence wins, even when valueless.
  const attributes = tag.slice(5, -1).matchAll(/([^\t\n\f\r />=]+)(?:[\t\n\f\r ]*=[\t\n\f\r ]*(?:"([^"]*)"|'([^']*)'|([^\t\n\f\r >]+)))?/g);
  for (const match of attributes) {
    if (match[1].toLowerCase() === name) return match[2] ?? match[3] ?? match[4] ?? '';
  }
  return '';
}

// HTML numeric references in the C1 range use the legacy Windows-1252 mapping.
// https://html.spec.whatwg.org/multipage/parsing.html#numeric-character-reference-end-state
const HTML_C1_REFERENCES = [
  0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021,
  0x2c6, 0x2030, 0x160, 0x2039, 0x152, 0x8d, 0x17d, 0x8f,
  0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x9d, 0x17e, 0x178,
];
const BASIC_HTML_REFERENCES = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };

function decodeIconHref(value) {
  // Decode only after extracting the attribute, in one pass. Leave percent
  // escapes to URL parsing and do not reinterpret decoded quotes as markup.
  return value.replace(/&#(?:[xX]([0-9a-fA-F]+)|([0-9]+));?|&(amp|AMP|quot|QUOT|lt|LT|gt|GT)(?:;|(?![A-Za-z0-9=]))|&(apos);/g,
    (_match, hex, decimal, named, apostrophe) => {
      if (named || apostrophe) return BASIC_HTML_REFERENCES[(named || apostrophe).toLowerCase()];
      let point = Number.parseInt(hex || decimal, hex ? 16 : 10);
      if (point === 0 || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) return '\uFFFD';
      if (point >= 0x80 && point <= 0x9f) point = HTML_C1_REFERENCES[point - 0x80];
      return String.fromCodePoint(point);
    });
}

function iconCandidates(links, pageUrl) {
  const candidates = [];
  for (const tag of links) {
    const rel = linkAttribute(tag, 'rel').toLocaleLowerCase('en-US').split(/\s+/);
    if (!rel.some((value) => value === 'icon' || value === 'apple-touch-icon' || value === 'mask-icon')) continue;
    const href = decodeIconHref(linkAttribute(tag, 'href'));
    if (!href) continue;
    try {
      const url = new URL(href, pageUrl);
      if (!['https:', 'http:'].includes(url.protocol)) continue;
      const type = linkAttribute(tag, 'type').toLocaleLowerCase('en-US');
      const sizes = linkAttribute(tag, 'sizes');
      const area = [...sizes.matchAll(/(\d+)x(\d+)/gi)]
        .reduce((best, size) => Math.max(best, Number(size[1]) * Number(size[2])), 0);
      const score = (type.includes('svg') || /\.svg(?:$|[?#])/i.test(url.href) ? 1000000 : 0)
        + (rel.includes('apple-touch-icon') ? 500000 : 0)
        + area;
      candidates.push({ url, score });
    } catch {
      // A malformed icon candidate is ignored; the deterministic fallback remains available.
    }
  }
  candidates.sort((left, right) => right.score - left.score);
  const fallback = new URL('/favicon.ico', pageUrl);
  const unique = new Map(candidates.map((candidate) => [candidate.url.href, candidate]));
  unique.delete(fallback.href);
  return [...unique.values()].slice(0, 5).concat({ url: fallback, score: -1 });
}

function validIcoImageRanges(buffer) {
  if (buffer.length < 6 || buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) return false;
  const count = buffer.readUInt16LE(4);
  const directoryEnd = 6 + count * 16;
  if (count === 0 || directoryEnd > buffer.length) return false;
  for (let index = 0; index < count; index += 1) {
    const entry = 6 + index * 16;
    const size = buffer.readUInt32LE(entry + 8);
    const offset = buffer.readUInt32LE(entry + 12);
    if (size === 0 || offset < directoryEnd || offset + size > buffer.length) return false;
  }
  return true;
}

async function imageData(response) {
  const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLocaleLowerCase('en-US');
  const allowed = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/x-icon',
    'image/vnd.microsoft.icon',
  ]);
  if (!allowed.has(contentType)) {
    response.body?.destroy?.();
    throw new Error(`unsupported brand image type ${contentType || 'unknown'}`);
  }
  const buffer = await readLimited(response, MAX_IMAGE_BYTES);
  const signatureMatches = contentType === 'image/png'
    ? buffer.length >= 45
      && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      && buffer.readUInt32BE(8) === 13
      && buffer.toString('ascii', 12, 16) === 'IHDR'
      && buffer.readUInt32BE(16) > 0
      && buffer.readUInt32BE(20) > 0
      && buffer.toString('ascii', buffer.length - 8, buffer.length - 4) === 'IEND'
    : (contentType === 'image/jpeg'
      ? buffer.length >= 20
        && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
        && buffer.at(-2) === 0xff && buffer.at(-1) === 0xd9
      : (contentType === 'image/webp'
        ? buffer.length >= 16
          && buffer.toString('ascii', 0, 4) === 'RIFF'
          && buffer.toString('ascii', 8, 12) === 'WEBP'
          && buffer.readUInt32LE(4) + 8 <= buffer.length
        : validIcoImageRanges(buffer)));
  if (!signatureMatches) throw new Error(`brand asset bytes do not match ${contentType}`);
  return {
    dataUrl: `data:${contentType};base64,${buffer.toString('base64')}`,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    contentType,
  };
}

async function captureRemoteBrand(value, deadline = Date.now() + captureTimeoutMilliseconds()) {
  const sourceUrl = new URL(value);
  const publicSourceUrl = normalizeBrandSourceUrl(sourceUrl);
  const fallback = (reason) => ({
    id: sourceUrl.hostname,
    title: sourceUrl.hostname,
    category: 'link',
    kind: 'fallback',
    status: 'unavailable',
    sourceUrl: publicSourceUrl,
    reason,
  });
  try {
    const page = await checkedFetch(sourceUrl, 'text/html,application/xhtml+xml,image/*;q=0.8', deadline);
    const pageType = (page.response.headers.get('content-type') || '').toLocaleLowerCase('en-US');
    if (pageType.startsWith('image/')) {
      const image = await imageData(page.response);
      return {
        id: sourceUrl.hostname,
        title: sourceUrl.hostname,
        category: 'link',
        kind: 'remote',
        status: 'captured',
        sourceUrl: publicSourceUrl,
        resolvedUrl: page.finalUrl.href,
        ...image,
      };
    }
    if (!pageType.includes('text/html') && !pageType.includes('application/xhtml+xml')) {
      page.response.body?.destroy?.();
      return fallback('linked page is not HTML');
    }
    // Distinguish HTML noscript and XHTML empty elements without executing scripts.
    const mediaType = pageType.split(';')[0].trim();
    const links = await readHtmlHeadLinks(page.response, MAX_HTML_BYTES, mediaType);
    const iconErrors = [];
    for (const candidate of iconCandidates(links, page.finalUrl)) {
      try {
        const fetched = await checkedFetch(candidate.url, 'image/*', deadline);
        const image = await imageData(fetched.response);
        return {
          id: sourceUrl.hostname,
          title: sourceUrl.hostname,
          category: 'link',
          kind: 'remote',
          status: 'captured',
          sourceUrl: publicSourceUrl,
          resolvedUrl: fetched.finalUrl.href,
          ...image,
        };
      } catch (error) {
        iconErrors.push(error);
        // Try the next declared favicon before using the generic link mark.
      }
    }
    const usefulError = iconErrors.find((error) => /unsupported brand (?:image type|content encoding)/i.test(error?.message))
      || iconErrors.at(-1);
    return fallback(usefulError?.message || 'no usable site icon was found');
  } catch (error) {
    return fallback(error.message);
  }
}

export async function captureBrandReference(value) {
  const url = asUrl(value);
  if (!url) throw new Error('brand capture requires one HTTP(S) URL');
  validateUrlShape(url);
  const preset = findBrandMark(url.href);
  if (preset) return { brand: preset.id, resolved: { ...preset, kind: 'preset', status: 'preset' } };
  const resolved = await captureRemoteBrand(url.href);
  if (resolved.status !== 'captured' || !resolved.sha256) {
    throw new Error(`brand capture failed: ${resolved.reason || 'no usable site icon was found'}`);
  }
  return {
    brand: { url: url.href, sha256: resolved.sha256 },
    resolved,
  };
}

function remoteBrand(value, cache, deadline) {
  const key = new URL(value).href;
  if (!cache.has(key)) cache.set(key, captureRemoteBrand(key, deadline));
  return cache.get(key);
}

function suggestions(value) {
  const needle = lookupForms(value)[0] || '';
  const packSuggestions = suggestPackIcons(value, 3);
  return [...packSuggestions, ...BRAND_MARKS.map((mark) => ({
    id: mark.id,
    score: lookupForms(mark.id).some((form) => form.includes(needle) || needle.includes(form)) ? 0 : 1,
  })).sort((left, right) => left.score - right.score || left.id.localeCompare(right.id))
    .slice(0, 5)
    .map((entry) => entry.id)].slice(0, 6);
}

async function mapConcurrent(values, limit, visit) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      await visit(values[index], index);
    }
  });
  await Promise.all(workers);
}

function attachPackMark(diagramType, index, node, packIcon) {
  const scope = `ic${createHash('sha256').update(`${diagramType}\0${index}\0${node.id}\0${packIcon.id}`).digest('hex').slice(0, 8)}`;
  const loaded = loadPackIcon(packIcon, scope);
  const resolved = {
    id: packIcon.id,
    title: packIcon.title,
    kind: 'pack',
    placement: placementFor(diagramType),
    pack: packIcon.pack,
    status: 'pack',
    sourceUrl: packSourceUrl(packIcon),
    viewBox: loaded.viewBox,
    markup: loaded.markup,
    line: loaded.line,
    nodeType: node.type,
  };
  node[RESOLVED_MARK] = resolved;
  RESOLVED_BY_NODE.set(node, resolved);
  return resolved;
}

// Built-in and captured marks use the larger gutter layout in architecture
// diagrams, but diagrams written before that keep working: a node too narrow
// for the gutter and a readable label keeps the small corner badge instead of
// failing. Below GUTTER_MIN_WIDTH the label would have under ~100px beside the
// 48px icon and fall under the desktop readability floor.
const GUTTER_MIN_WIDTH = 190;
function keepSmallBadgeWhenTooNarrow(nodes) {
  for (const node of nodes) {
    const mark = brandMarkFor(node);
    if (!mark?.placement || mark.kind === 'pack') continue;
    const width = Array.isArray(node.size) ? node.size[0] : null;
    if (width && (width < GUTTER_MIN_WIDTH || brandTopRailProblem(node, width, 8))) {
      const { placement, ...small } = mark;
      node[RESOLVED_MARK] = small;
      RESOLVED_BY_NODE.set(node, small);
    }
  }
}

// An architecture diagram that already shows Microsoft icons gives every other
// node a generic icon too, so users, API servers and queues are not left bare.
// A node too narrow for its label beside an icon keeps no icon rather than
// failing validation for something the author never asked for.
function inferGenericMarks(diagramType, nodes) {
  if (diagramType !== 'architecture' || !genericIconsEnabled()) return;
  const hasMicrosoftIcon = nodes.some((node) => {
    const mark = brandMarkFor(node);
    return mark?.kind === 'pack' && mark.pack !== 'generic';
  });
  if (!hasMicrosoftIcon) return;
  nodes.forEach((node, index) => {
    if (node.brand || brandMarkFor(node)) return;
    const id = inferGenericIcon(node);
    const icon = id && findPackIcon(id);
    if (!icon || icon.pack !== 'generic') return;
    try {
      attachPackMark(diagramType, index, node, icon);
    } catch {
      return;
    }
    const width = Array.isArray(node.size) ? node.size[0] : null;
    if (width && brandTopRailProblem(node, width, 8)) {
      delete node[RESOLVED_MARK];
      RESOLVED_BY_NODE.delete(node);
    }
  });
}

export async function prepareDiagramBrandMarks(diagramType, diagram) {
  const collection = COLLECTIONS[diagramType];
  const nodes = collection && Array.isArray(diagram[collection]) ? diagram[collection] : [];
  const unknown = [];
  const remoteByUrl = new Map();
  const deadline = Date.now() + captureTimeoutMilliseconds();
  await mapConcurrent(nodes, MAX_CAPTURE_CONCURRENCY, async (node, index) => {
    if (!node.brand) return;
    if (typeof node.brand === 'object') {
      const url = asUrl(node.brand.url);
      const resolved = url ? await remoteBrand(url.href, remoteByUrl, deadline) : null;
      if (!resolved || resolved.status !== 'captured') {
        unknown.push(`/${collection}/${index}/brand could not reproduce the pinned capture: ${resolved?.reason || 'invalid URL'}`);
        return;
      }
      if (resolved.sha256 !== node.brand.sha256) {
        unknown.push(`/${collection}/${index}/brand digest changed: expected ${node.brand.sha256}, received ${resolved.sha256}`);
        return;
      }
      // Architecture marks get the larger gutter layout too, so a PostgreSQL or
      // Qdrant node is not a 16px badge beside 48px Azure icons (D-22). The
      // capture is shared between nodes, so copy before adding placement.
      const placed = diagramType === 'architecture' ? { ...resolved, placement: placementFor(diagramType) } : resolved;
      node[RESOLVED_MARK] = placed;
      RESOLVED_BY_NODE.set(node, placed);
      return;
    }
    const preset = findBrandMark(node.brand);
    if (preset) {
      const resolved = {
        ...preset,
        kind: 'preset',
        status: 'preset',
        sourceUrl: preset.provenance.source,
        ...(diagramType === 'architecture' ? { placement: placementFor(diagramType) } : {}),
      };
      node[RESOLVED_MARK] = resolved;
      RESOLVED_BY_NODE.set(node, resolved);
      return;
    }
    const packIcon = findPackIcon(node.brand);
    if (packIcon) {
      try {
        attachPackMark(diagramType, index, node, packIcon);
      } catch (error) {
        unknown.push(`/${collection}/${index}/brand ${JSON.stringify(node.brand)} icon pack file is unusable: ${error.message}`);
      }
      return;
    }
    const url = asUrl(node.brand);
    if (url) {
      unknown.push(`/${collection}/${index}/brand ${JSON.stringify(node.brand)} is an unpinned URL; capture it first with \`archify brands capture ${url.href} --json\``);
      return;
    }
    unknown.push(`/${collection}/${index}/brand ${JSON.stringify(node.brand)} is not a built-in brand; closest IDs: ${suggestions(node.brand).join(', ')}`);
  });
  if (!unknown.length) {
    keepSmallBadgeWhenTooNarrow(nodes);
    inferGenericMarks(diagramType, nodes);
  }
  if (unknown.length) {
    throwDiagnosticError(`Brand mark validation failed:\n- ${unknown.join('\n- ')}`, unknown.map((message) => ({
      code: message.includes('is an unpinned URL') ? 'brand/unpinned-url'
        : (message.includes('digest changed') ? 'brand/digest-mismatch'
          : (message.includes('could not reproduce') ? 'brand/capture-unavailable' : 'brand/unknown')),
      severity: 'error',
      message,
      subject: { diagramType, collection },
      evidence: {},
      supportedFixes: message.includes('is an unpinned URL')
        ? ['run `archify brands capture <url> --json` and author the returned digest-pinned brand object']
        : ['choose an ID from `archify brands`', 'run `archify brands capture <url> --json` for an unknown official site'],
    })));
  }
}

export function brandMarkFor(node) {
  return node?.[RESOLVED_MARK] || RESOLVED_BY_NODE.get(node) || null;
}

export function brandMetadataFor(node) {
  const mark = brandMarkFor(node);
  return mark ? {
    brand: mark.title,
    brandId: mark.id,
    brandStatus: mark.status,
    brandSource: mark.sourceUrl,
  } : {};
}

// Pack icons are full-colour product art and are drawn larger than the 16px
// single-colour brand badges. Architecture diagrams put the icon in a 48px left
// gutter with the label beside it (DECISIONS.md D-09). The other diagram types
// still use a 24px corner tile. SIMFORM_ICON_VARIANT="<corner|left|top>:<px>"
// overrides the architecture placement, e.g. corner:24 restores the old look.
const BRAND_MARK_SIZE = 16;
const CORNER_PLACEMENT = { position: 'corner', size: 24 };

function placementFor(diagramType) {
  if (diagramType !== 'architecture') return CORNER_PLACEMENT;
  const match = /^(corner|left|top):(\d{2})$/.exec(process.env.SIMFORM_ICON_VARIANT || '');
  if (!match) return { position: 'left', size: 48 };
  return { position: match[1], size: Math.min(64, Math.max(16, Number(match[2]))) };
}

function packPlacement(mark) {
  return mark?.placement || CORNER_PLACEMENT;
}

function markSize(mark) {
  return mark?.placement ? packPlacement(mark).size : BRAND_MARK_SIZE;
}

// Corner: the label is centred, so both sides keep the room the mark needs.
// Left: the mark sits in a gutter and the label is left-aligned beside it.
// Top: the mark is centred above the label, which keeps the full node width.
function railReserve(mark) {
  if (mark?.placement) {
    const { position, size } = packPlacement(mark);
    if (position === 'left') return size + 36;
    if (position === 'top') return 24;
  }
  return 2 * (markSize(mark) + 8);
}

export function brandLabelFitWidth(node, width) {
  const mark = brandMarkFor(node);
  return mark ? Math.max(1, width - railReserve(mark)) : width;
}

export function brandTopRailProblem(node, width, minimumFontSize, subject = 'Node') {
  const mark = brandMarkFor(node);
  if (!mark) return null;
  const available = width - railReserve(mark);
  const required = textUnits(node.label) * minimumFontSize * 0.6;
  if (available >= required) return null;
  return `${subject} "${node.id}" brand top rail leaves ${Math.max(0, available)}px for its label, but `
    + `"${node.label}" needs ~${Math.ceil(required)}px at the ${minimumFontSize}px legible minimum — widen the node or shorten the label.`;
}

function markAttrs(mark) {
  return [
    `data-brand-mark="${esc(mark.id)}"`,
    `data-brand-title="${esc(mark.title)}"`,
    `data-brand-status="${esc(mark.status)}"`,
    mark.pack ? `data-brand-pack="${esc(mark.pack)}"` : '',
    mark.sourceUrl ? `data-brand-source="${esc(mark.sourceUrl)}"` : '',
    mark.sha256 ? `data-brand-sha256="${esc(mark.sha256)}"` : '',
  ].filter(Boolean).join(' ');
}

export function renderBrandMark(node, { x, y, size = 16 } = {}) {
  const mark = brandMarkFor(node);
  if (!mark) return '';
  let inset = 3;
  let content;
  if (mark.placement) {
    // Callers position a 16px badge; keep its right edge and grow leftwards.
    const placedSize = packPlacement(mark).size;
    x -= placedSize - size;
    size = placedSize;
    inset = Math.round(size * 0.22);
  }
  if (mark.kind === 'pack') {
    // Line art (the generic pack) sits smaller in its tile than product art does.
    inset = mark.line ? Math.round(size * (size >= 40 ? 0.25 : 0.18)) : Math.max(2, Math.round(size / 12));
    const inner = size - inset * 2;
    // Fit like preserveAspectRatio="xMidYMid meet": uniform scale, centred, never
    // cropped or distorted (Microsoft's terms forbid altering the artwork). A
    // transform on a <g> keeps the artifact to its single diagram <svg>.
    const [minX, minY, width, height] = mark.viewBox;
    const scale = inner / Math.max(width, height);
    const tx = inset + (inner - width * scale) / 2 - minX * scale;
    const ty = inset + (inner - height * scale) / 2 - minY * scale;
    const round = (value) => Number(value.toFixed(4));
    content = `<g class="brand-mark-pack-art" transform="translate(${round(tx)} ${round(ty)}) scale(${round(scale)})">${mark.markup}</g>`;
  } else if (mark.kind === 'preset') {
    const scale = (size - inset * 2) / mark.viewBox;
    content = `<path d="${esc(mark.path)}" transform="translate(${inset} ${inset}) scale(${scale})" fill="#${esc(mark.hex)}"/>`;
  } else if (mark.kind === 'remote') {
    content = `<image href="${esc(mark.dataUrl)}" x="${inset}" y="${inset}" width="${size - inset * 2}" height="${size - inset * 2}" preserveAspectRatio="xMidYMid meet"/>`;
  } else {
    const scale = size / 20;
    content = `<g transform="scale(${scale})" class="brand-mark-fallback"><circle cx="10" cy="10" r="5.2"/><path d="M4.8 10h10.4M10 4.8c1.6 1.6 2.4 3.3 2.4 5.2s-.8 3.6-2.4 5.2M10 4.8C8.4 6.4 7.6 8.1 7.6 10s.8 3.6 2.4 5.2"/></g>`;
  }
  const markClass = mark.line ? `brand-mark brand-mark-line s-${esc(mark.nodeType || 'backend')}` : 'brand-mark';
  return `<g aria-hidden="true" ${markAttrs(mark)} class="${markClass}" transform="translate(${x} ${y})">
            <rect width="${size}" height="${size}" rx="4" class="brand-mark-badge"/>
            ${content}
            <rect width="${size}" height="${size}" rx="4" class="brand-mark-frame"/>
          </g>`;
}

// Non-corner placement for pack icons. Returns null when the caller should keep
// its own corner layout. `box` is the node rectangle. All geometry is returned so
// a renderer only swaps in coordinates: nothing here alters the artwork.
export function brandPlacement(node, box) {
  const mark = brandMarkFor(node);
  if (!mark || !mark.placement) return null;
  const { position, size } = packPlacement(mark);
  if (position === 'corner') return null;
  const hasSub = Boolean(node.sublabel);
  if (position === 'left') {
    const left = box.x + 12;
    return {
      svg: renderBrandMark(node, { x: left, y: box.y + (box.height - size) / 2, size }),
      textX: left + size + 12,
      anchor: 'start',
      fitWidth: box.width - railReserve(mark),
      labelY: hasSub ? box.y + box.height / 2 - 2 : box.y + box.height / 2 + 4,
      subY: box.y + box.height / 2 + 14,
      sigil: { x: box.x + box.width - 22, y: box.y + 6 },
    };
  }
  const top = box.y + 10;
  const labelY = top + size + 18;
  return {
    svg: renderBrandMark(node, { x: box.x + (box.width - size) / 2, y: top, size }),
    textX: box.x + box.width / 2,
    anchor: 'middle',
    fitWidth: box.width - railReserve(mark),
    labelY,
    subY: labelY + 15,
    sigil: { x: box.x + 6, y: box.y + 6 },
  };
}
