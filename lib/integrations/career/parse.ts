import { createHash } from 'node:crypto';
import { load } from 'cheerio';

const clean = (value: string) => value.replace(/\s+/gu, ' ').trim();

function findJob(value: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 20 || !value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) { const job = findJob(item, depth + 1); if (job) return job; }
    return null;
  }
  const object = value as Record<string, unknown>;
  if ([object['@type']].flat().includes('JobPosting')) return object;
  return findJob(object['@graph'], depth + 1) ?? findJob(object.mainEntity, depth + 1);
}

function semanticJson(value: unknown): unknown {
  if (typeof value === 'string') return clean(load(value).text());
  if (Array.isArray(value)) return value.map(semanticJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !['@context', '@id', 'url', 'identifier'].includes(key))
      .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, semanticJson(item)]));
  }
  return value;
}

export function normalizeCareerHtml(html: string, _url: string): {
  title: string; text: string; contentHash: string; jobPosting: unknown | null;
} {
  void _url; // Source identity is stored separately; it is not semantic posting content.
  const $ = load(html);
  let jobPosting: Record<string, unknown> | null = null;
  $('script[type="application/ld+json"]').each((_index, element) => {
    if (jobPosting) return;
    try { jobPosting = findJob(JSON.parse($(element).text())); }
    catch { /* Malformed third-party JSON-LD is not evidence; visible text remains available. */ }
  });
  $('script, style, nav, footer, aside, noscript, template, [hidden], [aria-hidden="true"], [role="navigation"], [role="contentinfo"], [role="banner"]').remove();
  $('header').filter((_index, element) => $(element).parents('main, article').length === 0).remove();
  const region = $('main').first().length ? $('main').first() : $('article').first().length ? $('article').first() : $('body');
  const jobTitle = (jobPosting as Record<string, unknown> | null)?.title;
  const title = clean(region.find('h1').first().text() || (typeof jobTitle === 'string' ? jobTitle : '') || $('title').text());
  region.find('p, div, li, br, h1, h2, h3, h4, tr, section, article').each((_index, element) => {
    $(element).prepend(' ').append(' ');
  });
  const visible = clean(region.text());
  const structured = jobPosting ? JSON.stringify(semanticJson(jobPosting)) : '';
  const text = [visible, structured].filter(Boolean).join('\n');
  if (!text) throw new Error('Source contains no readable posting text');
  return { title, text, contentHash: createHash('sha256').update(`${title}\n${text}`).digest('hex'), jobPosting };
}
