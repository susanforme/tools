import { MathToolPage } from '@/components/math-tool-page';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/triangle-calculator')({
  component: TriangleCalculatorPage,
});

function TriangleCalculatorPage() {
  return <MathToolPage tool="triangle-calculator" />;
}
