import { ChoiceField } from '@/components/calculator-ui';
import {
  StudyImport,
  StudyPreview,
  StudyText,
} from '@/components/study-tools-ui';
import { Button } from '@/components/ui/button';
import { StringParam, useQueryParams } from '@/hooks/useQueryParams';
import { downloadBlob } from '@/lib/download';
import {
  defaultResume,
  resumePages,
  validateResume,
  type ResumeData,
} from '@/lib/resume-builder';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
export const Route = createFileRoute('/resume-builder')({
  component: ResumeBuilderPage,
});
const KEY = 'tools-resume-draft-v1';
function ResumeBuilderPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    language: string;
    template: string;
  }>({ language: StringParam, template: StringParam });
  const language = query.language === 'en' ? 'en' : 'zh';
  const template = query.template === 'classic' ? 'classic' : 'accent';
  const [data, setData] = useState<ResumeData>(() => defaultResume());
  const dirty = useRef(false);
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setData(validateResume(JSON.parse(raw)));
    } catch {
      setError(t('studyCommon.storageError'));
    }
  }, []);
  useEffect(() => {
    if (!dirty.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      setError(t('studyCommon.storageError'));
    }
  }, [data]);
  const update = (next: ResumeData) => {
    dirty.current = true;
    setData(next);
    setImages([]);
  };
  const move = (index: number, delta: number) => {
    const sections = [...data.sections];
    [sections[index], sections[index + delta]] = [
      sections[index + delta]!,
      sections[index]!,
    ];
    update({ ...data, sections });
  };
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('resumeBuilder.title')}</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        <ChoiceField
          label={t('resumeBuilder.language')}
          value={language}
          options={['zh', 'en'].map((value) => ({
            value,
            label: t(`studyCommon.${value}`),
          }))}
          onChange={(value) => {
            setQuery({ language: value });
            const previous = defaultResume(language).sections;
            const next = defaultResume(value).sections;
            update({
              ...data,
              sections: data.sections.map((section) => ({
                ...section,
                title:
                  next[previous.findIndex((row) => row.title === section.title)]
                    ?.title ?? section.title,
              })),
            });
          }}
        />
        <ChoiceField
          label={t('resumeBuilder.template')}
          value={template}
          options={['classic', 'accent'].map((value) => ({
            value,
            label: t(`resumeBuilder.${value}`),
          }))}
          onChange={(value) => {
            setQuery({ template: value });
            setImages([]);
          }}
        />
        {(['name', 'headline', 'email', 'phone', 'location'] as const).map(
          (key) => (
            <StudyText
              key={key}
              label={t(`resumeBuilder.${key}`)}
              value={data[key]}
              maxLength={300}
              onChange={(value) => update({ ...data, [key]: value })}
            />
          ),
        )}
      </div>
      {data.sections.map((section, index) => (
        <section key={section.id} className="space-y-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1">
              <StudyText
                label={t('resumeBuilder.sectionTitle')}
                value={section.title}
                maxLength={100}
                onChange={(value) =>
                  update({
                    ...data,
                    sections: data.sections.map((row) =>
                      row.id === section.id ? { ...row, title: value } : row,
                    ),
                  })
                }
              />
            </div>
            <Button
              variant="outline"
              disabled={!index}
              aria-label={t('studyCommon.up')}
              onClick={() => move(index, -1)}
            >
              ↑
            </Button>
            <Button
              variant="outline"
              disabled={index === data.sections.length - 1}
              aria-label={t('studyCommon.down')}
              onClick={() => move(index, 1)}
            >
              ↓
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                update({
                  ...data,
                  sections: data.sections.filter(
                    (row) => row.id !== section.id,
                  ),
                })
              }
            >
              {t('studyCommon.remove')}
            </Button>
          </div>
          <StudyText
            label={t('resumeBuilder.content')}
            multiline
            maxLength={15000}
            value={section.body}
            onChange={(value) =>
              update({
                ...data,
                sections: data.sections.map((row) =>
                  row.id === section.id ? { ...row, body: value } : row,
                ),
              })
            }
          />
        </section>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={data.sections.length >= 20}
          onClick={() =>
            update({
              ...data,
              sections: [
                ...data.sections,
                {
                  id: crypto.randomUUID(),
                  title: t('resumeBuilder.newSection'),
                  body: '',
                },
              ],
            })
          }
        >
          {t('resumeBuilder.addSection')}
        </Button>
        <Button
          onClick={() => {
            setError(null);
            try {
              setImages(resumePages(data, template === 'accent'));
            } catch (cause) {
              setError(
                t(`studyCommon.${(cause as Error).message}`, {
                  defaultValue: t('studyCommon.generateError'),
                }),
              );
            }
          }}
        >
          {t('studyCommon.generate')}
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            downloadBlob(
              new Blob(
                [JSON.stringify({ version: 1, resume: data }, null, 2)],
                { type: 'application/json' },
              ),
              'resume-backup.json',
            )
          }
        >
          {t('studyCommon.backup')}
        </Button>
      </div>
      <StudyImport
        json
        onText={(source) => {
          try {
            const parsed: unknown = JSON.parse(source);
            if (
              typeof parsed !== 'object' ||
              parsed === null ||
              !('version' in parsed) ||
              parsed.version !== 1 ||
              !('resume' in parsed)
            )
              throw new Error('backupError');
            const next = validateResume(parsed.resume);
            update(next);
            setError(null);
          } catch {
            setError(t('studyCommon.backupError'));
          }
        }}
      />
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <StudyPreview images={images} filename="resume-A4.pdf" />
    </div>
  );
}
