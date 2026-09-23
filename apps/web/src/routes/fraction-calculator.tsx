import { MathToolPage } from '@/components/math-tool-page';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/fraction-calculator')({
  component: FractionCalculatorPage,
});

function FractionCalculatorPage() {
  return <MathToolPage tool="fraction-calculator" />;
}
