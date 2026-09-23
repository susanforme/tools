import { MathToolPage } from '@/components/math-tool-page';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/prime-factorization')({
  component: PrimeFactorizationPage,
});

function PrimeFactorizationPage() {
  return <MathToolPage tool="prime-factorization" />;
}
