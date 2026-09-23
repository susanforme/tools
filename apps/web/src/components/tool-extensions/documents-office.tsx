import { loadRuntimeAssetUrl } from '@/lib/runtime-assets';
import { unzipTraceEntries } from '@/lib/playwright-trace';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Papa from 'papaparse';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

function Report({
  value,
  error,
  busy,
}: {
  value: string;
  error: string | null;
  busy?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      {busy && <p role="status">{t('newTools.loading')}</p>}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {value && (
        <Textarea
          readOnly
          className="min-h-48 font-mono text-xs"
          value={value}
        />
      )}
    </>
  );
}

export function PdfAccessibility() {
  const { t } = useTranslation();
  const [report, setReport] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function inspect(file: File) {
    setBusy(true);
    setError(null);
    setReport('');
    try {
      if (file.size > 50_000_000) throw new Error(t('newTools.fileTooLarge'));
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = await loadRuntimeAssetUrl(
        'pdfWorker',
        'text/javascript',
      );
      const loading = pdfjs.getDocument({ data: await file.arrayBuffer() });
      try {
        const pdf = await loading.promise;
        const lines: string[] = [];
        for (let number = 1; number <= Math.min(pdf.numPages, 100); number++) {
          const page = await pdf.getPage(number);
          const [tree, content, operators] = await Promise.all([
            page.getStructTree(),
            page.getTextContent(),
            page.getOperatorList(),
          ]);
          let roles = 0,
            missingAlt = 0;
          const order: string[] = [];
          const walk = (node: unknown): void => {
            if (!node || typeof node !== 'object') return;
            const item = node as {
              role?: string;
              alt?: string;
              children?: unknown[];
            };
            if (item.role && item.role !== 'Root') {
              roles++;
              if (order.length < 30) order.push(item.role);
            }
            if (item.role === 'Figure' && !item.alt?.trim()) missingAlt++;
            item.children?.forEach(walk);
          };
          walk(tree);
          const text = content.items.filter(
            (item) => 'str' in item && item.str.trim(),
          ).length;
          const images = operators.fnArray.filter(
            (operator) =>
              operator === pdfjs.OPS.paintImageXObject ||
              operator === pdfjs.OPS.paintInlineImageXObject,
          ).length;
          lines.push(
            `${t('newTools.page')} ${number}: ${t('newTools.textItems')} ${text}; ${t('newTools.tagNodes')} ${roles}; ${t('newTools.images')} ${images}; ${t('newTools.missingAlt')} ${missingAlt}${!tree ? `; ${t('newTools.noTags')}` : ''}${!text && images ? `; ${t('newTools.scannedPage')}` : ''}`,
          );
          if (order.length)
            lines.push(`  ${t('newTools.readingOrder')}: ${order.join(' → ')}`);
        }
        setReport(lines.join('\n'));
      } finally {
        await loading.destroy();
      }
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <Input
        aria-label="PDF"
        type="file"
        accept=".pdf,application/pdf"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void inspect(file);
        }}
      />
      <p className="text-sm text-muted-foreground">
        {t('newTools.accessibilityLimit')}
      </p>
      <Report value={report} error={error} busy={busy} />
    </div>
  );
}

export function EpubAccessibility() {
  const { t } = useTranslation();
  const [report, setReport] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function inspect(file: File) {
    setBusy(true);
    setError(null);
    setReport('');
    try {
      if (file.size > 24_000_000) throw new Error(t('newTools.fileTooLarge'));
      const entries = await unzipTraceEntries(
        new Uint8Array(await file.arrayBuffer()),
        (name) => /\.(?:opf|xhtml|html)$/i.test(name),
      );
      const decoder = new TextDecoder();
      const opf = [...entries].find(([name]) => name.endsWith('.opf'));
      if (!opf) throw new Error(t('newTools.invalidEpub'));
      const metadata = new DOMParser().parseFromString(
        decoder.decode(opf[1]),
        'application/xml',
      );
      if (metadata.querySelector('parsererror'))
        throw new Error(t('newTools.invalidEpub'));
      const language =
        metadata
          .getElementsByTagNameNS('*', 'language')[0]
          ?.textContent?.trim() ?? '';
      const manifest = [...metadata.getElementsByTagNameNS('*', 'item')];
      const hasNav = manifest.some((item) =>
        (item.getAttribute('properties') ?? '').split(/\s+/).includes('nav'),
      );
      const lines = [
        `${t('newTools.language')}: ${language || t('newTools.missing')}`,
        `${t('newTools.tableOfContents')}: ${hasNav ? t('newTools.found') : t('newTools.missing')}`,
      ];
      for (const [name, bytes] of entries) {
        if (!/\.(?:xhtml|html)$/i.test(name)) continue;
        const doc = new DOMParser().parseFromString(
          decoder.decode(bytes),
          'text/html',
        );
        const missingAlt = [...doc.querySelectorAll('img')].filter(
          (image) => !image.hasAttribute('alt'),
        ).length;
        const headings = [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(
          (heading) => Number(heading.tagName[1]),
        );
        const skipped = headings.filter(
          (level, index) => index > 0 && level > headings[index - 1]! + 1,
        ).length;
        if (missingAlt || skipped)
          lines.push(
            `${name}: ${t('newTools.missingAlt')} ${missingAlt}; ${t('newTools.headingSkips')} ${skipped}`,
          );
      }
      setReport(lines.join('\n'));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <Input
        aria-label="EPUB"
        type="file"
        accept=".epub,application/epub+zip"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void inspect(file);
        }}
      />
      <p className="text-sm text-muted-foreground">
        {t('newTools.accessibilityLimit')}
      </p>
      <Report value={report} error={error} busy={busy} />
    </div>
  );
}

