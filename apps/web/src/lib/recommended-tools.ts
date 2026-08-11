export interface RedirectStep {
  parameter: string;
  url: string;
}

const REDIRECT_PARAMETERS = [
  'url',
  'u',
  'q',
  'target',
  'redirect',
  'redirect_url',
  'continue',
  'dest',
] as const;

export function unwrapRedirectUrl(input: string): RedirectStep[] {
  const steps: RedirectStep[] = [];
  let current = input.trim();
  for (let depth = 0; depth < 8; depth += 1) {
    const parsed = new URL(current);
    const entry = REDIRECT_PARAMETERS.map((parameter) => ({
      parameter,
      value: parsed.searchParams.get(parameter),
    })).find(({ value }) => value && /^https?:\/\//i.test(value));
    if (!entry?.value || entry.value === current) break;
    current = entry.value;
    steps.push({ parameter: entry.parameter, url: current });
  }
  return steps;
}

export interface IbanResult {
  country: string;
  formatted: string;
  valid: boolean;
}

export function validateIban(input: string): IbanResult {
  const normalized = input.replace(/\s+/g, '').toUpperCase();
  const formatValid = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(normalized);
  const rearranged = `${normalized.slice(4)}${normalized.slice(0, 4)}`;
  let remainder = 0;
  for (const character of rearranged) {
    const digits = /[A-Z]/.test(character)
      ? String(character.charCodeAt(0) - 55)
      : character;
    for (const digit of digits)
      remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return {
    country: normalized.slice(0, 2),
    formatted: normalized.replace(/(.{4})/g, '$1 ').trim(),
    valid: formatValid && remainder === 1,
  };
}

export interface CardResult {
  brand: string;
  formatted: string;
  valid: boolean;
}

export function validateCardNumber(input: string): CardResult {
  const number = input.replace(/[\s-]+/g, '');
  const brand = /^4/.test(number)
    ? 'Visa'
    : /^(5[1-5]|2(?:2[2-9]|[3-6]\d|7[01]|720))/.test(number)
      ? 'Mastercard'
      : /^3[47]/.test(number)
        ? 'American Express'
        : /^62/.test(number)
          ? 'UnionPay'
          : 'Unknown';
  const sum = [...number].reverse().reduce((total, digit, index) => {
    let value = Number(digit);
    if (index % 2 === 1) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    return total + value;
  }, 0);
  return {
    brand,
    formatted: number.replace(/(.{4})/g, '$1 ').trim(),
    valid: /^\d{12,19}$/.test(number) && sum % 10 === 0,
  };
}

export interface PdfSignatureInfo {
  byteRange: number[];
  coversWholeFile: boolean;
  name: string;
  reason: string;
  signedAt: string;
  subFilter: string;
}

function pdfString(source: string, key: string): string {
  return source.match(new RegExp(`\\/${key}\\s*\\(([^)]*)\\)`))?.[1] ?? '';
}

export function inspectPdfSignatures(bytes: Uint8Array): PdfSignatureInfo[] {
  const source = new TextDecoder('latin1').decode(bytes);
  return [
    ...source.matchAll(
      /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g,
    ),
  ].map((match) => {
    const byteRange = match.slice(1).map(Number);
    const nearby = source.slice(
      Math.max(0, match.index - 1500),
      match.index + 1500,
    );
    return {
      byteRange,
      coversWholeFile:
        byteRange[0] === 0 && byteRange[2]! + byteRange[3]! === bytes.length,
      name: pdfString(nearby, 'Name'),
      reason: pdfString(nearby, 'Reason'),
      signedAt: pdfString(nearby, 'M'),
      subFilter: nearby.match(/\/SubFilter\s*\/([^\s/>]+)/)?.[1] ?? '',
    };
  });
}

const LOREM_SENTENCES = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore.',
  'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
] as const;

export function generateLorem(paragraphs: number, sentences: number): string {
  return Array.from({ length: Math.max(1, paragraphs) }, (_, paragraph) =>
    Array.from(
      { length: Math.max(1, sentences) },
      (_, sentence) =>
        LOREM_SENTENCES[
          (paragraph * sentences + sentence) % LOREM_SENTENCES.length
        ],
    ).join(' '),
  ).join('\n\n');
}

export function numericPartOrder(name: string): number {
  return Number(name.match(/\.part(\d+)$/i)?.[1] ?? Number.MAX_SAFE_INTEGER);
}
