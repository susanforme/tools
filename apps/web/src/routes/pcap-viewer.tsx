import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  PCAP_MAX_BYTES,
  type PcapRequest,
  type PcapResult,
  type PcapTree,
} from '@/lib/pcap';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/pcap-viewer')({ component: PcapPage });
function Tree({ nodes }: { nodes: PcapTree[] }) {
  return (
    <ul className="space-y-1 pl-3">
      {nodes.map((node, index) => (
        <li key={index} className="break-all text-xs">
          {node.children.length ? (
            <details>
              <summary className="cursor-pointer py-1">{node.label}</summary>
              <Tree nodes={node.children} />
            </details>
          ) : (
            <span title={node.filter}>{node.label}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
function PcapPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useQueryParam<string>('filter', StringParam, '');
  const [result, setResult] = useState<PcapResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [skip, setSkip] = useState(0);
  const [appliedFilter, setAppliedFilter] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const worker = useRef<Worker | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    worker.current?.terminate();
    worker.current = null;
    if (timer.current) clearTimeout(timer.current);
  };
  useEffect(() => () => stop(), []);
  const run = (request: PcapRequest) => {
    setError(null);
    setBusy(true);
    if (request.kind === 'load') {
      stop();
      setResult(null);
      setSkip(0);
      setSelected(null);
    }
    try {
      if (!worker.current)
        worker.current = new Worker(
          new URL('../workers/pcap.worker.ts', import.meta.url),
          { type: 'module' },
        );
      const active = worker.current;
      const finish = () => {
        if (timer.current) clearTimeout(timer.current);
        setBusy(false);
      };
      active.onmessage = (
        event: MessageEvent<{ result?: PcapResult; error?: string }>,
      ) => {
        if (worker.current !== active) return;
        finish();
        if (event.data.error) setError(event.data.error);
        else if (event.data.result) {
          setResult(event.data.result);
          if (request.kind !== 'frame') setAppliedFilter(request.filter);
          if (request.kind === 'frames') {
            setSkip(request.skip);
            setSelected(null);
          }
        }
      };
      active.onerror = (event) => {
        finish();
        stop();
        setResult(null);
        setError(event.message);
      };
      timer.current = setTimeout(() => {
        stop();
        setResult(null);
        setBusy(false);
        setError(t('browserInspection.timeout'));
      }, 120000);
      active.postMessage(request);
    } catch (cause) {
      stop();
      setBusy(false);
      setError((cause as Error).message);
    }
  };
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('browserInspection.pcapTitle')}</h1>
      <Label htmlFor="pcap-file">{t('browserInspection.captureFile')}</Label>
      <Input
        id="pcap-file"
        type="file"
        accept=".pcap,.pcapng,.cap"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (file.size > PCAP_MAX_BYTES) {
            stop();
            setResult(null);
            setError(t('browserInspection.captureLimit'));
            return;
          }
          run({ kind: 'load', file, filter });
        }}
      />
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="pcap-filter">{t('browserInspection.filter')}</Label>
          <Input
            disabled={busy}
            id="pcap-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="tcp.port == 443"
          />
        </div>
        <Button
          disabled={busy || !result}
          onClick={() => run({ kind: 'frames', filter, skip: 0 })}
        >
          {t('browserInspection.apply')}
        </Button>
      </div>
      {busy && (
        <div className="flex items-center gap-3">
          <span className="text-sm">{t('browserInspection.loading')}</span>
          <Button
            variant="outline"
            onClick={() => {
              stop();
              setBusy(false);
              setResult(null);
            }}
          >
            {t('browserInspection.cancel')}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t('browserInspection.failed', { message: error })}
        </p>
      )}
      {result && (
        <>
          <p className="text-sm">
            {result.summary.file_type} · {appliedFilter || '—'} ·{' '}
            {t('browserInspection.packetCount', {
              count: result.summary.packet_count,
              matched: result.matched,
            })}
          </p>
          <div className="max-h-96 overflow-auto rounded border">
            <table className="w-full whitespace-nowrap text-left text-xs">
              <thead>
                <tr>
                  <th className="p-2">{t('browserInspection.detail')}</th>
                  {result.columns.map((column, index) => (
                    <th key={index} className="p-2">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.frames.map((frame) => (
                  <tr
                    key={frame.number}
                    className={
                      selected === frame.number
                        ? 'border-t bg-primary/10'
                        : 'border-t'
                    }
                  >
                    <td className="p-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => {
                          setSelected(frame.number);
                          run({ kind: 'frame', number: frame.number });
                        }}
                      >
                        #{frame.number}
                      </Button>
                    </td>
                    {frame.columns.map((column, index) => (
                      <td
                        key={index}
                        className="max-w-96 truncate p-2"
                        title={column}
                      >
                        {column}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              disabled={busy || skip === 0}
              onClick={() =>
                run({
                  kind: 'frames',
                  filter: appliedFilter,
                  skip: Math.max(0, skip - 100),
                })
              }
            >
              {t('browserInspection.previous')}
            </Button>
            <span className="text-sm">{Math.floor(skip / 100) + 1}</span>
            <Button
              variant="outline"
              disabled={busy || skip + 100 >= result.matched}
              onClick={() =>
                run({ kind: 'frames', filter: appliedFilter, skip: skip + 100 })
              }
            >
              {t('browserInspection.next')}
            </Button>
          </div>
          {result.tree && (
            <div className="max-h-96 overflow-auto rounded border p-3">
              <Tree nodes={result.tree} />
            </div>
          )}
          {result.sources?.map((source, index) => (
            <details key={index} className="rounded border p-3">
              <summary>{source.name} · Base64</summary>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all text-xs">
                {source.data}
              </pre>
            </details>
          ))}
        </>
      )}
      <p className="text-xs text-muted-foreground">
        <a
          href="https://github.com/good-tools/wiregasm"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Wiregasm / Wireshark · GPL-2.0
        </a>
      </p>
    </div>
  );
}
