import { MathToolPage } from '@/components/math-tool-page';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/logarithm-calculator')({
  component: LogarithmCalculatorPage,
});

function LogarithmCalculatorPage() {
  return <MathToolPage tool="logarithm-calculator" />;
}
