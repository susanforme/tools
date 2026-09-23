import { MediaWorkspaceSelector } from '@/components/media-workspace-selector';
import { ToolExtensionSelector } from '@/components/tool-extension-selector';
import { createFileRoute } from '@tanstack/react-router';
import { PianoTool } from '@/components/practical-music';
export const Route = createFileRoute('/piano')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: () => (
    <ToolExtensionSelector
      panels={['midi']}
      base={<MediaWorkspaceSelector kind="score" original={<PianoTool />} />}
    />
  ),
});
