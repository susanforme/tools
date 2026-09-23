import { MediaWorkspaceSelector } from '@/components/media-workspace-selector';
import { createFileRoute } from '@tanstack/react-router';
import { PianoTool } from '@/components/practical-music';
export const Route = createFileRoute('/piano')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: () => (
    <MediaWorkspaceSelector kind="score" original={<PianoTool />} />
  ),
});
