import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import type { IncomingMessage } from 'node:http';
import { EventEmitter } from 'node:events';
import { canonicalizeCareerUrl, isOfficialCareerUrl } from '../lib/career/url';
import { careerSourceTest, normalizeCareerHtml } from '../lib/integrations/career/fetch';

const publicAddress = { address: '93.184.216.34', family: 4 };
const ok = (body = '<main><h1>Internship</h1><p>Graduation 2027</p></main>') => ({
  status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, body: Buffer.from(body),
});

test('career URLs preserve job identity and remove only known tracking parameters', () => {
  assert.equal(canonicalizeCareerUrl('https://JOBS.example:443/jobs?utm_source=email&job=42&b=2&a=1#apply'), 'https://jobs.example/jobs?a=1&b=2&job=42');
  for (const raw of ['http://jobs.example', 'https://user:password@jobs.example', 'https://jobs.example:8443']) {
    assert.throws(() => canonicalizeCareerUrl(raw));
  }
});

test('official URL trust requires exact origin and path segment boundary', () => {
  const prefixes = ['https://jobs.example/careers'];
  assert.equal(isOfficialCareerUrl('https://jobs.example/careers/42', prefixes), true);
  for (const url of ['https://jobs.example.evil.test/careers', 'https://evil.test/jobs.example/careers', 'https://jobs.example/careers-other', 'https://jobs.example/careers%2f42', 'https://jobs.example/careers/../private']) {
    assert.equal(isOfficialCareerUrl(url, prefixes), false, url);
  }
  assert.equal(isOfficialCareerUrl('https://jobs.example/?tenant=other', ['https://jobs.example/?tenant=ours']), false);
});

