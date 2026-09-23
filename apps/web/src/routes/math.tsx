import { ChoiceField } from '@/components/calculator-ui';
import { MathToolPage } from '@/components/math-tool-page';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { MATH_TOOLS } from '@/lib/math-tool-catalog';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/math')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: MathPage,
});
function MathPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    tool: string;
    mode: string;
    digits: number;
    places: number;
  }>({
    tool: StringParam,
    mode: StringParam,
    digits: NumberParam,
    places: NumberParam,
  });
  const selected =
    MATH_TOOLS.find(({ id }) => id === query.tool) ?? MATH_TOOLS[0];
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('mathTools.title')}</h1>
      <ChoiceField
        label={t('mathTools.selectTool')}
        value={selected.id}
        options={MATH_TOOLS.map(({ id }) => ({
          value: id,
          label: t(`mathTools.tools.${id}.title`),
        }))}
        onChange={(tool) =>
          setQuery({
            tool,
            mode: undefined,
            digits: undefined,
            places: undefined,
          })
        }
      />
      <MathToolPage key={selected.id} tool={selected.id} />
    </div>
  );
}
