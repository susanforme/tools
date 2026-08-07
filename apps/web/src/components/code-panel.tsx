import { useTranslation } from 'react-i18next';
import { MonacoTextEditor } from './monaco-editor';

export interface CodePanelProps {
  input: string;
  output: string;
  onInputChange: (v: string) => void;
  inputPlaceholder?: string;
  error?: string | null;
  language?: string;
  /** 输出面板使用不同语言（如 SCSS→CSS），默认与 language 相同 */
  outputLanguage?: string;
}

export function CodePanel({
  input,
  output,
  onInputChange,
  inputPlaceholder: _inputPlaceholder,
  error,
  language = 'plaintext',
  outputLanguage,
}: CodePanelProps) {
  const { t } = useTranslation();
  const resolvedOutputLanguage = outputLanguage ?? language;
  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MonacoTextEditor
          label={t('panel.input')}
          language={language}
          value={input}
          onChange={onInputChange}
        />
        <MonacoTextEditor
          readOnly
          label={t('panel.output')}
          language={resolvedOutputLanguage}
          value={output}
        />
      </div>
    </div>
  );
}
