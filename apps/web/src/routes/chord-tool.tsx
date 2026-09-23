import { createFileRoute } from '@tanstack/react-router';
import { ChordTool } from '@/components/practical-music';
export const Route = createFileRoute('/chord-tool')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: () => <ChordTool />,
});
