import { ArrayParam, useQueryParam } from '@/hooks/useQueryParams';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';

export const Route = createFileRoute('/csp')({ component: CspPage });

const DIRECTIVES = [
  ['default-src', "'self'"],
  ['script-src', "'self'"],
  ['style-src', "'self' 'unsafe-inline'"],
  ['img-src', "'self' data: https:"],
  ['font-src', "'self' data:"],
  ['connect-src', "'self' https:"],
  ['frame-ancestors', "'none'"],
] as const;

function CspPage() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useQueryParam(
    'directives',
    ArrayParam,
    DIRECTIVES.map(([name]) => name),
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(DIRECTIVES),
  );
  const output = useMemo(
    () =>
      DIRECTIVES.filter(([name]) => enabled.includes(name))
        .map(([name]) => `${name} ${values[name]}`)
        .join('; '),
    [enabled, values],
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('cspTool.title')}</h1>
      <div className="space-y-2 rounded-lg border p-4">
        {DIRECTIVES.map(([name]) => (
          <div
            key={name}
            className="grid items-center gap-3 sm:grid-cols-[180px_1fr]"
          >
            <div className="flex items-center gap-2">
              <Checkbox
                id={name}
                checked={enabled.includes(name)}
                onCheckedChange={(checked) =>
                  setEnabled(
                    checked
                      ? [...new Set([...enabled, name])]
                      : enabled.filter((value) => value !== name),
                  )
                }
              />
              <Label htmlFor={name} className="font-mono text-xs">
                {name}
              </Label>
            </div>
            <Input
              value={values[name]}
              disabled={!enabled.includes(name)}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [name]: event.target.value,
                }))
              }
              className="font-mono text-xs"
            />
          </div>
        ))}
      </div>
      <Textarea
        readOnly
        value={output}
        className="min-h-40 font-mono text-xs"
      />
    </div>
  );
}
