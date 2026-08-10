import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { SemverRangePanel } from '@/components/extra-tool-panels';
import {
  EDITORCONFIG_TEMPLATES,
  GITIGNORE_TEMPLATES,
} from '@/lib/dev-config-templates';
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

type Mode = 'ignore' | 'commit' | 'version' | 'range' | 'editorconfig';
const COMMIT_TYPES = [
  'feat',
  'fix',
  'docs',
  'refactor',
  'test',
  'build',
  'chore',
];
const GITIGNORE_KEYS = Object.keys(GITIGNORE_TEMPLATES);
const EDITORCONFIG_KEYS = Object.keys(EDITORCONFIG_TEMPLATES);

function GitToolPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<Mode>('mode', StringParam, 'ignore');
  const [left, setLeft] = useState('node_modules\n.env\ndist');
  const [right, setRight] = useState('.env\ncoverage\n.DS_Store');
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [editorconfigKey, setEditorconfigKey] = useState(
    EDITORCONFIG_KEYS[0] ?? 'default',
  );
  const [type, setType] = useState('feat');
  const [scope, setScope] = useState('web');
  const [description, setDescription] = useState('add developer tools');
  const [breaking, setBreaking] = useState('');
  const [versionA, setVersionA] = useState('1.2.3');
  const [versionB, setVersionB] = useState('2.0.0-beta.1');

  const toggleTemplate = (key: string) => {
    setSelectedTemplates((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  };

  const output = useMemo(() => {
    if (mode === 'ignore') {
      const templates = selectedTemplates
        .map((key) => GITIGNORE_TEMPLATES[key])
        .filter((content): content is string => Boolean(content));
      return mergeGitignore([...templates, left, right]);
    }
    if (mode === 'editorconfig') {
      return EDITORCONFIG_TEMPLATES[editorconfigKey] ?? '';
    }
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
    editorconfigKey,
    left,
    mode,
    right,
    scope,
    selectedTemplates,
    t,
    type,
    versionA,
    versionB,
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('gitTool.title')}</h1>
      <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="ignore">.gitignore</TabsTrigger>
          <TabsTrigger value="commit">Conventional Commit</TabsTrigger>
          <TabsTrigger value="version">SemVer</TabsTrigger>
          <TabsTrigger value="range">SemVer Range</TabsTrigger>
          <TabsTrigger value="editorconfig">.editorconfig</TabsTrigger>
        </TabsList>
      </Tabs>
      {mode === 'ignore' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            {GITIGNORE_KEYS.map((key) => (
              <label
                key={key}
                className="flex items-center gap-1.5 text-sm cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={selectedTemplates.includes(key)}
                  onChange={() => toggleTemplate(key)}
                  className="rounded"
                />
                {key}
              </label>
            ))}
          </div>
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
        </div>
      )}
      {mode === 'editorconfig' && (
        <Select value={editorconfigKey} onValueChange={setEditorconfigKey}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EDITORCONFIG_KEYS.map((key) => (
              <SelectItem key={key} value={key}>
                {key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      {mode === 'range' && <SemverRangePanel />}
      {mode !== 'range' && (
        <Textarea
          readOnly
          value={output}
          className="min-h-48 font-mono text-xs"
        />
      )}
    </div>
  );
}
