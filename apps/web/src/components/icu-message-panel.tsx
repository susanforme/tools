import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import { StringParam, useQueryParams } from '@/hooks/useQueryParams';
import type { IcuRequest } from '@/lib/community-protocols';
import { FormatActions } from './format-workbench';
import {
  CommunityError,
  CommunityOutput,
  createCommunityWorker,
} from './community-workbench';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
export default function IcuMessagePanel() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    icuLocale: string;
    icuZone: string;
  }>({ icuLocale: StringParam, icuZone: StringParam });
  const locale = query.icuLocale || 'en-US',
    timeZone = query.icuZone || 'UTC';
  const [message, setMessage] = useState(''),
    [params, setParams] = useState('{}');
  const task = useBoundedWorker<IcuRequest, { output: string; info: string }>(
    createCommunityWorker,
    10000,
  );
  const sample = () => {
    task.clear();
    setMessage(
      '{name} has {count, plural, =0 {no messages} one {# message} other {# messages}}. {role, select, admin {Administrator} other {Member}}',
    );
    setParams('{"name":"Ada","count":2,"role":"admin"}');
  };
  return (
    <div className="space-y-4 min-w-0">
      <p className="text-sm text-muted-foreground">{t('icu.note')}</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="icu-locale">{t('icu.locale')}</Label>
          <Input
            id="icu-locale"
            value={locale}
            onChange={(e) => {
              task.clear();
              setQuery({ icuLocale: e.target.value });
            }}
          />
        </div>
        <div>
          <Label htmlFor="icu-zone">{t('icu.timeZone')}</Label>
          <Input
            id="icu-zone"
            value={timeZone}
            onChange={(e) => {
              task.clear();
              setQuery({ icuZone: e.target.value });
            }}
          />
        </div>
        <div className="min-w-0">
          <Label htmlFor="icu-message">{t('icu.message')}</Label>
          <Textarea
            id="icu-message"
            className="h-48 font-mono"
            value={message}
            onChange={(e) => {
              task.clear();
              setMessage(e.target.value);
            }}
          />
        </div>
        <div className="min-w-0">
          <Label htmlFor="icu-params">{t('icu.params')}</Label>
          <Textarea
            id="icu-params"
            className="h-48 font-mono"
            value={params}
            onChange={(e) => {
              task.clear();
              setParams(e.target.value);
            }}
          />
        </div>
      </div>
      <FormatActions
        busy={task.busy}
        run={() => task.run({ kind: 'icu', message, params, locale, timeZone })}
        cancel={task.cancel}
        clear={() => {
          task.clear();
          setMessage('');
          setParams('{}');
        }}
        sample={sample}
      />
      <CommunityError error={task.error} />
      <CommunityOutput output={task.result?.output ?? ''} />
      {task.result && (
        <Textarea
          aria-label={t('formats.info')}
          value={task.result.info}
          readOnly
          className="h-48 font-mono text-xs"
        />
      )}
    </div>
  );
}
