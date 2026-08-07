import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { compareVersions, mergeGitignore } from '@/lib/developer-tools';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';

export const Route = createFileRoute('/git-tool')({ component: GitToolPage });

type Mode = 'ignore' | 'commit' | 'version';
const COMMIT_TYPES = [
  'feat',
  'fix',
  'docs',
  'refactor',
  'test',
  'build',
  'chore',
];

function GitToolPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<Mode>('mode', StringParam, 'ignore');
  const [left, setLeft] = useState('node_modules\n.env\ndist');
  const [right, setRight] = useState('.env\ncoverage\n.DS_Store');
  const [type, setType] = useState('feat');
  const [scope, setScope] = useState('web');
  const [description, setDescription] = useState('add developer tools');
  const [breaking, setBreaking] = useState('');
  const [versionA, setVersionA] = useState('1.2.3');
  const [versionB, setVersionB] = useState('2.0.0-beta.1');
  const output = useMemo(() => {
    if (mode === 'ignore') return mergeGitignore([left, right]);
    if (mode === 'commit') {
      const header = `${type}${scope ? `(${scope})` : ''}: ${description}`;
      return breaking ? `${header}\n\nBREAKING CHANGE: ${breaking}` : header;
    }
    try {
      const result = compareVersions(versionA, versionB);
      return result === 0
        ? `${versionA} = ${versionB}`
        : result < 0
          ? `${versionA} < ${versionB}`
          : `${versionA} > ${versionB}`;
    } catch {
      return t('gitTool.invalidVersion');
    }
  }, [
    breaking,
    description,
    left,
    mode,
    right,
    scope,
    t,
    type,
    versionA,
    versionB,
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('gitTool.title')}</h1>
      <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
        <TabsList>
          <TabsTrigger value="ignore">.gitignore</TabsTrigger>
          <TabsTrigger value="commit">Conventional Commit</TabsTrigger>
          <TabsTrigger value="version">SemVer</TabsTrigger>
        </TabsList>
      </Tabs>
      {mode === 'ignore' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Textarea
            value={left}
            onChange={(event) => setLeft(event.target.value)}
            className="min-h-64 font-mono text-xs"
          />
          <Textarea
            value={right}
            onChange={(event) => setRight(event.target.value)}
            className="min-h-64 font-mono text-xs"
          />
        </div>
      )}
      {mode === 'commit' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMIT_TYPES.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={scope}
            onChange={(event) => setScope(event.target.value)}
            placeholder={t('gitTool.scope')}
          />
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t('gitTool.description')}
            className="sm:col-span-2"
          />
          <Input
            value={breaking}
            onChange={(event) => setBreaking(event.target.value)}
            placeholder={t('gitTool.breaking')}
            className="sm:col-span-2"
          />
        </div>
      )}
      {mode === 'version' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            value={versionA}
            onChange={(event) => setVersionA(event.target.value)}
          />
          <Input
            value={versionB}
            onChange={(event) => setVersionB(event.target.value)}
          />
        </div>
      )}
      <Textarea
        readOnly
        value={output}
        className="min-h-48 font-mono text-xs"
      />
    </div>
  );
}
