import { MathToolPage } from '@/components/math-tool-page';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/power-root')({
  component: PowerRootPage,
});

function PowerRootPage() {
  return <MathToolPage tool="power-root" />;
}
