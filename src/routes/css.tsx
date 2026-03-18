import {
  NumberParam,
  StringParam,
  useQueryParam,
  useQueryParams,
  withDefault,
} from '@/hooks/useQueryParams';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CodePanel } from '../components/code-panel';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';

type TabType = 'format' | 'minify' | 'scss' | 'convert';
type UnitField = 'px' | 'vw' | 'rem';
type ConvertErrorKey =
  | 'invalidValue'
  | 'invalidViewport'
  | 'invalidRoot'
  | 'invalidBoth'
  | null;
type ConvertQuery = { vwBase: number; remBase: number };
type ConvertValues = {
  px: string;
  vw: string;
  rem: string;
  lastEdited: UnitField;
};

const VIEWPORT_PRESETS = [
  320, 360, 375, 390, 414, 768, 1024, 1280, 1440, 1920,
] as const;
const DEFAULT_VIEWPORT_WIDTH = 375;
const DEFAULT_ROOT_FONT_SIZE = 16;
const DEFAULT_PX_VALUE = '16';

export const Route = createFileRoute('/css')({
  component: CssPage,
});

/** 简易 CSS 压缩：移除注释与多余空白 */
function minifyCssString(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '') // 移除注释
    .replace(/\s+/g, ' ') // 合并空白
    .replace(/\s*([{}:;,>~+])\s*/g, '$1') // 移除特殊符号周围的空白
    .replace(/;}/g, '}') // 移除末尾分号
    .trim();
}

function parseNumberInput(rawValue: string): number | null {
  if (!rawValue.trim()) return null;

  const value = Number(rawValue);
  return Number.isFinite(value) ? value : null;
}

function parsePositiveNumber(rawValue: string): number | null {
  const value = parseNumberInput(rawValue);
  return value !== null && value > 0 ? value : null;
}

function formatUnitValue(value: number): string {
  const normalized = Math.abs(value) < 1e-10 ? 0 : value;
  return Number(normalized.toFixed(6)).toString();
}

function getBaseErrorKey(
  viewportWidth: number | null,
  rootFontSize: number | null,
): Exclude<ConvertErrorKey, 'invalidValue'> {
  if (viewportWidth === null && rootFontSize === null) return 'invalidBoth';
  if (viewportWidth === null) return 'invalidViewport';
  if (rootFontSize === null) return 'invalidRoot';
  return null;
}

function buildConvertValues(
  sourceField: UnitField,
  rawValue: string,
  viewportWidth: number | null,
  rootFontSize: number | null,
): {
  values: Omit<ConvertValues, 'lastEdited'>;
  errorKey: ConvertErrorKey;
} {
  const values = { px: '', vw: '', rem: '' };

  if (!rawValue.trim()) {
    return { values, errorKey: null };
  }

  const sourceValue = parseNumberInput(rawValue);
  if (sourceValue === null) {
    return {
      values: { ...values, [sourceField]: rawValue },
      errorKey: 'invalidValue',
    };
  }

  if (sourceField === 'px') {
    return {
      values: {
        px: rawValue,
        vw:
          viewportWidth === null
            ? ''
            : formatUnitValue((sourceValue / viewportWidth) * 100),
        rem:
          rootFontSize === null
            ? ''
            : formatUnitValue(sourceValue / rootFontSize),
      },
      errorKey: getBaseErrorKey(viewportWidth, rootFontSize),
    };
  }

  if (sourceField === 'vw') {
    if (viewportWidth === null) {
      return {
        values: { ...values, vw: rawValue },
        errorKey: getBaseErrorKey(viewportWidth, rootFontSize),
      };
    }

    const pxValue = (sourceValue * viewportWidth) / 100;
    return {
      values: {
        px: formatUnitValue(pxValue),
        vw: rawValue,
        rem:
          rootFontSize === null ? '' : formatUnitValue(pxValue / rootFontSize),
      },
      errorKey: getBaseErrorKey(viewportWidth, rootFontSize),
    };
  }

  if (rootFontSize === null) {
    return {
      values: { ...values, rem: rawValue },
      errorKey: getBaseErrorKey(viewportWidth, rootFontSize),
    };
  }

  const pxValue = sourceValue * rootFontSize;
  return {
    values: {
      px: formatUnitValue(pxValue),
      vw:
        viewportWidth === null
          ? ''
          : formatUnitValue((pxValue / viewportWidth) * 100),
      rem: rawValue,
    },
    errorKey: getBaseErrorKey(viewportWidth, rootFontSize),
  };
}

const DEFAULT_CSS = `.container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background-color: #f9f9f9;
}

.title {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}`;

const DEFAULT_SCSS = `$primary: #3b82f6;
$spacing: 8px;

.container {
  display: flex;
  gap: $spacing * 2;
  padding: $spacing;

  .title {
    font-size: 24px;
    color: $primary;
    &:hover { opacity: 0.8; }
  }
}`;

