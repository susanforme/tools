import DigitalCircuit from '@/components/digital-circuit-workspace';
import { ChoiceField } from '@/components/calculator-ui';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnalysisFrame } from '@/components/analysis-tool-ui';
import { PracticalText, ExportText } from '@/components/practical-ui';
import { analyzeLogic, karnaughRows } from '@/lib/analysis-logic';
export const Route = createFileRoute('/logic-workbench')({
  component: LogicModes,
  validateSearch: (search: Record<string, unknown>) => search,
});
function LogicWorkbench() {
  const { t } = useTranslation();
  const [input, setInput] = useState('(A & B) | (A & !B)');
  const [compare, setCompare] = useState('A');
  const result = useMemo(() => {
    try {
      return { data: analyzeLogic(input, compare), error: null };
    } catch (cause) {
      return { data: null, error: (cause as Error).message };
    }
  }, [input, compare]);
  const data = result.data;
  const map = data ? karnaughRows(data.variables.length) : null;
  return (
    <AnalysisFrame tool="logic" error={result.error}>
      <p className="text-sm text-muted-foreground">
        {t('analysisTools.logic.syntax')}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <PracticalText
          label={t('analysisTools.logic.expression')}
          value={input}
          onChange={setInput}
          maxLength={1000}
        />
        <PracticalText
          label={t('analysisTools.logic.compare')}
          value={compare}
          onChange={setCompare}
          maxLength={1000}
        />
      </div>
      {data && (
        <>
          <section className="space-y-2 rounded border p-4">
            <h2 className="font-semibold">{t('analysisTools.logic.simplified')}</h2>
            <code className="break-all">{data.simplified}</code>
            <p className="text-sm text-muted-foreground">
              {t('analysisTools.logic.coverNote')}
            </p>
            {data.equivalent !== null && (
              <p>
                {t(
                  data.equivalent
                    ? 'analysisTools.logic.equivalent'
                    : 'analysisTools.logic.different',
                )}
              </p>
            )}
            <ExportText
              value={JSON.stringify(data, null, 2)}
              name="logic.json"
              type="application/json"
            />
          </section>
          <section className="overflow-auto">
            <h2 className="mb-2 font-semibold">{t('analysisTools.logic.truth')}</h2>
            <table className="w-full text-center text-sm">
              <thead>
                <tr>
                  {data.variables.map((name) => (
                    <th className="border p-2" key={name}>
                      {name}
                    </th>
                  ))}
                  <th className="border p-2">F</th>
                  {data.equivalent !== null && (
                    <th className="border p-2">G</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, index) => (
                  <tr
                    key={index}
                    className={
                      row.comparison !== null && row.output !== row.comparison
                        ? 'bg-destructive/10'
                        : ''
                    }
                  >
                    {data.variables.map((name) => (
                      <td key={name} className="border p-2">
                        {Number(row.values[name])}
                      </td>
                    ))}
                    <td className="border p-2">{Number(row.output)}</td>
                    {row.comparison !== null && (
                      <td className="border p-2">{Number(row.comparison)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          {map && data.variables.length >= 2 && data.variables.length <= 4 && (
            <section className="overflow-auto">
              <h2 className="mb-2 font-semibold">
                {t('analysisTools.logic.kmap')}
              </h2>
              <table className="w-full text-center">
                <thead>
                  <tr>
                    <th className="border p-2">
                      {data.variables.slice(0, map.rowBits).join('')} /{' '}
                      {data.variables.slice(map.rowBits).join('')}
                    </th>
                    {map.columns.map((col) => (
                      <th className="border p-2" key={col}>
                        {col.toString(2).padStart(map.columnBits, '0')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {map.rows.map((row) => (
                    <tr key={row}>
                      <th className="border p-2">
                        {row.toString(2).padStart(map.rowBits, '0')}
                      </th>
                      {map.columns.map((col) => {
                        const value =
                          data.rows[(row << map.columnBits) | col].output;
                        return (
                          <td
                            className={`border p-4 ${value ? 'bg-primary/15 font-bold' : ''}`}
                            key={col}
                          >
                            {Number(value)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </AnalysisFrame>
  );
}

function LogicModes() {
  const { t } = useTranslation();
  const [workspace, set] = useQueryParam<string>(
    'workspace',
    StringParam,
    'logic',
  );
  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-6">
        <ChoiceField
          label={t('scienceExpansion.mode')}
          value={workspace === 'circuit' ? 'circuit' : 'logic'}
          options={[
            { value: 'logic', label: t('scienceExpansion.originalLogic') },
            { value: 'circuit', label: t('scienceExpansion.circuit.title') },
          ]}
          onChange={set}
        />
      </div>
      {workspace === 'circuit' ? <DigitalCircuit /> : <LogicWorkbench />}
    </>
  );
}
