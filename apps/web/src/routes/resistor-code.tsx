import { createFileRoute } from '@tanstack/react-router';
import { ResistorCode } from '@/components/practical-calculators';
import { ElectricalPanel } from '@/components/electrical-panel';
import { ChoiceField } from '@/components/calculator-ui';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { useTranslation } from 'react-i18next';
export const Route = createFileRoute('/resistor-code')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: ResistorToolbox,
});
function ResistorToolbox() {
  const { t } = useTranslation();
  const [section, set] = useQueryParam<string>(
    'section',
    StringParam,
    'resistor',
  );
  return (
    <>
      <div className="mx-auto max-w-4xl px-4 pt-6">
        <ChoiceField
          label={t('batch3Calc.mode')}
          value={section === 'electrical' ? 'electrical' : 'resistor'}
          options={['resistor', 'electrical'].map((value) => ({
            value,
            label: t(`batch3Calc.${value}`),
          }))}
          onChange={set}
        />
      </div>
      {section === 'electrical' ? <ElectricalPanel /> : <ResistorCode />}
    </>
  );
}