export function SurveyAnalyzer() {
  const { t } = useTranslation();
  const [source, setSource] = useState(
    'question1,question2\nYes,Good\nNo,Good\nYes,Great',
  );
  const [report, setReport] = useState('');
  const [error, setError] = useState<string | null>(null);
  function analyze() {
    setError(null);
    try {
      const parsed = Papa.parse<string[]>(source, { skipEmptyLines: 'greedy' });
      if (parsed.errors.length) throw new Error(parsed.errors[0]!.message);
      const [header = [], ...rows] = parsed.data;
      if (!header.length) throw new Error(t('newTools.emptyTable'));
      const lines = header.flatMap((name, index) => {
        const counts = new Map<string, number>();
        rows.forEach((row) => {
          const value = row[index]?.trim() || t('newTools.missing');
          counts.set(value, (counts.get(value) ?? 0) + 1);
        });
        if (rows.length >= 5 && counts.size / rows.length > 0.8)
          return [
            name,
            `  ${t('newTools.openAnswers')}:`,
            ...rows
              .map((row) => `  - ${(row[index] ?? '').slice(0, 200)}`)
              .slice(0, 30),
          ];
        return [
          name,
          ...[...counts]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(
              ([value, count]) =>
                `  ${value}: ${count} (${((100 * count) / Math.max(rows.length, 1)).toFixed(1)}%)`,
            ),
        ];
      });
      setReport(lines.join('\n'));
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  return (
    <div className="space-y-3">
      <Label htmlFor="survey-csv">{t('newTools.responsesCsv')}</Label>
      <Input
        aria-label={t('newTools.responsesCsv')}
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
        id="survey-csv"
        className="min-h-52 font-mono text-xs"
        value={source}
        onChange={(event) => setSource(event.target.value)}
      />
      <Button onClick={analyze}>{t('newTools.analyze')}</Button>
      <Report value={report} error={error} />
    </div>
  );
}

export function CapacityPlanner() {
  const { t } = useTranslation();
  const [people, setPeople] = useState(
    'person,week,capacity\nAlice,2026-W39,40\nBob,2026-W39,32',
  );
  const [tasks, setTasks] = useState(
    'person,week,task,hours\nAlice,2026-W39,Design,18\nAlice,2026-W39,Review,25\nBob,2026-W39,Test,20',
  );
  const [report, setReport] = useState('');
  const [error, setError] = useState<string | null>(null);
  function calculate() {
    setError(null);
    try {
      const parse = (value: string) => {
        const result = Papa.parse<Record<string, string>>(value, {
          header: true,
          skipEmptyLines: 'greedy',
        });
        if (result.errors.length) throw new Error(result.errors[0]!.message);
        return result.data;
      };
      const capacity = new Map(
        parse(people).map((row) => [
          `${row.person}|${row.week}`,
          Number(row.capacity),
        ]),
      );
      if (
        [...capacity.values()].some(
          (hours) => !Number.isFinite(hours) || hours < 0,
        )
      )
        throw new Error(t('newTools.invalidHours'));
      const workload = new Map<string, number>();
      parse(tasks).forEach((row) => {
        const key = `${row.person}|${row.week}`;
        const hours = Number(row.hours);
        if (!Number.isFinite(hours) || hours < 0)
          throw new Error(t('newTools.invalidHours'));
        workload.set(key, (workload.get(key) ?? 0) + hours);
      });
      setReport(
        [...new Set([...capacity.keys(), ...workload.keys()])]
          .sort()
          .map((key) => {
            const [person, week] = key.split('|');
            const limit = capacity.get(key);
            const assigned = workload.get(key) ?? 0;
            return `${person} · ${week}: ${assigned}/${limit ?? '?'} h ${limit !== undefined && assigned > limit ? `⚠ ${t('newTools.overCapacity')}` : ''}`;
          })
          .join('\n'),
      );
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="capacity-people">
            {t('newTools.peopleCapacity')}
          </Label>
          <Textarea
            id="capacity-people"
            className="min-h-44 font-mono text-xs"
            value={people}
            onChange={(event) => setPeople(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="capacity-tasks">{t('newTools.taskHours')}</Label>
          <Textarea
            id="capacity-tasks"
            className="min-h-44 font-mono text-xs"
            value={tasks}
            onChange={(event) => setTasks(event.target.value)}
          />
        </div>
      </div>
      <Button onClick={calculate}>{t('newTools.calculate')}</Button>
      <Report value={report} error={error} />
    </div>
  );
}
