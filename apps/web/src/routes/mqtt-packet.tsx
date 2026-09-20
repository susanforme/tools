import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import { StringParam, useQueryParams } from '@/hooks/useQueryParams';
import type { MqttRequest, MqttFrame } from '@/lib/community-protocols';
import { FileDropzone } from '@/components/file-dropzone';
import { FormatActions } from '@/components/format-workbench';
import {
  CommunityError,
  CommunityOutput,
  createCommunityWorker,
} from '@/components/community-workbench';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { downloadBlob } from '@/lib/download';
export const Route = createFileRoute('/mqtt-packet')({
  component: MqttPacketPage,
});
function MqttPacketPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    version: string;
    encoding: string;
  }>({ version: StringParam, encoding: StringParam });
  const version = query.version === '5' ? 5 : 4,
    encoding = query.encoding === 'base64' ? 'base64' : 'hex';
  const [input, setInput] = useState(''),
    [file, setFile] = useState<File | null>(null),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState(0);
  const task = useBoundedWorker<MqttRequest, MqttFrame[]>(
    createCommunityWorker,
    10000,
  );
  const clear = () => {
    task.clear();
    setPage(0);
    setSelected(0);
  };
  const frames = task.result ?? [];
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-4 min-w-0">
      <h1 className="text-2xl font-bold">{t('mqtt.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('mqtt.note')}</p>
      <div className="flex flex-wrap gap-2">
        <Select
          value={String(version)}
          onValueChange={(value) => {
            clear();
            setQuery({ version: value });
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="4">MQTT 3.1.1</SelectItem>
            <SelectItem value="5">MQTT 5.0</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={encoding}
          onValueChange={(value) => {
            clear();
            setQuery({ encoding: value });
          }}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hex">Hex</SelectItem>
            <SelectItem value="base64">Base64</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <FileDropzone
        onFiles={(files) => {
          clear();
          setFile(files[0]?.file ?? null);
        }}
      >
        {file?.name ?? t('mqtt.upload')}
      </FileDropzone>
      <Textarea
        aria-label={t('mqtt.input')}
        value={input}
        className="h-48 font-mono"
        onChange={(e) => {
          clear();
          setFile(null);
          setInput(e.target.value);
        }}
      />
      <FormatActions
        busy={task.busy}
        run={() => {
          clear();
          task.run({ kind: 'mqtt', input: file ?? input, encoding, version });
        }}
        cancel={task.cancel}
        clear={() => {
          clear();
          setInput('');
          setFile(null);
        }}
        sample={() => {
          clear();
          setFile(null);
          setQuery({ encoding: 'hex', version: '4' });
          setInput('30 07 00 01 61 74 65 73 74 c0 00');
        }}
      />
      <CommunityError error={task.error} />
      {task.result && (
        <>
          <p className="text-sm">{t('mqtt.count', { count: frames.length })}</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('mqtt.offset')}</TableHead>
                <TableHead>{t('mqtt.command')}</TableHead>
                <TableHead>{t('mqtt.length')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {frames.slice(page * 25, page * 25 + 25).map((frame, index) => (
                <TableRow key={frame.offset}>
                  <TableCell>{frame.offset}</TableCell>
                  <TableCell>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setSelected(page * 25 + index)}
                    >
                      {frame.command}
                    </Button>
                  </TableCell>
                  <TableCell>{frame.length}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!page}
              onClick={() => setPage(page - 1)}
            >
              {t('community.previous')}
            </Button>
            <span>
              {page + 1} / {Math.max(1, Math.ceil(frames.length / 25))}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={(page + 1) * 25 >= frames.length}
              onClick={() => setPage(page + 1)}
            >
              {t('community.next')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadBlob(
                  new Blob([JSON.stringify(frames, null, 2)], {
                    type: 'application/json',
                  }),
                  'mqtt-packets.json',
                )
              }
            >
              {t('community.exportAll')}
            </Button>
          </div>
          <CommunityOutput
            output={
              frames[selected] ? JSON.stringify(frames[selected], null, 2) : ''
            }
          />
        </>
      )}
    </div>
  );
}
