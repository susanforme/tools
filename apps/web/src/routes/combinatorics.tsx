import { MathToolPage } from '@/components/math-tool-page';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/combinatorics')({
  component: CombinatoricsPage,
});

function CombinatoricsPage() {
  return <MathToolPage tool="combinatorics" />;
}
