import { LifeWorkspace } from '@/components/life-workspace-ui';
import { FamilyTreePanel } from '@/components/family-tree-workspace';
import { ChoiceField } from '@/components/calculator-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import type { KinshipRequest } from '@/lib/kinship';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/kinship')({ component: ExpandedPage });
const PARAMS = { sex: NumberParam, direction: StringParam };
const RELATIONS = [
  ['father', '爸爸'],
  ['mother', '妈妈'],
  ['olderBrother', '哥哥'],
  ['youngerBrother', '弟弟'],
  ['olderSister', '姐姐'],
  ['youngerSister', '妹妹'],
  ['husband', '老公'],
  ['wife', '老婆'],
  ['son', '儿子'],
  ['daughter', '女儿'],
] as const;
const createWorker = () =>
  new Worker(new URL('../workers/kinship.worker.ts', import.meta.url), {
    type: 'module',
  });

function KinshipPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{ sex: number; direction: string }>(
    PARAMS,
  );
  const sex = query.sex === 0 || query.sex === 1 ? query.sex : -1;
  const direction =
    query.direction === 'reverse' || query.direction === 'chain'
      ? query.direction
      : 'forward';
  const [text, setText] = useState('');
  const worker = useBoundedWorker<KinshipRequest, string[]>(createWorker);
  const { clear } = worker;
  useEffect(() => clear(), [text, sex, direction, clear]);
  const valid =
    text.trim().length > 0 &&
    text.length <= 80 &&
    text.split('的').length <= 12;
  const error =
    worker.error === 'INVALID_INPUT'
      ? t('kinship.invalid')
      : worker.error === 'TIMEOUT'
        ? t('kinship.timeout')
        : worker.error
          ? t('kinship.error', { message: worker.error })
          : null;

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t('kinship.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('kinship.description')}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ChoiceField
          label={t('kinship.sex')}
          value={String(sex)}
          onChange={(value) => setQuery({ sex: Number(value) })}
          options={[
            { value: '-1', label: t('kinship.unknown') },
            { value: '1', label: t('kinship.male') },
            { value: '0', label: t('kinship.female') },
          ]}
        />
        <ChoiceField
          label={t('kinship.direction')}
          value={direction}
          onChange={(value) => setQuery({ direction: value })}
          options={['forward', 'reverse', 'chain'].map((value) => ({
            value,
            label: t(`kinship.${value}`),
          }))}
        />
      </div>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid)
            worker.run({
              text,
              sex,
              reverse: direction === 'reverse',
              chain: direction === 'chain',
            });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="kinship-text">{t('kinship.input')}</Label>
          <Input
            id="kinship-text"
            maxLength={80}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t('kinship.placeholder')}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {RELATIONS.map(([key, value]) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              disabled={
                text.split('的').length >= 12 ||
                text.length + value.length + 1 > 80
              }
              onClick={() =>
                setText((old) =>
                  old.trim() ? `${old.trim()}的${value}` : value,
                )
              }
            >
              {t(`kinship.${key}`)}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!valid || worker.busy}>
            {t(worker.busy ? 'kinship.calculating' : 'kinship.calculate')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!text}
            onClick={() =>
              setText((old) => old.split('的').slice(0, -1).join('的'))
            }
          >
            {t('kinship.back')}
          </Button>
          <Button type="button" variant="outline" onClick={() => setText('')}>
            {t('kinship.clear')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setText('妈妈的哥哥的女儿')}
          >
            {t('kinship.example')}
          </Button>
        </div>
      </form>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {worker.result !== null && (
        <section className="space-y-3 rounded-xl border p-5" aria-live="polite">
          <h2 className="font-semibold">{t('kinship.results')}</h2>
          {worker.result.length ? (
            <ul className="flex flex-wrap gap-3">
              {worker.result.map((title) => (
                <li
                  key={title}
                  className="rounded-lg bg-muted px-4 py-3 text-lg font-semibold"
                >
                  {title}
                </li>
              ))}
            </ul>
          ) : (
            <p>{t('kinship.empty')}</p>
          )}
        </section>
      )}
      <p className="text-sm text-muted-foreground">{t('kinship.regional')}</p>
    </div>
  );
}

function ExpandedPage() {
  return (
    <LifeWorkspace label="lifeWorkspace.family.title" panel={<FamilyTreePanel />}>
      <KinshipPage />
    </LifeWorkspace>
  );
}
