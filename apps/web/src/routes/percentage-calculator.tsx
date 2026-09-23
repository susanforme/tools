import { MathToolPage } from '@/components/math-tool-page';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/percentage-calculator')({
  component: PercentageCalculatorPage,
});

function PercentageCalculatorPage() {
  return <MathToolPage tool="percentage-calculator" />;
}
