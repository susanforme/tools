import { useState } from 'react';
import {
  parseDmarc,
  readDmarcFile,
  type DmarcReport,
} from '@/lib/dmarc-report';
import { downloadBlob } from '@/lib/download';
import { useSecurityText } from './security-text';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
export const DMARC_EXAMPLE =
  '<feedback><report_metadata><org_name>Example Mail</org_name><report_id>demo-1</report_id><date_range><begin>1789516800</begin><end>1789603200</end></date_range></report_metadata><policy_published><domain>example.com</domain><p>reject</p></policy_published><record><row><source_ip>192.0.2.1</source_ip><count>42</count><policy_evaluated><disposition>none</disposition><dkim>pass</dkim><spf>fail</spf></policy_evaluated></row><identifiers><header_from>example.com</header_from></identifiers></record><record><row><source_ip>192.0.2.2</source_ip><count>8</count><policy_evaluated><disposition>reject</disposition><dkim>fail</dkim><spf>fail</spf></policy_evaluated></row><identifiers><header_from>example.com</header_from></identifiers></record></feedback>';
export default function DmarcReportPanel() {
  const text = useSecurityText();
  const [input, setInput] = useState('');
  const [report, setReport] = useState<DmarcReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const run = async (file?: File) => {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const xml = file ? await readDmarcFile(file) : input;
      if (file) setInput(xml);
      setReport(parseDmarc(xml));
    } catch (cause) {
      setError(text('failed', { msg: (cause as Error).message }));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{text('dmarcLimit')}</p>
      <Input
        aria-label={text('importFile')}
        type="file"
        accept=".xml,.gz,application/gzip,text/xml"
        disabled={loading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void run(file);
          event.target.value = '';
        }}
      />
      <Textarea
        disabled={loading}
        aria-label={text('input')}
        className="min-h-40 font-mono"
        value={input}
        onChange={(event) => {
          setInput(event.target.value);
          setReport(null);
          setError(null);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button disabled={loading || !input.trim()} onClick={() => void run()}>
          {text(loading ? 'running' : 'run')}
        </Button>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => {
            setInput(DMARC_EXAMPLE);
            setReport(null);
            setError(null);
          }}
        >
          {text('example')}
        </Button>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => {
            setInput('');
            setReport(null);
            setError(null);
          }}
        >
          {text('clear')}
        </Button>
        {report && (
          <Button
            variant="outline"
            onClick={() =>
              downloadBlob(
                new Blob([JSON.stringify(report, null, 2)], {
                  type: 'application/json',
                }),
                'dmarc-report.json',
              )
            }
          >
            {text('download')}
          </Button>
        )}
      </div>
      {error && (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      )}
      {report && (
        <>
          <div className="grid gap-3 rounded-lg border p-4 text-sm md:grid-cols-2">
            <p>
              {text('organization')}: {report.organization}
            </p>
            <p>
              {text('domain')}: {report.domain}
            </p>
            <p>
              {text('total')}: {report.total}
            </p>
            <p>
              {text('aligned')}: {report.passed}
            </p>
            <p className="md:col-span-2">
              {report.begin} → {report.end}
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                {(
                  [
                    'sourceIp',
                    'count',
                    'spfPass',
                    'dkimPass',
                    'aligned',
                  ] as const
                ).map((key) => (
                  <TableHead key={key}>{text(key)}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.sources.map((row) => (
                <TableRow key={row.ip}>
                  <TableCell className="font-mono">{row.ip}</TableCell>
                  <TableCell>{row.count}</TableCell>
                  <TableCell>{row.spfPass}</TableCell>
                  <TableCell>{row.dkimPass}</TableCell>
                  <TableCell>{row.aligned}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}
