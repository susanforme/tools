import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CodePanel } from '../components/code-panel';
import { Button } from '../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Separator } from '../components/ui/separator';

export const Route = createFileRoute('/table-convert')({
  component: TableConvertPage,
});

// ─── 示例数据 ──────────────────────────────────────────────────────────────────
const DEFAULT_HTML_TABLE = `<table>
  <thead>
    <tr>
      <th>Name</th>
      <th>Age</th>
      <th>City</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Alice</td>
      <td>30</td>
      <td>Beijing</td>
    </tr>
    <tr>
      <td>Bob</td>
      <td>25</td>
      <td>Shanghai</td>
    </tr>
  </tbody>
</table>`;

const DEFAULT_CSV = `Name,Age,City
Alice,30,Beijing
Bob,25,Shanghai`;

const DEFAULT_JSON_ARR = JSON.stringify(
  [
    { Name: 'Alice', Age: 30, City: 'Beijing' },
    { Name: 'Bob', Age: 25, City: 'Shanghai' },
  ],
  null,
  2,
);

// ─── helpers ──────────────────────────────────────────────────────────────────

/** 从 HTML 字符串中提取第一个 <table> 的行列数据 */
function parseHtmlTable(html: string): string[][] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) throw new Error('未找到 <table> 元素');
  const rows = Array.from(table.querySelectorAll('tr'));
  return rows.map((tr) =>
    Array.from(tr.querySelectorAll('th,td')).map(
      (cell) => cell.textContent ?? '',
    ),
  );
}

/** 解析 CSV 为二维数组 */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (line.trim() === '') continue;
    const cells: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuote) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else inQuote = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuote = true;
      } else if (ch === ',') {
        cells.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

/** 二维数组（首行为 header）→ CSV 字符串 */
function rowsToCsv(rows: string[][]): string {
  return rows
    .map((r) =>
      r
        .map((v) =>
          v.includes(',') || v.includes('"') || v.includes('\n')
            ? '"' + v.replace(/"/g, '""') + '"'
            : v,
        )
        .join(','),
    )
    .join('\n');
}

/** 二维数组（首行为 header）→ JSON 数组字符串 */
function rowsToJson(rows: string[][]): string {
  if (rows.length === 0) return '[]';
  const [header, ...data] = rows;
  const objs = data.map((row) => {
    const obj: Record<string, string | number> = {};
    header.forEach((h, i) => {
      const v = row[i] ?? '';
      const n = Number(v);
      obj[h] = !isNaN(n) && v.trim() !== '' ? n : v;
    });
    return obj;
  });
  return JSON.stringify(objs, null, 2);
}

/** 二维数组 → HTML 表格字符串 */
function rowsToHtmlTable(rows: string[][]): string {
  if (rows.length === 0) return '<table></table>';
  const [header, ...data] = rows;
  const thead = `  <thead>\n    <tr>\n${header.map((h) => `      <th>${h}</th>`).join('\n')}\n    </tr>\n  </thead>`;
  const tbody =
    `  <tbody>\n` +
    data
      .map(
        (row) =>
          `    <tr>\n${row.map((v) => `      <td>${v}</td>`).join('\n')}\n    </tr>`,
      )
      .join('\n') +
    `\n  </tbody>`;
  return `<table>\n${thead}\n${tbody}\n</table>`;
}

/** JSON 数组字符串 → 二维数组 */
function jsonArrToRows(json: string): string[][] {
  const arr = JSON.parse(json) as Record<string, unknown>[];
  if (!Array.isArray(arr) || arr.length === 0) return [];
  const keys = Object.keys(arr[0] as object);
  const rows: string[][] = [keys];
  for (const item of arr) {
    rows.push(
      keys.map((k) => String((item as Record<string, unknown>)[k] ?? '')),
    );
  }
  return rows;
}

// ─── 转换模式 ──────────────────────────────────────────────────────────────────
const MODES = [
  { value: 'html2csv', label: 'HTML Table → CSV' },
  { value: 'html2json', label: 'HTML Table → JSON' },
  { value: 'csv2html', label: 'CSV → HTML Table' },
  { value: 'json2html', label: 'JSON → HTML Table' },
  { value: 'json2csv', label: 'JSON → CSV' },
  { value: 'csv2json', label: 'CSV → JSON' },
] as const;

type Mode = (typeof MODES)[number]['value'];

function getDefaultInput(mode: Mode): string {
  if (mode.startsWith('html')) return DEFAULT_HTML_TABLE;
  if (mode.startsWith('csv')) return DEFAULT_CSV;
  return DEFAULT_JSON_ARR;
}

function getInputLang(mode: Mode): string {
  if (mode.startsWith('html')) return 'html';
  if (mode.startsWith('csv')) return 'plaintext';
  return 'json';
}

function getOutputLang(mode: Mode): string {
  if (mode.endsWith('html')) return 'html';
  if (mode.endsWith('csv')) return 'plaintext';
  return 'json';
}

// ─── component ────────────────────────────────────────────────────────────────
function TableConvertPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('html2json');
  const [input, setInput] = useState(DEFAULT_HTML_TABLE);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleModeChange = (v: Mode) => {
    setMode(v);
    setInput(getDefaultInput(v));
    setOutput('');
    setError(null);
  };

  const convert = () => {
    setError(null);
    try {
      let rows: string[][];

      // 解析输入
      if (mode.startsWith('html')) {
        rows = parseHtmlTable(input);
      } else if (mode.startsWith('csv')) {
        rows = parseCsvRows(input);
      } else {
        rows = jsonArrToRows(input);
      }

      if (rows.length === 0) {
        setError(t('tableConvert.emptyInput'));
        return;
      }

      // 生成输出
      if (mode.endsWith('csv')) {
        setOutput(rowsToCsv(rows));
      } else if (mode.endsWith('json')) {
        setOutput(rowsToJson(rows));
      } else {
        setOutput(rowsToHtmlTable(rows));
      }
    } catch (e) {
      setError(t('tableConvert.convertError', { msg: (e as Error).message }));
    }
  };

  const clear = () => {
    setInput('');
    setOutput('');
    setError(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('tableConvert.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('tableConvert.desc')}
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm shrink-0 text-muted-foreground">
            {t('tableConvert.mode')}
          </span>
          <Select
            value={mode}
            onValueChange={(v) => handleModeChange(v as Mode)}
          >
            <SelectTrigger className="h-8 w-52 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODES.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator orientation="vertical" className="h-6" />
        <Button size="sm" onClick={convert}>
          {t('tableConvert.convert')}
        </Button>
        <Button size="sm" variant="outline" onClick={clear}>
          {t('tableConvert.clear')}
        </Button>
      </div>

      <CodePanel
        input={input}
        output={output}
        onInputChange={setInput}
        inputPlaceholder={t('tableConvert.inputPlaceholder')}
        error={error}
        language={getInputLang(mode)}
        outputLanguage={getOutputLang(mode)}
      />
    </div>
  );
}
