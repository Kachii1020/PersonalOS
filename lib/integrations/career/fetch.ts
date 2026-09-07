import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
import type { IncomingHttpHeaders } from 'node:http';
import ipaddr from 'ipaddr.js';
import { canonicalizeCareerUrl } from '@/lib/career/url';
import { normalizeCareerHtml } from './parse';

export { normalizeCareerHtml } from './parse';

export type CareerFetchResult = {
  kind: 'ok' | 'not_modified' | 'unavailable'; url: string; httpStatus: number | null;
  checkedAt: string; etag: string | null; lastModified: string | null;
  title?: string; text?: string; contentHash?: string; jobPosting?: unknown | null; error?: string;
};
type Options = { etag?: string | null; lastModified?: string | null };
type Address = { address: string; family: number };
type Response = { status: number; headers: IncomingHttpHeaders; body: Buffer };
type Transport = (url: URL, address: Address, headers: Record<string, string>, signal: AbortSignal) => Promise<Response>;
const MAX_BYTES = 2 * 1024 * 1024;

function isGlobalAddress(raw: string): boolean {
  if (!isIP(raw) || raw.includes('%')) return false;
  const parsed = ipaddr.parse(raw);
  if (parsed.kind() === 'ipv4') return parsed.range() === 'unicast';
  const ipv6 = parsed as ipaddr.IPv6;
  // Reject mapped/translated IPv4, transition mechanisms, and special-purpose IPv6.
  return ipv6.range() === 'unicast' && ipv6.match(ipaddr.IPv6.parse('2000::'), 3)
    && !ipv6.match(ipaddr.IPv6.parse('2001::'), 23)
    && !ipv6.match(ipaddr.IPv6.parse('2002::'), 16)
    && !ipv6.match(ipaddr.IPv6.parse('3fff::'), 20);
}

const httpsTransport: Transport = (url, pinned, headers, signal) => new Promise((resolve, reject) => {
  const req = request(url, {
    method: 'GET', headers, signal, agent: false, family: pinned.family,
    // The TLS hostname and Host header still come from url; only DNS is replaced.
    lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family),
  }, (res) => {
    const status = res.statusCode ?? 0;
    if (status !== 200) { res.destroy(); resolve({ status, headers: res.headers, body: Buffer.alloc(0) }); return; }
    if (Number(res.headers['content-length']) > MAX_BYTES) { res.destroy(); reject(new Error('Source exceeds 2 MB')); return; }
    const chunks: Buffer[] = [];
    let bytes = 0;
    res.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_BYTES) { res.destroy(new Error('Source exceeds 2 MB')); return; }
      chunks.push(chunk);
    });
    res.on('end', () => resolve({ status, headers: res.headers, body: Buffer.concat(chunks) }));
    res.on('error', reject);
    res.on('aborted', () => reject(new Error('Source response interrupted')));
  });
  req.on('error', reject);
  req.end();
});

function createFetcher(resolveDns: (hostname: string) => Promise<Address[]>, transport: Transport, timeoutMs = 15_000) {
  return async (raw: string, options: Options = {}): Promise<CareerFetchResult> => {
    const checkedAt = new Date().toISOString();
    let url = raw;
    let httpStatus: number | null = null;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('Source request timed out')); }, timeoutMs);
    });
    try {
      url = canonicalizeCareerUrl(raw);
      for (let hop = 0; hop <= 3; hop++) {
        const target = new URL(url);
        const hostname = target.hostname.replace(/^\[|\]$/g, '');
        const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }]
          : await Promise.race([resolveDns(hostname), timeout]);
        if (!addresses.length || addresses.some(({ address, family }) => !isGlobalAddress(address) || isIP(address) !== family)) {
          throw new Error('Source resolves to a non-public address');
        }
        const headers: Record<string, string> = { Accept: 'text/html, application/xhtml+xml', 'Accept-Encoding': 'identity', 'User-Agent': 'PersonalOS-CareerMonitor/1.0' };
        // Validators belong to the requested resource, not a new redirect target.
        if (hop === 0 && options.etag) headers['If-None-Match'] = options.etag;
        if (hop === 0 && options.lastModified) headers['If-Modified-Since'] = options.lastModified;
        const response = await Promise.race([transport(target, addresses[0], headers, controller.signal), timeout]);
        httpStatus = response.status;
        if ([301, 302, 303, 307, 308].includes(httpStatus)) {
          if (hop === 3 || !response.headers.location) throw new Error('Source redirect limit or missing location');
          url = canonicalizeCareerUrl(new URL(response.headers.location, target).toString());
          continue;
        }
        const metadata = { url, httpStatus, checkedAt, etag: response.headers.etag ?? null, lastModified: response.headers['last-modified'] ?? null };
        if (httpStatus === 304) {
          if (!headers['If-None-Match'] && !headers['If-Modified-Since']) throw new Error('Unexpected unconditional 304');
          return { ...metadata, etag: metadata.etag ?? options.etag ?? null, lastModified: metadata.lastModified ?? options.lastModified ?? null, kind: 'not_modified' };
        }
        if (httpStatus !== 200) throw new Error(`Source HTTP ${httpStatus}`);
        if (response.body.length > MAX_BYTES) throw new Error('Source exceeds 2 MB');
        if (response.headers['content-encoding'] && response.headers['content-encoding'].toLowerCase() !== 'identity') throw new Error('Unsupported source compression');
        const contentType = response.headers['content-type'] ?? '';
        if (!/^(text\/html|application\/xhtml\+xml)(;|$)/i.test(contentType)) throw new Error('Source is not HTML');
        const charset = /charset\s*=\s*["']?([^;\s"']+)/i.exec(contentType)?.[1] ?? 'utf-8';
        const html = new TextDecoder(charset, { fatal: true }).decode(response.body);
        return { ...metadata, kind: 'ok', ...normalizeCareerHtml(html, url) };
      }
      throw new Error('Source redirect limit');
    } catch (error) {
      return { kind: 'unavailable', url, httpStatus, checkedAt, etag: null, lastModified: null, error: error instanceof Error ? error.message : 'Source retrieval failed' };
    } finally { clearTimeout(timer); controller.abort(); }
  };
}

export const fetchCareerSource = createFetcher((hostname) => lookup(hostname, { all: true, verbatim: true }), httpsTransport);

/** Internal deterministic test seam; request input never controls DNS or transport. */
export const careerSourceTest = { createFetcher, isGlobalAddress, httpsTransport };
