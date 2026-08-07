export type ParsedEmailHeaders = {
  fields: Record<string, string[]>;
  subject: string;
  from: string;
  to: string;
  received: Array<{ value: string; date: string; delayMs: number | null }>;
  authentication: { spf: string[]; dkim: string[]; dmarc: string[] };
};

function decodeWord(charset: string, encoding: string, value: string): string {
  const bytes =
    encoding.toUpperCase() === 'B'
      ? Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
      : Uint8Array.from(
          value
            .replace(/_/g, ' ')
            .replace(/=([0-9A-F]{2})/gi, (_, hex: string) =>
              String.fromCharCode(parseInt(hex, 16)),
            ),
          (character) => character.charCodeAt(0),
        );
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
}

export function decodeMimeWords(value: string): string {
  return value.replace(
    /=\?([^?]+)\?([bq])\?([^?]+)\?=/gi,
    (_, charset: string, encoding: string, content: string) =>
      decodeWord(charset, encoding, content),
  );
}

export function parseEmailHeaders(source: string): ParsedEmailHeaders {
  const unfolded = source.replace(/\r?\n[ \t]+/g, ' ');
  const fields: Record<string, string[]> = {};
  unfolded.split(/\r?\n/).forEach((line) => {
    const separator = line.indexOf(':');
    if (separator <= 0) return;
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = decodeMimeWords(line.slice(separator + 1).trim());
    (fields[name] ??= []).push(value);
  });
  const receivedValues = fields.received ?? [];
  const timestamps = receivedValues.map((value) => {
    const candidate = value.slice(value.lastIndexOf(';') + 1).trim();
    const timestamp = Date.parse(candidate);
    return Number.isFinite(timestamp) ? timestamp : null;
  });
  const received = receivedValues.map((value, index) => ({
    value,
    date: timestamps[index] ? new Date(timestamps[index]).toISOString() : '',
    delayMs:
      timestamps[index] !== null && timestamps[index + 1] !== null
        ? Math.max((timestamps[index] ?? 0) - (timestamps[index + 1] ?? 0), 0)
        : null,
  }));
  const auth = [
    ...(fields['authentication-results'] ?? []),
    ...(fields['received-spf'] ?? []),
  ];
  return {
    fields,
    subject: fields.subject?.[0] ?? '',
    from: fields.from?.[0] ?? '',
    to: fields.to?.[0] ?? '',
    received,
    authentication: {
      spf: auth.filter((value) => /spf=/i.test(value)),
      dkim: auth.filter((value) => /dkim=/i.test(value)),
      dmarc: auth.filter((value) => /dmarc=/i.test(value)),
    },
  };
}
