import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { downloadBlob } from '@/lib/download';
import { createFileRoute } from '@tanstack/react-router';
import { Download, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/realtime-debugger')({
  component: RealtimeDebuggerPage,
});
type Protocol = 'websocket' | 'sse';
type LogEntry = {
  direction: 'in' | 'out' | 'system';
  id: string;
  message: string;
  time: string;
};
const STORAGE_KEY = 'breeze-realtime-debugger-logs';

function RealtimeDebuggerPage() {
  const { t } = useTranslation();
  const [protocol, setProtocol] = useQueryParam<Protocol>(
    'protocol',
    StringParam,
    'websocket',
  );
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState('');
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem(STORAGE_KEY) ?? '[]',
      ) as LogEntry[];
    } catch {
      return [];
    }
  });
  const socket = useRef<WebSocket | null>(null);
  const source = useRef<EventSource | null>(null);
  const active = useRef(false);
  const addLog = (direction: LogEntry['direction'], value: string) =>
    setLogs((current) => [
      ...current.slice(-199),
      {
        id: crypto.randomUUID(),
        direction,
        message: value,
        time: new Date().toISOString(),
      },
    ]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  }, [logs]);
  useEffect(
    () => () => {
      active.current = false;
      socket.current?.close();
      source.current?.close();
    },
    [],
  );
  const connect = () => {
    active.current = true;
    addLog('system', t('realtimeDebugger.connecting'));
    if (protocol === 'sse') {
      source.current?.close();
      const next = new EventSource(url);
      source.current = next;
      next.onopen = () => {
        setConnected(true);
        addLog('system', t('realtimeDebugger.connected'));
      };
      next.onmessage = (event) => addLog('in', event.data);
      next.onerror = () => {
        setConnected(false);
        addLog('system', t('realtimeDebugger.disconnected'));
        if (!autoReconnect) next.close();
      };
      return;
    }
    socket.current?.close();
    const next = new WebSocket(url);
    socket.current = next;
    next.onopen = () => {
      setConnected(true);
      addLog('system', t('realtimeDebugger.connected'));
    };
    next.onmessage = (event) => addLog('in', String(event.data));
    next.onerror = () => addLog('system', t('realtimeDebugger.error'));
    next.onclose = () => {
      setConnected(false);
      addLog('system', t('realtimeDebugger.disconnected'));
      if (active.current && autoReconnect) window.setTimeout(connect, 1500);
    };
  };
  const disconnect = () => {
    active.current = false;
    socket.current?.close();
    source.current?.close();
    setConnected(false);
  };
  const send = () => {
    if (socket.current?.readyState !== WebSocket.OPEN) return;
    socket.current.send(message);
    addLog('out', message);
    setMessage('');
  };
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('realtimeDebugger.title')}</h1>
      <Tabs
        value={protocol}
        onValueChange={(value) => {
          disconnect();
          setProtocol(value as Protocol);
        }}
      >
        <TabsList>
          <TabsTrigger value="websocket">WebSocket</TabsTrigger>
          <TabsTrigger value="sse">SSE</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label={t('realtimeDebugger.title')}
          className="min-w-72 flex-1"
          value={url}
          placeholder={protocol === 'websocket' ? 'wss://…' : 'https://…'}
          onChange={(event) => setUrl(event.target.value)}
        />
        <Button disabled={!url || connected} onClick={connect}>
          {t('realtimeDebugger.connect')}
        </Button>
        <Button variant="outline" disabled={!connected} onClick={disconnect}>
          {t('realtimeDebugger.disconnect')}
        </Button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={autoReconnect}
          onCheckedChange={(value) => setAutoReconnect(value === true)}
        />
        {t('realtimeDebugger.autoReconnect')}
      </label>
      {protocol === 'websocket' && (
        <div className="flex gap-2">
          <Textarea
            aria-label={t('realtimeDebugger.send')}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <Button disabled={!connected || !message} onClick={send}>
            <Send className="h-4 w-4" />
            {t('realtimeDebugger.send')}
          </Button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <Label>{t('realtimeDebugger.history')}</Label>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              downloadBlob(
                new Blob([JSON.stringify(logs, null, 2)], {
                  type: 'application/json',
                }),
                'realtime-log.json',
              )
            }
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setLogs([])}>
            {t('realtimeDebugger.clear')}
          </Button>
        </div>
      </div>
      <div className="max-h-[32rem] space-y-2 overflow-y-auto rounded-xl border p-3 font-mono text-xs">
        {logs.map((entry) => (
          <div key={entry.id} className="grid grid-cols-[8rem_3rem_1fr] gap-2">
            <span className="text-muted-foreground">
              {entry.time.slice(11, 19)}
            </span>
            <span>{entry.direction}</span>
            <span className="break-all">{entry.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
