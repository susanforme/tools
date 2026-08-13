import { expect, test } from 'vitest';
import { getToolShell } from './tool-shells';

test('uses the immersive shell only for configured tools', () => {
  expect(getToolShell('/video-editor')).toBe('immersive');
  expect(getToolShell('/json')).toBe('standard');
});
