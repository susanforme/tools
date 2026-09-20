import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { createSelectorPreview } from '@/lib/selector-preview';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const SAMPLE =
  '<main><h1>Store</h1><ul><li class="active">First item</li><li>Second item</li><li class="active">Third item</li></ul></main>';
export default function SelectorVisualPanel() {
  const { t } = useTranslation();
  const [source, setSource] = useState(SAMPLE);
  const [selector, setSelector] = useQueryParam<string>(
    'selector',
    StringParam,
    'li.active',
  );
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof createSelectorPreview>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const epoch = useRef(0);
  useEffect(
    () => () => {
      epoch.current++;
    },
    [],
  );
  function clearResult() {
    epoch.current++;
    setResult(null);
    setError(null);
  }
  async function run() {
    clearResult();
    const version = epoch.current;
    try {
      const next = await createSelectorPreview(source, selector);
      if (version === epoch.current) setResult(next);
    } catch (cause) {
      if (version === epoch.current) setError((cause as Error).message);
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('communityVisual.selector.limit')}
      </p>
      <Label htmlFor="selector-html">HTML</Label>
      <Textarea
        id="selector-html"
        className="min-h-48 font-mono"
        value={source}
        onChange={(e) => {
          clearResult();
          setSource(e.target.value);
        }}
      />
      <Label htmlFor="selector-rule">
        {t('communityVisual.selector.selector')}
      </Label>
      <Input
        id="selector-rule"
        value={selector}
        onChange={(e) => {
          clearResult();
          setSelector(e.target.value);
        }}
      />
      <Button onClick={() => void run()}>{t('communityVisual.run')}</Button>
      {error && (
        <p role="alert" className="break-all text-sm text-destructive">
          {t('communityVisual.failed', {
            msg: t(`communityVisual.errors.${error}`, { defaultValue: error }),
          })}
        </p>
      )}
      {result && (
        <>
          <p role="status">
            {t('communityVisual.selector.matched', { count: result.count })}
          </p>
          <iframe
            title={t('communityVisual.selector.preview')}
            sandbox=""
            srcDoc={result.html}
            className="h-80 w-full rounded-md border bg-white"
          />
          <details>
            <summary className="cursor-pointer">
              {t('communityVisual.selector.results')}
            </summary>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md border p-3 text-xs">
              {result.snippets.join('\n\n')}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}
