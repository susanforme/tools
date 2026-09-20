import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import { downloadBlob } from '@/lib/download';
import type { JsonataRequest, JsonataResult } from '@/lib/jsonata-transform';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

const createWorker = (): Worker =>
  new Worker(
    new URL('../workers/jsonata-transform.worker.ts', import.meta.url),
    { type: 'module' },
  );
const SAMPLE_INPUT = JSON.stringify(
  {
    orders: [
      { product: 'Book', price: 12, quantity: 2 },
      { product: 'Pen', price: 3, quantity: 4 },
    ],
  },
  null,
  2,
);
const SAMPLE_EXPRESSION =
  '{ "items": orders.{"name": product, "subtotal": price * quantity}, "total": $sum(orders.(price * quantity)) }';

export default function JsonataPanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [expression, setExpression] = useState('');
  const task = useBoundedWorker<JsonataRequest, JsonataResult>(createWorker);
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('jsonata.limits')}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={task.busy || !input.trim() || !expression.trim()}
          onClick={() => task.run({ input, expression })}
        >
          {t(task.busy ? 'jsonata.running' : 'jsonata.run')}
        </Button>
        {task.busy && (
          <Button variant="outline" onClick={task.cancel}>
            {t('jsonata.cancel')}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => {
            task.clear();
            setInput(SAMPLE_INPUT);
            setExpression(SAMPLE_EXPRESSION);
          }}
        >
          {t('jsonata.sample')}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            task.clear();
            setInput('');
            setExpression('');
          }}
        >
          {t('jsonata.clear')}
        </Button>
        {task.result?.output && (
          <Button
            variant="outline"
            onClick={() =>
              downloadBlob(
                new Blob([task.result!.output], { type: 'application/json' }),
                'jsonata-result.json',
              )
            }
          >
            {t('jsonata.download')}
          </Button>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="jsonata-expression">{t('jsonata.expression')}</Label>
        <Textarea
          id="jsonata-expression"
          className="min-h-28 font-mono text-sm"
          value={expression}
          onChange={(event) => {
            task.clear();
            setExpression(event.target.value);
          }}
          spellCheck={false}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="jsonata-input">{t('jsonata.input')}</Label>
          <Textarea
            id="jsonata-input"
            className="min-h-80 font-mono text-sm"
            value={input}
            onChange={(event) => {
              task.clear();
              setInput(event.target.value);
            }}
            spellCheck={false}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="jsonata-output">{t('jsonata.output')}</Label>
          <Textarea
            id="jsonata-output"
            className="min-h-80 font-mono text-sm"
            value={task.result?.output ?? ''}
            readOnly
          />
        </div>
      </div>
      {task.result?.empty && <p role="status">{t('jsonata.empty')}</p>}
      {task.error && (
        <p role="alert" className="text-sm text-destructive">
          {t('jsonata.failure', {
            message: t(`jsonata.errors.${task.error}`, {
              defaultValue: task.error,
            }),
          })}
        </p>
      )}
    </section>
  );
}
