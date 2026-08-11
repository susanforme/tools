import { inflateSync, strFromU8 } from 'fflate';

function decodeBase64(value: string): Uint8Array {
  const normalized = value
    .replace(/ /g, '+')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/\s+/g, '');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function samlPayload(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith('<')) return trimmed;
  try {
    const url = new URL(trimmed);
    return (
      url.searchParams.get('SAMLRequest') ??
      url.searchParams.get('SAMLResponse') ??
      trimmed
    );
  } catch {
    const params = new URLSearchParams(trimmed.replace(/^\?/, ''));
    return params.get('SAMLRequest') ?? params.get('SAMLResponse') ?? trimmed;
  }
}

function xmlText(xml: string, localName: string): string | null {
  return (
    xml
      .match(
        new RegExp(
          `<(?:[\\w.-]+:)?${localName}\\b[^>]*>([^<]*)<\\/(?:[\\w.-]+:)?${localName}>`,
          'i',
        ),
      )?.[1]
      ?.trim() ?? null
  );
}

function xmlAttribute(xml: string, name: string): string | null {
  return xml.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'))?.[1] ?? null;
}

export type SamlInspection = {
  xml: string;
  root: string;
  issuer: string | null;
  destination: string | null;
  audience: string | null;
  nameId: string | null;
  notBefore: string | null;
  notOnOrAfter: string | null;
  statusCode: string | null;
  assertions: number;
  signaturePresent: boolean;
  encrypted: boolean;
};

