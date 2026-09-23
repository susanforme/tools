import { MathToolPage } from '@/components/math-tool-page';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/matrix-calculator')({
  component: MatrixCalculatorPage,
});

function MatrixCalculatorPage() {
  return <MathToolPage tool="matrix-calculator" />;
}
