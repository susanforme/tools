import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';

export const Route = createFileRoute('/serial-monitor')({
  component: SerialMonitor,
});

type SerialPortLike = {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
};
type SerialNavigator = Navigator & {
  serial?: { requestPort(): Promise<SerialPortLike> };
};

function SerialMonitor() {
  const { t } = useTranslation();
  const [baud, setBaud] = useState(115200);
  const [line, setLine] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const port = useRef<SerialPortLike | null>(null);
  const reader = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const active = useRef(false);
  const append = (direction: string, value: string) =>
    setLog((current) => [
      ...current.slice(-1999),
      `${new Date().toISOString()} ${direction} ${value}`,
    ]);

  async function disconnect() {
    active.current = false;
    const currentReader = reader.current;
    try {
      await currentReader?.cancel();
    } catch {
      /* already closed */
    }
    try {
      currentReader?.releaseLock();
    } catch {
      /* already released */
    }
    reader.current = null;
    try {
      await port.current?.close();
    } catch {
      /* already closed */
    }
    port.current = null;
    setConnected(false);
  }
  useEffect(
    () => () => {
      void disconnect();
    },
    [],
  );

  async function connect() {
    setError(null);
    try {
      const api = (navigator as SerialNavigator).serial;
      if (!api) throw new Error(t('newTools.serialUnavailable'));
      if (!Number.isInteger(baud) || baud < 300 || baud > 3000000)
        throw new Error(t('newTools.invalidBaud'));
      const selected = await api.requestPort();
      await selected.open({ baudRate: baud });
      port.current = selected;
      active.current = true;
      setConnected(true);
      if (!selected.readable) throw new Error(t('newTools.serialUnavailable'));
      const streamReader = selected.readable.getReader();
      reader.current = streamReader;
      const decoder = new TextDecoder();
      while (active.current) {
        const { value, done } = await streamReader.read();
        if (done) break;
        if (value) append('RX', decoder.decode(value, { stream: true }));
      }
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      await disconnect();
    }
  }
  async function send() {
    if (!port.current?.writable || !line) return;
    try {
      const writer = port.current.writable.getWriter();
      try {
        await writer.write(new TextEncoder().encode(line + '\n'));
      } finally {
        writer.releaseLock();
      }
      append('TX', line);
      setLine('');
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  function exportLog() {
    const url = URL.createObjectURL(
      new Blob([log.join('\n')], { type: 'text/plain' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'serial-log.txt';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('newTools.serial')}</h1>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="serial-baud">{t('newTools.baud')}</Label>
          <Input
            id="serial-baud"
            type="number"
            min={300}
            max={3000000}
            value={baud}
            onChange={(event) => setBaud(Number(event.target.value))}
          />
        </div>
        <Button onClick={() => void (connected ? disconnect() : connect())}>
          {t(connected ? 'newTools.disconnect' : 'newTools.connect')}
        </Button>
        <Button variant="outline" disabled={!log.length} onClick={exportLog}>
          {t('newTools.export')}
        </Button>
      </div>
      <div className="flex gap-2">
        <Input
          aria-label={t('newTools.sendText')}
          value={line}
          onChange={(event) => setLine(event.target.value)}
        />
        <Button disabled={!connected || !line} onClick={() => void send()}>
          {t('newTools.send')}
        </Button>
      </div>
      <Textarea
        readOnly
        aria-label={t('newTools.serialLog')}
        className="min-h-80 font-mono text-xs"
        value={log.join('\n')}
      />
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {t('newTools.serialLimit')}
      </p>
    </main>
  );
}
