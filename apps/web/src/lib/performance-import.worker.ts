import { parseAxTree, type AxRow } from './ax-tree-import';
import {
  compareCoverage,
  parseChromeCoverage,
  type CoverageFile,
} from './coverage-import';
import { decodePprof, type PprofResult } from './pprof-import';
import { parseReactProfiler, type ReactProfile } from './react-profiler-import';
export type ImportKind = 'coverage' | 'react' | 'pprof' | 'ax';
export type ImportRequest = {
  kind: ImportKind;
  text: string;
  comparison: string;
  bytes: Uint8Array | null;
};
export type ImportResult =
  | {
      kind: 'coverage';
      files: CoverageFile[];
      comparison: ReturnType<typeof compareCoverage> | null;
    }
  | { kind: 'react'; data: ReactProfile }
  | { kind: 'pprof'; data: PprofResult }
  | { kind: 'ax'; nodes: AxRow[] };
self.onmessage = async (event: MessageEvent<ImportRequest>) => {
  try {
    const { kind, text, comparison, bytes } = event.data;
    let result: ImportResult;
    if (kind === 'coverage') {
      const files = parseChromeCoverage(text);
      result = {
        kind,
        files,
        comparison: comparison.trim()
          ? compareCoverage(files, parseChromeCoverage(comparison))
          : null,
      };
    } else if (kind === 'react')
      result = { kind, data: parseReactProfiler(text) };
    else if (kind === 'ax') result = { kind, nodes: parseAxTree(text) };
    else {
      if (!bytes) throw new Error('chooseFile');
      result = { kind, data: await decodePprof(bytes) };
    }
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: (error as Error).message });
  }
};
