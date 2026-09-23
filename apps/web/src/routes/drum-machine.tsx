import { createFileRoute } from '@tanstack/react-router';
import { DrumMachine } from '@/components/practical-music';
export const Route = createFileRoute('/drum-machine')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: () => <DrumMachine />,
});
