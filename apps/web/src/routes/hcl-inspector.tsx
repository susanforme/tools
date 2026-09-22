import { createFileRoute } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CodePanel } from '../components/code-panel';
import { Button } from '../components/ui/button';
export const Route = createFileRoute('/hcl-inspector')({ component: HclPage });
function HclPage() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const invalidate = () => {
    generation.current++;
    setOutput('');
    setError(null);
    setLoading(false);
  };
  const run = async () => {
    const version = ++generation.current;
    setLoading(true);
    setError(null);
    setOutput('');
    try {
      const { inspectHcl } = await import('../lib/hcl-inspector');
      const result = await inspectHcl(input);
      if (version === generation.current)
        setOutput(JSON.stringify(result, null, 2));
    } catch (cause) {
      if (version === generation.current)
        setError(
          t('dataTools.failed', {
            defaultValue: '处理失败：{{message}}',
            message: (cause as Error).message,
          }),
        );
    } finally {
      if (version === generation.current) setLoading(false);
    }
  };
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">
        {t('dataTools.hclTitle', { defaultValue: 'HCL / Terraform 配置检查' })}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t('dataTools.hclLimit', {
          defaultValue:
            '最多 200 KB。检查 HCL 语法、块结构与资源清单，不执行表达式或 Terraform 部署。',
        })}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={loading} onClick={run}>
          {loading
            ? t('dataTools.processing', { defaultValue: '处理中…' })
            : t('dataTools.inspect', { defaultValue: '检查' })}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            invalidate();
            setInput(
              'variable "name" {\n  type = string\n  default = "demo"\n}\nresource "aws_s3_bucket" "assets" {\n  bucket = var.name\n}\noutput "bucket_id" {\n  value = aws_s3_bucket.assets.id\n}',
            );
          }}
        >
          {t('dataTools.sample', { defaultValue: '填入示例' })}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            invalidate();
            setInput('');
          }}
        >
          {t('dataTools.clear', { defaultValue: '清空' })}
        </Button>
      </div>
      <CodePanel
        input={input}
        output={output}
        onInputChange={(value) => {
          invalidate();
          setInput(value);
        }}
        error={error}
        language="hcl"
        outputLanguage="json"
      />
    </div>
  );
}
