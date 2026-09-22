// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { CodePanelProps } from './code-panel';
import { processJwe } from '@/lib/security-workbench';
import TokenSecurityPanel from './token-security-panel';
vi.mock('@/lib/security-workbench', () => ({
  processJwe: vi.fn(),
  processPaseto: vi.fn(),
}));
vi.mock('./security-text', () => ({
  useSecurityText: () => (key: string) => key,
}));
vi.mock('@/hooks/useQueryParams', async () => {
  const { useState } = await import('react');
  return {
    StringParam: {},
    useQueryParam: (_key: string, _param: unknown, initial: string) =>
      useState(initial),
  };
});
vi.mock('./code-panel', () => ({
  CodePanel: ({ input, output, onInputChange, error }: CodePanelProps) => (
    <>
      <textarea
        aria-label="test-input"
        value={input}
        onChange={(event) => onInputChange(event.target.value)}
      />
      <output data-testid="test-result">{output}</output>
      {error && <p role="alert">{error}</p>}
    </>
  ),
}));
it('discards a pending token result when its input has changed', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof processJwe>>) => void;
  vi.mocked(processJwe).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  render(<TokenSecurityPanel kind="jwe" />);
  fireEvent.change(screen.getByLabelText('test-input'), {
    target: { value: 'first' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'run' }));
  fireEvent.change(screen.getByLabelText('test-input'), {
    target: { value: 'changed' },
  });
  await act(async () => {
    resolve({
      token: 'stale-token',
      parts: {
        protectedHeader: '',
        encryptedKey: '',
        iv: '',
        ciphertext: '',
        authenticationTag: '',
      },
    });
  });
  expect(screen.getByTestId('test-result').textContent).toBe('');
  expect(screen.queryByRole('alert')).toBeNull();
  expect(
    screen.getByRole('button', { name: 'run' }).hasAttribute('disabled'),
  ).toBe(false);
});
