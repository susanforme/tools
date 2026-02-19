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

export const Route = createFileRoute('/xml-json')({ component: XmlJsonPage });

// ─── 示例数据 ──────────────────────────────────────────────────────────────────
const DEFAULT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<users>
  <user id="1">
    <name>Alice</name>
    <age>30</age>
    <city>Beijing</city>
  </user>
  <user id="2">
    <name>Bob</name>
    <age>25</age>
    <city>Shanghai</city>
  </user>
</users>`;

const DEFAULT_JSON = JSON.stringify(
  {
    users: {
      user: [
        { '@id': '1', name: 'Alice', age: '30', city: 'Beijing' },
        { '@id': '2', name: 'Bob', age: '25', city: 'Shanghai' },
      ],
    },
  },
  null,
  2,
);

// ─── XML → JSON helpers ────────────────────────────────────────────────────────

/** 将 XML DOM Element 转为 JS 对象（属性用 @ 前缀，文本用 #text） */
function elementToObj(el: Element): unknown {
  const obj: Record<string, unknown> = {};

  // 属性
  for (const attr of Array.from(el.attributes)) {
    obj[`@${attr.name}`] = attr.value;
  }

  const children = Array.from(el.childNodes);
  const elementChildren = children.filter((n) => n.nodeType === 1) as Element[];
  const textContent = children
    .filter((n) => n.nodeType === 3)
    .map((n) => n.textContent ?? '')
    .join('')
    .trim();

  if (elementChildren.length === 0) {
    if (Object.keys(obj).length === 0) return textContent;
    if (textContent) obj['#text'] = textContent;
    return obj;
  }

  // 分组同名子元素
  const groups: Record<string, Element[]> = {};
  for (const child of elementChildren) {
    if (!groups[child.tagName]) groups[child.tagName] = [];
    groups[child.tagName].push(child);
  }
  for (const [tag, els] of Object.entries(groups)) {
    const vals = els.map(elementToObj);
    obj[tag] = vals.length === 1 ? vals[0] : vals;
  }
  if (textContent) obj['#text'] = textContent;
  return obj;
}

function xmlToJson(xmlStr: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlStr, 'application/xml');
  const parseErr = doc.querySelector('parsererror');
  if (parseErr) throw new Error(parseErr.textContent ?? 'XML parse error');
  const root = doc.documentElement;
  const result: Record<string, unknown> = {};
  result[root.tagName] = elementToObj(root);
  return JSON.stringify(result, null, 2);
}

// ─── JSON → XML helpers ────────────────────────────────────────────────────────

function objToXml(key: string, val: unknown, indent: number): string {
  const pad = '  '.repeat(indent);
  if (val === null || val === undefined) return `${pad}<${key}/>`;

  if (Array.isArray(val)) {
    return val.map((item) => objToXml(key, item, indent)).join('\n');
  }

  if (typeof val === 'object') {
    const rec = val as Record<string, unknown>;
    const attrs = Object.entries(rec)
      .filter(([k]) => k.startsWith('@'))
      .map(([k, v]) => ` ${k.slice(1)}="${String(v)}"`)
      .join('');
    const textContent = rec['#text'] as string | undefined;
    const children = Object.entries(rec)
      .filter(([k]) => !k.startsWith('@') && k !== '#text')
      .map(([k, v]) => objToXml(k, v, indent + 1))
      .join('\n');

    if (!children && textContent === undefined)
      return `${pad}<${key}${attrs}/>`;
    if (!children && textContent !== undefined)
      return `${pad}<${key}${attrs}>${textContent}</${key}>`;
    const inner = [
      textContent !== undefined
        ? `${'  '.repeat(indent + 1)}${textContent}`
        : null,
      children || null,
    ]
      .filter(Boolean)
      .join('\n');
    return `${pad}<${key}${attrs}>\n${inner}\n${pad}</${key}>`;
  }

  return `${pad}<${key}>${String(val)}</${key}>`;
}

function jsonToXml(jsonStr: string): string {
  const obj = JSON.parse(jsonStr) as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) return '<root/>';
  const lines = keys.map((k) => objToXml(k, obj[k], 0)).join('\n');
  if (keys.length === 1) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n${lines}`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<root>\n${lines}\n</root>`;
}

// ─── 方向 ──────────────────────────────────────────────────────────────────────
type Direction = 'xml2json' | 'json2xml';

// ─── component ────────────────────────────────────────────────────────────────
function XmlJsonPage() {
  const { t } = useTranslation();
  const [direction, setDirection] = useState<Direction>('xml2json');
  const [input, setInput] = useState(DEFAULT_XML);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleDirectionChange = (v: Direction) => {
    setDirection(v);
    setInput(v === 'xml2json' ? DEFAULT_XML : DEFAULT_JSON);
    setOutput('');
    setError(null);
  };

  const convert = () => {
    setError(null);
    try {
      if (direction === 'xml2json') {
        setOutput(xmlToJson(input));
      } else {
        setOutput(jsonToXml(input));
      }
    } catch (e) {
      setError(t('xmlJson.convertError', { msg: (e as Error).message }));
    }
  };

  const clear = () => {
    setInput('');
    setOutput('');
    setError(null);
  };

  const inputLang = direction === 'xml2json' ? 'xml' : 'json';
  const outputLang = direction === 'xml2json' ? 'json' : 'xml';

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('xmlJson.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('xmlJson.desc')}
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm shrink-0 text-muted-foreground">
            {t('xmlJson.direction')}
          </span>
          <Select
            value={direction}
            onValueChange={(v) => handleDirectionChange(v as Direction)}
          >
            <SelectTrigger className="h-8 w-40 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="xml2json">XML → JSON</SelectItem>
              <SelectItem value="json2xml">JSON → XML</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator orientation="vertical" className="h-6" />
        <Button size="sm" onClick={convert}>
          {t('xmlJson.convert')}
        </Button>
        <Button size="sm" variant="outline" onClick={clear}>
          {t('xmlJson.clear')}
        </Button>
      </div>

      <CodePanel
        input={input}
        output={output}
        onInputChange={setInput}
        inputPlaceholder={
          direction === 'xml2json'
            ? t('xmlJson.xmlPlaceholder')
            : t('xmlJson.jsonPlaceholder')
        }
        error={error}
        language={inputLang}
        outputLanguage={outputLang}
      />
    </div>
  );
}
