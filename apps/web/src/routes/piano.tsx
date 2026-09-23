import { MediaWorkspace } from '@/components/batch4-media-workspace';
import { createFileRoute } from '@tanstack/react-router';
import { PianoTool } from '@/components/practical-music';
export const Route = createFileRoute('/piano')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: () => <MediaWorkspace kind="midi" original={<PianoTool />} />,
});
