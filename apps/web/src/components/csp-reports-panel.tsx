import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  groupCspReports,
  parseCspReports,
  type CspReport,
} from '@/lib/csp-reports';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const EXAMPLE = JSON.stringify(
  [
    {
      'csp-report': {
        'document-uri': 'https://example.com/',
        'blocked-uri': 'https://cdn.example.net/script.js',
        'effective-directive': 'script-src-elem',
        disposition: 'enforce',
      },
    },
  ],
  null,
  2,
);
export default function CspReportsPanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState(EXAMPLE);
  const [reports, setReports] = useState<CspReport[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useQueryParam<'directive' | 'blocked' | 'document'>(
    'group',
    StringParam,
    'directive',
  );
  const [busy, setBusy] = useState(false);
  const process = (text = input) => {
    setError(null);
    setReports([]);
    try {
      setReports(parseCspReports(text));
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  return (
    <div className="space-y-4">
      <Label htmlFor="csp-report-file">
        {t('browserInspection.reportFile')}
      </Label>
      <Input
        id="csp-report-file"
        type="file"
        accept=".json,application/json"
        disabled={busy}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setBusy(true);
          setError(null);
          setReports([]);
          try {
            if (file.size > 5 * 1024 * 1024)
              throw new Error(t('browserInspection.reportLimit'));
            const text = await file.text();
            setInput(text);
            process(text);
          } catch (cause) {
            setError((cause as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      <Label htmlFor="csp-report-input">
        {t('browserInspection.reportJson')}
      </Label>
      <Textarea
        id="csp-report-input"
        disabled={busy}
        value={input}
        onChange={(event) => {
          setInput(event.target.value);
          setReports([]);
        }}
        className="min-h-56 font-mono text-xs"
      />
      <Button disabled={busy || !input.trim()} onClick={() => process()}>
        {t('browserInspection.analyze')}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t('browserInspection.failed', { message: error })}
        </p>
      )}
      {reports.length > 0 && (
        <>
          <p className="text-sm">
            {t('browserInspection.reportCount', { count: reports.length })}
          </p>
          <Tabs
            value={group}
            onValueChange={(value) => setGroup(value as typeof group)}
          >
            <TabsList className="h-auto flex-wrap">
              {(['directive', 'blocked', 'document'] as const).map((field) => (
                <TabsTrigger key={field} value={field}>
                  {t(`browserInspection.${field}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="max-h-80 overflow-auto rounded border">
            {groupCspReports(
              reports,
              ['directive', 'blocked', 'document'].includes(group)
                ? group
                : 'directive',
            ).map(({ value, count }) => (
              <div
                key={value}
                className="flex justify-between gap-3 border-b p-2 text-sm"
              >
                <code className="break-all">{value || '—'}</code>
                <span>{count}</span>
              </div>
            ))}
          </div>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  {['document', 'directive', 'blocked', 'source'].map(
                    (name) => (
                      <th className="p-2" key={name}>
                        {t(`browserInspection.${name}`)}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {reports.slice(0, 500).map((report, index) => (
                  <tr key={index} className="border-t">
                    <td className="max-w-64 break-all p-2">
                      {report.document}
                    </td>
                    <td className="p-2">
                      {report.directive} ({report.disposition || '—'})
                    </td>
                    <td className="max-w-64 break-all p-2">{report.blocked}</td>
                    <td className="max-w-64 break-all p-2">
                      {report.source}
                      {report.line !== null ? `:${report.line}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {reports.length > 500 && (
            <p className="text-sm text-muted-foreground">
              {t('browserInspection.firstRows', { count: 500 })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
