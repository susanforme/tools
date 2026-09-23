import { MathToolPage } from '@/components/math-tool-page';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/binomial-distribution')({
  component: BinomialDistributionPage,
});

function BinomialDistributionPage() {
  return <MathToolPage tool="binomial-distribution" />;
}