test('reserved, private, mapped, transition, and scoped addresses are never public sources', () => {
  for (const address of ['0.0.0.0', '10.0.0.1', '127.0.0.1', '169.254.169.254', '172.16.0.1', '192.168.1.1', '100.64.0.1', '192.0.2.1', '198.18.0.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '255.255.255.255', '::', '::1', 'fc00::1', 'fe80::1', 'fe80::1%en0', '::ffff:127.0.0.1', '::ffff:8.8.8.8', '64:ff9b::7f00:1', '2001:db8::1', '2002:7f00:1::', '3fff::1', 'ff02::1']) {
    assert.equal(careerSourceTest.isGlobalAddress(address), false, address);
  }
  assert.equal(careerSourceTest.isGlobalAddress(publicAddress.address), true);
  assert.equal(careerSourceTest.isGlobalAddress('2606:4700:4700::1111'), true);
});

test('fetch passes the validated address to transport without a second DNS lookup', async () => {
  let lookups = 0;
  const fetchSource = careerSourceTest.createFetcher(async () => {
    lookups++;
    return [lookups === 1 ? publicAddress : { address: '127.0.0.1', family: 4 }];
  }, async (url, pinned) => {
    assert.equal(url.hostname, 'jobs.example');
    assert.deepEqual(pinned, publicAddress);
    return ok();
  });
  assert.equal((await fetchSource('https://jobs.example')).kind, 'ok');
  assert.equal(lookups, 1);
});

test('HTTPS transport preserves TLS hostname, pins lookup, and bounds declared and streamed bytes', async () => {
  for (const sizeCase of ['normal', 'declared', 'stream']) {
    const mocked = mock.method(https, 'request', ((...args: unknown[]) => {
      assert.equal((args[0] as URL).hostname, 'jobs.example');
      const options = args[1] as https.RequestOptions;
      assert.equal(options.agent, false);
      assert.equal(options.family, 4);
      assert.ok(options.lookup);
      options.lookup('jobs.example', { family: 4 }, (error, address, family) => {
        assert.equal(error, null);
        assert.equal(address, publicAddress.address);
        assert.equal(family, 4);
      });
      const receive = args[2] as (response: IncomingMessage) => void;
      const req = new EventEmitter();
      Object.assign(req, { end() {
        const res = new EventEmitter();
        let destroyed = false;
        Object.assign(res, {
          statusCode: 200, headers: { 'content-type': 'text/html', ...(sizeCase === 'declared' ? { 'content-length': String(2 * 1024 * 1024 + 1) } : {}) },
          destroy(error?: Error) { destroyed = true; if (error) res.emit('error', error); },
        });
        receive(res as IncomingMessage);
        queueMicrotask(() => {
          if (destroyed) return;
          res.emit('data', sizeCase === 'stream' ? Buffer.alloc(2 * 1024 * 1024) : Buffer.from('<main>Posting</main>'));
          if (sizeCase === 'stream') res.emit('data', Buffer.from('!'));
          if (!destroyed) res.emit('end');
        });
      } });
      return req;
    }) as unknown as typeof https.request);
    try {
      const request = careerSourceTest.httpsTransport(new URL('https://jobs.example'), publicAddress, {}, new AbortController().signal);
      if (sizeCase !== 'normal') await assert.rejects(request, /exceeds 2 MB/);
      else assert.equal((await request).body.toString(), '<main>Posting</main>');
    } finally { mocked.mock.restore(); }
  }
});

test('fetch rejects any non-public DNS answer before requesting', async () => {
  let requested = false;
  const fetchSource = careerSourceTest.createFetcher(async () => [publicAddress, { address: '127.0.0.1', family: 4 }], async () => { requested = true; return ok(); });
  assert.equal((await fetchSource('https://jobs.example')).kind, 'unavailable');
  assert.equal(requested, false);
});

test('each redirect revalidates DNS, including a same-host rebinding', async () => {
  let lookups = 0;
  let requests = 0;
  const fetchSource = careerSourceTest.createFetcher(async () => [++lookups === 1 ? publicAddress : { address: '10.0.0.1', family: 4 }], async () => {
    requests++;
    return { status: 302, headers: { location: '/next' }, body: Buffer.alloc(0) };
  });
  assert.equal((await fetchSource('https://jobs.example')).kind, 'unavailable');
  assert.equal(lookups, 2);
  assert.equal(requests, 1);
});

test('redirects to private literal URLs or insecure schemes never reach transport', async () => {
  for (const location of ['https://127.0.0.1/', 'https://[::1]/', 'https://2130706433/', 'https://0x7f000001/', 'http://jobs.example/', 'https://jobs.example:8443/']) {
    let calls = 0;
    const fetchSource = careerSourceTest.createFetcher(async () => [publicAddress], async () => {
      calls++;
      return { status: 302, headers: { location }, body: Buffer.alloc(0) };
    });
    assert.equal((await fetchSource('https://jobs.example')).kind, 'unavailable');
    assert.equal(calls, 1);
  }
});

test('fetch limits redirects to three and applies an overall timeout including DNS', async () => {
  let calls = 0;
  const fetchSource = careerSourceTest.createFetcher(async () => [publicAddress], async () => {
    calls++;
    return { status: 302, headers: { location: '/again' }, body: Buffer.alloc(0) };
  });
  assert.match((await fetchSource('https://jobs.example')).error ?? '', /redirect limit/);
  assert.equal(calls, 4);
  const slow = careerSourceTest.createFetcher(() => new Promise(() => {}), async () => ok(), 10);
  assert.match((await slow('https://jobs.example')).error ?? '', /timed out/);
});

test('conditional checks preserve HTTP metadata and handle 304 without parsing', async () => {
  const fetchSource = careerSourceTest.createFetcher(async () => [publicAddress], async (_url, _address, headers) => {
    assert.equal(headers['If-None-Match'], '"v1"');
    assert.equal(headers['If-Modified-Since'], 'Fri, 01 Jan 2027 00:00:00 GMT');
    return { status: 304, headers: { etag: '"v1"' }, body: Buffer.alloc(0) };
  });
  const result = await fetchSource('https://jobs.example', { etag: '"v1"', lastModified: 'Fri, 01 Jan 2027 00:00:00 GMT' });
  assert.equal(result.kind, 'not_modified');
  assert.equal(result.httpStatus, 304);
  assert.equal(result.etag, '"v1"');
  assert.equal(result.text, undefined);
});

test('conditional validators are not forwarded to a different redirect resource', async () => {
  let calls = 0;
  const fetchSource = careerSourceTest.createFetcher(async () => [publicAddress], async (_url, _address, headers) => {
    if (++calls === 1) return { status: 302, headers: { location: 'https://other.example/new-job' }, body: Buffer.alloc(0) };
    assert.equal(headers['If-None-Match'], undefined);
    return { status: 304, headers: {}, body: Buffer.alloc(0) };
  });
  assert.match((await fetchSource('https://jobs.example', { etag: '"old-resource"' })).error ?? '', /unconditional 304/);
});

test('overall timeout aborts an in-flight HTTPS request', async () => {
  let requestSignal: AbortSignal | undefined;
  const fetchSource = careerSourceTest.createFetcher(async () => [publicAddress], async (_url, _address, _headers, signal) => {
    requestSignal = signal;
    return new Promise(() => {});
  }, 10);
  assert.match((await fetchSource('https://jobs.example')).error ?? '', /timed out/);
  assert.equal(requestSignal?.aborted, true);
});

test('unavailable statuses, network errors, oversized or compressed bodies and non-HTML are explicit failures', async () => {
  for (const status of [403, 404, 410, 429, 500]) {
    const fetchSource = careerSourceTest.createFetcher(async () => [publicAddress], async () => ({ status, headers: {}, body: Buffer.alloc(0) }));
    const result = await fetchSource('https://jobs.example');
    assert.equal(result.kind, 'unavailable');
    assert.equal(result.httpStatus, status);
  }
  for (const response of [
    { ...ok(), body: Buffer.alloc(2 * 1024 * 1024 + 1) },
    { ...ok(), headers: { 'content-type': 'text/html', 'content-encoding': 'gzip' } },
    { ...ok(), headers: { 'content-type': 'application/pdf' } },
  ]) {
    const fetchSource = careerSourceTest.createFetcher(async () => [publicAddress], async () => response);
    assert.equal((await fetchSource('https://jobs.example')).kind, 'unavailable');
  }
  const failed = careerSourceTest.createFetcher(async () => { throw new Error('DNS unavailable'); }, async () => ok());
  assert.match((await failed('https://jobs.example')).error ?? '', /DNS unavailable/);
});

test('semantic hashes ignore navigation/footer/scripts and whitespace but detect eligibility or deadline changes', () => {
  const page = (year: string, date: string, chrome: string, gap = ' ') => `<nav>${chrome}</nav><main><h1>Internship</h1><p>Graduation${gap}${year}</p><p>Deadline: ${date}</p></main><footer>${chrome}</footer><script>tracking('${chrome}')</script>`;
  const first = normalizeCareerHtml(page('2027', '2027-01-01', 'A'), 'https://jobs.example');
  const second = normalizeCareerHtml(page('2027', '2027-01-01', 'B', '\n  '), 'https://jobs.example');
  assert.equal(first.contentHash, second.contentHash);
  assert.notEqual(first.contentHash, normalizeCareerHtml(page('2028', '2027-01-01', 'A'), 'https://jobs.example').contentHash);
  assert.notEqual(first.contentHash, normalizeCareerHtml(page('2027', '2027-02-01', 'A'), 'https://jobs.example').contentHash);
  assert.doesNotMatch(first.text, /tracking/);
});

test('JobPosting graph extraction retains structured requirements with stable key order', () => {
  const page = (posting: object) => `<script type="application/ld+json">${JSON.stringify({ '@graph': [{ '@type': 'WebSite' }, posting] })}</script>`;
  const first = normalizeCareerHtml(page({ '@type': 'JobPosting', title: 'Intern', description: '<p>Graduate 2027</p>', validThrough: '2027-01-01' }), 'https://jobs.example');
  const second = normalizeCareerHtml(page({ validThrough: '2027-01-01', description: '<div> Graduate   2027 </div>', title: 'Intern', '@type': 'JobPosting' }), 'https://jobs.example');
  assert.equal(first.contentHash, second.contentHash);
  assert.ok(first.jobPosting);
  assert.match(first.text, /Graduate 2027/);
  assert.notEqual(first.contentHash, normalizeCareerHtml(page({ '@type': 'JobPosting', title: 'Intern', description: 'Graduate 2028', validThrough: '2027-01-01' }), 'https://jobs.example').contentHash);
});
