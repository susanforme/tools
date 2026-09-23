import { MathToolPage } from '@/components/math-tool-page';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/rounding-calculator')({
  component: RoundingCalculatorPage,
});

function RoundingCalculatorPage() {
  return <MathToolPage tool="rounding-calculator" />;
}
