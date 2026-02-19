import { createFileRoute } from '@tanstack/react-router';
import { ArrowLeftRight } from 'lucide-react';
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

export const Route = createFileRoute('/csv-convert')({
  component: CsvConvertPage,
});

// ─── 示例数据 ──────────────────────────────────────────────────────────────────
const DEFAULT_CSV = `name,age,city
Alice,30,Beijing
Bob,25,Shanghai
Carol,28,Guangzhou`;

// ─── helpers ──────────────────────────────────────────────────────────────────

/** 解析 CSV / TSV 为二维数组（支持带引号字段） */
function parseCsvRows(text: string, delimiter: string): string[][] {
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
          } else {
            inQuote = false;
          }
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuote = true;
      } else if (ch === delimiter) {
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

/** 将值转成带引号的 CSV/TSV 字段 */
function escapeCsvField(val: string, delimiter: string): string {
  if (
    val.includes(delimiter) ||
    val.includes('"') ||
    val.includes('\n') ||
    val.includes('\r')
  ) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

/** 二维数组 → CSV/TSV */
function rowsToDelimited(rows: string[][], delimiter: string): string {
  return rows
    .map((r) => r.map((v) => escapeCsvField(v, delimiter)).join(delimiter))
    .join('\n');
}

/** 二维数组（首行为 header）→ JSON 数组字符串 */
function rowsToJson(rows: string[][]): string {
  if (rows.length === 0) return '[]';
  const [header, ...data] = rows;
  const objs = data.map((row) => {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => {
      obj[h ?? `col${i}`] = row[i] ?? '';
    });
    return obj;
  });
  return JSON.stringify(objs, null, 2);
}

/** 二维数组（首行为 header）→ SQL INSERT 语句 */
function rowsToSql(rows: string[][], tableName: string): string {
  if (rows.length < 2) return '';
  const [header, ...data] = rows;
  const cols = header.map((h) => `\`${h}\``).join(', ');
  const stmts = data.map((row) => {
    const vals = row.map((v) => {
      const n = Number(v);
      if (v === '' || v === null) return 'NULL';
      if (!isNaN(n) && v.trim() !== '') return v;
      return `'${v.replace(/'/g, "''")}'`;
    });
    return `INSERT INTO \`${tableName}\` (${cols}) VALUES (${vals.join(', ')});`;
  });
  return stmts.join('\n');
}

/** JSON 数组字符串 → CSV 行 */
function jsonToCsvRows(json: string): string[][] {
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

// ─── 输出格式 ──────────────────────────────────────────────────────────────────
const OUTPUT_FORMATS = ['csv', 'tsv', 'json', 'sql'] as const;
type OutputFormat = (typeof OUTPUT_FORMATS)[number];

const INPUT_FORMATS = ['csv', 'tsv', 'json'] as const;
type InputFormat = (typeof INPUT_FORMATS)[number];

/** 输出格式 → 可用作输入格式（SQL 无法直接反解，降级为 csv） */
function outputToInput(fmt: OutputFormat): InputFormat {
  if (fmt === 'csv' || fmt === 'tsv' || fmt === 'json') return fmt;
  return 'csv'; // sql 不能作为输入，降级
}

/** 输入格式 → 默认输出格式（避免 in === out 无意义） */
function inputToOutput(fmt: InputFormat, current: OutputFormat): OutputFormat {
  if (fmt !== current) return current;
  // 当前输出与新输入相同时，切换到下一个可用输出
  const others: OutputFormat[] = ['csv', 'tsv', 'json', 'sql'];
  return others.find((f) => f !== fmt) ?? 'json';
}

// ─── component ────────────────────────────────────────────────────────────────
function CsvConvertPage() {
  const { t } = useTranslation();
  const [input, setInput] = useState(DEFAULT_CSV);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [inputFmt, setInputFmt] = useState<InputFormat>('csv');
  const [outputFmt, setOutputFmt] = useState<OutputFormat>('json');
  const [tableName, setTableName] = useState('my_table');

  const getInputDelimiter = (fmt: InputFormat) => (fmt === 'tsv' ? '\t' : ',');

  const convert = () => {
    setError(null);
    try {
      let rows: string[][];

      if (inputFmt === 'json') {
        rows = jsonToCsvRows(input);
      } else {
        rows = parseCsvRows(input, getInputDelimiter(inputFmt));
      }

      if (rows.length === 0) {
        setError(t('csvConvert.emptyInput'));
        return;
      }

      if (outputFmt === 'csv') {
        setOutput(rowsToDelimited(rows, ','));
      } else if (outputFmt === 'tsv') {
        setOutput(rowsToDelimited(rows, '\t'));
      } else if (outputFmt === 'json') {
        setOutput(rowsToJson(rows));
      } else if (outputFmt === 'sql') {
        setOutput(rowsToSql(rows, tableName));
      }
    } catch (e) {
      setError(t('csvConvert.convertError', { msg: (e as Error).message }));
    }
  };

  /** 对调输入/输出格式，并将输出内容搬回输入框 */
  const swap = () => {
    const newInputFmt = outputToInput(outputFmt);
    const newOutputFmt = inputToOutput(newInputFmt, inputFmt as OutputFormat);
    const newInput = output || input;
    setInputFmt(newInputFmt);
    setOutputFmt(newOutputFmt);
    setInput(newInput);
    setOutput('');
    setError(null);
  };

  const clear = () => {
    setInput('');
    setOutput('');
    setError(null);
  };

  const outputLanguage =
    outputFmt === 'json' ? 'json' : outputFmt === 'sql' ? 'sql' : 'plaintext';
  const inputLanguage = inputFmt === 'json' ? 'json' : 'plaintext';

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      {/* 标题 */}
      <div>
        <h1 className="text-2xl font-bold">{t('csvConvert.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('csvConvert.desc')}
        </p>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* 输入格式 */}
        <div className="flex items-center gap-2">
          <span className="text-sm shrink-0 text-muted-foreground">
            {t('csvConvert.inputFmt')}
          </span>
          <Select
            value={inputFmt}
            onValueChange={(v) => setInputFmt(v as InputFormat)}
          >
            <SelectTrigger className="h-8 w-24 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INPUT_FORMATS.map((f) => (
                <SelectItem key={f} value={f}>
                  {f.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 互换按钮 */}
        <button
          onClick={swap}
          title={t('csvConvert.swap')}
          className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <ArrowLeftRight className="w-4 h-4" />
        </button>

        {/* 输出格式 */}
        <div className="flex items-center gap-2">
          <span className="text-sm shrink-0 text-muted-foreground">
            {t('csvConvert.outputFmt')}
          </span>
          <Select
            value={outputFmt}
            onValueChange={(v) => setOutputFmt(v as OutputFormat)}
          >
            <SelectTrigger className="h-8 w-32 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="tsv">TSV</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="sql">SQL INSERT</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* SQL 表名（仅输出 SQL 时显示） */}
        {outputFmt === 'sql' && (
          <>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <span className="text-sm shrink-0 text-muted-foreground">
                {t('csvConvert.tableName')}
              </span>
              <input
                className="h-8 px-2 rounded-md border border-input bg-background text-sm w-32 focus:outline-none focus:ring-1 focus:ring-ring"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="table_name"
              />
            </div>
          </>
        )}

        <Separator orientation="vertical" className="h-6" />
        <Button size="sm" onClick={convert}>
          {t('csvConvert.convert')}
        </Button>
        <Button size="sm" variant="outline" onClick={clear}>
          {t('csvConvert.clear')}
        </Button>
      </div>

      <CodePanel
        input={input}
        output={output}
        onInputChange={setInput}
        inputPlaceholder={t('csvConvert.inputPlaceholder')}
        error={error}
        language={inputLanguage}
        outputLanguage={outputLanguage}
      />
    </div>
  );
}
