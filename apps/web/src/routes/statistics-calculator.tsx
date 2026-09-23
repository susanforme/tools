import { MathToolPage } from '@/components/math-tool-page';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/statistics-calculator')({
  component: StatisticsCalculatorPage,
});

function StatisticsCalculatorPage() {
  return <MathToolPage tool="statistics-calculator" />;
}
