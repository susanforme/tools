import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import type { SshRequest } from '@/lib/community-protocols';
import { FormatActions } from './format-workbench';
import {
  CommunityError,
  CommunityOutput,
  createCommunityWorker,
} from './community-workbench';
import { FileDropzone } from './file-dropzone';
import { Textarea } from './ui/textarea';
export default function OpenSshPanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState(''),
    [file, setFile] = useState<File | null>(null);
  const task = useBoundedWorker<SshRequest, Record<string, unknown>>(
    createCommunityWorker,
    10000,
  );
  return (
    <div className="space-y-4 min-w-0">
      <p className="text-sm text-muted-foreground">{t('openSsh.note')}</p>
      <FileDropzone
        accept=".pub,text/plain"
        onFiles={(files) => {
          task.clear();
          setFile(files[0]?.file ?? null);
        }}
      >
        {file?.name ?? t('openSsh.upload')}
      </FileDropzone>
      <Textarea
        aria-label={t('openSsh.input')}
        className="h-48 font-mono"
        value={input}
        onChange={(e) => {
          task.clear();
          setFile(null);
          setInput(e.target.value);
        }}
      />
      <FormatActions
        busy={task.busy}
        run={() => task.run({ kind: 'ssh', input: file ?? input })}
        cancel={task.cancel}
        clear={() => {
          task.clear();
          setFile(null);
          setInput('');
        }}
        sample={() => {
          task.clear();
          setFile(null);
          setInput(
            'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB demo',
          );
        }}
      />
      <CommunityError error={task.error} />
      <CommunityOutput
        output={task.result ? JSON.stringify(task.result, null, 2) : ''}
      />
    </div>
  );
}