export function inspectSaml(input: string): SamlInspection {
  const payload = samlPayload(input);
  let xml = payload;
  if (!payload.startsWith('<')) {
    const bytes = decodeBase64(payload);
    xml = strFromU8(bytes);
    if (!xml.trimStart().startsWith('<')) xml = strFromU8(inflateSync(bytes));
  }
  const root = xml.match(/<(?:[\w.-]+:)?([A-Za-z][\w.-]*)\b/)?.[1] ?? '';
  if (!root || !xml.includes(`</`)) throw new Error('INVALID_SAML_XML');
  return {
    xml,
    root,
    issuer: xmlText(xml, 'Issuer'),
    destination: xmlAttribute(xml, 'Destination'),
    audience: xmlText(xml, 'Audience'),
    nameId: xmlText(xml, 'NameID'),
    notBefore: xmlAttribute(xml, 'NotBefore'),
    notOnOrAfter: xmlAttribute(xml, 'NotOnOrAfter'),
    statusCode:
      xml.match(/<(?:[\w.-]+:)?StatusCode\b[^>]*\bValue=["']([^"']+)/i)?.[1] ??
      null,
    assertions: xml.match(/<(?:[\w.-]+:)?Assertion\b/gi)?.length ?? 0,
    signaturePresent: /<(?:[\w.-]+:)?Signature\b/i.test(xml),
    encrypted: /<(?:[\w.-]+:)?EncryptedAssertion\b/i.test(xml),
  };
}

function attributeList(value: string): Record<string, string> {
  return Object.fromEntries(
    (value.match(/(?:[^,"]|"[^"]*")+/g) ?? []).map((part) => {
      const index = part.indexOf('=');
      const key = part.slice(0, index).trim();
      const raw = part.slice(index + 1).trim();
      return [key, raw.replace(/^"|"$/g, '')];
    }),
  );
}

function xmlAttributes(value: string): Record<string, string> {
  return Object.fromEntries(
    [...value.matchAll(/([\w:.-]+)\s*=\s*["']([^"']*)["']/g)].map((match) => [
      match[1]!,
      match[2]!,
    ]),
  );
}

export type ManifestInspection = {
  kind: 'hls' | 'dash';
  variants: Array<{
    uri: string;
    bandwidth: number | null;
    resolution: string | null;
    codecs: string | null;
    frameRate: number | null;
  }>;
  segments: number;
  durationSeconds: number | null;
  audioTracks: number;
  subtitleTracks: number;
  encrypted: boolean;
  issues: string[];
};

export function inspectStreamingManifest(input: string): ManifestInspection {
  const text = input.trim();
  if (text.startsWith('#EXTM3U')) {
    const lines = text.split(/\r?\n/).map((line) => line.trim());
    const variants: ManifestInspection['variants'] = [];
    const issues: string[] = [];
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]!;
      if (!line.startsWith('#EXT-X-STREAM-INF:')) continue;
      const attributes = attributeList(line.slice(line.indexOf(':') + 1));
      const uri =
        lines.slice(index + 1).find((item) => item && !item.startsWith('#')) ??
        '';
      if (!attributes.BANDWIDTH) issues.push('VARIANT_WITHOUT_BANDWIDTH');
      if (!uri) issues.push('VARIANT_WITHOUT_URI');
      variants.push({
        uri,
        bandwidth: attributes.BANDWIDTH ? Number(attributes.BANDWIDTH) : null,
        resolution: attributes.RESOLUTION ?? null,
        codecs: attributes.CODECS ?? null,
        frameRate: attributes['FRAME-RATE']
          ? Number(attributes['FRAME-RATE'])
          : null,
      });
    }
    const durations = lines
      .filter((line) => line.startsWith('#EXTINF:'))
      .map((line) => Number(line.slice(8).split(',')[0]));
    return {
      kind: 'hls',
      variants,
      segments: durations.length,
      durationSeconds: durations.length
        ? durations.reduce((sum, value) => sum + value, 0)
        : null,
      audioTracks: lines.filter((line) =>
        /#EXT-X-MEDIA:.*TYPE=AUDIO/.test(line),
      ).length,
      subtitleTracks: lines.filter((line) =>
        /#EXT-X-MEDIA:.*TYPE=SUBTITLES/.test(line),
      ).length,
      encrypted: lines.some((line) =>
        /#EXT-X-KEY:.*METHOD=(?!NONE)/.test(line),
      ),
      issues,
    };
  }

  if (/<(?:\w+:)?MPD\b/i.test(text)) {
    const variants = [
      ...text.matchAll(/<(?:\w+:)?Representation\b([^>]*)>/gi),
    ].map((match) => {
      const attributes = xmlAttributes(match[1]!);
      const width = attributes.width;
      const height = attributes.height;
      return {
        uri: attributes.id ?? '',
        bandwidth: attributes.bandwidth ? Number(attributes.bandwidth) : null,
        resolution: width && height ? `${width}x${height}` : null,
        codecs: attributes.codecs ?? null,
        frameRate: attributes.frameRate
          ? Number(attributes.frameRate.split('/')[0]) /
            Number(attributes.frameRate.split('/')[1] ?? 1)
          : null,
      };
    });
    return {
      kind: 'dash',
      variants,
      segments: (text.match(/<(?:\w+:)?S\b/gi) ?? []).length,
      durationSeconds: null,
      audioTracks: (
        text.match(
          /<(?:\w+:)?AdaptationSet\b[^>]*(?:audio|mimeType=["']audio)/gi,
        ) ?? []
      ).length,
      subtitleTracks: (
        text.match(/<(?:\w+:)?AdaptationSet\b[^>]*(?:text|subtitle)/gi) ?? []
      ).length,
      encrypted: /<(?:\w+:)?ContentProtection\b/i.test(text),
      issues: variants.some((variant) => variant.bandwidth === null)
        ? ['REPRESENTATION_WITHOUT_BANDWIDTH']
        : [],
    };
  }
  throw new Error('UNSUPPORTED_STREAMING_MANIFEST');
}

export type CssSpecificity = readonly [
  ids: number,
  classes: number,
  types: number,
];

function addSpecificity(
  left: CssSpecificity,
  right: CssSpecificity,
): CssSpecificity {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function compareTuple(left: CssSpecificity, right: CssSpecificity): number {
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}

function splitSelectors(value: string): string[] {
  let depth = 0;
  let start = 0;
  const result: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '(' || value[index] === '[') depth += 1;
    if (value[index] === ')' || value[index] === ']') depth -= 1;
    if (value[index] === ',' && depth === 0) {
      result.push(value.slice(start, index));
      start = index + 1;
    }
  }
  result.push(value.slice(start));
  return result.filter((item) => item.trim());
}

function extractFunction(
  value: string,
): { before: string; name: string; body: string; after: string } | null {
  const match = /:(where|is|not|has)\(/i.exec(value);
  if (!match) return null;
  const open = match.index + match[0].length - 1;
  let depth = 1;
  for (let index = open + 1; index < value.length; index += 1) {
    if (value[index] === '(') depth += 1;
    if (value[index] === ')') depth -= 1;
    if (depth === 0)
      return {
        before: value.slice(0, match.index),
        name: match[1]!.toLowerCase(),
        body: value.slice(open + 1, index),
        after: value.slice(index + 1),
      };
  }
  throw new Error('INVALID_CSS_SELECTOR');
}

export function calculateCssSpecificity(selector: string): CssSpecificity {
  let working = selector.trim();
  if (!working) throw new Error('EMPTY_CSS_SELECTOR');
  let nested: CssSpecificity = [0, 0, 0];
  let functional = extractFunction(working);
  while (functional) {
    if (functional.name !== 'where') {
      const maximum = splitSelectors(functional.body)
        .map(calculateCssSpecificity)
        .sort((left, right) => compareTuple(right, left))[0] ?? [0, 0, 0];
      nested = addSpecificity(nested, maximum);
    }
    working = `${functional.before}${functional.after}`;
    functional = extractFunction(working);
  }
  const attributes = working.match(/\[[^\]]+\]/g)?.length ?? 0;
  working = working.replace(/\[[^\]]+\]/g, '');
  const ids = working.match(/#[\w-]+/g)?.length ?? 0;
  const classes = working.match(/\.[\w-]+/g)?.length ?? 0;
  const pseudoElements =
    working.match(/::[\w-]+|:(?:before|after|first-line|first-letter)\b/gi)
      ?.length ?? 0;
  const pseudoClasses =
    working
      .match(/:(?!:)[\w-]+(?:\([^)]*\))?/g)
      ?.filter(
        (value) => !/^:(?:before|after|first-line|first-letter)/i.test(value),
      ).length ?? 0;
  const stripped = working
    .replace(/#[\w-]+|\.[\w-]+|::?[\w-]+(?:\([^)]*\))?/g, ' ')
    .replace(/[>*+~|]/g, ' ')
    .replace(/\*/g, ' ');
  const types = stripped.match(/(?:^|\s)([a-z][\w-]*)/gi)?.length ?? 0;
  return addSpecificity(nested, [
    ids,
    attributes + classes + pseudoClasses,
    types + pseudoElements,
  ]);
}

export function compareCssSelectors(left: string, right: string) {
  const leftSpecificity = calculateCssSpecificity(left);
  const rightSpecificity = calculateCssSpecificity(right);
  return {
    left: leftSpecificity,
    right: rightSpecificity,
    winner: Math.sign(compareTuple(leftSpecificity, rightSpecificity)) as
      | -1
      | 0
      | 1,
  };
}

export function evaluateXPath(xml: string, expression: string): string[] {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error('INVALID_XML');
  const result = document.evaluate(
    expression,
    document,
    (prefix) => document.documentElement.lookupNamespaceURI(prefix),
    XPathResult.ANY_TYPE,
    null,
  );
  if (result.resultType === XPathResult.STRING_TYPE)
    return [result.stringValue];
  if (result.resultType === XPathResult.NUMBER_TYPE)
    return [String(result.numberValue)];
  if (result.resultType === XPathResult.BOOLEAN_TYPE)
    return [String(result.booleanValue)];
  const values: string[] = [];
  let node = result.iterateNext();
  while (node && values.length < 200) {
    values.push(
      node.nodeType === Node.ATTRIBUTE_NODE || node.nodeType === Node.TEXT_NODE
        ? (node.nodeValue ?? '')
        : new XMLSerializer().serializeToString(node),
    );
    node = result.iterateNext();
  }
  return values;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

export function buildGraphqlRequest({
  endpoint,
  query,
  variables,
  operationName,
  bearerToken,
}: {
  endpoint: string;
  query: string;
  variables: string;
  operationName: string;
  bearerToken: string;
}) {
  const url = new URL(endpoint);
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('INVALID_GRAPHQL_ENDPOINT');
  if (!query.trim()) throw new Error('EMPTY_GRAPHQL_QUERY');
  const parsedVariables: unknown = variables.trim()
    ? JSON.parse(variables)
    : {};
  if (
    !parsedVariables ||
    Array.isArray(parsedVariables) ||
    typeof parsedVariables !== 'object'
  )
    throw new Error('INVALID_GRAPHQL_VARIABLES');
  const body = JSON.stringify({
    query,
    variables: parsedVariables,
    ...(operationName.trim() ? { operationName: operationName.trim() } : {}),
  });
  const headers = {
    'Content-Type': 'application/json',
    ...(bearerToken.trim()
      ? { Authorization: `Bearer ${bearerToken.trim()}` }
      : {}),
  };
  const curl = [
    `curl ${shellQuote(url.toString())}`,
    `-H ${shellQuote('Content-Type: application/json')}`,
    ...(headers.Authorization
      ? [`-H ${shellQuote(`Authorization: ${headers.Authorization}`)}`]
      : []),
    `--data-raw ${shellQuote(body)}`,
  ].join(' \\\n  ');
  return { url: url.toString(), headers, body: JSON.parse(body), curl };
}

export function parseKubernetesQuantity(value: string, kind: 'cpu' | 'memory') {
  const trimmed = value.trim();
  if (kind === 'cpu') {
    const match = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)(m|u|n)?$/);
    if (!match) throw new Error('INVALID_KUBERNETES_CPU');
    const factor = { m: 1e-3, u: 1e-6, n: 1e-9 }[match[2] ?? ''] ?? 1;
    const cores = Number(match[1]) * factor;
    return { cores, millicores: cores * 1000 };
  }
  const match = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)([KMGTPE]i?|)?$/i);
  if (!match) throw new Error('INVALID_KUBERNETES_MEMORY');
  const suffix = match[2] ?? '';
  const powers = ['', 'K', 'M', 'G', 'T', 'P', 'E'];
  const power = powers.indexOf(suffix.replace(/i$/i, '').toUpperCase());
  const bytes =
    Number(match[1]) * (suffix.endsWith('i') ? 1024 : 1000) ** power;
  return { bytes, mebibytes: bytes / 1024 ** 2, gibibytes: bytes / 1024 ** 3 };
}
