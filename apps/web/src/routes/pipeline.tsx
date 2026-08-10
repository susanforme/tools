import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrayParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  PIPELINE_OPERATIONS,
  runPipeline,
  type PipelineOperation,
} from '@/lib/advanced-tools';
import { createFileRoute } from '@tanstack/react-router';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/pipeline')({ component: PipelinePage });

function PipelinePage() {
  const { t } = useTranslation();
  const [storedSteps, setSteps] = useQueryParam('steps', ArrayParam, [
    'url-decode',
    'base64-decode',
  ]);
  const steps = storedSteps.filter((step): step is PipelineOperation =>
    PIPELINE_OPERATIONS.includes(step as PipelineOperation),
  );
  const [next, setNext] = useState<PipelineOperation>('json-format');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const move = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= steps.length) return;
    const updated = [...steps];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    setSteps(updated);
  };
  const run = async () => {
    setError(null);
    try {
      setOutput(await runPipeline(input, steps));
    } catch (cause) {
      setOutput('');
      setError(t('pipeline.failed', { msg: (cause as Error).message }));
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('pipeline.title')}</h1>
      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <div className="space-y-3 rounded-xl border p-4">
          <div className="flex gap-2">
            <Select
              value={next}
              onValueChange={(value) => setNext(value as PipelineOperation)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_OPERATIONS.map((operation) => (
                  <SelectItem key={operation} value={operation}>
                    {t(`pipeline.operations.${operation}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => setSteps([...steps, next])}
            >
              {t('pipeline.add')}
            </Button>
          </div>
          {steps.map((step, index) => (
            <div
              key={`${step}-${index}`}
              className="flex items-center gap-1 rounded-md border px-2 py-1.5 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">
                {index + 1}. {t(`pipeline.operations.${step}`)}
              </span>
              <Button
                size="icon"
                variant="ghost"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                disabled={index + 1 === steps.length}
                onClick={() => move(index, 1)}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() =>
                  setSteps(steps.filter((_, itemIndex) => itemIndex !== index))
                }
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="min-h-96 font-mono text-xs"
            placeholder={t('pipeline.input')}
          />
          <Textarea
            readOnly
            value={output}
            className="min-h-96 font-mono text-xs"
            placeholder={t('pipeline.output')}
          />
        </div>
      </div>
      <Button disabled={!steps.length} onClick={() => void run()}>
        {t('pipeline.run')}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
