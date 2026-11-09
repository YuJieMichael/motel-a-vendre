// Google Ads conversion endpoints for the configured Canadian campaigns.
export function withGoogleAdsCsp(policy, config) {
 if (!/^AW-\d+$/.test(config?.tagId || '') ||
     ![config.buyer, config.seller].every(label => /^[A-Za-z0-9_-]+$/.test(label || ''))) return policy;
 const tag = 'https://www.googletagmanager.com';
 const script = [tag, 'https://www.googleadservices.com', 'https://www.google.com'];
 const image = [...script, 'https://www.google.ca', 'https://googleads.g.doubleclick.net', 'https://pagead2.googlesyndication.com'];
 const directives = [
  ['script-src', script],
  ['img-src', image],
  ['connect-src', [...image, 'https://ad.doubleclick.net']],
  ['frame-src', [tag]],
 ];
 for (const [name, sources] of directives) {
  const match = new RegExp('(?:^|;\\s*)' + name + ' [^;]+');
  const extra = ' ' + sources.join(' ');
  policy = match.test(policy) ? policy.replace(match, directive => directive + extra) : policy + '; ' + name + extra;
 }
 return policy;
}
