import { importRuntimeModule } from './runtime-assets';

type SassModule = typeof import('sass');

type SassLibrary = {
  load(
    dependencies: { immutable: typeof import('immutable') },
    exports: Record<string, unknown>,
  ): void;
};

declare global {
  var _cliPkgExports: SassLibrary[] | undefined;
}

let sassReady: Promise<SassModule> | null = null;

export function loadSass(): Promise<SassModule> {
  sassReady ??= Promise.all([
    importRuntimeModule<typeof import('immutable')>('immutableModule'),
    importRuntimeModule<Record<string, never>>('sassDart'),
  ]).then(([immutable]) => {
    const library = globalThis._cliPkgExports?.pop();
    if (!library) throw new Error('SASS_RUNTIME_FAILED');
    if (globalThis._cliPkgExports?.length === 0) {
      delete globalThis._cliPkgExports;
    }
    const exports: Record<string, unknown> = {};
    library.load({ immutable }, exports);
    return exports as SassModule;
  });
  return sassReady;
}
