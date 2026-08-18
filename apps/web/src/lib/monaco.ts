import { loader } from '@monaco-editor/react';
import { MONACO_VS_CDN_BASE } from './runtime-assets';
import { MONACO_ENVIRONMENT } from './monaco-environment';

let monacoPromise: Promise<typeof import('monaco-editor')> | null = null;

export function loadMonaco(): Promise<typeof import('monaco-editor')> {
  if (!monacoPromise) {
    monacoPromise = import('monaco-editor').then((monaco) => {
      loader.config({ monaco, paths: { vs: MONACO_VS_CDN_BASE } });
      return loader.init().then(() => {
        if (typeof self !== 'undefined') {
          self.MonacoEnvironment = MONACO_ENVIRONMENT;
        }
        return monaco;
      });
    });
  }
  return monacoPromise;
}
