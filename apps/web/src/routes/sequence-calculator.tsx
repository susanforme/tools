import { MathToolPage } from '@/components/math-tool-page';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/sequence-calculator')({
  component: SequenceCalculatorPage,
});

function SequenceCalculatorPage() {
  return <MathToolPage tool="sequence-calculator" />;
}
