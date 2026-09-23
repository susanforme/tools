import { MathToolPage } from '@/components/math-tool-page';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/quadratic-equation')({
  component: QuadraticEquationPage,
});

function QuadraticEquationPage() {
  return <MathToolPage tool="quadratic-equation" />;
}
