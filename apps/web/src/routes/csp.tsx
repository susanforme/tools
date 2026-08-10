import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PermissionsPolicyPanel } from '@/components/modern-web-tool-panels';
import { ArrayParam, StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { inspectSecurityHeaders } from '@/lib/advanced-tools';
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
  const [tab, setTab] = useQueryParam<'generate' | 'analyze' | 'permissions'>(
    'tab',
    StringParam,
    'generate',
  );
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
      <Tabs
        value={tab}
        onValueChange={(value) =>
          setTab(value as 'generate' | 'analyze' | 'permissions')
        }
      >
        <TabsList>
          <TabsTrigger value="generate">{t('cspTool.tabGenerate')}</TabsTrigger>
          <TabsTrigger value="analyze">{t('cspTool.tabAnalyze')}</TabsTrigger>
          <TabsTrigger value="permissions">Permissions-Policy</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'permissions' ? (
        <PermissionsPolicyPanel />
      ) : tab === 'analyze' ? (
        <SecurityHeadersPanel />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}

function SecurityHeadersPanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState(
    "Content-Security-Policy: default-src 'self'\nX-Content-Type-Options: nosniff",
  );
  const findings = useMemo(() => inspectSecurityHeaders(input), [input]);
  return (
    <div className="space-y-4">
      <Textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="min-h-56 font-mono text-xs"
        placeholder={t('cspTool.headersPlaceholder')}
      />
      <div className="space-y-2">
        {findings.map((finding) => (
          <div
            key={finding.header}
            className="grid gap-2 rounded-md border px-3 py-2 text-sm sm:grid-cols-[14rem_6rem_1fr]"
          >
            <code>{finding.header}</code>
            <span
              className={
                finding.state === 'present'
                  ? 'text-emerald-600'
                  : finding.state === 'warning'
                    ? 'text-amber-600'
                    : 'text-destructive'
              }
            >
              {t(`cspTool.status.${finding.state}`)}
            </span>
            <span className="break-all font-mono text-muted-foreground">
              {finding.value || '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
