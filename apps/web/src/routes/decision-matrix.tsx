import {
  OrganizerFrame,
  OrganizerInput,
  useOrganizerStore,
} from '@/components/organizer-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { downloadBlob } from '@/lib/download';
import {
  csvFile,
  rankDecision,
  validDecisions,
  type Decision,
} from '@/lib/organizer-tools';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
export const Route = createFileRoute('/decision-matrix')({
  component: DecisionMatrixPage,
});
const INITIAL: Decision[] = [];
function DecisionMatrixPage() {
  const { t } = useTranslation();
  const store = useOrganizerStore(
    'tools.decision-matrix.v1',
    INITIAL,
    validDecisions,
  );
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('');
  const decision =
    store.data.find((item) => item.id === selected) ?? store.data[0];
  const update = (next: Decision) =>
    store.setData((previous) =>
      previous.map((item) => (item.id === next.id ? next : item)),
    );
  const ranked = decision ? rankDecision(decision) : [];
  const totalWeight =
    decision?.criteria.reduce((sum, item) => sum + item.weight, 0) ?? 0;
  const create = () => {
    const id = crypto.randomUUID();
    const value: Decision = {
      id,
      name: name.trim() || t('decisionMatrix.newDecision'),
      criteria: [
        {
          id: crypto.randomUUID(),
          name: t('decisionMatrix.criterion', { n: 1 }),
          weight: 1,
        },
      ],
      options: [],
    };
    if (store.setData([...store.data, value])) {
      setSelected(id);
      setName('');
    }
  };
  const exportCsv = () => {
    if (!decision) return;
    downloadBlob(
      new Blob(
        [
          csvFile([
            [
              t('decisionMatrix.option'),
              ...decision.criteria.map(
                (item) => `${item.name} (${item.weight})`,
              ),
              t('decisionMatrix.score'),
            ],
            ...decision.options.map((option) => [
              option.name,
              ...option.scores,
              ranked.find((item) => item.id === option.id)!.score,
            ]),
          ]),
        ],
        { type: 'text/csv;charset=utf-8' },
      ),
      'decision-matrix.csv',
    );
  };
  return (
    <OrganizerFrame title={t('decisionMatrix.title')} store={store}>
      <div className="flex flex-wrap items-end gap-3">
        <OrganizerInput
          label={t('decisionMatrix.decisionName')}
          value={name}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
        />
        <Button disabled={store.data.length >= 30} onClick={create}>
          {t('organizer.create')}
        </Button>
      </div>
      {decision && (
        <>
          <div className="flex flex-wrap gap-3">
            <Select value={decision.id} onValueChange={setSelected}>
              <SelectTrigger
                aria-label={t('decisionMatrix.decisionName')}
                className="w-64"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {store.data.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={store.data.length >= 30}
              onClick={() => {
                const id = crypto.randomUUID();
                if (
                  store.setData([
                    ...store.data,
                    {
                      ...decision,
                      id,
                      name: `${decision.name.slice(0, 100)} ${t('organizer.copy')}`,
                    },
                  ])
                )
                  setSelected(id);
              }}
            >
              {t('organizer.copy')}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                store.setData(
                  store.data.filter((item) => item.id !== decision.id),
                )
              }
            >
              {t('organizer.delete')}
            </Button>
            <Button
              variant="outline"
              disabled={!decision.options.length || totalWeight === 0}
              onClick={exportCsv}
            >
              {t('organizer.csv')}
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {decision.criteria.map((criterion) => (
              <div
                key={criterion.id}
                className="space-y-3 rounded-lg border p-3"
              >
                <OrganizerInput
                  label={t('decisionMatrix.criterionName')}
                  value={criterion.name}
                  maxLength={120}
                  onChange={(event) =>
                    update({
                      ...decision,
                      criteria: decision.criteria.map((item) =>
                        item.id === criterion.id
                          ? { ...item, name: event.target.value }
                          : item,
                      ),
                    })
                  }
                />
                <OrganizerInput
                  label={t('decisionMatrix.weight')}
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  value={criterion.weight}
                  onChange={(event) =>
                    update({
                      ...decision,
                      criteria: decision.criteria.map((item) =>
                        item.id === criterion.id
                          ? { ...item, weight: Number(event.target.value) }
                          : item,
                      ),
                    })
                  }
                />
                <Button
                  variant="ghost"
                  disabled={decision.criteria.length === 1}
                  onClick={() => {
                    const index = decision.criteria.indexOf(criterion);
                    update({
                      ...decision,
                      criteria: decision.criteria.filter(
                        (item) => item.id !== criterion.id,
                      ),
                      options: decision.options.map((option) => ({
                        ...option,
                        scores: option.scores.filter((_, i) => i !== index),
                      })),
                    });
                  }}
                >
                  {t('organizer.delete')}
                </Button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={decision.criteria.length >= 20}
              onClick={() =>
                update({
                  ...decision,
                  criteria: [
                    ...decision.criteria,
                    {
                      id: crypto.randomUUID(),
                      name: t('decisionMatrix.criterion', {
                        n: decision.criteria.length + 1,
                      }),
                      weight: 1,
                    },
                  ],
                  options: decision.options.map((option) => ({
                    ...option,
                    scores: [...option.scores, 0],
                  })),
                })
              }
            >
              {t('decisionMatrix.addCriterion')}
            </Button>
            <Button
              variant="outline"
              disabled={decision.options.length >= 30}
              onClick={() =>
                update({
                  ...decision,
                  options: [
                    ...decision.options,
                    {
                      id: crypto.randomUUID(),
                      name: t('decisionMatrix.optionNumber', {
                        n: decision.options.length + 1,
                      }),
                      scores: decision.criteria.map(() => 0),
                    },
                  ],
                })
              }
            >
              {t('decisionMatrix.addOption')}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('decisionMatrix.instructions')}
          </p>
          {totalWeight === 0 && (
            <p role="alert" className="text-sm text-destructive">
              {t('decisionMatrix.noWeight')}
            </p>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('decisionMatrix.option')}</TableHead>
                {decision.criteria.map((criterion) => (
                  <TableHead key={criterion.id}>{criterion.name}</TableHead>
                ))}
                <TableHead>{t('organizer.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {decision.options.map((option) => (
                <TableRow key={option.id}>
                  <TableCell>
                    <Input
                      className="min-w-32"
                      aria-label={t('decisionMatrix.option')}
                      value={option.name}
                      maxLength={120}
                      onChange={(event) =>
                        update({
                          ...decision,
                          options: decision.options.map((item) =>
                            item.id === option.id
                              ? { ...item, name: event.target.value }
                              : item,
                          ),
                        })
                      }
                    />
                  </TableCell>
                  {option.scores.map((score, index) => (
                    <TableCell key={decision.criteria[index].id}>
                      <Input
                        className="min-w-20"
                        aria-label={`${option.name} · ${decision.criteria[index].name}`}
                        type="number"
                        min={0}
                        max={10}
                        step="0.1"
                        value={score}
                        onChange={(event) =>
                          update({
                            ...decision,
                            options: decision.options.map((item) =>
                              item.id === option.id
                                ? {
                                    ...item,
                                    scores: item.scores.map((value, i) =>
                                      i === index
                                        ? Number(event.target.value)
                                        : value,
                                    ),
                                  }
                                : item,
                            ),
                          })
                        }
                      />
                    </TableCell>
                  ))}
                  <TableCell>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        update({
                          ...decision,
                          options: decision.options.filter(
                            (item) => item.id !== option.id,
                          ),
                        })
                      }
                    >
                      {t('organizer.delete')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {totalWeight > 0 && (
            <div className="grid gap-3 md:grid-cols-3">
              {ranked.map((option, index) => (
                <div key={option.id} className="rounded-lg border p-4">
                  <p className="font-semibold">
                    #
                    {ranked.findIndex((item) => item.score === option.score) +
                      1}{' '}
                    {option.name}
                  </p>
                  <p className="text-2xl tabular-nums">
                    {option.score.toFixed(2)} / 10
                  </p>
                  {index === 0 && (
                    <p className="text-sm text-primary">
                      {t('decisionMatrix.top')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </OrganizerFrame>
  );
}
