// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { createInstance } from 'i18next';
import type { ComponentType } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, expect, it, vi } from 'vitest';
import { studyToolsZh } from '@/i18n/locales/study-tools';
import { Route as ResumeRoute } from '@/routes/resume-builder';
import { Route as FlashRoute } from '@/routes/flashcards';
vi.mock('@/hooks/useQueryParams', () => ({
  StringParam: {},
  useQueryParams: () => [{}, vi.fn()],
}));
const i18n = createInstance();
await i18n.init({
  lng: 'zh',
  resources: { zh: { translation: studyToolsZh } },
  interpolation: { escapeValue: false },
});
const Resume = ResumeRoute.options.component as ComponentType;
const Flash = FlashRoute.options.component as ComponentType;
afterEach(() => {
  cleanup();
  localStorage.clear();
});
it('keeps a damaged resume draft intact until the user edits, then restores the saved edit', () => {
  localStorage.setItem('tools-resume-draft-v1', '{damaged');
  const view = render(
    <I18nextProvider i18n={i18n}>
      <Resume />
    </I18nextProvider>,
  );
  expect(localStorage.getItem('tools-resume-draft-v1')).toBe('{damaged');
  fireEvent.change(screen.getByLabelText('姓名'), {
    target: { value: '张三' },
  });
  expect(JSON.parse(localStorage.getItem('tools-resume-draft-v1')!).name).toBe(
    '张三',
  );
  view.unmount();
  render(
    <I18nextProvider i18n={i18n}>
      <Resume />
    </I18nextProvider>,
  );
  expect((screen.getByLabelText('姓名') as HTMLInputElement).value).toBe(
    '张三',
  );
});
it('keeps damaged flashcards intact and saves only a successfully imported deck', async () => {
  localStorage.setItem('tools-flashcards-v1', '{damaged');
  render(
    <I18nextProvider i18n={i18n}>
      <Flash />
    </I18nextProvider>,
  );
  expect(localStorage.getItem('tools-flashcards-v1')).toBe('{damaged');
  fireEvent.change(screen.getByLabelText('新卡组名称'), {
    target: { value: 'Words' },
  });
  fireEvent.change(
    screen.getByLabelText('问题,答案（CSV）或问题与答案用 Tab 分隔'),
    { target: { value: 'cat,猫' } },
  );
  fireEvent.click(screen.getByRole('button', { name: '创建卡组' }));
  await waitFor(() =>
    expect(
      JSON.parse(localStorage.getItem('tools-flashcards-v1')!).decks[0].cards[0]
        .back,
    ).toBe('猫'),
  );
  expect(
    (screen.getByRole('button', { name: '记住了' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '显示答案' }));
  fireEvent.click(screen.getByRole('button', { name: '记住了' }));
  const saved = JSON.parse(localStorage.getItem('tools-flashcards-v1')!);
  expect(saved.decks[0].cards[0].reviews).toBe(1);
  expect(saved.decks[0].cards[0].due).toBeGreaterThan(Date.now());
  expect(screen.getByText('本轮复习已完成')).toBeTruthy();
});