function useTool(initialInput = '') {
  const [input, setInput] = useState(initialInput);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const clear = () => {
    setInput('');
    setOutput('');
    setError(null);
  };
  return {
    input,
    setInput,
    output,
    setOutput,
    error,
    setError,
    loading,
    setLoading,
    clear,
  };
}

type UnitInputProps = {
  label: string;
  value: string;
  suffix: string;
  placeholder: string;
  onChange: (value: string) => void;
};

function UnitInput({
  label,
  value,
  suffix,
  placeholder,
  onChange,
}: UnitInputProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <div className="flex gap-2">
        <Input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="font-mono"
        />
        <div className="h-9 min-w-12 rounded-md border bg-muted/40 px-3 text-sm font-mono text-muted-foreground flex items-center justify-center">
          {suffix}
        </div>
      </div>
    </div>
  );
}

function CssPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useQueryParam<TabType>('tab', StringParam, 'format');
  const [convertQuery, setConvertQuery] = useQueryParams<ConvertQuery>({
    vwBase: withDefault<number>(NumberParam, DEFAULT_VIEWPORT_WIDTH),
    remBase: withDefault<number>(NumberParam, DEFAULT_ROOT_FONT_SIZE),
  });
  const fmt = useTool(DEFAULT_CSS);
  const min = useTool(DEFAULT_CSS);
  const scss = useTool(DEFAULT_SCSS);
  const queryViewportWidth = convertQuery.vwBase ?? DEFAULT_VIEWPORT_WIDTH;
  const queryRootFontSize = convertQuery.remBase ?? DEFAULT_ROOT_FONT_SIZE;
  const [viewportWidthInput, setViewportWidthInput] = useState(
    String(queryViewportWidth),
  );
  const [rootFontSizeInput, setRootFontSizeInput] = useState(
    String(queryRootFontSize),
  );
  const [convertValues, setConvertValues] = useState<ConvertValues>(() => {
    const { values } = buildConvertValues(
      'px',
      DEFAULT_PX_VALUE,
      DEFAULT_VIEWPORT_WIDTH,
      DEFAULT_ROOT_FONT_SIZE,
    );
    return { ...values, lastEdited: 'px' };
  });
  const [convertErrorKey, setConvertErrorKey] = useState<ConvertErrorKey>(null);
  const viewportWidth = parsePositiveNumber(viewportWidthInput);
  const rootFontSize = parsePositiveNumber(rootFontSizeInput);

  useEffect(() => {
    setViewportWidthInput(String(queryViewportWidth));
  }, [queryViewportWidth]);

  useEffect(() => {
    setRootFontSizeInput(String(queryRootFontSize));
  }, [queryRootFontSize]);

  useEffect(() => {
    const sourceField = convertValues.lastEdited;
    const sourceValue = convertValues[sourceField];
    const { values, errorKey } = buildConvertValues(
      sourceField,
      sourceValue,
      viewportWidth,
      rootFontSize,
    );

    setConvertValues((prev) => ({ ...prev, ...values }));
    setConvertErrorKey(errorKey);
  }, [rootFontSize, viewportWidth]);

  const syncConvertValues = (sourceField: UnitField, rawValue: string) => {
    const { values, errorKey } = buildConvertValues(
      sourceField,
      rawValue,
      viewportWidth,
      rootFontSize,
    );

    setConvertValues({ ...values, lastEdited: sourceField });
    setConvertErrorKey(errorKey);
  };

  const handleViewportWidthChange = (rawValue: string) => {
    setViewportWidthInput(rawValue);

    const value = parsePositiveNumber(rawValue);
    if (value !== null) {
      setConvertQuery({ vwBase: value });
    }
  };

  const handleRootFontSizeChange = (rawValue: string) => {
    setRootFontSizeInput(rawValue);

    const value = parsePositiveNumber(rawValue);
    if (value !== null) {
      setConvertQuery({ remBase: value });
    }
  };

  const handleViewportPreset = (preset: number) => {
    setViewportWidthInput(String(preset));
    setConvertQuery({ vwBase: preset });
  };

  const clearConvertValues = () => {
    setConvertValues({ px: '', vw: '', rem: '', lastEdited: 'px' });
    setConvertErrorKey(null);
  };

  const convertError =
    convertErrorKey === 'invalidValue'
      ? t('css.convertValueError')
      : convertErrorKey === 'invalidBoth'
        ? t('css.convertBothBaseError')
        : convertErrorKey === 'invalidViewport'
          ? t('css.convertViewportError')
          : convertErrorKey === 'invalidRoot'
            ? t('css.convertRootError')
            : null;

  const formatCss = async () => {
    fmt.setError(null);
    fmt.setLoading(true);
    try {
      const prettier = await import('prettier/standalone');
      const parserPostcss = await import('prettier/plugins/postcss');
      const result = await prettier.format(fmt.input, {
        parser: 'css',
        plugins: [parserPostcss],
        printWidth: 80,
        tabWidth: 2,
      });
      fmt.setOutput(result);
    } catch (e) {
      fmt.setError(t('css.formatError', { msg: (e as Error).message }));
    } finally {
      fmt.setLoading(false);
    }
  };

  const minifyCss = () => {
    min.setError(null);
    try {
      if (!min.input.trim()) return;
      min.setOutput(minifyCssString(min.input));
    } catch (e) {
      min.setError(t('css.minifyError', { msg: (e as Error).message }));
    }
  };

  const compileScssToCss = async () => {
    scss.setError(null);
    scss.setLoading(true);
    try {
      const { compileStringAsync } = await import('sass');
      const result = await compileStringAsync(scss.input, {
        style: 'expanded',
      });
      scss.setOutput(result.css);
    } catch (e) {
      scss.setError(t('css.scssError', { msg: (e as Error).message }));
    } finally {
      scss.setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('css.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('css.desc')}</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabType)}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="format">{t('css.tabFormat')}</TabsTrigger>
          <TabsTrigger value="minify">{t('css.tabMinify')}</TabsTrigger>
          <TabsTrigger value="scss">{t('css.tabScss')}</TabsTrigger>
          <TabsTrigger value="convert">{t('css.tabConvert')}</TabsTrigger>
        </TabsList>

        <TabsContent value="format" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={formatCss}
              disabled={fmt.loading || !fmt.input.trim()}
            >
              {fmt.loading ? t('css.processing') : t('css.format')}
            </Button>
            <Button size="sm" variant="ghost" onClick={fmt.clear}>
              {t('css.clear')}
            </Button>
          </div>
          <CodePanel
            input={fmt.input}
            output={fmt.output}
            onInputChange={fmt.setInput}
            inputPlaceholder={`.container{display:flex;gap:8px;}`}
            error={fmt.error}
            language="css"
          />
        </TabsContent>

        <TabsContent value="minify" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={minifyCss} disabled={!min.input.trim()}>
              {t('css.minify')}
            </Button>
            <Button size="sm" variant="ghost" onClick={min.clear}>
              {t('css.clear')}
            </Button>
          </div>
          <CodePanel
            input={min.input}
            output={min.output}
            onInputChange={min.setInput}
            inputPlaceholder={`.container {\n  display: flex;\n  gap: 8px;\n}`}
            error={min.error}
            language="css"
          />
        </TabsContent>

        <TabsContent value="scss" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={compileScssToCss}
              disabled={scss.loading || !scss.input.trim()}
            >
              {scss.loading ? t('css.compiling') : t('css.compile')}
            </Button>
            <Button size="sm" variant="ghost" onClick={scss.clear}>
              {t('css.clear')}
            </Button>
          </div>
          <CodePanel
            input={scss.input}
            output={scss.output}
            onInputChange={scss.setInput}
            inputPlaceholder={`$primary: #3b82f6;\n\n.container {\n  color: $primary;\n  &:hover { opacity: 0.8; }\n}`}
            error={scss.error}
            language="scss"
            outputLanguage="css"
          />
        </TabsContent>

        <TabsContent value="convert" className="space-y-4 mt-4">
          <div className="rounded-xl border bg-card p-4 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-medium">{t('css.convertTitle')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('css.convertHint')}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={clearConvertValues}>
                {t('css.clear')}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">{t('css.viewportWidth')}</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={viewportWidthInput}
                    onChange={(e) => handleViewportWidthChange(e.target.value)}
                    placeholder="375"
                    className="font-mono"
                  />
                  <div className="h-9 min-w-12 rounded-md border bg-muted/40 px-3 text-sm font-mono text-muted-foreground flex items-center justify-center">
                    px
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">
                    {t('css.commonResolutions')}
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {VIEWPORT_PRESETS.map((preset) => (
                      <Button
                        key={preset}
                        type="button"
                        size="xs"
                        variant={
                          viewportWidth === preset ? 'default' : 'outline'
                        }
                        className="font-mono"
                        onClick={() => handleViewportPreset(preset)}
                      >
                        {preset}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">{t('css.rootFontSize')}</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={rootFontSizeInput}
                    onChange={(e) => handleRootFontSizeChange(e.target.value)}
                    placeholder="16"
                    className="font-mono"
                  />
                  <div className="h-9 min-w-12 rounded-md border bg-muted/40 px-3 text-sm font-mono text-muted-foreground flex items-center justify-center">
                    px
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('css.rootFontHint')}
                </p>
              </div>
            </div>

            {convertError && (
              <div className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                {convertError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <UnitInput
                label={t('css.px')}
                value={convertValues.px}
                suffix="px"
                placeholder="16"
                onChange={(value) => syncConvertValues('px', value)}
              />
              <UnitInput
                label={t('css.vw')}
                value={convertValues.vw}
                suffix="vw"
                placeholder="4.266667"
                onChange={(value) => syncConvertValues('vw', value)}
              />
              <UnitInput
                label={t('css.rem')}
                value={convertValues.rem}
                suffix="rem"
                placeholder="1"
                onChange={(value) => syncConvertValues('rem', value)}
              />
            </div>

            <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 font-mono">
              {t('css.convertFormula')}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
