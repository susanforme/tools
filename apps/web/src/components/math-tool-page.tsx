import {
  StringParam,
  NumberParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { MATH_TOOLS, type MathToolId } from '@/lib/math-tool-catalog';
import {
  calculateMath,
  formatMathNumber,
  type MathInput,
  type MathResult,
} from '@/lib/math-tools';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChoiceField } from './calculator-ui';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

export function MathToolPage({ tool }: { tool: MathToolId }) {
  const { t } = useTranslation();
  const config = MATH_TOOLS.find(({ id }) => id === tool)!;
  const defaults = (): MathInput =>
    Object.fromEntries(config.fields.map(({ key, value }) => [key, value]));
  const [input, setInput] = useState<MathInput>(defaults);
  const [query, setQuery] = useQueryParams<{
    mode: string;
    digits: number;
    places: number;
  }>({ mode: StringParam, digits: NumberParam, places: NumberParam });
  const mode = query.mode ?? config.modes[0] ?? '';
  const effectiveInput = { ...input };
  if (query.digits != null && tool === 'scientific-notation')
    effectiveInput.digits = String(query.digits);
  if (query.places != null && tool === 'rounding-calculator')
    effectiveInput.places = String(query.places);
  const [results, setResults] = useState<MathResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>(
    'idle',
  );
  // 结果绑定输入快照；浏览器前进/后退或 URL 更新后不显示旧结果。
  const [snapshot, setSnapshot] = useState('');
  const currentSnapshot = JSON.stringify([effectiveInput, mode]);
  const fresh = snapshot === currentSnapshot;
  const prefix = `mathTools.tools.${tool}`;
  const text = (item: MathResult): string =>
    typeof item.value === 'number'
      ? formatMathNumber(item.value)
      : ['yes', 'no', 'none'].includes(item.value)
        ? t(`mathTools.${item.value}`)
        : item.value;
  const fields = config.fields.filter(
    ({ key }) =>
      !(
        tool === 'matrix-calculator' &&
        key === 'b' &&
        ['transpose', 'determinant', 'inverse'].includes(mode)
      ),
  );
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold">{t(`${prefix}.title`)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(`${prefix}.description`)}
        </p>
      </header>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setSnapshot(currentSnapshot);
          setCopyState('idle');
          try {
            setResults(calculateMath(tool, effectiveInput, mode));
            setError(null);
          } catch (cause) {
            setResults(null);
            setError((cause as Error).message);
          }
        }}
      >
        {config.modes.length > 0 && (
          <ChoiceField
            label={t('mathTools.mode')}
            value={mode}
            onChange={(value) => setQuery({ mode: value })}
            options={config.modes.map((value) => ({
              value,
              label: t(`${prefix}.modes.${value}`),
            }))}
          />
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map((field) => {
            const id = `${tool}-${field.key}`;
            const onChange = (value: string): void => {
              setInput((previous) => ({ ...previous, [field.key]: value }));
              if (field.key === 'digits' || field.key === 'places')
                setQuery({
                  [field.key]:
                    value.trim() && Number.isFinite(Number(value))
                      ? Number(value)
                      : undefined,
                });
            };
            return (
              <div key={field.key} className="min-w-0 space-y-2">
                <Label htmlFor={id}>{t(`${prefix}.fields.${field.key}`)}</Label>
                {'multiline' in field ? (
                  <Textarea
                    id={id}
                    className="min-h-32 font-mono"
                    value={effectiveInput[field.key]}
                    maxLength={200000}
                    onChange={(event) => onChange(event.target.value)}
                  />
                ) : (
                  <Input
                    id={id}
                    value={effectiveInput[field.key]}
                    maxLength={tool === 'fraction-calculator' ? 203 : 120}
                    onChange={(event) => onChange(event.target.value)}
                  />
                )}
              </div>
            );
          })}
        </div>
        {t(`${prefix}.note`, { defaultValue: '' }) && (
          <p className="text-sm text-muted-foreground">{t(`${prefix}.note`)}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{t('mathTools.calculate')}</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setInput(defaults());
              setQuery({
                mode: undefined,
                digits: undefined,
                places: undefined,
              });
              setResults(null);
              setError(null);
              setCopyState('idle');
            }}
          >
            {t('mathTools.example')}
          </Button>
        </div>
      </form>
      {fresh && error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {t('mathTools.error', {
            message: t(`mathTools.errors.${error}`, {
              defaultValue: t('mathTools.errors.domain'),
            }),
          })}
        </p>
      )}
      {fresh && results && (
        <section aria-label={t('mathTools.resultTitle')} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {t('mathTools.resultTitle')}
            </h2>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    results
                      .map(
                        (item) =>
                          `${t(`mathTools.results.${item.key}`)}: ${text(item)}`,
                      )
                      .join('\n'),
                  );
                  setCopyState('copied');
                } catch {
                  setCopyState('error');
                }
              }}
            >
              {t(
                copyState === 'copied' ? 'mathTools.copied' : 'mathTools.copy',
              )}
            </Button>
          </div>
          {copyState === 'error' && (
            <p role="alert" className="text-sm text-destructive">
              {t('mathTools.copyError')}
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-2" aria-live="polite">
            {results.map((item) => (
              <div key={item.key} className="min-w-0 rounded-lg border p-4">
                <div className="text-sm text-muted-foreground">
                  {t(`mathTools.results.${item.key}`)}
                </div>
                <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all font-mono text-lg tabular-nums">
                  {text(item)}
                </pre>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
