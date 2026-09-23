import { MathToolPage } from '@/components/math-tool-page';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/probability-calculator')({
  component: ProbabilityCalculatorPage,
});

function ProbabilityCalculatorPage() {
  return <MathToolPage tool="probability-calculator" />;
}
