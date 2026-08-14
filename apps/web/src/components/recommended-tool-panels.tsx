import { NumberField } from '@/components/calculator-ui';
import { FileDropzone, type DroppedFile } from '@/components/file-dropzone';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  NumberParam,
  StringParam,
  useQueryParam,
} from '@/hooks/useQueryParams';
import { sha256 } from '@/lib/batch-files';
import { downloadBlob, downloadBytes } from '@/lib/download';
import { importNetworkRuntimeModule } from '@/lib/runtime-assets';
import {
  generateLorem,
  inspectPdfSignatures,
  numericPartOrder,
  unwrapRedirectUrl,
  validateCardNumber,
  validateIban,
} from '@/lib/recommended-tools';
import { Copy, Download, FileArchive, Play, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { XmlDocument, XsdValidator } from 'libxml2-wasm';

function ErrorMessage({ value }: { value: string | null }) {
  return value ? <div className="text-sm text-destructive">{value}</div> : null;
}

function CopyButton({ value }: { value: string }) {
  const { t } = useTranslation();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={!value}
      onClick={() => void navigator.clipboard.writeText(value)}
    >
      <Copy className="h-4 w-4" />
      {t('recommended.copy')}
    </Button>
  );
}

export function RedirectUnwrapPanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const parsed = useMemo(() => {
    try {
      return {
        error: null,
        steps: input.trim() ? unwrapRedirectUrl(input) : [],
      };
    } catch (cause) {
      return { error: (cause as Error).message, steps: [] };
    }
  }, [input]);
  const { error, steps } = parsed;
  const result = steps.at(-1)?.url ?? input.trim();
  return (
    <div className="space-y-4">
      <Textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder={t('recommended.redirectPlaceholder')}
        className="min-h-28 font-mono"
      />
      <ErrorMessage value={error} />
      {!!input.trim() && (
        <div className="space-y-2 rounded-xl border p-4">
          <div className="break-all font-mono text-sm">{result}</div>
          <CopyButton value={result} />
          {!!steps.length && (
            <div className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
              {steps.map((step, index) => (
                <div key={`${step.url}-${index}`} className="break-all">
                  {index + 1}. {step.parameter}: {step.url}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function BankValidationPanel() {
  const { t } = useTranslation();
  const [iban, setIban] = useState('');
  const [card, setCard] = useState('');
  const ibanResult = iban ? validateIban(iban) : null;
  const cardResult = card ? validateCardNumber(card) : null;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3 rounded-xl border p-4">
        <Label>IBAN</Label>
        <Input value={iban} onChange={(event) => setIban(event.target.value)} />
        {ibanResult && (
          <ResultRows
            rows={[
              [
                t('recommended.status'),
                ibanResult.valid
                  ? t('recommended.valid')
                  : t('recommended.invalid'),
              ],
              [t('recommended.country'), ibanResult.country],
              [t('recommended.formatted'), ibanResult.formatted],
            ]}
          />
        )}
      </div>
      <div className="space-y-3 rounded-xl border p-4">
        <Label>{t('recommended.cardNumber')}</Label>
        <Input
          inputMode="numeric"
          value={card}
          onChange={(event) => setCard(event.target.value)}
        />
        {cardResult && (
          <ResultRows
            rows={[
              [
                t('recommended.status'),
                cardResult.valid
                  ? t('recommended.valid')
                  : t('recommended.invalid'),
              ],
              [t('recommended.brand'), cardResult.brand],
              [t('recommended.formatted'), cardResult.formatted],
            ]}
          />
        )}
      </div>
    </div>
  );
}

function ResultRows({ rows }: { rows: string[][] }) {
  return (
    <div className="space-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[8rem_1fr] gap-2">
          <span className="text-muted-foreground">{label}</span>
          <span className="break-all font-mono">{value}</span>
        </div>
      ))}
    </div>
  );
}

export function PdfSignaturePanel() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [signatures, setSignatures] = useState<
    ReturnType<typeof inspectPdfSignatures>
  >([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return;
    void file
      .arrayBuffer()
      .then((buffer) =>
        setSignatures(inspectPdfSignatures(new Uint8Array(buffer))),
      )
      .catch((cause: Error) => setError(cause.message));
  }, [file]);
  return (
    <div className="space-y-4">
      <FileDropzone
        accept="application/pdf,.pdf"
        onFiles={(files) => {
          setError(null);
          setFile(files[0]?.file ?? null);
        }}
        className="flex min-h-32 items-center justify-center rounded-xl p-5 text-center"
      >
        {file?.name ?? t('recommended.dropPdf')}
      </FileDropzone>
      <ErrorMessage value={error} />
      {file && !signatures.length && (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">
          {t('recommended.noPdfSignature')}
        </div>
      )}
      {signatures.map((signature, index) => (
        <div key={index} className="space-y-2 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <strong>{t('recommended.signature', { index: index + 1 })}</strong>
            <Badge
              variant={signature.coversWholeFile ? 'default' : 'secondary'}
            >
              {signature.coversWholeFile
                ? t('recommended.fullCoverage')
                : t('recommended.partialCoverage')}
            </Badge>
          </div>
          <ResultRows
            rows={[
              ['ByteRange', signature.byteRange.join(', ')],
              ['SubFilter', signature.subFilter || '-'],
              [t('recommended.signer'), signature.name || '-'],
              [t('recommended.signedAt'), signature.signedAt || '-'],
              [t('recommended.reason'), signature.reason || '-'],
            ]}
          />
        </div>
      ))}
      {!!signatures.length && (
        <p className="text-xs text-muted-foreground">
          {t('recommended.signatureNote')}
        </p>
      )}
    </div>
  );
}

export function PhonePanel() {
  const { t } = useTranslation();
  const [country, setCountry] = useQueryParam<string>(
    'phoneCountry',
    StringParam,
    'CN',
  );
  const [input, setInput] = useState('');
  const [result, setResult] = useState<Array<[string, string]>>([]);
  const [error, setError] = useState<string | null>(null);
  const parse = async () => {
    setError(null);
    try {
      const { parsePhoneNumber } = await import('libphonenumber-js/max');
      const phone = parsePhoneNumber(input, {
        defaultCountry: country as 'CN',
        extract: false,
      });
      setResult([
        ['E.164', phone.number],
        [t('recommended.international'), phone.formatInternational()],
        [t('recommended.national'), phone.formatNational()],
        [t('recommended.country'), phone.country ?? '-'],
        [t('recommended.type'), phone.getType() ?? '-'],
        [
          t('recommended.status'),
          phone.isValid() ? t('recommended.valid') : t('recommended.invalid'),
        ],
      ]);
    } catch (cause) {
      setResult([]);
      setError((cause as Error).message);
    }
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[12rem_1fr_auto]">
        <CountrySelect
          value={country}
          onChange={(value) => setCountry(value)}
        />
        <Input
          type="tel"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t('recommended.phonePlaceholder')}
        />
        <Button onClick={() => void parse()}>{t('recommended.parse')}</Button>
      </div>
      <ErrorMessage value={error} />
      {!!result.length && <ResultRows rows={result} />}
    </div>
  );
}

const PHONE_COUNTRIES = [
  'CN',
  'US',
  'GB',
  'JP',
  'KR',
  'SG',
  'AU',
  'CA',
  'DE',
  'FR',
  'IN',
  'BR',
] as const;

function CountrySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PHONE_COUNTRIES.map((country) => (
          <SelectItem key={country} value={country}>
            {country}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function XsdPanel() {
  const { t } = useTranslation();
  const [xml, setXml] = useState('<message><text>Hello</text></message>');
  const [xsd, setXsd] = useState(`<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="message">
    <xs:complexType>
      <xs:sequence><xs:element name="text" type="xs:string"/></xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`);
  const [result, setResult] = useState('');
  const [error, setError] = useState<string | null>(null);
  const validate = async () => {
    setError(null);
    let xmlDocument: XmlDocument | null = null;
    let xsdDocument: XmlDocument | null = null;
    let validator: XsdValidator | null = null;
    try {
      const { ParseOption, XmlDocument, XsdValidator } =
        await importNetworkRuntimeModule<typeof import('libxml2-wasm')>(
          'libxml2Module',
        );
      const options = {
        option: ParseOption.XML_PARSE_NONET | ParseOption.XML_PARSE_NO_XXE,
      };
      xmlDocument = XmlDocument.fromString(xml, options);
      xsdDocument = XmlDocument.fromString(xsd, options);
      validator = XsdValidator.fromDoc(xsdDocument);
      validator.validate(xmlDocument);
      setResult(t('recommended.xsdValid'));
    } catch (cause) {
      setResult('');
      setError((cause as Error).message);
    } finally {
      validator?.dispose();
      xsdDocument?.dispose();
      xmlDocument?.dispose();
    }
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>XML</Label>
          <Textarea
            className="min-h-72 font-mono"
            value={xml}
            onChange={(event) => setXml(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>XSD</Label>
          <Textarea
            className="min-h-72 font-mono"
            value={xsd}
            onChange={(event) => setXsd(event.target.value)}
          />
        </div>
      </div>
      <Button onClick={() => void validate()}>
        {t('recommended.validate')}
      </Button>
      {result && <div className="rounded-lg border p-3 text-sm">{result}</div>}
      <ErrorMessage value={error} />
    </div>
  );
}

type MnemonicLanguage =
  | 'english'
  | 'simplified-chinese'
  | 'traditional-chinese'
  | 'japanese';

async function loadWordlist(language: MnemonicLanguage): Promise<string[]> {
  if (language === 'simplified-chinese')
    return (await import('@scure/bip39/wordlists/simplified-chinese.js'))
      .wordlist;
  if (language === 'traditional-chinese')
    return (await import('@scure/bip39/wordlists/traditional-chinese.js'))
      .wordlist;
  if (language === 'japanese')
    return (await import('@scure/bip39/wordlists/japanese.js')).wordlist;
  return (await import('@scure/bip39/wordlists/english.js')).wordlist;
}

export function MnemonicPanel() {
  const { t } = useTranslation();
  const [language, setLanguage] = useQueryParam<MnemonicLanguage>(
    'mnemonicLanguage',
    StringParam,
    'english',
  );
  const [words, setWords] = useQueryParam<number>(
    'mnemonicWords',
    NumberParam,
    12,
  );
  const [mnemonic, setMnemonic] = useState('');
  const [entropy, setEntropy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const generate = async () => {
    setError(null);
    try {
      const [{ generateMnemonic }, wordlist] = await Promise.all([
        import('@scure/bip39'),
        loadWordlist(language),
      ]);
      setMnemonic(generateMnemonic(wordlist, (words / 3) * 32));
      setEntropy('');
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  const validate = async () => {
    setError(null);
    try {
      const [{ mnemonicToEntropy, validateMnemonic }, wordlist] =
        await Promise.all([import('@scure/bip39'), loadWordlist(language)]);
      if (!validateMnemonic(mnemonic.trim(), wordlist))
        throw new Error(t('recommended.invalidMnemonic'));
      setEntropy(
        Array.from(mnemonicToEntropy(mnemonic.trim(), wordlist), (byte) =>
          byte.toString(16).padStart(2, '0'),
        ).join(''),
      );
    } catch (cause) {
      setEntropy('');
      setError((cause as Error).message);
    }
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t('recommended.language')}</Label>
          <Select
            value={language}
            onValueChange={(value) => setLanguage(value as MnemonicLanguage)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="english">English</SelectItem>
              <SelectItem value="simplified-chinese">简体中文</SelectItem>
              <SelectItem value="traditional-chinese">繁體中文</SelectItem>
              <SelectItem value="japanese">日本語</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t('recommended.wordCount')}</Label>
          <Select
            value={String(words)}
            onValueChange={(value) => setWords(Number(value))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[12, 15, 18, 21, 24].map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Textarea
        className="min-h-32 font-mono"
        value={mnemonic}
        onChange={(event) => setMnemonic(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void generate()}>
          {t('recommended.generate')}
        </Button>
        <Button variant="outline" onClick={() => void validate()}>
          {t('recommended.validate')}
        </Button>
        <CopyButton value={mnemonic} />
      </div>
      {entropy && (
        <div className="break-all rounded-lg border p-3 font-mono text-sm">
          Entropy: {entropy}
        </div>
      )}
      <ErrorMessage value={error} />
      <p className="text-xs text-muted-foreground">
        {t('recommended.mnemonicWarning')}
      </p>
    </div>
  );
}

const EMOJI_GROUPS = {
  people: [
    '😀',
    '😃',
    '😄',
    '😁',
    '😆',
    '😅',
    '😂',
    '🤣',
    '😊',
    '😇',
    '🙂',
    '🙃',
    '😉',
    '😍',
    '🥰',
    '😘',
    '😎',
    '🤓',
    '🧐',
    '🤔',
    '🫡',
    '🤗',
    '🤝',
    '👍',
    '👎',
    '👏',
    '🙌',
    '🙏',
    '💪',
    '👀',
    '❤️',
    '💔',
    '💯',
    '🔥',
    '✨',
    '🎉',
  ],
  nature: [
    '🐶',
    '🐱',
    '🐭',
    '🐹',
    '🐰',
    '🦊',
    '🐻',
    '🐼',
    '🐨',
    '🐯',
    '🦁',
    '🐮',
    '🐷',
    '🐸',
    '🐵',
    '🌱',
    '🌲',
    '🌳',
    '🌴',
    '🌵',
    '🌸',
    '🌹',
    '🌻',
    '🌞',
    '🌙',
    '⭐',
    '🌈',
    '⚡',
    '❄️',
  ],
  food: [
    '🍎',
    '🍐',
    '🍊',
    '🍋',
    '🍌',
    '🍉',
    '🍇',
    '🍓',
    '🫐',
    '🍒',
    '🥑',
    '🍅',
    '🥕',
    '🌽',
    '🍞',
    '🥐',
    '🧀',
    '🍔',
    '🍕',
    '🍜',
    '🍣',
    '🍰',
    '🍫',
    '☕',
    '🍺',
  ],
  travel: [
    '🚗',
    '🚕',
    '🚌',
    '🚎',
    '🏎️',
    '🚓',
    '🚑',
    '🚒',
    '🚲',
    '✈️',
    '🚀',
    '🚁',
    '🚢',
    '⚓',
    '🗺️',
    '🏠',
    '🏢',
    '🏰',
    '🗼',
    '🗽',
    '🌋',
    '🏕️',
    '🏖️',
  ],
  symbols: [
    '✅',
    '❌',
    '⚠️',
    '❓',
    '❗',
    '⭕',
    '🔴',
    '🟠',
    '🟡',
    '🟢',
    '🔵',
    '🟣',
    '⬆️',
    '⬇️',
    '⬅️',
    '➡️',
    '▶️',
    '⏸️',
    '⏹️',
    '🔒',
    '🔑',
    '💡',
    '📌',
    '📎',
    '🔗',
  ],
} as const;

const EMOJI_KEYWORDS: Record<keyof typeof EMOJI_GROUPS, string> = {
  people: 'people smile face emotion hand heart 人物 表情 笑 手 爱心',
  nature: 'nature animal plant weather 自然 动物 植物 天气',
  food: 'food drink fruit meal 食物 饮料 水果 餐',
  travel: 'travel transport place building 旅行 交通 地点 建筑',
  symbols: 'symbol arrow status sign 符号 箭头 状态 标记',
};

export function EmojiPanel() {
  const { t } = useTranslation();
  const [category, setCategory] = useQueryParam<string>(
    'emojiCategory',
    StringParam,
    'people',
  );
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const normalizedQuery = query.trim().toLowerCase();
  const emojis = normalizedQuery
    ? Object.entries(EMOJI_GROUPS)
        .filter(
          ([key, values]) =>
            EMOJI_KEYWORDS[key as keyof typeof EMOJI_GROUPS].includes(
              normalizedQuery,
            ) || values.some((emoji) => emoji.includes(normalizedQuery)),
        )
        .flatMap(([, values]) => values)
    : (EMOJI_GROUPS[category as keyof typeof EMOJI_GROUPS] ??
      EMOJI_GROUPS.people);
  const pick = (emoji: string) => {
    void navigator.clipboard.writeText(emoji);
    setRecent((items) =>
      [emoji, ...items.filter((item) => item !== emoji)].slice(0, 12),
    );
  };
  return (
    <div className="space-y-4">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('recommended.emojiSearch')}
      />
      <div className="flex flex-wrap gap-2">
        {Object.keys(EMOJI_GROUPS).map((key) => (
          <Button
            key={key}
            size="sm"
            variant={category === key ? 'default' : 'outline'}
            onClick={() => setCategory(key)}
          >
            {t(`recommended.emoji.${key}`)}
          </Button>
        ))}
      </div>
      {!!recent.length && (
        <div className="flex gap-1 rounded-lg border p-2">
          {recent.map((emoji) => (
            <button
              key={emoji}
              className="rounded p-1 text-xl hover:bg-muted"
              onClick={() => pick(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-8 gap-1 sm:grid-cols-12 md:grid-cols-16">
        {emojis.map((emoji, index) => (
          <button
            key={`${emoji}-${index}`}
            className="aspect-square rounded-md border text-2xl hover:bg-muted"
            title={emoji}
            onClick={() => pick(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LoremPanel() {
  const { t } = useTranslation();
  const [paragraphs, setParagraphs] = useQueryParam<number>(
    'loremParagraphs',
    NumberParam,
    3,
  );
  const [sentences, setSentences] = useQueryParam<number>(
    'loremSentences',
    NumberParam,
    4,
  );
  const output = generateLorem(
    Math.min(20, paragraphs),
    Math.min(20, sentences),
  );
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField
          label={t('recommended.paragraphs')}
          value={paragraphs}
          min={1}
          step={1}
          onChange={setParagraphs}
        />
        <NumberField
          label={t('recommended.sentences')}
          value={sentences}
          min={1}
          step={1}
          onChange={setSentences}
        />
      </div>
      <Textarea readOnly className="min-h-72" value={output} />
      <CopyButton value={output} />
    </div>
  );
}

const ASCII_FONTS = ['Standard', 'Small', 'Slant', 'Big', 'Banner3'] as const;
const ASCII_FONT_LOADERS = {
  Standard: () => import('figlet/fonts/Standard'),
  Small: () => import('figlet/fonts/Small'),
  Slant: () => import('figlet/fonts/Slant'),
  Big: () => import('figlet/fonts/Big'),
  Banner3: () => import('figlet/fonts/Banner3'),
} as const;

export function AsciiArtPanel() {
  const { t } = useTranslation();
  const [font, setFont] = useQueryParam<string>(
    'asciiFont',
    StringParam,
    'Standard',
  );
  const [input, setInput] = useState('TOOLS');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const selectedFont = ASCII_FONTS.includes(
      font as (typeof ASCII_FONTS)[number],
    )
      ? (font as (typeof ASCII_FONTS)[number])
      : 'Standard';
    void Promise.all([import('figlet'), ASCII_FONT_LOADERS[selectedFont]()])
      .then(([{ default: figlet }, fontModule]) => {
        figlet.parseFont(selectedFont, fontModule.default);
        const text = figlet.textSync(input.slice(0, 40), {
          font: selectedFont,
        });
        if (active) {
          setOutput(text);
          setError(null);
        }
      })
      .catch((cause: Error) => active && setError(cause.message));
    return () => {
      active = false;
    };
  }, [font, input]);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <Input
          value={input}
          maxLength={40}
          onChange={(event) => setInput(event.target.value)}
        />
        <Select value={font} onValueChange={setFont}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ASCII_FONTS.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <pre className="min-h-56 overflow-auto rounded-xl border bg-muted/30 p-4 text-xs leading-none">
        {output}
      </pre>
      <CopyButton value={output} />
      <ErrorMessage value={error} />
      {!/^[\x20-\x7e]*$/.test(input) && (
        <p className="text-xs text-muted-foreground">
          {t('recommended.asciiOnly')}
        </p>
      )}
    </div>
  );
}

function formatStopwatch(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1_000);
  const hundredths = Math.floor((milliseconds % 1_000) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

export function StopwatchPanel() {
  const { t } = useTranslation();
  const startedAt = useRef(0);
  const elapsedBeforeStart = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(
      () =>
        setElapsed(
          elapsedBeforeStart.current + performance.now() - startedAt.current,
        ),
      10,
    );
    return () => window.clearInterval(timer);
  }, [running]);
  const toggle = () => {
    if (running) elapsedBeforeStart.current = elapsed;
    else startedAt.current = performance.now();
    setRunning(!running);
  };
  const reset = () => {
    setRunning(false);
    setElapsed(0);
    setLaps([]);
    elapsedBeforeStart.current = 0;
  };
  return (
    <div className="mx-auto max-w-xl space-y-5 text-center">
      <div className="rounded-2xl border p-8 font-mono text-5xl font-semibold tabular-nums sm:text-7xl">
        {formatStopwatch(elapsed)}
      </div>
      <div className="flex justify-center gap-2">
        <Button onClick={toggle}>
          <Play className="h-4 w-4" />
          {running ? t('recommended.pause') : t('recommended.start')}
        </Button>
        <Button
          variant="outline"
          disabled={!elapsed}
          onClick={() => setLaps((values) => [...values, elapsed])}
        >
          {t('recommended.lap')}
        </Button>
        <Button variant="ghost" onClick={reset}>
          <RotateCcw className="h-4 w-4" />
          {t('recommended.reset')}
        </Button>
      </div>
      {!!laps.length && (
        <div className="divide-y rounded-xl border text-sm">
          {laps.map((lap, index) => (
            <div key={index} className="flex justify-between px-4 py-2">
              <span>
                {t('recommended.lap')} {index + 1}
              </span>
              <span className="font-mono">{formatStopwatch(lap)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface CapturedEvent {
  id: number;
  type: string;
  detail: string;
  time: string;
}

export function EventInspectorPanel() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<CapturedEvent[]>([]);
  const eventId = useRef(0);
  const capture = (event: React.SyntheticEvent<HTMLDivElement>) => {
    const native = event.nativeEvent;
    let detail = '';
    if (native instanceof KeyboardEvent)
      detail = `key=${native.key} code=${native.code}`;
    else if (native instanceof PointerEvent)
      detail = `x=${Math.round(native.clientX)} y=${Math.round(native.clientY)} button=${native.button}`;
    else if (native instanceof WheelEvent)
      detail = `deltaX=${Math.round(native.deltaX)} deltaY=${Math.round(native.deltaY)}`;
    else if (native instanceof ClipboardEvent)
      detail = `types=${[...(native.clipboardData?.types ?? [])].join(', ')}`;
    setEvents((items) =>
      [
        {
          id: eventId.current++,
          type: native.type,
          detail,
          time: new Date().toLocaleTimeString(),
        },
        ...items,
      ].slice(0, 50),
    );
  };
  return (
    <div className="space-y-4">
      <div
        tabIndex={0}
        className="flex min-h-48 items-center justify-center rounded-xl border-2 border-dashed p-6 text-center outline-none focus:border-primary"
        onKeyDown={capture}
        onKeyUp={capture}
        onPointerDown={capture}
        onPointerUp={capture}
        onPointerMove={capture}
        onWheel={capture}
        onCopy={capture}
        onPaste={capture}
      >
        {t('recommended.eventArea')}
      </div>
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setEvents([])}>
          {t('recommended.clear')}
        </Button>
      </div>
      <div className="max-h-80 divide-y overflow-auto rounded-xl border font-mono text-xs">
        {events.map((event) => (
          <div
            key={event.id}
            className="grid grid-cols-[5rem_7rem_1fr] gap-2 px-3 py-2"
          >
            <span className="text-muted-foreground">{event.time}</span>
            <strong>{event.type}</strong>
            <span>{event.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FileSplitMergePanel() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<'split' | 'merge'>(
    'fileMode',
    StringParam,
    'split',
  );
  const [files, setFiles] = useState<DroppedFile[]>([]);
  const [chunkMb, setChunkMb] = useQueryParam<number>(
    'chunkMb',
    NumberParam,
    100,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const process = async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'split') {
        const file = files[0]!.file;
        const chunkSize = Math.max(1, chunkMb) * 1024 * 1024;
        const chunks = Array.from(
          { length: Math.ceil(file.size / chunkSize) },
          (_, index) => file.slice(index * chunkSize, (index + 1) * chunkSize),
        );
        const hashes = await Promise.all(chunks.map(sha256));
        const entries: Record<string, Uint8Array<ArrayBuffer>> = {};
        for (let index = 0; index < chunks.length; index += 1)
          entries[`${file.name}.part${String(index + 1).padStart(4, '0')}`] =
            new Uint8Array(await chunks[index]!.arrayBuffer());
        entries['manifest.json'] = new TextEncoder().encode(
          JSON.stringify(
            {
              name: file.name,
              size: file.size,
              chunks: hashes.map((hash, index) => ({
                name: `${file.name}.part${String(index + 1).padStart(4, '0')}`,
                sha256: hash,
              })),
            },
            null,
            2,
          ),
        );
        const { zipSync } = await import('fflate');
        downloadBytes(
          zipSync(entries),
          `${file.name}.parts.zip`,
          'application/zip',
        );
      } else {
        const parts = files
          .map(({ file }) => file)
          .filter((file) => /\.part\d+$/i.test(file.name))
          .sort((a, b) => numericPartOrder(a.name) - numericPartOrder(b.name));
        if (!parts.length) throw new Error(t('recommended.noParts'));
        if (
          parts.some((part, index) => numericPartOrder(part.name) !== index + 1)
        )
          throw new Error(t('recommended.missingParts'));
        const manifestFile = files.find(
          ({ file }) => file.name === 'manifest.json',
        )?.file;
        if (manifestFile) {
          const manifest = JSON.parse(await manifestFile.text()) as {
            chunks: Array<{ name: string; sha256: string }>;
          };
          if (manifest.chunks.length !== parts.length)
            throw new Error(t('recommended.manifestMismatch'));
          const hashes = await Promise.all(parts.map(sha256));
          if (
            parts.some(
              (part, index) =>
                manifest.chunks[index]?.name !== part.name ||
                manifest.chunks[index]?.sha256 !== hashes[index],
            )
          )
            throw new Error(t('recommended.manifestMismatch'));
        }
        const baseName = parts[0]!.name.replace(/\.part\d+$/i, '');
        downloadBlob(new Blob(parts), baseName);
      }
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={mode === 'split' ? 'default' : 'outline'}
          onClick={() => {
            setMode('split');
            setFiles([]);
          }}
        >
          {t('recommended.split')}
        </Button>
        <Button
          size="sm"
          variant={mode === 'merge' ? 'default' : 'outline'}
          onClick={() => {
            setMode('merge');
            setFiles([]);
          }}
        >
          {t('recommended.merge')}
        </Button>
      </div>
      <FileDropzone
        multiple={mode === 'merge'}
        onFiles={setFiles}
        className="flex min-h-36 items-center justify-center rounded-xl p-6 text-center"
      >
        <div>
          <FileArchive className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          {t(
            mode === 'split'
              ? 'recommended.dropSplit'
              : 'recommended.dropMerge',
          )}
        </div>
      </FileDropzone>
      {mode === 'split' && (
        <NumberField
          label={t('recommended.chunkSize')}
          value={chunkMb}
          min={1}
          step={1}
          onChange={setChunkMb}
        />
      )}
      {!!files.length && (
        <div className="text-sm text-muted-foreground">
          {files.map(({ file }) => file.name).join(', ')}
        </div>
      )}
      <ErrorMessage value={error} />
      <Button
        disabled={!files.length || loading}
        onClick={() => void process()}
      >
        <Download className="h-4 w-4" />
        {loading
          ? t('recommended.processing')
          : t(
              mode === 'split'
                ? 'recommended.downloadParts'
                : 'recommended.downloadMerged',
            )}
      </Button>
    </div>
  );
}
