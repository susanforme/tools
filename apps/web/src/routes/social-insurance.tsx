import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  calculateSocialInsurance,
  type SocialContributionKey,
  type SocialRates,
} from '@/lib/life-calculators';
import { createFileRoute } from '@tanstack/react-router';
import { Landmark } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/social-insurance')({
  component: SocialInsurancePage,
});

const CITY_PRESETS = {
  beijing: {
    source:
      'https://sw.beijing.gov.cn/zwxx/swxx/202505/P020250508344903299439.pdf',
    rates: {
      pension: { personal: 8, employer: 16 },
      medical: { personal: 2, employer: 9.8 },
      unemployment: { personal: 0.5, employer: 0.5 },
      injury: { personal: 0, employer: 0.2 },
      maternity: { personal: 0, employer: 0 },
      housing: { personal: 12, employer: 12 },
      medicalPersonalFixed: 3,
    },
  },
  shanghai: {
    source:
      'https://www.shanghai.gov.cn/gwk/search/content/921e047144694b61b6df8ca0c5ef2cfc',
    rates: {
      pension: { personal: 8, employer: 16 },
      medical: { personal: 2, employer: 9 },
      unemployment: { personal: 0.5, employer: 0.5 },
      injury: { personal: 0, employer: 0.2 },
      maternity: { personal: 0, employer: 0 },
      housing: { personal: 7, employer: 7 },
      medicalPersonalFixed: 0,
    },
  },
  guangzhou: {
    source:
      'https://www.gz.gov.cn/gzybj/gkmlpt/content/8/8689/post_8689835.html',
    rates: {
      pension: { personal: 8, employer: 14 },
      medical: { personal: 2, employer: 6 },
      unemployment: { personal: 0.2, employer: 0.8 },
      injury: { personal: 0, employer: 0.2 },
      maternity: { personal: 0, employer: 0.85 },
      housing: { personal: 5, employer: 5 },
      medicalPersonalFixed: 0,
    },
  },
  shenzhen: {
    source:
      'https://www.sz.gov.cn/szsrmzfxxgk/zc/gz/content/post_10826936.html',
    rates: {
      pension: { personal: 8, employer: 16 },
      medical: { personal: 2, employer: 6 },
      unemployment: { personal: 0.2, employer: 0.8 },
      injury: { personal: 0, employer: 0.14 },
      maternity: { personal: 0, employer: 0.5 },
      housing: { personal: 5, employer: 5 },
      medicalPersonalFixed: 0,
    },
  },
} as const;

type City = keyof typeof CITY_PRESETS;

const money = (value: number) =>
  new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 2,
  }).format(value);

function cloneRates(city: City): SocialRates {
  return structuredClone(CITY_PRESETS[city].rates);
}

function SocialInsurancePage() {
  const { t } = useTranslation();
  const [cityQuery, setCityQuery] = useQueryParam<City>(
    'city',
    StringParam,
    'beijing',
  );
  const city: City = cityQuery in CITY_PRESETS ? cityQuery : 'beijing';
  const [salary, setSalary] = useState('20000');
  const [socialBase, setSocialBase] = useState('20000');
  const [housingBase, setHousingBase] = useState('20000');
  const [rates, setRates] = useState<SocialRates>(() => cloneRates(city));
  const salaryValue = Math.max(0, Number(salary) || 0);
  const result = calculateSocialInsurance(
    Math.max(0, Number(socialBase) || 0),
    Math.max(0, Number(housingBase) || 0),
    rates,
  );

  const selectCity = (nextCity: City) => {
    setCityQuery(nextCity);
    setRates(cloneRates(nextCity));
  };
  const updateRate = (
    key: SocialContributionKey,
    side: 'personal' | 'employer',
    value: string,
  ) => {
    setRates((current) => ({
      ...current,
      [key]: { ...current[key], [side]: Math.max(0, Number(value) || 0) },
    }));
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Landmark className="h-6 w-6 text-violet-500" />
          {t('socialInsurance.title')}
        </h1>
      </div>

      <Card>
        <CardContent className="grid gap-4 py-6 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-2 text-sm font-medium">
            <span>{t('socialInsurance.city')}</span>
            <Select
              value={city}
              onValueChange={(value) => selectCity(value as City)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(CITY_PRESETS).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`socialInsurance.cities.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <MoneyInput
            label={t('socialInsurance.salary')}
            value={salary}
            onChange={setSalary}
          />
          <MoneyInput
            label={t('socialInsurance.socialBase')}
            value={socialBase}
            onChange={setSocialBase}
          />
          <MoneyInput
            label={t('socialInsurance.housingBase')}
            value={housingBase}
            onChange={setHousingBase}
          />
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3">{t('socialInsurance.item')}</th>
              <th className="px-4 py-3">{t('socialInsurance.personalRate')}</th>
              <th className="px-4 py-3">
                {t('socialInsurance.personalAmount')}
              </th>
              <th className="px-4 py-3">{t('socialInsurance.employerRate')}</th>
              <th className="px-4 py-3">
                {t('socialInsurance.employerAmount')}
              </th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <tr key={row.key} className="border-t">
                <td className="px-4 py-3 font-medium">
                  {t(`socialInsurance.items.${row.key}`)}
                </td>
                <td className="px-4 py-2">
                  <RateInput
                    value={rates[row.key].personal}
                    onChange={(value) => updateRate(row.key, 'personal', value)}
                  />
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {money(row.personal)}
                </td>
                <td className="px-4 py-2">
                  <RateInput
                    value={rates[row.key].employer}
                    onChange={(value) => updateRate(row.key, 'employer', value)}
                  />
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {money(row.employer)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {city === 'beijing' && (
        <label className="flex max-w-xs items-center gap-3 text-sm">
          <span>{t('socialInsurance.medicalFixed')}</span>
          <Input
            type="number"
            min="0"
            className="w-28"
            value={rates.medicalPersonalFixed}
            onChange={(event) =>
              setRates((current) => ({
                ...current,
                medicalPersonalFixed: Math.max(
                  0,
                  Number(event.target.value) || 0,
                ),
              }))
            }
          />
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Summary
          label={t('socialInsurance.personalTotal')}
          value={money(result.personalTotal)}
        />
        <Summary
          label={t('socialInsurance.afterContribution')}
          value={money(salaryValue - result.personalTotal)}
        />
        <Summary
          label={t('socialInsurance.employerTotal')}
          value={money(result.employerTotal)}
        />
        <Summary
          label={t('socialInsurance.employerCost')}
          value={money(salaryValue + result.employerTotal)}
        />
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        {t('socialInsurance.note')}{' '}
        <a
          href={CITY_PRESETS[city].source}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4"
        >
          {t('socialInsurance.source')}
        </a>
      </p>
    </div>
  );
}

function MoneyInput({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="space-y-2 text-sm font-medium">
      <span>{label}</span>
      <Input
        type="number"
        min="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function RateInput({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: number;
}) {
  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        min="0"
        step="0.01"
        className="w-24"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="text-muted-foreground">%</span>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xl font-semibold tabular-nums">
        {value}
      </CardContent>
    </Card>
  );
}
