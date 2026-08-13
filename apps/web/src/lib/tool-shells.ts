export type ToolShell = 'standard' | 'immersive';

export const TOOL_SHELLS: Record<string, ToolShell> = {
  '/video-editor': 'immersive',
};

export function getToolShell(pathname: string): ToolShell {
  return TOOL_SHELLS[pathname] ?? 'standard';
}
