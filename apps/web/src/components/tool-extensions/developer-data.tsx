import { extractOpenApiEndpoints, isRecord } from '@/lib/developer-tools';
import { parseHar } from '@/lib/har';
import { unzipTraceEntries } from '@/lib/playwright-trace';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Papa from 'papaparse';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

function TextResult({ value, error }: { value: string; error: string | null }) {
  return (
    <>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {value && (
        <Textarea
          readOnly
          className="min-h-56 font-mono text-xs"
          value={value}
        />
      )}
    </>
  );
}

export function ResponseValidator() {
  const { t } = useTranslation();
  const [spec, setSpec] = useState('');
  const [body, setBody] = useState('');
  const [endpointId, setEndpointId] = useState('');
  const [status, setStatus] = useState('200');
  const [result, setResult] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function validate() {
    setError(null);
    setResult('');
    try {
      const parsed: unknown = spec.trim().startsWith('{')
        ? JSON.parse(spec)
        : (await import('js-yaml')).load(spec);
      if (!isRecord(parsed)) throw new Error(t('newTools.invalidSpec'));
      const endpoint =
        extractOpenApiEndpoints(parsed).find(
          (item) => item.id === endpointId,
        ) ?? extractOpenApiEndpoints(parsed)[0];
      if (!endpoint || !isRecord(endpoint.operation.responses))
        throw new Error(t('newTools.noResponseSchema'));
      const responses = endpoint.operation.responses;
      const raw = responses[status];
      const resolve = (value: unknown): unknown => {
        if (
          !isRecord(value) ||
          typeof value.$ref !== 'string' ||
          !value.$ref.startsWith('#/')
        )
          return value;
        return value.$ref
          .slice(2)
          .split('/')
          .reduce<unknown>(
            (current, part) =>
              isRecord(current)
                ? current[part.replaceAll('~1', '/').replaceAll('~0', '~')]
                : null,
            parsed,
          );
      };
      const response = resolve(raw);
      const media =
        isRecord(response) && isRecord(response.content)
          ? response.content['application/json']
          : null;
      if (!isRecord(media) || !isRecord(media.schema))
        throw new Error(t('newTools.noResponseSchema'));
      const Ajv = (await import('ajv/dist/2020')).default;
      const schema = { ...media.schema, components: parsed.components ?? {} };
      const check = new Ajv({ allErrors: true, strict: false }).compile(schema);
      const valid = check(JSON.parse(body));
      setResult(
        valid
          ? t('newTools.valid')
          : JSON.stringify(check.errors ?? [], null, 2),
      );
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  const ids = (() => {
    try {
      const value = spec.trim().startsWith('{')
        ? (JSON.parse(spec) as unknown)
        : null;
      return extractOpenApiEndpoints(value).map((item) => item.id);
    } catch {
      return [];
    }
  })();
  return (
    <div className="space-y-3">
      <Label htmlFor="openapi-spec">OpenAPI YAML / JSON</Label>
      <Textarea
        id="openapi-spec"
        className="min-h-52 font-mono text-xs"
        value={spec}
        onChange={(event) => setSpec(event.target.value)}
      />
      <Label htmlFor="openapi-operation">{t('newTools.operation')}</Label>
      <Input
        id="openapi-operation"
        list="openapi-operations"
        value={endpointId}
        onChange={(event) => setEndpointId(event.target.value)}
        placeholder="GET /users"
      />
      <datalist id="openapi-operations">
        {ids.map((id) => (
          <option key={id} value={id} />
        ))}
      </datalist>
      <Label htmlFor="openapi-status">HTTP status</Label>
      <Input
        id="openapi-status"
        value={status}
        onChange={(event) => setStatus(event.target.value)}
        className="max-w-32"
      />
      <Label htmlFor="openapi-body">{t('newTools.responseJson')}</Label>
      <Textarea
        id="openapi-body"
        className="min-h-36 font-mono text-xs"
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
      <Button onClick={() => void validate()}>{t('newTools.validate')}</Button>
      <TextResult value={result} error={error} />
    </div>
  );
}

function csv(text: string): string[][] {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' });
  if (result.errors.length) throw new Error(result.errors[0]!.message);
  return result.data;
}

export function TableJoiner() {
  const { t } = useTranslation();
  const [left, setLeft] = useState('id,name\n1,Alice\n2,Bob');
  const [right, setRight] = useState('id,city\n1,Beijing\n3,Shanghai');
  const [leftKey, setLeftKey] = useState('id');
  const [rightKey, setRightKey] = useState('id');
  const [result, setResult] = useState('');
  const [error, setError] = useState<string | null>(null);
  function join() {
    setError(null);
    try {
      const a = csv(left),
        b = csv(right),
        ah = a[0] ?? [],
        bh = b[0] ?? [];
      const ai = ah.indexOf(leftKey),
        bi = bh.indexOf(rightKey);
      if (ai < 0 || bi < 0) throw new Error(t('newTools.missingJoinKey'));
      const indexed = new Map<string, string[][]>();
      b.slice(1).forEach((row) =>
        indexed.set(row[bi] ?? '', [
          ...(indexed.get(row[bi] ?? '') ?? []),
          row,
        ]),
      );
      const matched = new Set<string>();
      const output = [ah.concat(bh.filter((_, index) => index !== bi))];
      const missingLeft: string[] = [];
      for (const row of a.slice(1)) {
        const key = row[ai] ?? '';
        const matches = indexed.get(key) ?? [];
        if (!matches.length) missingLeft.push(key);
        matches.forEach((other) => {
          output.push(row.concat(other.filter((_, index) => index !== bi)));
          matched.add(key);
        });
      }
      const missingRight = [...indexed.keys()].filter(
        (key) => !matched.has(key),
      );
      setResult(
        `${Papa.unparse(output)}\n\n${t('newTools.unmatchedLeft')}: ${missingLeft.join(', ') || '—'}\n${t('newTools.unmatchedRight')}: ${missingRight.join(', ') || '—'}`,
      );
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="join-left">{t('newTools.leftTable')}</Label>
          <Input
            aria-label={t('newTools.leftTable')}
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file)
                void file
                  .text()
                  .then(setLeft)
                  .catch((cause: unknown) =>
                    setError((cause as Error).message),
                  );
            }}
          />
          <Textarea
            id="join-left"
            className="min-h-44 font-mono text-xs"
            value={left}
            onChange={(event) => setLeft(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="join-right">{t('newTools.rightTable')}</Label>
          <Input
            aria-label={t('newTools.rightTable')}
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file)
                void file
                  .text()
                  .then(setRight)
                  .catch((cause: unknown) =>
                    setError((cause as Error).message),
                  );
            }}
          />
          <Textarea
            id="join-right"
            className="min-h-44 font-mono text-xs"
            value={right}
            onChange={(event) => setRight(event.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          aria-label={t('newTools.leftKey')}
          value={leftKey}
          onChange={(event) => setLeftKey(event.target.value)}
        />
        <Input
          aria-label={t('newTools.rightKey')}
          value={rightKey}
          onChange={(event) => setRightKey(event.target.value)}
        />
      </div>
      <Button onClick={join}>{t('newTools.join')}</Button>
      <TextResult value={result} error={error} />
    </div>
  );
}

export function DatasetProfiler() {
  const { t } = useTranslation();
  const [source, setSource] = useState(
    'age,score\n20,45\n21,49\n22,51\n23,53\n24,100',
  );
  const [report, setReport] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [histogram, setHistogram] = useState<{
    name: string;
    bins: number[];
  } | null>(null);
  function analyze() {
    setError(null);
    try {
      const [header = [], ...rows] = csv(source);
      if (!header.length) throw new Error(t('newTools.emptyTable'));
      let nextHistogram: { name: string; bins: number[] } | null = null;
      const lines = header.map((name, index) => {
        const cells = rows.map((row) => row[index] ?? '');
        const numbers = cells
          .filter((value) => value.trim() && Number.isFinite(Number(value)))
          .map(Number)
          .sort((a, b) => a - b);
        const missing = cells.filter((value) => !value.trim()).length;
        if (numbers.length < 4)
          return `${name}: ${t('newTools.missing')} ${missing}/${rows.length}`;
        if (!nextHistogram) {
          const low = numbers[0]!,
            high = numbers.at(-1)!;
          const bins = Array.from({ length: 10 }, () => 0);
          numbers.forEach((number) => {
            bins[
              Math.min(
                9,
                Math.floor((number - low) / Math.max((high - low) / 10, 1e-9)),
              )
            ]!++;
          });
          nextHistogram = { name, bins };
        }
        const percentile = (p: number) =>
          numbers[Math.floor((numbers.length - 1) * p)]!;
        const q1 = percentile(0.25),
          q3 = percentile(0.75),
          iqr = q3 - q1;
        const outliers = numbers.filter(
          (number) => number < q1 - 1.5 * iqr || number > q3 + 1.5 * iqr,
        );
        return `${name}: ${t('newTools.missing')} ${missing}/${rows.length}; min ${numbers[0]}; Q1 ${q1}; median ${percentile(0.5)}; Q3 ${q3}; max ${numbers.at(-1)}; ${t('newTools.outliers')} ${outliers.join(', ') || '—'}`;
      });
      setReport(lines.join('\n'));
      setHistogram(nextHistogram);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  return (
    <div className="space-y-3">
      <Input
        aria-label="CSV"
        type="file"
        accept=".csv,text/csv"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file)
            void file
              .text()
              .then(setSource)
              .catch((cause: unknown) => setError((cause as Error).message));
        }}
      />
      <Textarea
        aria-label="CSV"
        className="min-h-52 font-mono text-xs"
        value={source}
        onChange={(event) => setSource(event.target.value)}
      />
      <Button onClick={analyze}>{t('newTools.analyze')}</Button>
      <TextResult value={report} error={error} />
      {histogram && (
        <div className="rounded-md border p-3">
          <p className="mb-2 text-sm font-medium">{histogram.name}</p>
          <svg
            role="img"
            aria-label={t('newTools.histogram')}
            viewBox="0 0 500 130"
            className="w-full"
          >
            {histogram.bins.map((count, index) => {
              const height = (count / Math.max(1, ...histogram.bins)) * 110;
              return (
                <rect
                  key={index}
                  x={index * 50 + 5}
                  y={120 - height}
                  width="40"
                  height={height}
                  fill="#2563eb"
                />
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

const SECRET_PATTERNS = [
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/g],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g],
  ['Private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  [
    'Credential assignment',
    /\b(?:api[_-]?key|secret|password|token)\s*[:=]\s*["']?[^\s"']{12,}/gi,
  ],
] as const;

export function SecretScanner() {
  const { t } = useTranslation();
  const [source, setSource] = useState('');
  const [result, setResult] = useState('');
  const [error, setError] = useState<string | null>(null);
  function inspect(text: string) {
    const matches: string[] = [];
    let path = 'input.diff',
      line = 0;
    for (const row of text.split(/\r?\n/)) {
      if (row.startsWith('+++ b/')) {
        path = row.slice(6);
        line = 0;
        continue;
      }
      const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(row);
      if (hunk) {
        line = Number(hunk[1]);
        continue;
      }
      if (row.startsWith('-') && !row.startsWith('---')) continue;
      if (row.startsWith('+') && !row.startsWith('+++'))
        for (const [name, pattern] of SECRET_PATTERNS) {
          pattern.lastIndex = 0;
          if (pattern.test(row)) matches.push(`${path}:${line} ${name}`);
        }
      if (!row.startsWith('\\')) line++;
    }
    setResult(matches.join('\n') || t('newTools.noSecrets'));
  }
  async function scanZip(file: File) {
    setError(null);
    try {
      if (file.size > 10_000_000) throw new Error(t('newTools.fileTooLarge'));
      const entries = await unzipTraceEntries(
        new Uint8Array(await file.arrayBuffer()),
        (name) => /\.(?:env|js|ts|tsx|json|yml|yaml|txt|py|rs)$/i.test(name),
      );
      const decoder = new TextDecoder();
      const matches: string[] = [];
      for (const [name, bytes] of entries) {
        if (bytes.length > 1_000_000) continue;
        decoder
          .decode(bytes)
          .split(/\r?\n/)
          .forEach((row, index) => {
            for (const [kind, pattern] of SECRET_PATTERNS) {
              pattern.lastIndex = 0;
              if (pattern.test(row))
                matches.push(`${name}:${index + 1} ${kind}`);
            }
          });
      }
      setResult(matches.join('\n') || t('newTools.noSecrets'));
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  return (
    <div className="space-y-3">
      <Label htmlFor="secret-diff">Git diff</Label>
      <Textarea
        id="secret-diff"
        className="min-h-52 font-mono text-xs"
        value={source}
        onChange={(event) => setSource(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => inspect(source)}>{t('newTools.scan')}</Button>
        <Input
          aria-label="ZIP"
          type="file"
          accept=".zip"
          className="max-w-72"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void scanZip(file);
          }}
        />
      </div>
      <TextResult value={result} error={error} />
    </div>
  );
}

export function ThirdPartyInventory() {
  const { t } = useTranslation();
  const [source, setSource] = useState('');
  const [firstParty, setFirstParty] = useState('example.com');
  const [report, setReport] = useState('');
  const [error, setError] = useState<string | null>(null);
  function analyze() {
    setError(null);
    try {
      const entries = parseHar(source).entries;
      const groups = new Map<
        string,
        { requests: number; bytes: number; cookies: number }
      >();
      for (const entry of entries) {
        const host = new URL(entry.url).hostname;
        if (host === firstParty || host.endsWith(`.${firstParty}`)) continue;
        const group = groups.get(host) ?? { requests: 0, bytes: 0, cookies: 0 };
        group.requests++;
        group.bytes += entry.size;
        group.cookies +=
          entry.requestHeaders.filter(
            (header) => header.name.toLowerCase() === 'cookie',
          ).length +
          entry.responseHeaders.filter(
            (header) => header.name.toLowerCase() === 'set-cookie',
          ).length;
        groups.set(host, group);
      }
      setReport(
        [...groups]
          .sort((a, b) => b[1].bytes - a[1].bytes)
          .map(
            ([host, item]) =>
              `${host}\t${item.requests} ${t('newTools.requests')}\t${item.bytes} B\t${item.cookies} Cookie`,
          )
          .join('\n') || t('newTools.noThirdParty'),
      );
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  return (
    <div className="space-y-3">
      <Label htmlFor="first-party">{t('newTools.firstParty')}</Label>
      <Input
        id="first-party"
        value={firstParty}
        onChange={(event) => setFirstParty(event.target.value)}
      />
      <Label htmlFor="har-source">HAR JSON</Label>
      <Input
        aria-label="HAR"
        type="file"
        accept=".har,application/json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file)
            void file
              .text()
              .then(setSource)
              .catch((cause: unknown) => setError((cause as Error).message));
        }}
      />
      <Textarea
        id="har-source"
        className="min-h-52 font-mono text-xs"
        value={source}
        onChange={(event) => setSource(event.target.value)}
      />
      <Button onClick={analyze}>{t('newTools.analyze')}</Button>
      <TextResult value={report} error={error} />
    </div>
  );
}
