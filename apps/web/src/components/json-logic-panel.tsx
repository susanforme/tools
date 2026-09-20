import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBoundedWorker } from '../hooks/use-bounded-worker';
import type { FormatResult } from '../lib/format-input';
import type { JsonLogicRequest } from '../lib/json-logic-debug';
import { CodePanel } from './code-panel';
import {
  createFormatWorker,
  FormatActions,
  FormatFeedback,
} from './format-workbench';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
export default function JsonLogicPanel() {
  const { t } = useTranslation();
  const [rule, setRule] = useState('');
  const [data, setData] = useState('');
  const task = useBoundedWorker<JsonLogicRequest, FormatResult>(
    createFormatWorker,
    10000,
  );
  return (
    <section className="min-w-0 space-y-4">
      <p className="text-sm text-muted-foreground">{t('jsonLogic.note')}</p>
      <div className="space-y-2">
        <Label htmlFor="logic-rule">{t('jsonLogic.rule')}</Label>
        <Textarea
          id="logic-rule"
          className="min-h-36 font-mono text-xs"
          value={rule}
          onChange={(event) => {
            task.clear();
            setRule(event.target.value);
          }}
          spellCheck={false}
        />
      </div>
      <FormatActions
        busy={task.busy}
        run={() => task.run({ kind: 'logic', rule, data })}
        cancel={task.cancel}
        clear={() => {
          task.clear();
          setRule('');
          setData('');
        }}
        sample={() => {
          task.clear();
          setRule(
            '{"and":[{">=":[{"var":"age"},18]},{"in":[{"var":"country"},["CN","US"]]}]}',
          );
          setData('{"age":25,"country":"CN"}');
        }}
      />
      <FormatFeedback error={task.error} info={task.result?.info} />
      <Label>{t('jsonLogic.data')}</Label>
      <CodePanel
        input={data}
        output={task.result?.output ?? ''}
        language="json"
        onInputChange={(value) => {
          task.clear();
          setData(value);
        }}
      />
    </section>
  );
}
