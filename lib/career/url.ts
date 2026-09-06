/** Canonical public source identity; query parameters may identify a specific job. */
export function canonicalizeCareerUrl(raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
    throw new Error('Career sources require HTTPS without credentials on port 443');
  }
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_.+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid)$/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.toString();
}

export function isOfficialCareerUrl(raw: string, prefixes: string[]): boolean {
  try {
    const target = new URL(canonicalizeCareerUrl(raw));
    return prefixes.some((rawPrefix) => {
      try {
        const prefix = new URL(canonicalizeCareerUrl(rawPrefix));
        const path = prefix.pathname.replace(/\/+$/, '');
        return target.origin === prefix.origin
          && (target.pathname === path || target.pathname.startsWith(`${path}/`))
          && [...prefix.searchParams].every(([key, value]) => target.searchParams.getAll(key).includes(value));
      } catch { return false; }
    });
  } catch { return false; }
}
