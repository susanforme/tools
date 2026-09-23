import { ScienceFrame } from '@/components/science-workspace-ui';
import { ChoiceField, NumberField } from '@/components/calculator-ui';
import { Button } from '@/components/ui/button';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { packagingPdf } from '@/lib/analysis-packaging';
import { sewingPattern } from '@/lib/sewing-patterns';
import { downloadBytes } from '@/lib/download';
import { createFileRoute } from '@tanstack/react-router';
import { useLatestJob } from '@/components/practical-ui';
import { useTranslation } from 'react-i18next';
export const Route = createFileRoute('/sewing-pattern')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: SewingPattern,
});
const FIELDS = {
  waist: 72,
  hip: 96,
  length: 60,
  width: 60,
  bust: 90,
  ease: 4,
  seam: 1,
  strap: 65,
};
function SewingPattern() {
  const { t } = useTranslation(),
    label = (key: string) => t(`scienceTools.${key}`);
  const [q, set] = useQueryParams<{
    kind: string;
    paper: string;
    waist: number;
    hip: number;
    length: number;
    width: number;
    bust: number;
    ease: number;
    seam: number;
    strap: number;
  }>({
    kind: StringParam,
    paper: StringParam,
    waist: NumberParam,
    hip: NumberParam,
    length: NumberParam,
    width: NumberParam,
    bust: NumberParam,
    ease: NumberParam,
    seam: NumberParam,
    strap: NumberParam,
  });
  const kind = ['skirt', 'apron', 'bag'].includes(q.kind ?? '')
      ? q.kind!
      : 'skirt',
    paper = q.paper === 'actual' ? 'actual' : 'a4';
  const job = useLatestJob<Uint8Array>(JSON.stringify(q));
  let plan: ReturnType<typeof sewingPattern> | null = null,
    error: string | null = null;
  try {
    plan = sewingPattern(
      kind,
      ...((Object.keys(FIELDS) as Array<keyof typeof FIELDS>).map(
        (k) => q[k] ?? FIELDS[k],
      ) as [number, number, number, number, number, number, number, number]),
    );
  } catch (cause) {
    error = (cause as Error).message;
  }
  const active =
    kind === 'skirt'
      ? ['waist', 'hip', 'length', 'ease', 'seam']
      : kind === 'apron'
        ? ['waist', 'bust', 'length', 'width', 'seam', 'strap']
        : ['length', 'width', 'seam', 'strap'];
  return (
    <ScienceFrame tool="sewing" error={error ?? job.error}>
      <ChoiceField
        label={label('pattern')}
        value={kind}
        options={['skirt', 'apron', 'bag'].map((value) => ({
          value,
          label: label(value),
        }))}
        onChange={(kind) => set({ kind })}
      />
      <div className="grid gap-3 md:grid-cols-3">
        {(Object.keys(FIELDS) as Array<keyof typeof FIELDS>)
          .filter((k) => active.includes(k))
          .map((key) => (
            <NumberField
              key={key}
              label={label(key)}
              value={q[key] ?? FIELDS[key]}
              step={0.1}
              onChange={(value) => set({ [key]: value })}
            />
          ))}
      </div>
      <p className="text-sm text-muted-foreground">{label(`${kind}Hint`)}</p>
      <p className="text-sm text-muted-foreground">{label('patternHint')}</p>
      <ChoiceField
        label={label('paper')}
        value={paper}
        options={['a4', 'actual'].map((value) => ({
          value,
          label: label(value),
        }))}
        onChange={(paper) => set({ paper })}
      />
      <div className="flex gap-2">
        <Button
          disabled={!plan || job.busy}
          onClick={() => {
            if (plan) void job.run(() => packagingPdf(plan, paper === 'a4'));
          }}
        >
          {label('print')}
        </Button>
        {job.result && (
          <Button
            variant="outline"
            onClick={() => {
              if (job.result)
                downloadBytes(
                  job.result,
                  `${kind}-pattern.pdf`,
                  'application/pdf',
                );
            }}
          >
            {label('download')}
          </Button>
        )}
      </div>
      {plan && (
        <svg
          role="img"
          aria-label={label('pattern')}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${plan.width} ${plan.height}`}
          className="max-h-[700px] w-full rounded border bg-white"
        >
          {plan.lines.map((l, i) => (
            <line
              key={i}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke={l.fold ? '#2659cc' : '#cc2626'}
              strokeWidth={0.6}
              strokeDasharray={l.fold ? '3 2' : undefined}
            />
          ))}
          {plan.labels.map((l, i) => (
            <text
              key={i}
              x={l.x}
              y={l.y}
              textAnchor="middle"
              fontSize={5}
              fill="#111827"
            >
              {l.text}
            </text>
          ))}
        </svg>
      )}
    </ScienceFrame>
  );
}
