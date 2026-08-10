export type OgMeta = {
  title: string;
  description: string;
  image: string;
  url: string;
  siteName: string;
  type: string;
  twitterCard: string;
  favicon: string;
};

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function readMeta(
  html: string,
  names: string[],
): string {
  for (const name of names) {
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["'][^>]*>`,
        'i',
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${name}["'][^>]*>`,
        'i',
      ),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return decodeEntities(match[1]);
    }
  }
  return '';
}

export function parseOgMeta(html: string): OgMeta {
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  const favicon =
    html.match(
      /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["'][^>]*>/i,
    )?.[1] ??
    html.match(
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["'][^>]*>/i,
    )?.[1] ??
    '';

  return {
    title:
      readMeta(html, ['og:title', 'twitter:title']) ||
      decodeEntities(titleTag.trim()),
    description: readMeta(html, [
      'og:description',
      'twitter:description',
      'description',
    ]),
    image: readMeta(html, ['og:image', 'twitter:image']),
    url: readMeta(html, ['og:url']),
    siteName: readMeta(html, ['og:site_name']),
    type: readMeta(html, ['og:type']) || 'website',
    twitterCard: readMeta(html, ['twitter:card']) || 'summary',
    favicon,
  };
}
